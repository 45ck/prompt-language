/**
 * Advance-flow — node advancement and flow completion logic.
 *
 * Extracted from inject-context.ts to isolate advancement concerns.
 */

import {
  advanceNode,
  updateVariable,
  updateNodeProgress,
  updateSpawnedChild,
  updateRaceChildren,
  addWarning,
  markCompleted,
  allGatesPassing,
  markFailed,
} from '../domain/session-state.js';
import type { SessionState } from '../domain/session-state.js';
import type {
  FlowNode,
  LetNode,
  RunNode,
  BreakNode,
  ContinueNode,
  SpawnNode,
  AwaitNode,
  WhileNode,
  UntilNode,
  RetryNode,
  ForeachNode,
  ApproveNode,
  ReviewNode,
  RaceNode,
  ForeachSpawnNode,
  RememberNode,
  SendNode,
  ReceiveNode,
} from '../domain/flow-node.js';
import type { MemoryEntry } from './ports/memory-store.js';
import type { CommandRunner } from './ports/command-runner.js';
import type { CaptureReader } from './ports/capture-reader.js';
import { CAPTURE_PENDING_SENTINEL } from './ports/capture-reader.js';
import type { ProcessSpawner } from './ports/process-spawner.js';
import type { AuditLogger } from './ports/audit-logger.js';
import type { MemoryStore } from './ports/memory-store.js';
import type { MessageStore } from './ports/message-store.js';
import { interpolate, shellInterpolate } from '../domain/interpolate.js';
import { evaluateCondition } from '../domain/evaluate-condition.js';
import { resolveBuiltinCommand, isInvertedPredicate } from './evaluate-completion.js';
import { splitIterable } from '../domain/split-iterable.js';
import { initEmptyList, appendToList, listLength } from '../domain/list-variable.js';
import {
  buildCapturePrompt,
  buildCaptureRetryPrompt,
  buildJsonCapturePrompt,
  buildJsonCaptureRetryPrompt,
  DEFAULT_MAX_CAPTURE_RETRIES,
} from '../domain/capture-prompt.js';
import { evaluateArithmetic } from '../domain/arithmetic.js';
import { applyTransform } from '../domain/transforms.js';
import {
  isAskCondition,
  extractAskQuestion,
  judgeVarName,
  buildJudgePrompt,
  buildJudgeRetryPrompt,
} from '../domain/judge-prompt.js';
import { createJudgeResult, type JudgeResult } from '../domain/judge-result.js';
import {
  createFlowOutcome,
  createRuntimeWarningDiagnostic,
  FLOW_OUTCOME_CODES,
  RUNTIME_DIAGNOSTIC_CODES,
  type FlowDiagnostic,
  type FlowOutcome,
} from '../domain/diagnostic-report.js';
import {
  buildReviewJudgeCapturePrompt,
  buildReviewJudgeRetryPrompt,
  parseReviewJudgeCapture,
} from '../domain/review-judge-capture.js';
import { extractJudgeKind } from '../domain/judge-definition.js';
import { renderNodesToDsl, renderSpawnBody } from './render-node-to-dsl.js';
import {
  decodeJsonVariableValue,
  stringifyVariableValue,
  type VariableStore,
  type VariableValue,
} from '../domain/variable-value.js';

type LoweredAwayFlowNode = Extract<FlowNode, { kind: 'swarm' | 'start' | 'return' }>;

function unexpectedLoweredAwayNode(node: LoweredAwayFlowNode): never {
  throw new Error(`Flow node "${node.kind}" must be lowered before runtime execution`);
}

export function resolveCurrentNode(
  nodes: readonly FlowNode[],
  path: readonly number[],
): FlowNode | null {
  if (path.length === 0) return null;
  const idx = path[0]!;
  const node = nodes[idx];
  if (!node) return null;
  if (path.length === 1) return node;
  const rest = path.slice(1);
  switch (node.kind) {
    case 'while':
    case 'until':
    case 'retry':
    case 'foreach':
    case 'foreach_spawn':
    case 'spawn':
    case 'review':
      return resolveCurrentNode(node.body, rest);
    case 'race': {
      const raceBodies = node.children.flatMap((c) => [c as FlowNode, ...c.body]);
      return resolveCurrentNode(raceBodies, rest);
    }
    case 'if':
      return resolveCurrentNode([...node.thenBranch, ...node.elseBranch], rest);
    case 'try':
      return resolveCurrentNode([...node.body, ...node.catchBody, ...node.finallyBody], rest);
    case 'prompt':
    case 'run':
    case 'let':
    case 'break':
    case 'continue':
    case 'await':
    case 'approve':
    case 'remember':
    case 'send':
    case 'receive':
      return null;
    case 'swarm':
    case 'start':
    case 'return':
      return unexpectedLoweredAwayNode(node);
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

export function advancePath(path: readonly number[]): readonly number[] {
  if (path.length === 0) return [0];
  const last = path[path.length - 1]!;
  return [...path.slice(0, -1), last + 1];
}

const INTERPOLATION_TOKEN_RE =
  /\$\{([\w.]+):-((?:[^}\\]|\\.)*)\}|\$\{(\w+)\[(-?\d+)\]\}|\$\{([\w.]+)\}/g;

function prepareWindowsCommand(
  template: string,
  variables: VariableStore,
  baseEnv?: Readonly<Record<string, string>>,
): { command: string; env?: Readonly<Record<string, string>> } {
  let index = 0;
  const env: Record<string, string> = { ...(baseEnv ?? {}) };
  const command = template.replace(INTERPOLATION_TOKEN_RE, (match) => {
    const resolved = interpolate(match, variables);
    if (resolved === match) return match;
    const envName = `PROMPT_LANGUAGE_VAR_${index}`;
    index += 1;
    env[envName] = resolved;
    return `%${envName}%`;
  });
  if (index > 0) {
    return { command, env };
  }
  return baseEnv != null ? { command, env: baseEnv } : { command };
}

function prepareShellCommand(
  template: string,
  variables: VariableStore,
  baseEnv?: Readonly<Record<string, string>>,
): { command: string; env?: Readonly<Record<string, string>> } {
  if (process.platform === 'win32') {
    return prepareWindowsCommand(template, variables, baseEnv);
  }
  const command = shellInterpolate(template, variables);
  return baseEnv != null ? { command, env: baseEnv } : { command };
}

function advanceFromPath(state: SessionState, path: readonly number[]): SessionState {
  if (path.length > 0) {
    const parentPath = path.slice(0, -1);
    const parentNode = resolveCurrentNode(state.flowSpec.nodes, parentPath);
    if (parentNode?.kind === 'if') {
      const childIndex = path[path.length - 1]!;
      const progress = state.nodeProgress[parentNode.id];
      if (progress?.branchEndOffset !== undefined && childIndex + 1 >= progress.branchEndOffset) {
        const completed = updateNodeProgress(state, parentNode.id, {
          iteration: progress.iteration,
          maxIterations: progress.maxIterations,
          status: 'completed',
          branchEndOffset: progress.branchEndOffset,
          startedAt: progress.startedAt,
          completedAt: Date.now(),
        });
        return advanceNode(completed, advancePath(parentPath));
      }
    }

    if (parentNode?.kind === 'try') {
      const childIndex = path[path.length - 1]!;
      const bodyLen = parentNode.body.length;
      const catchLen = parentNode.catchBody.length;
      const finallyLen = parentNode.finallyBody.length;
      const finallyStart = bodyLen + catchLen;

      if (childIndex < bodyLen) {
        if (childIndex + 1 < bodyLen) {
          return advanceNode(state, [...parentPath, childIndex + 1]);
        }
        if (finallyLen > 0) {
          return advanceNode(state, [...parentPath, finallyStart]);
        }
        return advanceNode(state, advancePath(parentPath));
      }

      if (childIndex < finallyStart) {
        if (childIndex + 1 < finallyStart) {
          return advanceNode(state, [...parentPath, childIndex + 1]);
        }
        if (finallyLen > 0) {
          return advanceNode(state, [...parentPath, finallyStart]);
        }
        return advanceNode(state, advancePath(parentPath));
      }

      if (childIndex + 1 < finallyStart + finallyLen) {
        return advanceNode(state, [...parentPath, childIndex + 1]);
      }
      return advanceNode(state, advancePath(parentPath));
    }
  }

  return advanceNode(state, advancePath(path));
}

function enterIfBranch(
  current: SessionState,
  node: Extract<FlowNode, { kind: 'if' }>,
  branchOffset: number,
  branchLength: number,
): SessionState {
  const now = Date.now();
  const updated = updateNodeProgress(current, node.id, {
    iteration: 1,
    maxIterations: 1,
    status: 'running',
    branchEndOffset: branchOffset + branchLength,
    startedAt: current.nodeProgress[node.id]?.startedAt ?? now,
  });
  return advanceNode(updated, [...current.currentNodePath, branchOffset]);
}

const MAX_OUTPUT_LENGTH = 2000;

type DebugCategory = 'advance' | 'condition' | 'gate' | 'capture';

function parseDebugLevel(value: string | undefined): 0 | 1 | 2 | 3 {
  if (!value) return 0;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === '0' || normalized === 'false') return 0;
  if (normalized === '1' || normalized === 'true') return 1;
  if (normalized === '2') return 2;
  if (normalized === '3') return 3;
  return 1;
}

function debugLog(category: DebugCategory, message: string, level: 1 | 2 | 3 = 2): void {
  if (parseDebugLevel(process.env['PROMPT_LANGUAGE_DEBUG']) < level) return;
  process.stderr.write(`[PL:${category}] ${message}\n`);
}

function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_LENGTH) return output;
  return output.slice(0, MAX_OUTPUT_LENGTH) + '\n... (truncated)';
}

function isPidAlive(pid: number): boolean {
  if (process.platform === 'win32') return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function terminateRaceLosers(
  state: SessionState,
  raceNodeId: string,
  winnerName: string,
  processSpawner?: ProcessSpawner,
): Promise<SessionState> {
  const childNames = state.raceChildren[raceNodeId] ?? [];
  let next = state;

  for (const childName of childNames) {
    if (childName === winnerName) continue;
    const child = next.spawnedChildren[childName];
    if (child?.status !== 'running') continue;

    let warning = `Race winner "${winnerName}" completed; marked losing child "${childName}" as failed.`;
    if (child.pid !== undefined && processSpawner?.terminate) {
      const terminated = await processSpawner.terminate(child.pid);
      warning = terminated
        ? `Race winner "${winnerName}" completed; terminated losing child "${childName}" (pid ${child.pid}).`
        : `Race winner "${winnerName}" completed; losing child "${childName}" (pid ${child.pid}) was already gone.`;
    }

    next = updateSpawnedChild(next, childName, { ...child, status: 'failed' });
    next = addWarning(next, warning);
  }

  return next;
}

/** Store the 5 standard exit variables after a command execution. */
function setExitVariables(
  state: SessionState,
  exitCode: number,
  stdout: string,
  stderr: string,
): SessionState {
  let s = updateVariable(state, 'last_exit_code', exitCode);
  s = updateVariable(s, 'command_failed', exitCode !== 0);
  s = updateVariable(s, 'command_succeeded', exitCode === 0);
  s = updateVariable(s, 'last_stdout', truncateOutput(stdout.trimEnd()));
  s = updateVariable(s, 'last_stderr', truncateOutput(stderr.trimEnd()));
  return s;
}

function persistRuntimeDiagnostic(
  state: SessionState,
  code: string,
  summary: string,
): SessionState {
  let next = updateVariable(state, '_runtime_diagnostic.code', code);
  next = updateVariable(next, '_runtime_diagnostic.summary', summary);
  return next;
}

function readMemoryValue(entry?: MemoryEntry): string {
  return entry?.value ?? entry?.text ?? '';
}

function parseAskVerdict(captured: string): boolean | null {
  const raw = captured.trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

function normalizeGroundingCommand(command: string): string {
  if (process.platform !== 'win32') {
    return command;
  }

  const catMatch = /^\s*cat(\s+.+)$/i.exec(command);
  if (catMatch?.[1]) {
    return `type${catMatch[1]}`;
  }

  return command;
}

async function buildAskGroundingEvidence(
  groundedBy: string | undefined,
  variables: VariableStore,
  commandRunner?: CommandRunner,
): Promise<string | undefined> {
  if (!groundedBy || !commandRunner) return undefined;
  try {
    const command = normalizeGroundingCommand(interpolate(groundedBy, variables));
    const result = await commandRunner.run(command);
    return result.stdout.trimEnd();
  } catch {
    return undefined;
  }
}

/**
 * Evaluate a flow condition using variable lookup, falling back to command execution.
 * Returns null if the condition cannot be resolved.
 */
export async function evaluateFlowCondition(
  condition: string,
  variables: VariableStore,
  commandRunner?: CommandRunner,
): Promise<boolean | null> {
  // H-LANG-006: Interpolate ${var} and ${var:-default} before condition evaluation
  const interpolatedCondition = interpolate(condition, variables);
  debugLog('condition', `Evaluating "${condition}" -> "${interpolatedCondition}"`, 2);
  const pureResult = evaluateCondition(interpolatedCondition, variables);
  if (pureResult !== null) {
    debugLog('condition', `Resolved via expression evaluator: ${String(pureResult)}`, 2);
    return pureResult;
  }

  if (!commandRunner) {
    debugLog('condition', 'Condition unresolved and no command runner available', 2);
    return null;
  }

  const command = resolveBuiltinCommand(interpolatedCondition);
  if (!command) {
    debugLog('condition', `No builtin command mapping for "${interpolatedCondition}"`, 2);
    return null;
  }

  debugLog('gate', `Running condition command: ${command}`, 3);
  const result = await commandRunner.run(command);
  const inverted = isInvertedPredicate(interpolatedCondition);
  const outcome = inverted ? result.exitCode !== 0 : result.exitCode === 0;
  debugLog(
    'condition',
    `Command exit=${result.exitCode} inverted=${String(inverted)} => ${String(outcome)}`,
    2,
  );
  return outcome;
}

/**
 * When a run node fails inside a try body, find the catch jump target.
 * Returns the path to the first catch child, or null if no try ancestor.
 */
export function findTryCatchJump(
  nodes: readonly FlowNode[],
  path: readonly number[],
): readonly number[] | null {
  for (let depth = path.length - 1; depth >= 1; depth--) {
    const ancestorPath = path.slice(0, depth);
    const ancestor = resolveCurrentNode(nodes, ancestorPath);
    if (ancestor?.kind !== 'try') continue;

    const childIdx = path[depth]!;
    if (childIdx < ancestor.body.length && ancestor.catchBody.length > 0) {
      return [...ancestorPath, ancestor.body.length];
    }
  }
  return null;
}

function hasEnclosingTryFinally(nodes: readonly FlowNode[], path: readonly number[]): boolean {
  for (let depth = path.length - 1; depth >= 1; depth--) {
    const ancestor = resolveCurrentNode(nodes, path.slice(0, depth));
    if (ancestor?.kind === 'try' && ancestor.finallyBody.length > 0) {
      return true;
    }
  }
  return false;
}

/**
 * Shared loop re-entry logic for while/until/retry exhaustion.
 * If shouldReLoop is true and iteration < max, re-enters the body; otherwise exits the loop.
 * H-LANG-008: Also checks wall-clock timeout if configured on the parent node.
 */
function handleLoopReentry(
  state: SessionState,
  parentPath: readonly number[],
  nodeId: string,
  shouldReLoop: boolean,
  maxIter: number,
  timeoutSeconds?: number,
): SessionState {
  const progress = state.nodeProgress[nodeId];
  const iteration = progress?.iteration ?? 1;
  let current = state;

  // H-LANG-008: Check wall-clock timeout
  if (shouldReLoop && timeoutSeconds !== undefined && timeoutSeconds > 0) {
    const loopStart = progress?.loopStartedAt ?? progress?.startedAt;
    if (loopStart != null) {
      const elapsed = (Date.now() - loopStart) / 1000;
      if (elapsed >= timeoutSeconds) {
        current = addWarning(current, `Loop '${nodeId}' timed out after ${timeoutSeconds}s.`);
        current = updateNodeProgress(current, nodeId, {
          iteration,
          maxIterations: maxIter,
          status: 'completed',
          startedAt: progress?.startedAt,
          completedAt: Date.now(),
          loopStartedAt: progress?.loopStartedAt,
        });
        return advanceFromPath(current, parentPath);
      }
    }
  }

  if (shouldReLoop && iteration < maxIter) {
    current = updateNodeProgress(current, nodeId, {
      iteration: iteration + 1,
      maxIterations: maxIter,
      status: 'running',
      startedAt: progress?.startedAt,
      loopStartedAt: progress?.loopStartedAt,
    });
    return advanceNode(current, [...parentPath, 0]);
  }

  current = updateNodeProgress(current, nodeId, {
    iteration,
    maxIterations: maxIter,
    status: 'completed',
    startedAt: progress?.startedAt,
    completedAt: Date.now(),
    loopStartedAt: progress?.loopStartedAt,
  });
  return advanceFromPath(current, parentPath);
}

/**
 * Handle body exhaustion: when resolveCurrentNode returns null and we're
 * inside a parent scope (path.length >= 2), decide whether to loop or exit.
 */
async function handleBodyExhaustion(
  state: SessionState,
  commandRunner?: CommandRunner,
  captureReader?: CaptureReader,
): Promise<SessionState | AutoAdvanceResult | null> {
  const path = state.currentNodePath;
  if (path.length <= 1) return null;

  const parentPath = path.slice(0, -1);
  const parentNode = resolveCurrentNode(state.flowSpec.nodes, parentPath);
  if (!parentNode) return null;

  switch (parentNode.kind) {
    case 'while': {
      if (isAskCondition(parentNode.condition)) {
        // For ask conditions: reset path to while node so advanceConditionLoop
        // handles Phase 1 judgment on re-entry (captureReader available there).
        return advanceNode(state, parentPath);
      }
      const condResult = await evaluateFlowCondition(
        parentNode.condition,
        state.variables,
        commandRunner,
      );
      return handleLoopReentry(
        state,
        parentPath,
        parentNode.id,
        condResult === true,
        parentNode.maxIterations,
        parentNode.timeoutSeconds,
      );
    }

    case 'until': {
      if (isAskCondition(parentNode.condition)) {
        // For ask conditions: reset path to until node so advanceConditionLoop
        // handles Phase 1 judgment on re-entry.
        return advanceNode(state, parentPath);
      }
      const condResult = await evaluateFlowCondition(
        parentNode.condition,
        state.variables,
        commandRunner,
      );
      return handleLoopReentry(
        state,
        parentPath,
        parentNode.id,
        condResult === false,
        parentNode.maxIterations,
        parentNode.timeoutSeconds,
      );
    }

    case 'retry': {
      const commandFailed = state.variables['command_failed'];
      // H-REL-004: Set _retry_backoff_seconds when backoff is configured
      let retryState = state;
      if (parentNode.backoffMs != null && commandFailed === true) {
        const progress = state.nodeProgress[parentNode.id];
        const iteration = progress?.iteration ?? 1;
        const MAX_BACKOFF_MS = 60_000;
        const delayMs = Math.min(parentNode.backoffMs * Math.pow(2, iteration - 1), MAX_BACKOFF_MS);
        retryState = updateVariable(
          retryState,
          '_retry_backoff_seconds',
          Math.round(delayMs / 1000),
        );
      }
      return handleLoopReentry(
        retryState,
        parentPath,
        parentNode.id,
        commandFailed === true,
        parentNode.maxAttempts,
        parentNode.timeoutSeconds,
      );
    }

    case 'foreach': {
      // H-LANG-007: For command-based foreach, read from stored variable
      const rawList = parentNode.listCommand
        ? stringifyVariableValue(state.variables[`_foreach_${parentNode.id}_list`] ?? '')
        : interpolate(parentNode.listExpression, state.variables);
      const items = splitIterable(rawList).slice(0, parentNode.maxIterations);
      const progress = state.nodeProgress[parentNode.id];
      const iteration = progress?.iteration ?? 1;
      // Use cached maxIterations from entry to avoid mutation drift
      const itemCount = progress?.maxIterations ?? items.length;
      let current = state;

      if (iteration < itemCount) {
        const nextItem = items[iteration] ?? '';
        current = updateVariable(current, parentNode.variableName, nextItem);
        current = updateVariable(current, `${parentNode.variableName}_index`, iteration);
        current = updateNodeProgress(current, parentNode.id, {
          iteration: iteration + 1,
          maxIterations: itemCount,
          status: 'running',
          startedAt: progress?.startedAt,
        });
        return advanceNode(current, [...parentPath, 0]);
      }

      current = updateNodeProgress(current, parentNode.id, {
        iteration,
        maxIterations: itemCount,
        status: 'completed',
        startedAt: progress?.startedAt,
        completedAt: Date.now(),
      });
      return advanceFromPath(current, parentPath);
    }

    case 'review': {
      return handleReviewBodyExhaustion(
        state,
        parentPath,
        parentNode,
        commandRunner,
        captureReader,
      );
    }

    case 'foreach_spawn':
    case 'if':
    case 'try':
    case 'spawn':
    case 'race':
      return advanceFromPath(state, parentPath);
    case 'prompt':
    case 'run':
    case 'let':
    case 'break':
    case 'continue':
    case 'await':
    case 'approve':
    case 'remember':
    case 'send':
    case 'receive':
      return null;
    case 'swarm':
    case 'start':
    case 'return':
      return unexpectedLoweredAwayNode(parentNode);
    default: {
      const _exhaustive: never = parentNode;
      return _exhaustive;
    }
  }
}

/** Accepted response tokens for approve node approval. */
const APPROVE_YES_TOKENS = new Set(['yes', 'y', 'approved', 'ok', 'approve']);
const APPROVE_NO_TOKENS = new Set(['no', 'n', 'reject', 'cancel', 'rejected']);

export function advanceApproveNode(
  node: ApproveNode,
  current: SessionState,
  replyText?: string,
): AutoAdvanceResult {
  const progress = current.nodeProgress[node.id];
  const startedAt = progress?.startedAt;
  const now = Date.now();

  if (
    replyText === undefined &&
    node.timeoutSeconds !== undefined &&
    node.timeoutSeconds > 0 &&
    startedAt !== undefined &&
    now - startedAt >= node.timeoutSeconds * 1000
  ) {
    let next = updateVariable(current, 'approve_rejected', 'false');
    next = updateNodeProgress(next, node.id, {
      iteration: progress?.iteration ?? 1,
      maxIterations: progress?.maxIterations ?? 1,
      status: 'completed',
      startedAt,
      completedAt: now,
    });
    next = advanceFromPath(next, next.currentNodePath);
    return { kind: 'advance', state: next, capturedPrompt: null };
  }

  if (replyText === undefined) {
    const promptState =
      progress === undefined
        ? updateNodeProgress(current, node.id, {
            iteration: 1,
            maxIterations: 1,
            status: 'running',
            startedAt: now,
          })
        : current;
    return {
      kind: 'prompt',
      state: promptState,
      capturedPrompt: node.message + '\n\nPlease respond with "yes" to approve or "no" to reject.',
    };
  }

  const normalized = replyText.trim().toLowerCase();
  const firstWord = normalized.split(/[\s]+/)[0] ?? '';

  if (APPROVE_YES_TOKENS.has(firstWord)) {
    let next = updateVariable(current, 'approve_rejected', 'false');
    next = updateNodeProgress(next, node.id, {
      iteration: progress?.iteration ?? 1,
      maxIterations: progress?.maxIterations ?? 1,
      status: 'completed',
      startedAt,
      completedAt: now,
    });
    next = advanceFromPath(next, next.currentNodePath);
    return { kind: 'advance', state: next, capturedPrompt: null };
  }

  if (APPROVE_NO_TOKENS.has(firstWord)) {
    let next = updateVariable(current, 'approve_rejected', 'true');
    next = updateNodeProgress(next, node.id, {
      iteration: progress?.iteration ?? 1,
      maxIterations: progress?.maxIterations ?? 1,
      status: 'completed',
      startedAt,
      completedAt: now,
    });
    next = advanceFromPath(next, next.currentNodePath);
    return {
      kind: 'advance',
      state: next,
      capturedPrompt: null,
      outcomes: [
        createFlowOutcome(FLOW_OUTCOME_CODES.approvalDenied, `Approval denied: ${node.message}`),
      ],
    };
  }

  const promptState =
    progress === undefined
      ? updateNodeProgress(current, node.id, {
          iteration: 1,
          maxIterations: 1,
          status: 'running',
          startedAt: now,
        })
      : current;
  return {
    kind: 'prompt',
    state: promptState,
    capturedPrompt: 'Please respond with "yes" to approve or "no" to reject: ' + node.message,
  };
}

export const DEFAULT_MAX_REVIEW_ROUNDS = 3;

const REVIEW_RESULT_VAR = '_review_result';
const MAX_REVIEW_EVIDENCE_LENGTH = 300;

function truncateReviewEvidence(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_REVIEW_EVIDENCE_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_REVIEW_EVIDENCE_LENGTH)}...[truncated]`;
}

function buildReviewEvidence(parentNode: ReviewNode, state: SessionState): string[] {
  const evidence: string[] = [];
  if (parentNode.judgeName) {
    evidence.push(`judge: ${parentNode.judgeName}`);
    const judge = state.flowSpec.judges?.find((entry) => entry.name === parentNode.judgeName);
    if (judge?.rubric) evidence.push(`rubric: ${judge.rubric}`);
  }
  if (parentNode.criteria) evidence.push(`criteria: ${parentNode.criteria}`);
  return evidence;
}

function buildReviewJudgePromptText(parentNode: ReviewNode, state: SessionState): string {
  const judge = state.flowSpec.judges?.find((entry) => entry.name === parentNode.judgeName);
  const rubric =
    judge?.rubric != null
      ? state.flowSpec.rubrics?.find((entry) => entry.name === judge.rubric)
      : undefined;

  const availableInputs: string[] = [];
  const candidateInputs = [
    ['output', state.variables['output']],
    ['diff', state.variables['diff'] ?? state.variables['last_diff']],
    ['last_exit_code', state.variables['last_exit_code']],
    ['command_failed', state.variables['command_failed']],
    ['last_stdout', state.variables['last_stdout']],
    ['last_stderr', state.variables['last_stderr']],
    ['_review_critique', state.variables['_review_critique']],
  ] as const;

  for (const [name, value] of candidateInputs) {
    if (value == null) continue;
    const serialized =
      typeof value === 'string'
        ? truncateReviewEvidence(value)
        : typeof value === 'boolean' || typeof value === 'number'
          ? String(value)
          : truncateReviewEvidence(JSON.stringify(value));
    if (serialized.trim().length === 0) continue;
    availableInputs.push(`${name}: ${serialized}`);
  }

  const judgeLines = judge?.lines?.join('\n') ?? 'judge definition not found';
  const rubricLines =
    rubric != null
      ? rubric.lines.join('\n')
      : judge?.rubric != null
        ? `rubric "${judge.rubric}" not found`
        : '';
  const reviewCriteria =
    parentNode.criteria != null ? `\n\nReview criteria:\n${parentNode.criteria}` : '';
  const rubricSection = rubricLines.length > 0 ? `\n\nReferenced rubric:\n${rubricLines}` : '';
  const inputSection =
    availableInputs.length > 0
      ? `\n\nAvailable review inputs:\n${availableInputs.map((line) => `- ${line}`).join('\n')}`
      : '\n\nAvailable review inputs:\n- none captured for this round';

  return `[Internal — prompt-language named review judge]

Execute the named review judge "${parentNode.judgeName}" for the current review round.
Return only JSON matching the provided schema.
If the available evidence is insufficient, set "abstain": true and "pass": false.
Do not include markdown fences or extra commentary.${reviewCriteria}

Judge definition:
${judgeLines}${rubricSection}${inputSection}`;
}

type ReviewJudgeCaptureStep =
  | { readonly kind: 'result'; readonly reviewResult: JudgeResult }
  | AutoAdvanceResult;

async function maybeRunNamedReviewJudge(
  state: SessionState,
  parentNode: ReviewNode,
  captureReader?: CaptureReader,
): Promise<ReviewJudgeCaptureStep> {
  const evidence = buildReviewEvidence(parentNode, state);
  const judge = parentNode.judgeName
    ? state.flowSpec.judges?.find((entry) => entry.name === parentNode.judgeName)
    : undefined;
  const judgeKind = judge ? extractJudgeKind(judge) : null;

  if (judgeKind != null && judgeKind !== 'model') {
    evidence.push(`judge-kind: ${judgeKind}`);
    return {
      kind: 'result',
      reviewResult: createJudgeResult(
        false,
        0,
        `Named review judge "${parentNode.judgeName}" uses unsupported kind "${judgeKind}" in runtime v1.`,
        evidence,
        true,
      ),
    };
  }

  if (!captureReader) {
    evidence.push('judge-runtime: no capture reader available');
    return {
      kind: 'result',
      reviewResult: createJudgeResult(
        false,
        0,
        'Named review judge could not run because no capture reader is available.',
        evidence,
        true,
      ),
    };
  }

  const progress = state.nodeProgress[parentNode.id];
  const retryCount = progress?.askRetryCount ?? 0;
  const isAwaiting = progress?.status === 'awaiting_capture';
  const captureVar = `__review_judge_${parentNode.id}__`;
  const updatedBase = {
    iteration: progress?.iteration ?? 1,
    maxIterations: progress?.maxIterations ?? parentNode.maxRounds,
    startedAt: progress?.startedAt,
    loopStartedAt: progress?.loopStartedAt,
  };

  if (!isAwaiting) {
    await captureReader.clear(captureVar);
    return {
      kind: 'prompt',
      state: updateNodeProgress(state, parentNode.id, {
        ...updatedBase,
        status: 'awaiting_capture',
        askRetryCount: 0,
      }),
      capturedPrompt: buildReviewJudgeCapturePrompt(
        buildReviewJudgePromptText(parentNode, state),
        parentNode.id,
        state.captureNonce,
      ),
    };
  }

  const captured = await captureReader.read(captureVar);
  if (captured) {
    await captureReader.clear(captureVar);
    const parsed = parseReviewJudgeCapture(captured);
    if (parsed != null) {
      return { kind: 'result', reviewResult: parsed };
    }

    if (retryCount + 1 < DEFAULT_MAX_CAPTURE_RETRIES) {
      return {
        kind: 'prompt',
        state: updateNodeProgress(state, parentNode.id, {
          ...updatedBase,
          status: 'awaiting_capture',
          askRetryCount: retryCount + 1,
          captureFailureReason: 'invalid judge-result JSON',
        }),
        capturedPrompt: buildReviewJudgeRetryPrompt(parentNode.id, state.captureNonce),
      };
    }

    evidence.push('judge-runtime: invalid judge-result JSON after retry budget exhausted');
    return {
      kind: 'result',
      reviewResult: createJudgeResult(
        false,
        0,
        'Named review judge did not return valid JSON within the retry budget.',
        evidence,
        true,
      ),
    };
  }

  if (retryCount + 1 < DEFAULT_MAX_CAPTURE_RETRIES) {
    return {
      kind: 'prompt',
      state: updateNodeProgress(state, parentNode.id, {
        ...updatedBase,
        status: 'awaiting_capture',
        askRetryCount: retryCount + 1,
        captureFailureReason: 'capture file empty or not found',
      }),
      capturedPrompt: buildReviewJudgeRetryPrompt(parentNode.id, state.captureNonce),
    };
  }

  evidence.push('judge-runtime: capture file empty or missing after retry budget exhausted');
  return {
    kind: 'result',
    reviewResult: createJudgeResult(
      false,
      0,
      'Named review judge capture did not arrive within the retry budget.',
      evidence,
      true,
    ),
  };
}

async function evaluateReviewResult(
  state: SessionState,
  parentNode: ReviewNode,
  commandRunner?: CommandRunner,
): Promise<JudgeResult> {
  const evidence = buildReviewEvidence(parentNode, state);

  if (parentNode.groundedBy) {
    const command = interpolate(parentNode.groundedBy, state.variables);
    evidence.push(`grounded-by: ${command}`);

    if (!commandRunner) {
      return createJudgeResult(
        false,
        0,
        'Grounded review could not run because no command runner is available.',
        evidence,
        true,
      );
    }

    try {
      const result = await commandRunner.run(command);
      evidence.push(`exit-code: ${result.exitCode}`);
      if (result.stdout.trim().length > 0) {
        evidence.push(`stdout: ${truncateReviewEvidence(result.stdout)}`);
      }
      if (result.stderr.trim().length > 0) {
        evidence.push(`stderr: ${truncateReviewEvidence(result.stderr)}`);
      }

      return result.exitCode === 0
        ? createJudgeResult(true, 1, 'Grounded review checks passed.', evidence)
        : createJudgeResult(
            false,
            1,
            `Grounded review checks failed with exit code ${result.exitCode}.`,
            evidence,
          );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      evidence.push(`runner-error: ${truncateReviewEvidence(reason)}`);
      return createJudgeResult(
        false,
        0,
        'Grounded review command failed before a verdict was available.',
        evidence,
        true,
      );
    }
  }

  return createJudgeResult(
    true,
    0.25,
    'Review completed without explicit grounding; treating the round as a pass for backward compatibility.',
    evidence.length > 0 ? evidence : ['review completed without explicit grounding'],
  );
}

function persistReviewResult(
  state: SessionState,
  parentNode: ReviewNode,
  reviewResult: JudgeResult,
): SessionState {
  let next = updateVariable(state, REVIEW_RESULT_VAR, JSON.stringify(reviewResult));
  next = updateVariable(next, `${REVIEW_RESULT_VAR}.pass`, reviewResult.pass);
  next = updateVariable(next, `${REVIEW_RESULT_VAR}.confidence`, reviewResult.confidence);
  next = updateVariable(next, `${REVIEW_RESULT_VAR}.reason`, reviewResult.reason);
  next = updateVariable(
    next,
    `${REVIEW_RESULT_VAR}.evidence`,
    JSON.stringify(reviewResult.evidence),
  );
  next = updateVariable(next, `${REVIEW_RESULT_VAR}.evidence_length`, reviewResult.evidence.length);
  next = updateVariable(next, `${REVIEW_RESULT_VAR}.abstain`, reviewResult.abstain);
  if (parentNode.judgeName) {
    next = updateVariable(next, `${REVIEW_RESULT_VAR}.judge`, parentNode.judgeName);
  }
  return next;
}

async function handleReviewBodyExhaustion(
  state: SessionState,
  parentPath: readonly number[],
  parentNode: ReviewNode,
  commandRunner?: CommandRunner,
  captureReader?: CaptureReader,
): Promise<SessionState | AutoAdvanceResult> {
  const progress = state.nodeProgress[parentNode.id];
  const round = progress?.iteration ?? 1;

  const reviewEvaluation = parentNode.judgeName
    ? await maybeRunNamedReviewJudge(state, parentNode, captureReader)
    : {
        kind: 'result' as const,
        reviewResult: await evaluateReviewResult(state, parentNode, commandRunner),
      };
  if (reviewEvaluation.kind !== 'result') {
    return reviewEvaluation;
  }

  const reviewResult = reviewEvaluation.reviewResult;
  let current = persistReviewResult(state, parentNode, reviewResult);

  if (reviewResult.pass) {
    const next = updateNodeProgress(current, parentNode.id, {
      iteration: round,
      maxIterations: parentNode.maxRounds,
      status: 'completed',
      startedAt: progress?.startedAt,
      completedAt: Date.now(),
      loopStartedAt: progress?.loopStartedAt,
    });
    return advanceFromPath(next, parentPath);
  }

  if (round >= parentNode.maxRounds) {
    if (parentNode.strict) {
      current = updateNodeProgress(current, parentNode.id, {
        iteration: round,
        maxIterations: parentNode.maxRounds,
        status: 'failed',
        startedAt: progress?.startedAt,
        completedAt: Date.now(),
        loopStartedAt: progress?.loopStartedAt,
      });
      const strictReason = `Review strict failed after ${round}/${parentNode.maxRounds} rounds: ${reviewResult.reason}`;
      return {
        kind: 'advance',
        capturedPrompt: null,
        state: markFailed(current, strictReason),
        outcomes: [createFlowOutcome(FLOW_OUTCOME_CODES.reviewRejected, strictReason)],
      };
    }

    const next = updateNodeProgress(current, parentNode.id, {
      iteration: round,
      maxIterations: parentNode.maxRounds,
      status: 'completed',
      startedAt: progress?.startedAt,
      completedAt: Date.now(),
      loopStartedAt: progress?.loopStartedAt,
    });
    return {
      kind: 'advance',
      capturedPrompt: null,
      state: advanceFromPath(next, parentPath),
      outcomes: reviewResult.abstain
        ? undefined
        : [
            createFlowOutcome(
              FLOW_OUTCOME_CODES.reviewRejected,
              `Review rejected: ${reviewResult.reason}`,
            ),
          ],
    };
  }

  const critiqueBase =
    'Review round ' +
    String(round + 1) +
    '/' +
    String(parentNode.maxRounds) +
    ': Please revise your work.';
  const critiqueFeedback = ` Latest verdict: ${reviewResult.reason}`;
  const critiquePrompt = parentNode.criteria
    ? critiqueBase + ' Evaluation criteria: ' + parentNode.criteria + critiqueFeedback
    : critiqueBase + ' Based on the feedback.' + critiqueFeedback;

  let looping = updateNodeProgress(current, parentNode.id, {
    iteration: round + 1,
    maxIterations: parentNode.maxRounds,
    status: 'running',
    startedAt: progress?.startedAt,
    loopStartedAt: progress?.loopStartedAt,
  });
  looping = updateVariable(looping, '_review_critique', critiquePrompt);
  looping = advanceNode(looping, [...parentPath, 0]);
  return looping;
}

export type AutoAdvanceResult =
  | {
      readonly kind: 'prompt';
      readonly state: SessionState;
      readonly capturedPrompt: string;
      readonly diagnostics?: readonly FlowDiagnostic[] | undefined;
      readonly outcomes?: readonly FlowOutcome[] | undefined;
    }
  | {
      readonly kind: 'advance';
      readonly state: SessionState;
      readonly capturedPrompt: null;
      readonly diagnostics?: readonly FlowDiagnostic[] | undefined;
      readonly outcomes?: readonly FlowOutcome[] | undefined;
    }
  | {
      readonly kind: 'pause';
      readonly state: SessionState;
      readonly capturedPrompt: null;
      readonly diagnostics?: readonly FlowDiagnostic[] | undefined;
      readonly outcomes?: readonly FlowOutcome[] | undefined;
    };

interface CapturedValueResult {
  readonly state: SessionState;
  readonly value: string;
  readonly diagnostics?: readonly FlowDiagnostic[] | undefined;
}

function shouldContinueAutoAdvance(result: AutoAdvanceResult): boolean {
  return (
    result.kind === 'advance' && result.capturedPrompt === null && result.state.status === 'active'
  );
}

function mergeAutoAdvanceSignals(
  pendingDiagnostics: readonly FlowDiagnostic[],
  pending: readonly FlowOutcome[],
  result: AutoAdvanceResult,
): AutoAdvanceResult {
  if (
    pendingDiagnostics.length === 0 &&
    pending.length === 0 &&
    (result.diagnostics == null || result.diagnostics.length === 0) &&
    (result.outcomes == null || result.outcomes.length === 0)
  ) {
    return result;
  }
  return {
    ...result,
    diagnostics: [...pendingDiagnostics, ...(result.diagnostics ?? [])],
    outcomes: [...pending, ...(result.outcomes ?? [])],
  };
}

/** Advance a let node, handling all source types (literal, empty_list, prompt, memory, run). */
async function advanceLetNode(
  node: LetNode,
  current: SessionState,
  commandRunner?: CommandRunner,
  captureReader?: CaptureReader,
  memoryStore?: MemoryStore,
): Promise<AutoAdvanceResult | { state: SessionState; advanced: true }> {
  let value: string;
  let tryCatchJump: readonly number[] | null = null;
  const pendingDiagnostics: FlowDiagnostic[] = [];

  switch (node.source.type) {
    case 'literal': {
      const interpolated = interpolate(node.source.value, current.variables);
      const arithResult = evaluateArithmetic(interpolated);
      value = arithResult !== null ? String(arithResult) : interpolated;
      break;
    }
    case 'empty_list':
      value = initEmptyList();
      break;
    case 'prompt': {
      const result = await advanceLetPrompt(node, current, captureReader);
      if ('capturedPrompt' in result) return result;
      current = result.state;
      value = result.value;
      pendingDiagnostics.push(...(result.diagnostics ?? []));
      break;
    }
    case 'prompt_json': {
      const result = await advanceLetPromptJson(node, current, captureReader);
      if ('capturedPrompt' in result) return result;
      // JSON field expansion: store root + each top-level field as flat keys
      current = result.state;
      const jsonStr = result.value;
      pendingDiagnostics.push(...(result.diagnostics ?? []));
      try {
        const fencedMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(jsonStr);
        const rawJson = fencedMatch?.[1] ? fencedMatch[1].trim() : jsonStr.trim();
        const parsed: unknown = JSON.parse(rawJson);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          // Store full JSON string as the root variable
          value = rawJson;
          for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
            const flatKey = `${node.variableName}.${key}`;
            if (Array.isArray(val)) {
              current = updateVariable(current, flatKey, JSON.stringify(val));
              current = updateVariable(current, `${flatKey}_length`, val.length);
            } else {
              current = updateVariable(current, flatKey, val !== null ? String(val) : '');
            }
          }
        } else {
          value = jsonStr;
        }
      } catch {
        // JSON parse failed; store raw value and warn
        value = jsonStr;
        current = addWarning(
          current,
          `Variable '${node.variableName}' JSON parse failed; stored raw response.`,
        );
      }
      break;
    }
    case 'memory': {
      if (!memoryStore) {
        value = '';
        break;
      }
      const entry = await memoryStore.findByKey(node.source.key);
      value = readMemoryValue(entry);
      break;
    }
    case 'run': {
      if (!commandRunner) return { kind: 'pause', state: current, capturedPrompt: null };
      const prepared = prepareShellCommand(
        node.source.command,
        current.variables,
        current.flowSpec.env,
      );
      const result = await commandRunner.run(
        prepared.command,
        prepared.env != null ? { env: prepared.env } : undefined,
      );
      value = result.stdout.trimEnd();
      // H-REL-010: Truncate captured variable to MAX_OUTPUT_LENGTH
      if (value.length > MAX_OUTPUT_LENGTH) {
        value = value.slice(0, MAX_OUTPUT_LENGTH) + '\n[truncated]';
        // D10-fix: Use addWarning() domain function instead of direct spread
        current = addWarning(
          current,
          `Variable '${node.variableName}' truncated to ${MAX_OUTPUT_LENGTH} chars.`,
        );
      }
      current = setExitVariables(current, result.exitCode, result.stdout, result.stderr);
      if (result.exitCode !== 0) {
        tryCatchJump = findTryCatchJump(current.flowSpec.nodes, current.currentNodePath);
      }
      break;
    }
  }

  // H-LANG-005: Apply pipe transform before append/store
  if (node.transform) {
    value = applyTransform(value, node.transform);
  }

  if (node.append) {
    value = appendToList(current.variables[node.variableName], value);
  }
  current = updateVariable(current, node.variableName, value);
  if (node.append || node.source.type === 'empty_list') {
    current = updateVariable(current, `${node.variableName}_length`, listLength(value));
  }

  if (tryCatchJump) {
    current = advanceNode(current, tryCatchJump);
  } else {
    current = advanceFromPath(current, current.currentNodePath);
  }
  if (pendingDiagnostics.length > 0) {
    return {
      kind: 'advance',
      state: current,
      capturedPrompt: null,
      diagnostics: pendingDiagnostics,
    };
  }
  return { state: current, advanced: true };
}

/** Handle let-prompt two-phase capture (emit meta-prompt or read captured file). */
async function advanceLetPrompt(
  node: LetNode,
  current: SessionState,
  captureReader?: CaptureReader,
): Promise<AutoAdvanceResult | CapturedValueResult> {
  const progress = current.nodeProgress[node.id];
  const isAwaiting = progress?.status === 'awaiting_capture';

  if (!isAwaiting) {
    if (captureReader) {
      await captureReader.clear(node.variableName);
      await captureReader.prime?.(node.variableName);
      debugLog('capture', `Primed capture file for "${node.variableName}"`, 3);
    }
    const updated = updateNodeProgress(current, node.id, {
      iteration: 1,
      maxIterations: DEFAULT_MAX_CAPTURE_RETRIES,
      status: 'awaiting_capture',
    });
    const promptText = interpolate(
      node.source.type === 'prompt' ? node.source.text : '',
      current.variables,
    );
    return {
      kind: 'prompt' as const,
      state: updated,
      capturedPrompt: buildCapturePrompt(promptText, node.variableName, current.captureNonce),
    };
  }

  let failureReason: string;
  let retryPrompt = buildCaptureRetryPrompt(node.variableName, current.captureNonce);
  if (captureReader) {
    const captured = await captureReader.read(node.variableName);
    if (captured && captured !== CAPTURE_PENDING_SENTINEL) {
      await captureReader.clear(node.variableName);
      debugLog('capture', `Captured value for "${node.variableName}"`, 2);
      return {
        state: updateNodeProgress(current, node.id, {
          iteration: progress.iteration,
          maxIterations: progress.maxIterations,
          status: 'completed',
          completedAt: Date.now(),
        }),
        value: captured,
      };
    }
    if (captured === CAPTURE_PENDING_SENTINEL) {
      failureReason = 'capture file still pending (model did not write response)';
      retryPrompt =
        buildCaptureRetryPrompt(node.variableName, current.captureNonce) +
        '\n\nPlease use the Write tool to save your answer to the capture file.';
    } else {
      failureReason = 'capture file exists but is empty';
      retryPrompt =
        buildCaptureRetryPrompt(node.variableName, current.captureNonce) +
        '\n\nPlease write a non-empty response to the capture file.';
    }
    debugLog('capture', `Capture retry for "${node.variableName}": ${failureReason}`, 2);
  } else {
    failureReason = 'no capture reader available';
    debugLog('capture', `Capture reader unavailable for "${node.variableName}"`, 2);
  }

  const iteration = progress.iteration;
  if (iteration < progress.maxIterations) {
    const updated = updateNodeProgress(current, node.id, {
      iteration: iteration + 1,
      maxIterations: progress.maxIterations,
      status: 'awaiting_capture',
      captureFailureReason: failureReason,
    });
    return {
      kind: 'prompt' as const,
      state: updated,
      capturedPrompt: retryPrompt,
    };
  }

  const summary = `Capture for '${node.variableName}' fell back to empty string after ${progress.maxIterations} attempts.`;
  const fallbackState = persistRuntimeDiagnostic(
    {
      ...current,
      warnings: [...current.warnings, summary],
    },
    RUNTIME_DIAGNOSTIC_CODES.captureRetryFallback,
    summary,
  );
  return {
    state: updateNodeProgress(fallbackState, node.id, {
      iteration: progress.iteration,
      maxIterations: progress.maxIterations,
      status: 'completed',
      completedAt: Date.now(),
    }),
    value: '',
    diagnostics: [
      createRuntimeWarningDiagnostic(
        RUNTIME_DIAGNOSTIC_CODES.captureRetryFallback,
        summary,
        'Inspect the capture path or rerun with a working Write/capture surface.',
        true,
      ),
    ],
  };
}

/**
 * Handle let-prompt_json two-phase capture: emit JSON-schema-guided prompt, then read back
 * and validate. Falls back to raw string if JSON parse fails on retry.
 */
async function advanceLetPromptJson(
  node: LetNode,
  current: SessionState,
  captureReader?: CaptureReader,
): Promise<AutoAdvanceResult | CapturedValueResult> {
  if (node.source.type !== 'prompt_json') {
    return { state: current, value: '' };
  }

  const progress = current.nodeProgress[node.id];
  const isAwaiting = progress?.status === 'awaiting_capture';

  if (!isAwaiting) {
    if (captureReader) {
      await captureReader.clear(node.variableName);
      await captureReader.prime?.(node.variableName);
      debugLog('capture', `Primed JSON capture file for "${node.variableName}"`, 3);
    }
    const updated = updateNodeProgress(current, node.id, {
      iteration: 1,
      maxIterations: DEFAULT_MAX_CAPTURE_RETRIES,
      status: 'awaiting_capture',
    });
    const promptText = interpolate(node.source.text, current.variables);
    return {
      kind: 'prompt' as const,
      state: updated,
      capturedPrompt: buildJsonCapturePrompt(
        promptText,
        node.variableName,
        node.source.schema,
        current.captureNonce,
      ),
    };
  }

  let failureReason: string;
  let retryPrompt = buildJsonCaptureRetryPrompt(
    node.variableName,
    node.source.schema,
    current.captureNonce,
  );
  if (captureReader) {
    const captured = await captureReader.read(node.variableName);
    if (captured && captured !== CAPTURE_PENDING_SENTINEL) {
      await captureReader.clear(node.variableName);
      debugLog('capture', `Captured JSON value for "${node.variableName}"`, 2);
      return {
        state: updateNodeProgress(current, node.id, {
          iteration: progress.iteration,
          maxIterations: progress.maxIterations,
          status: 'completed',
          completedAt: Date.now(),
        }),
        value: captured,
      };
    }
    if (captured === CAPTURE_PENDING_SENTINEL) {
      failureReason = 'capture file still pending (model did not write response)';
      retryPrompt =
        buildJsonCaptureRetryPrompt(node.variableName, node.source.schema, current.captureNonce) +
        '\n\nPlease use the Write tool to save your JSON response to the capture file.';
    } else {
      failureReason = 'capture file exists but is empty';
      retryPrompt =
        buildJsonCaptureRetryPrompt(node.variableName, node.source.schema, current.captureNonce) +
        '\n\nPlease write a non-empty JSON object to the capture file.';
    }
    debugLog('capture', `JSON capture retry for "${node.variableName}": ${failureReason}`, 2);
  } else {
    failureReason = 'no capture reader available';
    debugLog('capture', `JSON capture reader unavailable for "${node.variableName}"`, 2);
  }

  const iteration = progress.iteration;
  if (iteration < progress.maxIterations) {
    const updated = updateNodeProgress(current, node.id, {
      iteration: iteration + 1,
      maxIterations: progress.maxIterations,
      status: 'awaiting_capture',
      captureFailureReason: failureReason,
    });
    return {
      kind: 'prompt' as const,
      state: updated,
      capturedPrompt: retryPrompt,
    };
  }

  const summary = `JSON capture for '${node.variableName}' fell back to empty string after ${progress.maxIterations} attempts.`;
  const fallbackState = persistRuntimeDiagnostic(
    {
      ...current,
      warnings: [...current.warnings, summary],
    },
    RUNTIME_DIAGNOSTIC_CODES.captureRetryFallback,
    summary,
  );
  return {
    state: updateNodeProgress(fallbackState, node.id, {
      iteration: progress.iteration,
      maxIterations: progress.maxIterations,
      status: 'completed',
      completedAt: Date.now(),
    }),
    value: '',
    diagnostics: [
      createRuntimeWarningDiagnostic(
        RUNTIME_DIAGNOSTIC_CODES.captureRetryFallback,
        summary,
        'Inspect the capture path or rerun with a working Write/capture surface.',
        true,
      ),
    ],
  };
}

/** Advance a run node: execute command, set exit variables, handle try/catch. */
async function advanceRunNode(
  node: RunNode,
  current: SessionState,
  commandRunner?: CommandRunner,
  auditLogger?: AuditLogger,
): Promise<AutoAdvanceResult | { state: SessionState; advanced: true }> {
  if (!commandRunner) return { kind: 'pause', state: current, capturedPrompt: null };
  const prepared = prepareShellCommand(node.command, current.variables, current.flowSpec.env);
  const command = prepared.command;
  debugLog('advance', `Running node ${node.id} command`, 2);
  debugLog('gate', `Command: ${command}`, 3);
  const runOptions: import('./ports/command-runner.js').RunOptions = {
    ...(node.timeoutMs != null ? { timeoutMs: node.timeoutMs } : {}),
    ...(prepared.env != null ? { env: prepared.env } : {}),
  };
  const runStartedAt = Date.now();
  const result = await commandRunner.run(
    command,
    Object.keys(runOptions).length > 0 ? runOptions : undefined,
  );
  const runDurationMs = Math.max(0, Date.now() - runStartedAt);
  debugLog(
    'gate',
    `Command exit=${result.exitCode} timedOut=${String(result.timedOut ?? false)}`,
    3,
  );

  // H-SEC-006: Log command execution to audit trail
  if (auditLogger) {
    auditLogger.log({
      timestamp: new Date().toISOString(),
      event: 'run_command',
      command,
      exitCode: result.exitCode,
      ...(result.timedOut ? { timedOut: true } : {}),
      stdout: result.stdout,
      stderr: result.stderr,
      nodeId: node.id,
      nodeKind: node.kind,
      nodePath: current.currentNodePath.join('.'),
      durationMs: runDurationMs,
    });
  }

  let state = setExitVariables(current, result.exitCode, result.stdout, result.stderr);

  if (result.exitCode !== 0) {
    const jumpTarget = findTryCatchJump(state.flowSpec.nodes, state.currentNodePath);
    if (jumpTarget) {
      return { state: advanceNode(state, jumpTarget), advanced: true };
    }
    if (hasEnclosingTryFinally(state.flowSpec.nodes, state.currentNodePath) === false) {
      const parentPath = state.currentNodePath.slice(0, -1);
      const parentNode = resolveCurrentNode(state.flowSpec.nodes, parentPath);
      if (parentNode?.kind === 'try') {
        return {
          state: markFailed(
            state,
            `Command '${command}' failed with exit code ${result.exitCode} inside try '${parentNode.id}'.`,
          ),
          advanced: true,
        };
      }
    }
  }

  state = advanceFromPath(state, state.currentNodePath);
  return { state, advanced: true };
}

/** H-SEC-005: Default patterns to exclude from spawn when no allowlist is set. */
const SENSITIVE_VAR_SUFFIXES = ['_key', '_token', '_secret', '_password'];

/** H-SEC-005: Filter variables for spawn child based on allowlist or default deny. */
function filterSpawnVariables(
  variables: VariableStore,
  allowlist?: readonly string[],
): Record<string, VariableValue> {
  if (allowlist) {
    const allowed = new Set(allowlist);
    const result: Record<string, VariableValue> = {};
    for (const [key, value] of Object.entries(variables)) {
      if (allowed.has(key)) result[key] = value;
    }
    return result;
  }
  // Default: exclude variables matching sensitive patterns
  const result: Record<string, VariableValue> = {};
  for (const [key, value] of Object.entries(variables)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_VAR_SUFFIXES.some((suffix) => lower.endsWith(suffix))) continue;
    result[key] = value;
  }
  return result;
}

/** Advance a spawn node: launch child process, record in spawnedChildren, skip body. */
async function advanceSpawnNode(
  node: SpawnNode,
  current: SessionState,
  processSpawner?: ProcessSpawner,
  commandRunner?: CommandRunner,
): Promise<{ state: SessionState; advanced: true }> {
  // beads: prompt-language-lmep — evaluate optional condition guard before launching
  if (node.condition != null) {
    const condResult = await evaluateFlowCondition(
      node.condition,
      current.variables,
      commandRunner,
    );
    if (condResult === false) {
      // Condition is false: skip spawn entirely without launching
      return { state: advanceFromPath(current, current.currentNodePath), advanced: true };
    }
    // condResult === null means unresolvable — proceed with spawn (fail-open)
  }

  if (!processSpawner) {
    // No spawner available — skip spawn and advance past it
    return { state: advanceFromPath(current, current.currentNodePath), advanced: true };
  }

  const stateDir = `.prompt-language-${node.name}`;
  const flowText = renderSpawnBody(node);
  const goal = `Sub-task: ${node.name}`;
  // H-SEC-005: Filter variables based on allowlist
  const parentVars: Record<string, VariableValue> = filterSpawnVariables(
    current.variables,
    node.vars,
  );

  const { pid } = await processSpawner.spawn({
    name: node.name,
    goal,
    flowText: flowText,
    variables: parentVars,
    stateDir,
    ...(node.cwd != null ? { cwd: node.cwd } : {}),
    ...(node.model != null ? { model: node.model } : {}),
  });

  // D7: Detect failed spawn (pid=0 or undefined) and mark child as failed
  if (!pid) {
    let state = updateSpawnedChild(current, node.name, {
      name: node.name,
      status: 'failed',
      pid: 0,
      stateDir,
    });
    state = {
      ...state,
      warnings: [...state.warnings, `Spawn "${node.name}" failed: could not start child process.`],
    };
    state = advanceFromPath(state, state.currentNodePath);
    return { state, advanced: true };
  }

  let state = updateSpawnedChild(current, node.name, {
    name: node.name,
    status: 'running',
    pid,
    stateDir,
    startedAt: new Date().toISOString(),
  });

  // Skip past the spawn block (don't enter body — child runs it)
  state = advanceFromPath(state, state.currentNodePath);
  return { state, advanced: true };
}

export const MAX_AWAIT_POLLS = 150; // ~5 min with adaptive polling

// H-PERF-009: Adaptive await polling — starts fast, slows down over time
function computePollInterval(pollCount: number): number {
  if (pollCount <= 5) return 1000;
  if (pollCount <= 15) return 2000;
  if (pollCount <= 35) return 5000;
  return 10000;
}

function parseExitCode(raw: string | undefined): string | number {
  const trimmed = raw?.trim() ?? '';
  if (trimmed === '') return '';
  return /^-?\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

function importChildVariablesWithPrefix(
  state: SessionState,
  child: import('../domain/session-state.js').SpawnedChild,
): SessionState {
  let next = state;
  if (!child.variables) return next;

  for (const [key, value] of Object.entries(child.variables)) {
    next = updateVariable(next, `${child.name}.${key}`, value);
  }

  return next;
}

async function importAwaitedSwarmResult(
  state: SessionState,
  child: import('../domain/session-state.js').SpawnedChild,
  messageStore?: MessageStore,
): Promise<SessionState> {
  const swarmId = child.variables?.['__swarm_id']?.trim();
  if (!swarmId) return state;

  const roleId = child.variables?.['__swarm_role']?.trim() ?? child.name;
  const returned =
    child.returned ??
    (messageStore ? ((await messageStore.receive(child.name)) ?? undefined) : undefined) ??
    child.variables?.['__swarm_return'] ??
    '';
  const prefix = `${swarmId}.${roleId}`;

  let next = updateVariable(state, `${prefix}.status`, child.status);
  next = updateVariable(
    next,
    `${prefix}.exit_code`,
    parseExitCode(child.variables?.['last_exit_code']),
  );
  next = updateVariable(next, `${prefix}.returned`, returned);
  next = updateVariable(next, `${prefix}.result`, decodeJsonVariableValue(returned));
  next = updateVariable(next, `${prefix}.started_at`, child.startedAt ?? '');
  next = updateVariable(next, `${prefix}.completed_at`, child.completedAt ?? '');
  return next;
}

/** Advance an await node: poll children and block until target(s) complete. */
async function advanceAwaitNode(
  node: AwaitNode,
  current: SessionState,
  processSpawner?: ProcessSpawner,
  messageStore?: MessageStore,
): Promise<AutoAdvanceResult | { state: SessionState; advanced: true }> {
  if (!processSpawner) {
    return { state: advanceFromPath(current, current.currentNodePath), advanced: true };
  }

  const namedTargets =
    node.target === 'all' ? null : Array.isArray(node.target) ? node.target : [node.target];
  const children =
    namedTargets === null
      ? Object.values(current.spawnedChildren)
      : namedTargets
          .map((target) => current.spawnedChildren[target])
          .filter(
            (child): child is import('../domain/session-state.js').SpawnedChild => child != null,
          );

  // D6: Warn when named await target doesn't match any spawned child
  if (namedTargets !== null && children.length === 0) {
    const state = {
      ...current,
      warnings: [
        ...current.warnings,
        `Await target "${namedTargets.join(', ')}" does not match any spawned child — advancing past await.`,
      ],
    };
    return { state: advanceFromPath(state, state.currentNodePath), advanced: true };
  }

  let state = current;
  let allDone = true;

  for (const child of children) {
    if (!child) continue;

    let terminalChild = child;
    if (child.status === 'running') {
      const status = await processSpawner.poll(child.stateDir);
      if (status.status === 'running') {
        if (child.pid !== undefined && !isPidAlive(child.pid)) {
          terminalChild = {
            ...child,
            status: 'failed',
            completedAt: new Date().toISOString(),
          };
          state = updateSpawnedChild(state, child.name, terminalChild);
          state = await importAwaitedSwarmResult(state, terminalChild, messageStore);
          continue;
        }
        allDone = false;
        continue;
      }

      terminalChild = {
        name: child.name,
        pid: child.pid,
        stateDir: child.stateDir,
        startedAt: child.startedAt,
        completedAt: child.completedAt ?? new Date().toISOString(),
        returned: child.returned,
        status: status.status,
        variables: status.variables ?? undefined,
      };
      state = updateSpawnedChild(state, child.name, terminalChild);
    }

    state = importChildVariablesWithPrefix(state, terminalChild);
    state = await importAwaitedSwarmResult(state, terminalChild, messageStore);
  }

  if (!allDone) {
    // D2: Track poll count via nodeProgress — timeout after MAX_AWAIT_POLLS
    const progress = state.nodeProgress[node.id];
    const pollCount = (progress?.iteration ?? 0) + 1;

    if (pollCount >= MAX_AWAIT_POLLS) {
      for (const child of children) {
        if (child?.status === 'running') {
          state = updateSpawnedChild(state, child.name, {
            name: child.name,
            pid: child.pid,
            stateDir: child.stateDir,
            status: 'failed',
            startedAt: child.startedAt,
            completedAt: new Date().toISOString(),
            returned: child.returned,
            variables: child.variables,
          });
        }
      }
      state = {
        ...state,
        warnings: [
          ...state.warnings,
          `Await timeout after ${MAX_AWAIT_POLLS} polls; marked remaining children as failed.`,
        ],
      };
      return { state: advanceFromPath(state, state.currentNodePath), advanced: true };
    }

    state = updateNodeProgress(state, node.id, {
      iteration: pollCount,
      maxIterations: MAX_AWAIT_POLLS,
      status: 'running',
      startedAt: state.nodeProgress[node.id]?.startedAt ?? Date.now(),
    });

    await new Promise((resolve) => setTimeout(resolve, computePollInterval(pollCount)));
    return { kind: 'pause', state, capturedPrompt: null };
  }

  return { state: advanceFromPath(state, state.currentNodePath), advanced: true };
}

export async function autoAdvanceNodes(
  state: SessionState,
  commandRunner?: CommandRunner,
  captureReader?: CaptureReader,
  processSpawner?: ProcessSpawner,
  auditLogger?: AuditLogger,
  memoryStore?: MemoryStore,
  messageStore?: MessageStore,
): Promise<AutoAdvanceResult> {
  const MAX_ADVANCES = 100;
  let advances = 0;
  let current = state;
  const pendingDiagnostics: FlowDiagnostic[] = [];
  const pendingOutcomes: FlowOutcome[] = [];

  if (current.status !== 'active') {
    return { kind: 'advance', state: current, capturedPrompt: null };
  }

  while (advances < MAX_ADVANCES) {
    const prevPath = current.currentNodePath;
    const node = resolveCurrentNode(current.flowSpec.nodes, current.currentNodePath);

    if (!node) {
      const exhaustionResult = await handleBodyExhaustion(current, commandRunner, captureReader);
      if (!exhaustionResult) break;
      if ('kind' in exhaustionResult) {
        if (shouldContinueAutoAdvance(exhaustionResult)) {
          pendingDiagnostics.push(...(exhaustionResult.diagnostics ?? []));
          pendingOutcomes.push(...(exhaustionResult.outcomes ?? []));
          current = exhaustionResult.state;
          advances += 1;
          continue;
        }
        return mergeAutoAdvanceSignals(pendingDiagnostics, pendingOutcomes, exhaustionResult);
      }
      current = exhaustionResult;
      if (current.status !== 'active') {
        return mergeAutoAdvanceSignals(pendingDiagnostics, pendingOutcomes, {
          kind: 'advance',
          state: current,
          capturedPrompt: null,
        });
      }
      advances += 1;
      continue;
    }

    const nodeStartedAt = Date.now();
    const rawResult = await advanceSingleNode(
      node,
      current,
      commandRunner,
      captureReader,
      processSpawner,
      auditLogger,
      memoryStore,
      messageStore,
    );
    const result = instrumentNodeAdvanceResult(
      node,
      current,
      rawResult,
      nodeStartedAt,
      auditLogger,
    );
    if ('capturedPrompt' in result) {
      if (shouldContinueAutoAdvance(result)) {
        pendingDiagnostics.push(...(result.diagnostics ?? []));
        pendingOutcomes.push(...(result.outcomes ?? []));
        current = result.state;
        advances += 1;
        if (
          current.currentNodePath.length === prevPath.length &&
          current.currentNodePath.every((v, i) => v === prevPath[i])
        ) {
          break;
        }
        continue;
      }
      return mergeAutoAdvanceSignals(pendingDiagnostics, pendingOutcomes, result);
    }
    current = result.state;
    if (current.status !== 'active') {
      return mergeAutoAdvanceSignals(pendingDiagnostics, pendingOutcomes, {
        kind: 'advance',
        state: current,
        capturedPrompt: null,
      });
    }
    advances += 1;

    // Stale-state detection: if path didn't change, node failed to advance — bail out
    if (
      current.currentNodePath.length === prevPath.length &&
      current.currentNodePath.every((v, i) => v === prevPath[i])
    ) {
      break;
    }
  }

  if (advances >= MAX_ADVANCES) {
    current = {
      ...current,
      warnings: [...current.warnings, 'Flow paused — will continue on next interaction.'],
    };
    // H-REL-007: Try to complete the flow even after MAX_ADVANCES
    current = maybeCompleteFlow(current);
    // If current node is a prompt, include it so the agent can act on it
    const currentNode = resolveCurrentNode(current.flowSpec.nodes, current.currentNodePath);
    if (currentNode?.kind === 'prompt') {
      const capturedPrompt = interpolate(currentNode.text, current.variables);
      return mergeAutoAdvanceSignals(pendingDiagnostics, pendingOutcomes, {
        kind: 'prompt',
        state: advanceFromPath(current, current.currentNodePath),
        capturedPrompt,
      });
    }
  }

  return mergeAutoAdvanceSignals(pendingDiagnostics, pendingOutcomes, {
    kind: 'advance',
    state: current,
    capturedPrompt: null,
  });
}

/** Advance a race node: launch all spawn children in parallel and poll for a winner. */
async function advanceRaceNode(
  node: RaceNode,
  current: SessionState,
  processSpawner?: ProcessSpawner,
): Promise<AutoAdvanceResult | { state: SessionState; advanced: true }> {
  if (!processSpawner) {
    let state = updateVariable(current, 'race_winner', '');
    state = advanceFromPath(state, state.currentNodePath);
    return { state, advanced: true };
  }

  const existingChildNames = current.raceChildren[node.id];

  if (!existingChildNames) {
    let state = current;
    const childNames: string[] = [];
    for (const spawnChild of node.children) {
      const stateDir = `.prompt-language-${spawnChild.name}`;
      const flowText = renderSpawnBody(spawnChild);
      const goal = `Race sub-task: ${spawnChild.name}`;
      const parentVars: Record<string, VariableValue> = filterSpawnVariables(
        state.variables,
        spawnChild.vars,
      );
      const { pid } = await processSpawner.spawn({
        name: spawnChild.name,
        goal,
        flowText,
        variables: parentVars,
        stateDir,
        ...(spawnChild.cwd != null ? { cwd: spawnChild.cwd } : {}),
      });
      if (!pid) {
        state = updateSpawnedChild(state, spawnChild.name, {
          name: spawnChild.name,
          status: 'failed',
          pid: 0,
          stateDir,
        });
        state = addWarning(state, `Race child "${spawnChild.name}" failed to start.`);
      } else {
        state = updateSpawnedChild(state, spawnChild.name, {
          name: spawnChild.name,
          status: 'running',
          pid,
          stateDir,
          startedAt: new Date().toISOString(),
        });
        childNames.push(spawnChild.name);
      }
    }
    state = updateRaceChildren(state, node.id, childNames);
    state = updateNodeProgress(state, node.id, {
      iteration: 1,
      maxIterations: MAX_AWAIT_POLLS,
      status: 'running',
      startedAt: Date.now(),
    });
    await new Promise((resolve) => setTimeout(resolve, computePollInterval(1)));
    return { kind: 'pause', state, capturedPrompt: null };
  }

  // Check wall-clock timeout
  if (node.timeoutSeconds != null) {
    const progress = current.nodeProgress[node.id];
    const startedAt = progress?.startedAt;
    if (startedAt != null) {
      const elapsed = (Date.now() - startedAt) / 1000;
      if (elapsed >= node.timeoutSeconds) {
        let state = updateVariable(current, 'race_winner', '');
        state = addWarning(state, `Race node timed out after ${node.timeoutSeconds}s.`);
        state = advanceFromPath(state, state.currentNodePath);
        return { state, advanced: true };
      }
    }
  }

  // Poll children for winner
  let state = current;
  let winner: string | null = null;
  for (const childName of existingChildNames) {
    const child = state.spawnedChildren[childName];
    if (!child) continue;
    if (child.status !== 'running') {
      if (child.status === 'completed' && winner === null) winner = childName;
      continue;
    }
    const status = await processSpawner.poll(child.stateDir);
    const updatedChild = {
      name: child.name,
      pid: child.pid,
      stateDir: child.stateDir,
      status: status.status,
      variables: status.variables ?? undefined,
    } as const;
    state = updateSpawnedChild(state, childName, updatedChild);
    if (status.status === 'completed' && winner === null) {
      winner = childName;
      if (status.variables) {
        for (const [k, v] of Object.entries(status.variables)) {
          state = updateVariable(state, k, v);
        }
      }
    }
    if (status.status === 'running' && child.pid !== undefined && !isPidAlive(child.pid)) {
      state = updateSpawnedChild(state, childName, {
        ...child,
        status: 'failed',
      });
    }
  }

  if (winner !== null) {
    state = updateVariable(state, 'race_winner', winner);
    if (processSpawner) {
      state = await terminateRaceLosers(state, node.id, winner, processSpawner);
    }
    state = advanceFromPath(state, state.currentNodePath);
    return { state, advanced: true };
  }

  const allSettled = existingChildNames.every((name) => {
    const child = state.spawnedChildren[name];
    return child?.status === 'completed' || child?.status === 'failed';
  });
  if (allSettled) {
    state = updateVariable(state, 'race_winner', '');
    state = advanceFromPath(state, state.currentNodePath);
    return { state, advanced: true };
  }

  const progress = state.nodeProgress[node.id];
  const pollCount = (progress?.iteration ?? 0) + 1;
  if (pollCount >= MAX_AWAIT_POLLS) {
    state = updateVariable(state, 'race_winner', '');
    state = addWarning(state, `Race timeout after ${MAX_AWAIT_POLLS} polls; no winner declared.`);
    state = advanceFromPath(state, state.currentNodePath);
    return { state, advanced: true };
  }
  state = updateNodeProgress(state, node.id, {
    iteration: pollCount,
    maxIterations: MAX_AWAIT_POLLS,
    status: 'running',
    startedAt: progress?.startedAt ?? Date.now(),
  });
  await new Promise((resolve) => setTimeout(resolve, computePollInterval(pollCount)));
  return { kind: 'pause', state, capturedPrompt: null };
}

/** Advance a foreach-spawn node: resolve the list and launch one spawn child per item. */
async function advanceForeachSpawnNode(
  node: ForeachSpawnNode,
  current: SessionState,
  processSpawner?: ProcessSpawner,
): Promise<AutoAdvanceResult | { state: SessionState; advanced: true }> {
  if (!processSpawner) {
    return { state: advanceFromPath(current, current.currentNodePath), advanced: true };
  }
  const rawList = node.listCommand
    ? stringifyVariableValue(current.variables[`_foreach_${node.id}_list`] ?? '')
    : interpolate(node.listExpression, current.variables);
  const items = splitIterable(rawList).slice(0, node.maxItems);
  let state = current;
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const childName = `${node.variableName}_${i}`;
    const stateDir = `.prompt-language-${childName}`;
    const parentVars: Record<string, VariableValue> = filterSpawnVariables(state.variables);
    parentVars[node.variableName] = item;
    const flowText = renderNodesToDsl(node.body, 1).join('\n');
    const goal = `${node.variableName} item ${i}: ${item}`;
    const { pid } = await processSpawner.spawn({
      name: childName,
      goal,
      flowText,
      variables: parentVars,
      stateDir,
    });
    if (!pid) {
      state = updateSpawnedChild(state, childName, {
        name: childName,
        status: 'failed',
        pid: 0,
        stateDir,
      });
      state = addWarning(state, `foreach-spawn child "${childName}" failed to start.`);
    } else {
      state = updateSpawnedChild(state, childName, {
        name: childName,
        status: 'running',
        pid,
        stateDir,
        startedAt: new Date().toISOString(),
      });
    }
  }
  state = advanceFromPath(state, state.currentNodePath);
  return { state, advanced: true };
}

/** Advance a remember node: persist a memory entry and auto-advance. */
async function advanceRememberNode(
  node: RememberNode,
  current: SessionState,
  memoryStore?: MemoryStore,
): Promise<{ state: SessionState; advanced: true }> {
  if (memoryStore) {
    const resolvedValue =
      node.value !== undefined ? interpolate(node.value, current.variables) : undefined;
    const resolvedText =
      node.text !== undefined ? interpolate(node.text, current.variables) : undefined;
    await memoryStore.append({
      timestamp: new Date().toISOString(),
      ...(resolvedText !== undefined ? { text: resolvedText } : {}),
      ...(node.key !== undefined ? { key: node.key } : {}),
      ...(resolvedValue !== undefined ? { value: resolvedValue } : {}),
    });
  }
  return { state: advanceFromPath(current, current.currentNodePath), advanced: true };
}

/** Advance a send node: write a message to the target's inbox and auto-advance. */
async function advanceSendNode(
  node: SendNode,
  current: SessionState,
  messageStore?: MessageStore,
): Promise<{ state: SessionState; advanced: true }> {
  if (messageStore) {
    const resolvedMessage = interpolate(node.message, current.variables);
    await messageStore.send(node.target, resolvedMessage);
  }
  return { state: advanceFromPath(current, current.currentNodePath), advanced: true };
}

/**
 * Advance a receive node: read the oldest unconsumed message from the inbox.
 *
 * If a message is available, store it in the named variable and advance.
 * If no message is available, do NOT advance (block until next hook call).
 * If timeoutSeconds is set and the node has been waiting longer than that,
 * store "" and advance.
 */
async function advanceReceiveNode(
  node: ReceiveNode,
  current: SessionState,
  messageStore?: MessageStore,
): Promise<AutoAdvanceResult | { state: SessionState; advanced: true }> {
  // Check wall-clock timeout first
  if (node.timeoutSeconds !== undefined) {
    const progress = current.nodeProgress[node.id];
    const startedAt = progress?.startedAt ?? Date.now();
    const elapsed = (Date.now() - startedAt) / 1000;
    if (elapsed >= node.timeoutSeconds) {
      let s = updateVariable(current, node.variableName, '');
      s = updateNodeProgress(s, node.id, {
        iteration: 1,
        maxIterations: 1,
        status: 'completed',
        startedAt,
        completedAt: Date.now(),
      });
      return { state: advanceFromPath(s, s.currentNodePath), advanced: true };
    }
  }

  if (!messageStore) {
    const s = updateVariable(current, node.variableName, '');
    return { state: advanceFromPath(s, s.currentNodePath), advanced: true };
  }

  const from = node.from ?? 'parent';
  const message = await messageStore.receive(from);

  if (message === undefined) {
    const existingProgress = current.nodeProgress[node.id];
    if (!existingProgress) {
      const s = updateNodeProgress(current, node.id, {
        iteration: 1,
        maxIterations: 1,
        status: 'running',
        startedAt: Date.now(),
      });
      return { kind: 'pause', state: s, capturedPrompt: null };
    }
    return { kind: 'pause', state: current, capturedPrompt: null };
  }

  let s = updateVariable(current, node.variableName, message);
  s = updateNodeProgress(s, node.id, {
    iteration: 1,
    maxIterations: 1,
    status: 'completed',
    startedAt: current.nodeProgress[node.id]?.startedAt ?? Date.now(),
    completedAt: Date.now(),
  });
  return { state: advanceFromPath(s, s.currentNodePath), advanced: true };
}

function samePath(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function isDescendantPath(ancestor: readonly number[], descendant: readonly number[]): boolean {
  return (
    descendant.length > ancestor.length &&
    ancestor.every((value, index) => value === descendant[index])
  );
}

function describeAuditNode(node: FlowNode): string {
  switch (node.kind) {
    case 'prompt':
      return `prompt: ${node.text}`;
    case 'run':
      return `run: ${node.command}`;
    case 'let':
      return `let ${node.variableName}`;
    case 'while':
      return `while ${node.condition}`;
    case 'until':
      return `until ${node.condition}`;
    case 'retry':
      return `retry max ${node.maxAttempts}`;
    case 'if':
      return `if ${node.condition}`;
    case 'try':
      return 'try';
    case 'foreach':
      return `foreach ${node.variableName}`;
    case 'break':
      return 'break';
    case 'continue':
      return 'continue';
    case 'spawn':
      return `spawn "${node.name}"`;
    case 'await':
      return `await ${node.target}`;
    case 'approve':
      return `approve "${node.message}"`;
    case 'review':
      return `review max ${node.maxRounds}`;
    case 'race':
      return 'race';
    case 'foreach_spawn':
      return `foreach-spawn ${node.variableName}`;
    case 'remember':
      return node.key != null ? `remember ${node.key}` : 'remember';
    case 'send':
      return `send "${node.target}"`;
    case 'receive':
      return `receive ${node.variableName}`;
    case 'swarm':
      return `swarm ${node.name}`;
    case 'start':
      return `start ${node.targets.join(', ')}`;
    case 'return':
      return `return ${node.expression}`;
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

function cloneNodeProgressWithTiming(
  progress: import('../domain/session-state.js').NodeProgress,
  startedAt: number,
  completedAt?: number,
): import('../domain/session-state.js').NodeProgress {
  return {
    iteration: progress.iteration,
    maxIterations: progress.maxIterations,
    status: progress.status,
    ...(progress.branchEndOffset !== undefined
      ? { branchEndOffset: progress.branchEndOffset }
      : {}),
    ...(progress.captureFailureReason !== undefined
      ? { captureFailureReason: progress.captureFailureReason }
      : {}),
    ...(progress.askRetryCount !== undefined ? { askRetryCount: progress.askRetryCount } : {}),
    startedAt,
    ...(completedAt !== undefined ? { completedAt } : {}),
    ...(progress.loopStartedAt !== undefined ? { loopStartedAt: progress.loopStartedAt } : {}),
  };
}

function recordNodeTiming(
  before: SessionState,
  after: SessionState,
  node: FlowNode,
  startedAt: number,
  finishedAt: number,
): SessionState {
  const previous = before.nodeProgress[node.id];
  const next = after.nodeProgress[node.id];
  const pathChanged = !samePath(before.currentNodePath, after.currentNodePath);
  const enteredChild = isDescendantPath(before.currentNodePath, after.currentNodePath);
  const completedByAdvance = pathChanged && !enteredChild;

  if (!next) {
    if (!completedByAdvance) return after;
    return updateNodeProgress(after, node.id, {
      iteration: previous?.iteration ?? 1,
      maxIterations: previous?.maxIterations ?? 1,
      status: 'completed',
      startedAt: previous?.startedAt ?? startedAt,
      completedAt: finishedAt,
      ...(previous?.loopStartedAt !== undefined ? { loopStartedAt: previous.loopStartedAt } : {}),
    });
  }

  const needsStartedAt = next.startedAt === undefined;
  const shouldComplete =
    next.completedAt === undefined &&
    (next.status === 'completed' || next.status === 'failed' || completedByAdvance);

  if (!needsStartedAt && !shouldComplete) return after;

  const nextStatus: import('../domain/session-state.js').NodeProgress['status'] =
    completedByAdvance && next.status !== 'awaiting_capture' && next.status !== 'failed'
      ? 'completed'
      : next.status;

  return updateNodeProgress(
    after,
    node.id,
    cloneNodeProgressWithTiming(
      { ...next, status: nextStatus },
      next.startedAt ?? previous?.startedAt ?? startedAt,
      shouldComplete ? finishedAt : next.completedAt,
    ),
  );
}

function instrumentNodeAdvanceResult<
  T extends AutoAdvanceResult | { state: SessionState; advanced: true },
>(
  node: FlowNode,
  before: SessionState,
  result: T,
  startedAt: number,
  auditLogger?: AuditLogger,
): T {
  const finishedAt = Date.now();
  const state = recordNodeTiming(before, result.state, node, startedAt, finishedAt);

  auditLogger?.log({
    timestamp: new Date(finishedAt).toISOString(),
    event: 'node_advance',
    command: describeAuditNode(node),
    nodeId: node.id,
    nodeKind: node.kind,
    nodePath: before.currentNodePath.join('.'),
    durationMs: Math.max(0, finishedAt - startedAt),
  });

  return { ...result, state } as T;
}

/** Advance a single node by kind. Returns either an early-exit result or updated state. */
async function advanceSingleNode(
  node: FlowNode,
  current: SessionState,
  commandRunner?: CommandRunner,
  captureReader?: CaptureReader,
  processSpawner?: ProcessSpawner,
  auditLogger?: AuditLogger,
  memoryStore?: MemoryStore,
  messageStore?: MessageStore,
): Promise<AutoAdvanceResult | { state: SessionState; advanced: true }> {
  switch (node.kind) {
    case 'let':
      return advanceLetNode(node, current, commandRunner, captureReader, memoryStore);
    case 'run':
      return advanceRunNode(node, current, commandRunner, auditLogger);
    case 'prompt': {
      const capturedPrompt = interpolate(node.text, current.variables);
      return {
        kind: 'prompt',
        state: advanceFromPath(current, current.currentNodePath),
        capturedPrompt,
      };
    }
    case 'while':
    case 'until':
      return advanceConditionLoop(node, current, commandRunner, captureReader);
    case 'retry': {
      const now = Date.now();
      return {
        state: advanceNode(
          updateNodeProgress(current, node.id, {
            iteration: 1,
            maxIterations: node.maxAttempts,
            status: 'running',
            startedAt: now,
            loopStartedAt: now,
          }),
          [...current.currentNodePath, 0],
        ),
        advanced: true,
      };
    }
    case 'if':
      return advanceIfNode(node, current, commandRunner, captureReader);
    case 'try':
      return { state: advanceNode(current, [...current.currentNodePath, 0]), advanced: true };
    case 'foreach':
      return advanceForeachEntry(node, current, commandRunner);
    case 'break':
      return advanceBreakNode(node, current);
    case 'continue':
      return advanceContinueNode(node, current);
    case 'spawn':
      return advanceSpawnNode(node, current, processSpawner, commandRunner);
    case 'await':
      return advanceAwaitNode(node, current, processSpawner, messageStore);
    case 'approve':
      return advanceApproveNode(node, current);
    case 'review': {
      const now = Date.now();
      return {
        state: advanceNode(
          updateNodeProgress(current, node.id, {
            iteration: 1,
            maxIterations: node.maxRounds,
            status: 'running',
            startedAt: now,
            loopStartedAt: now,
          }),
          [...current.currentNodePath, 0],
        ),
        advanced: true,
      };
    }
    case 'race':
      return advanceRaceNode(node, current, processSpawner);
    case 'foreach_spawn':
      return advanceForeachSpawnNode(node, current, processSpawner);
    case 'remember':
      return advanceRememberNode(node, current, memoryStore);
    case 'send':
      return advanceSendNode(node, current, messageStore);
    case 'receive':
      return advanceReceiveNode(node, current, messageStore);
    case 'swarm':
    case 'start':
    case 'return':
      return unexpectedLoweredAwayNode(node);
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

// H#15: Break exits the nearest enclosing loop (while/until/retry/foreach).
const LOOP_KINDS = new Set(['while', 'until', 'retry', 'foreach']);

function advanceBreakNode(
  node: BreakNode,
  current: SessionState,
): { state: SessionState; advanced: true } {
  const path = current.currentNodePath;
  for (let depth = path.length - 1; depth >= 1; depth--) {
    const ancestorPath = path.slice(0, depth);
    const ancestor = resolveCurrentNode(current.flowSpec.nodes, ancestorPath);
    if (ancestor && LOOP_KINDS.has(ancestor.kind)) {
      // H-LANG-011: If break has a label, only match loop with that label
      if (node.label) {
        const loopLabel = (ancestor as WhileNode | UntilNode | RetryNode | ForeachNode).label;
        if (loopLabel !== node.label) continue;
      }
      return { state: advanceFromPath(current, ancestorPath), advanced: true };
    }
  }
  // No loop ancestor — just advance past break (warning situation, but don't crash)
  return { state: advanceFromPath(current, path), advanced: true };
}

// H-LANG-002: Continue re-enters the nearest enclosing loop at the next iteration.
// Sets path past the loop body so handleBodyExhaustion in autoAdvanceNodes
// decides whether to re-loop or exit.
function advanceContinueNode(
  node: ContinueNode,
  current: SessionState,
): { state: SessionState; advanced: true } {
  const path = current.currentNodePath;
  for (let depth = path.length - 1; depth >= 1; depth--) {
    const ancestorPath = path.slice(0, depth);
    const ancestor = resolveCurrentNode(current.flowSpec.nodes, ancestorPath);
    if (!ancestor || !LOOP_KINDS.has(ancestor.kind)) continue;

    // H-LANG-011: If continue has a label, only match loop with that label
    if (node.label) {
      const loopLabel = (ancestor as WhileNode | UntilNode | RetryNode | ForeachNode).label;
      if (loopLabel !== node.label) continue;
    }

    // Move path past the loop body end. The autoAdvanceNodes loop's
    // body-exhaustion path will handle re-entry or exit.
    const loopBody = (ancestor as FlowNode & { body: readonly FlowNode[] }).body;
    return {
      state: advanceNode(current, [...ancestorPath, loopBody.length]),
      advanced: true,
    };
  }
  // No loop ancestor — just advance past continue
  return { state: advanceFromPath(current, path), advanced: true };
}

/** Advance a while or until node on first encounter. */
async function advanceConditionLoop(
  node: FlowNode & {
    readonly kind: 'while' | 'until';
    readonly condition: string;
    readonly maxIterations: number;
    readonly askMaxRetries?: number | undefined;
    readonly groundedBy?: string | undefined;
  },
  current: SessionState,
  commandRunner?: CommandRunner,
  captureReader?: CaptureReader,
): Promise<AutoAdvanceResult | { state: SessionState; advanced: true }> {
  // AI-evaluated condition: two-phase capture (emit judge prompt, then read verdict)
  if (isAskCondition(node.condition)) {
    const varName = judgeVarName(node.id);
    const progress = current.nodeProgress[node.id];
    const isAwaiting = progress?.status === 'awaiting_capture';
    const retryCount = progress?.askRetryCount ?? 0;
    const maxRetries = node.askMaxRetries ?? 0;
    const usesRetryBudget = node.askMaxRetries != null;
    const question = extractAskQuestion(node.condition);

    if (!isAwaiting) {
      // Grounded-by fast path: keep current deterministic behavior unless max-retries
      // is explicitly enabled for the ask condition.
      if (!usesRetryBudget && node.groundedBy && commandRunner) {
        try {
          const groundingCommand = normalizeGroundingCommand(
            interpolate(node.groundedBy, current.variables),
          );
          const groundingResult = await commandRunner.run(groundingCommand);
          const groundingMet = groundingResult.exitCode === 0;
          const enterBody = node.kind === 'while' ? groundingMet : !groundingMet;
          return {
            state: handleLoopReentry(
              current,
              current.currentNodePath,
              node.id,
              enterBody,
              node.maxIterations,
              node.timeoutSeconds,
            ),
            advanced: true as const,
          };
        } catch {
          // Grounding command failed to run — fall through to AI judge path
        }
      }

      // Phase 1: emit judge prompt and wait for Claude's verdict
      if (captureReader) await captureReader.clear(varName);
      const now = Date.now();
      const updated = updateNodeProgress(current, node.id, {
        iteration: progress?.iteration ?? 0,
        maxIterations: node.maxIterations,
        status: 'awaiting_capture',
        askRetryCount: retryCount,
        startedAt: progress?.startedAt ?? now,
        loopStartedAt: progress?.loopStartedAt ?? now,
      });
      const groundingOutput = usesRetryBudget
        ? await buildAskGroundingEvidence(node.groundedBy, current.variables, commandRunner)
        : undefined;
      return {
        kind: 'prompt',
        state: updated,
        capturedPrompt: buildJudgePrompt(question, node.id, current.captureNonce, groundingOutput),
      };
    }

    // Phase 2: read verdict from capture file
    if (captureReader) {
      const captured = await captureReader.read(varName);
      if (captured) {
        const verdict = parseAskVerdict(captured);
        await captureReader.clear(varName);
        if (verdict === null) {
          if (usesRetryBudget && retryCount < maxRetries) {
            const retryUpdated = updateNodeProgress(current, node.id, {
              iteration: progress?.iteration ?? 0,
              maxIterations: node.maxIterations,
              status: 'awaiting_capture',
              askRetryCount: retryCount + 1,
              captureFailureReason: 'ambiguous verdict',
              startedAt: progress?.startedAt,
              loopStartedAt: progress?.loopStartedAt,
            });
            const groundingOutput = await buildAskGroundingEvidence(
              node.groundedBy,
              current.variables,
              commandRunner,
            );
            return {
              kind: 'prompt',
              state: retryUpdated,
              capturedPrompt: buildJudgePrompt(
                question,
                node.id,
                current.captureNonce,
                groundingOutput,
              ),
            };
          }

          return { kind: 'pause', state: current, capturedPrompt: null };
        }

        const iteration = progress?.iteration ?? 0;
        const enterBody = node.kind === 'while' ? verdict : !verdict;

        // Check wall-clock timeout (same logic as handleLoopReentry)
        if (enterBody && node.timeoutSeconds !== undefined && node.timeoutSeconds > 0) {
          const loopStart = progress?.loopStartedAt ?? progress?.startedAt;
          if (loopStart != null) {
            const elapsed = (Date.now() - loopStart) / 1000;
            if (elapsed >= node.timeoutSeconds) {
              const warnState = addWarning(
                current,
                `Loop '${node.id}' timed out after ${node.timeoutSeconds}s.`,
              );
              const completedProgress = updateNodeProgress(warnState, node.id, {
                iteration,
                maxIterations: node.maxIterations,
                status: 'completed',
                startedAt: progress?.startedAt,
                completedAt: Date.now(),
                loopStartedAt: progress?.loopStartedAt,
              });
              return {
                state: advanceFromPath(completedProgress, current.currentNodePath),
                advanced: true,
              };
            }
          }
        }

        // Check max iterations
        if (enterBody && iteration >= node.maxIterations) {
          const warnState = addWarning(
            current,
            `Loop '${node.id}' reached max iterations (${node.maxIterations}).`,
          );
          const completedProgress = updateNodeProgress(warnState, node.id, {
            iteration,
            maxIterations: node.maxIterations,
            status: 'completed',
            startedAt: progress?.startedAt,
            completedAt: Date.now(),
            loopStartedAt: progress?.loopStartedAt,
          });
          return {
            state: advanceFromPath(completedProgress, current.currentNodePath),
            advanced: true,
          };
        }

        if (enterBody) {
          const now = Date.now();
          let s = updateNodeProgress(current, node.id, {
            iteration: iteration + 1,
            maxIterations: node.maxIterations,
            status: 'running',
            askRetryCount: retryCount,
            startedAt: progress?.startedAt ?? now,
            loopStartedAt: progress?.loopStartedAt ?? now,
          });
          s = advanceNode(s, [...current.currentNodePath, 0]);
          return { state: s, advanced: true };
        }

        // Verdict says exit — advance past this loop
        const exitState = updateNodeProgress(current, node.id, {
          iteration,
          maxIterations: node.maxIterations,
          status: 'completed',
          askRetryCount: retryCount,
          startedAt: progress?.startedAt,
          completedAt: Date.now(),
          loopStartedAt: progress?.loopStartedAt,
        });
        return {
          state: advanceFromPath(exitState, current.currentNodePath),
          advanced: true,
        };
      }
    }

    // No verdict captured yet — retry the judge prompt
    if (usesRetryBudget && retryCount >= maxRetries) {
      return { kind: 'pause', state: current, capturedPrompt: null };
    }

    if (!usesRetryBudget) {
      return {
        kind: 'prompt',
        state: current,
        capturedPrompt: buildJudgeRetryPrompt(node.id, current.captureNonce),
      };
    }

    const retryUpdated = updateNodeProgress(current, node.id, {
      iteration: progress?.iteration ?? 0,
      maxIterations: node.maxIterations,
      status: 'awaiting_capture',
      askRetryCount: retryCount + 1,
      captureFailureReason: 'capture file empty or not found',
      startedAt: progress?.startedAt,
      loopStartedAt: progress?.loopStartedAt,
    });
    const retryGroundingOutput = usesRetryBudget
      ? await buildAskGroundingEvidence(node.groundedBy, current.variables, commandRunner)
      : undefined;
    return {
      kind: 'prompt',
      state: retryUpdated,
      capturedPrompt: buildJudgePrompt(
        question,
        node.id,
        current.captureNonce,
        retryGroundingOutput,
      ),
    };
  }

  const condResult = await evaluateFlowCondition(node.condition, current.variables, commandRunner);
  if (condResult === null) return { kind: 'pause', state: current, capturedPrompt: null };
  const enterBody = node.kind === 'while' ? condResult : !condResult;

  if (enterBody) {
    const now = Date.now();
    let s = updateNodeProgress(current, node.id, {
      iteration: 1,
      maxIterations: node.maxIterations,
      status: 'running',
      startedAt: now,
      loopStartedAt: now,
    });
    s = advanceNode(s, [...current.currentNodePath, 0]);
    return { state: s, advanced: true };
  }

  return { state: advanceFromPath(current, current.currentNodePath), advanced: true };
}

/** Advance an if node: evaluate condition and enter correct branch. */
async function advanceIfNode(
  node: FlowNode & {
    readonly kind: 'if';
    readonly condition: string;
    readonly thenBranch: readonly FlowNode[];
    readonly elseBranch: readonly FlowNode[];
    readonly askMaxRetries?: number | undefined;
    readonly groundedBy?: string | undefined;
  },
  current: SessionState,
  commandRunner?: CommandRunner,
  captureReader?: CaptureReader,
): Promise<AutoAdvanceResult | { state: SessionState; advanced: true }> {
  // AI-evaluated condition: two-phase capture
  if (isAskCondition(node.condition)) {
    const varName = judgeVarName(node.id);
    const progress = current.nodeProgress[node.id];
    const isAwaiting = progress?.status === 'awaiting_capture';
    const retryCount = progress?.askRetryCount ?? 0;
    const maxRetries = node.askMaxRetries ?? 0;
    const usesRetryBudget = node.askMaxRetries != null;
    const question = extractAskQuestion(node.condition);

    if (!isAwaiting) {
      if (!usesRetryBudget && node.groundedBy && commandRunner) {
        try {
          const groundingCommand = normalizeGroundingCommand(
            interpolate(node.groundedBy, current.variables),
          );
          const groundingResult = await commandRunner.run(groundingCommand);
          const verdict = groundingResult.exitCode === 0;
          if (verdict) {
            return {
              state: enterIfBranch(current, node, 0, node.thenBranch.length),
              advanced: true,
            };
          }
          if (node.elseBranch.length > 0) {
            return {
              state: enterIfBranch(current, node, node.thenBranch.length, node.elseBranch.length),
              advanced: true,
            };
          }
          const completed = updateNodeProgress(current, node.id, {
            iteration: 1,
            maxIterations: 1,
            status: 'completed',
            startedAt: current.nodeProgress[node.id]?.startedAt ?? Date.now(),
            completedAt: Date.now(),
          });
          return {
            state: advanceFromPath(completed, current.currentNodePath),
            advanced: true,
          };
        } catch {
          // Grounding command failed to run — fall through to AI judge path
        }
      }

      // Phase 1: emit judge prompt
      if (captureReader) await captureReader.clear(varName);
      const now = Date.now();
      const updated = updateNodeProgress(current, node.id, {
        iteration: 1,
        maxIterations: 1,
        status: 'awaiting_capture',
        askRetryCount: retryCount,
        startedAt: now,
      });
      const groundingOutput = usesRetryBudget
        ? await buildAskGroundingEvidence(node.groundedBy, current.variables, commandRunner)
        : undefined;
      return {
        kind: 'prompt',
        state: updated,
        capturedPrompt: buildJudgePrompt(question, node.id, current.captureNonce, groundingOutput),
      };
    }

    // Phase 2: read verdict and branch
    if (captureReader) {
      const captured = await captureReader.read(varName);
      if (captured) {
        const verdict = parseAskVerdict(captured);
        await captureReader.clear(varName);
        if (verdict === null) {
          if (usesRetryBudget && retryCount < maxRetries) {
            const retryUpdated = updateNodeProgress(current, node.id, {
              iteration: 1,
              maxIterations: 1,
              status: 'awaiting_capture',
              askRetryCount: retryCount + 1,
              captureFailureReason: 'ambiguous verdict',
              startedAt: progress?.startedAt,
            });
            const groundingOutput = await buildAskGroundingEvidence(
              node.groundedBy,
              current.variables,
              commandRunner,
            );
            return {
              kind: 'prompt',
              state: retryUpdated,
              capturedPrompt: buildJudgePrompt(
                question,
                node.id,
                current.captureNonce,
                groundingOutput,
              ),
            };
          }
          return { kind: 'pause', state: current, capturedPrompt: null };
        }
        if (verdict) {
          return { state: enterIfBranch(current, node, 0, node.thenBranch.length), advanced: true };
        }
        if (node.elseBranch.length > 0) {
          return {
            state: enterIfBranch(current, node, node.thenBranch.length, node.elseBranch.length),
            advanced: true,
          };
        }
        const completed = updateNodeProgress(current, node.id, {
          iteration: 1,
          maxIterations: 1,
          status: 'completed',
          startedAt: current.nodeProgress[node.id]?.startedAt ?? Date.now(),
          completedAt: Date.now(),
        });
        return {
          state: advanceFromPath(completed, current.currentNodePath),
          advanced: true,
        };
      }
    }

    // No verdict captured yet — retry the judge prompt
    if (usesRetryBudget && retryCount >= maxRetries) {
      return { kind: 'pause', state: current, capturedPrompt: null };
    }

    if (!usesRetryBudget) {
      return {
        kind: 'prompt',
        state: current,
        capturedPrompt: buildJudgeRetryPrompt(node.id, current.captureNonce),
      };
    }

    const retryGroundingOutput = usesRetryBudget
      ? await buildAskGroundingEvidence(node.groundedBy, current.variables, commandRunner)
      : undefined;
    return {
      kind: 'prompt',
      state: updateNodeProgress(current, node.id, {
        iteration: 1,
        maxIterations: 1,
        status: 'awaiting_capture',
        askRetryCount: retryCount + 1,
        captureFailureReason: 'capture file empty or not found',
        startedAt: progress?.startedAt,
      }),
      capturedPrompt: buildJudgePrompt(
        question,
        node.id,
        current.captureNonce,
        retryGroundingOutput,
      ),
    };
  }

  const condResult = await evaluateFlowCondition(node.condition, current.variables, commandRunner);
  if (condResult === null) return { kind: 'pause', state: current, capturedPrompt: null };

  if (condResult) {
    return { state: enterIfBranch(current, node, 0, node.thenBranch.length), advanced: true };
  }
  if (node.elseBranch.length > 0) {
    return {
      state: enterIfBranch(current, node, node.thenBranch.length, node.elseBranch.length),
      advanced: true,
    };
  }
  const completed = updateNodeProgress(current, node.id, {
    iteration: 1,
    maxIterations: 1,
    status: 'completed',
    startedAt: current.nodeProgress[node.id]?.startedAt ?? Date.now(),
    completedAt: Date.now(),
  });
  return { state: advanceFromPath(completed, current.currentNodePath), advanced: true };
}

/** Advance a foreach node on first encounter: set loop variable and enter body. */
async function advanceForeachEntry(
  node: FlowNode & { readonly kind: 'foreach' },
  current: SessionState,
  commandRunner?: CommandRunner,
): Promise<AutoAdvanceResult | { state: SessionState; advanced: true }> {
  let items: string[];

  // H-LANG-007: Dynamic list from command execution
  if (node.listCommand) {
    if (!commandRunner) return { kind: 'pause', state: current, capturedPrompt: null };
    const prepared = prepareShellCommand(node.listCommand, current.variables, current.flowSpec.env);
    const result = await commandRunner.run(
      prepared.command,
      prepared.env != null ? { env: prepared.env } : undefined,
    );
    current = setExitVariables(current, result.exitCode, result.stdout, result.stderr);
    const output = result.stdout.trimEnd();
    items = splitIterable(output);
    // Store output so body-exhaustion can re-derive items without re-running cmd
    current = updateVariable(current, `_foreach_${node.id}_list`, output);
  } else {
    const rawList = interpolate(node.listExpression, current.variables);
    items = splitIterable(rawList);
  }

  if (items.length === 0) {
    return { state: advanceFromPath(current, current.currentNodePath), advanced: true };
  }

  const cappedItems = items.slice(0, node.maxIterations);
  const now = Date.now();
  let s = updateVariable(current, node.variableName, cappedItems[0]!);
  s = updateVariable(s, `${node.variableName}_index`, 0);
  s = updateVariable(s, `${node.variableName}_length`, cappedItems.length);
  s = updateNodeProgress(s, node.id, {
    iteration: 1,
    maxIterations: cappedItems.length,
    status: 'running',
    startedAt: now,
    loopStartedAt: now,
  });
  return { state: advanceNode(s, [...current.currentNodePath, 0]), advanced: true };
}

export function maybeCompleteFlow(state: SessionState): SessionState {
  if (state.status !== 'active') return state;
  if (state.currentNodePath.length > 1) return state;
  const node = resolveCurrentNode(state.flowSpec.nodes, state.currentNodePath);
  if (node !== null) return state;
  if (state.flowSpec.completionGates.length === 0 || allGatesPassing(state)) {
    return markCompleted(state);
  }
  return state;
}
