/**
 * Advance-flow — node advancement and flow completion logic.
 *
 * Extracted from inject-context.ts to isolate advancement concerns.
 */

import {
  advanceNode,
  updateVariable,
  updateNodeProgress,
  markCompleted,
  allGatesPassing,
} from '../domain/session-state.js';
import type { SessionState } from '../domain/session-state.js';
import type { FlowNode, LetNode, RunNode } from '../domain/flow-node.js';
import type { CommandRunner } from './ports/command-runner.js';
import type { CaptureReader } from './ports/capture-reader.js';
import { interpolate, shellInterpolate } from '../domain/interpolate.js';
import { evaluateCondition } from '../domain/evaluate-condition.js';
import { resolveBuiltinCommand, isInvertedPredicate } from './evaluate-completion.js';
import { splitIterable } from '../domain/split-iterable.js';
import { initEmptyList, appendToList, listLength } from '../domain/list-variable.js';
import {
  buildCapturePrompt,
  buildCaptureRetryPrompt,
  DEFAULT_MAX_CAPTURE_RETRIES,
} from '../domain/capture-prompt.js';

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
      return resolveCurrentNode(node.body, rest);
    case 'if':
      return resolveCurrentNode([...node.thenBranch, ...node.elseBranch], rest);
    case 'try':
      return resolveCurrentNode([...node.body, ...node.catchBody], rest);
    default:
      return null;
  }
}

export function advancePath(path: readonly number[]): readonly number[] {
  if (path.length === 0) return [0];
  const last = path[path.length - 1]!;
  return [...path.slice(0, -1), last + 1];
}

const MAX_OUTPUT_LENGTH = 2000;

function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_LENGTH) return output;
  return output.slice(0, MAX_OUTPUT_LENGTH) + '\n... (truncated)';
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

/**
 * Evaluate a flow condition using variable lookup, falling back to command execution.
 * Returns null if the condition cannot be resolved.
 */
export async function evaluateFlowCondition(
  condition: string,
  variables: Readonly<Record<string, string | number | boolean>>,
  commandRunner?: CommandRunner,
): Promise<boolean | null> {
  const pureResult = evaluateCondition(condition, variables);
  if (pureResult !== null) return pureResult;

  if (!commandRunner) return null;

  const command = resolveBuiltinCommand(condition);
  if (!command) return null;

  const result = await commandRunner.run(command);
  const inverted = isInvertedPredicate(condition);
  return inverted ? result.exitCode !== 0 : result.exitCode === 0;
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

/**
 * Shared loop re-entry logic for while/until/retry exhaustion.
 * If shouldReLoop is true and iteration < max, re-enters the body; otherwise exits the loop.
 */
function handleLoopReentry(
  state: SessionState,
  parentPath: readonly number[],
  nodeId: string,
  shouldReLoop: boolean,
  maxIter: number,
): SessionState {
  const progress = state.nodeProgress[nodeId];
  const iteration = progress?.iteration ?? 1;
  let current = state;

  if (shouldReLoop && iteration < maxIter) {
    current = updateNodeProgress(current, nodeId, {
      iteration: iteration + 1,
      maxIterations: maxIter,
      status: 'running',
    });
    return advanceNode(current, [...parentPath, 0]);
  }

  current = updateNodeProgress(current, nodeId, {
    iteration,
    maxIterations: maxIter,
    status: 'completed',
  });
  return advanceNode(current, advancePath(parentPath));
}

/**
 * Handle body exhaustion: when resolveCurrentNode returns null and we're
 * inside a parent scope (path.length >= 2), decide whether to loop or exit.
 */
async function handleBodyExhaustion(
  state: SessionState,
  commandRunner?: CommandRunner,
): Promise<SessionState | null> {
  const path = state.currentNodePath;
  if (path.length <= 1) return null;

  const parentPath = path.slice(0, -1);
  const parentNode = resolveCurrentNode(state.flowSpec.nodes, parentPath);
  if (!parentNode) return null;

  switch (parentNode.kind) {
    case 'while': {
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
      );
    }

    case 'until': {
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
      );
    }

    case 'retry': {
      const commandFailed = state.variables['command_failed'];
      return handleLoopReentry(
        state,
        parentPath,
        parentNode.id,
        commandFailed === true,
        parentNode.maxAttempts,
      );
    }

    case 'foreach': {
      const rawList = interpolate(parentNode.listExpression, state.variables);
      const items = splitIterable(rawList).slice(0, parentNode.maxIterations);
      const progress = state.nodeProgress[parentNode.id];
      const iteration = progress?.iteration ?? 1;
      let current = state;

      if (iteration < items.length) {
        const nextItem = items[iteration]!;
        current = updateVariable(current, parentNode.variableName, nextItem);
        current = updateVariable(current, `${parentNode.variableName}_index`, iteration);
        current = updateNodeProgress(current, parentNode.id, {
          iteration: iteration + 1,
          maxIterations: items.length,
          status: 'running',
        });
        return advanceNode(current, [...parentPath, 0]);
      }

      current = updateNodeProgress(current, parentNode.id, {
        iteration,
        maxIterations: items.length,
        status: 'completed',
      });
      return advanceNode(current, advancePath(parentPath));
    }

    case 'if':
    case 'try':
      return advanceNode(state, advancePath(parentPath));

    default:
      return null;
  }
}

export interface AutoAdvanceResult {
  readonly state: SessionState;
  readonly capturedPrompt: string | null;
}

/** Advance a let node, handling all source types (literal, empty_list, prompt, run). */
async function advanceLetNode(
  node: LetNode,
  current: SessionState,
  commandRunner?: CommandRunner,
  captureReader?: CaptureReader,
): Promise<AutoAdvanceResult | { state: SessionState; advanced: true }> {
  let value: string;
  let tryCatchJump: readonly number[] | null = null;

  switch (node.source.type) {
    case 'literal':
      value = node.source.value;
      break;
    case 'empty_list':
      value = initEmptyList();
      break;
    case 'prompt': {
      const result = await advanceLetPrompt(node, current, captureReader);
      if ('capturedPrompt' in result) return result;
      current = result.state;
      value = result.value;
      break;
    }
    case 'run': {
      if (!commandRunner) return { state: current, capturedPrompt: null };
      const letCmd = shellInterpolate(node.source.command, current.variables);
      const result = await commandRunner.run(letCmd);
      value = result.stdout.trimEnd();
      current = setExitVariables(current, result.exitCode, result.stdout, result.stderr);
      if (result.exitCode !== 0) {
        tryCatchJump = findTryCatchJump(current.flowSpec.nodes, current.currentNodePath);
      }
      break;
    }
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
    current = advanceNode(current, advancePath(current.currentNodePath));
  }
  return { state: current, advanced: true };
}

/** Handle let-prompt two-phase capture (emit meta-prompt or read captured file). */
async function advanceLetPrompt(
  node: LetNode,
  current: SessionState,
  captureReader?: CaptureReader,
): Promise<AutoAdvanceResult | { state: SessionState; value: string }> {
  const progress = current.nodeProgress[node.id];
  const isAwaiting = progress?.status === 'awaiting_capture';

  if (!isAwaiting) {
    if (captureReader) await captureReader.clear(node.variableName);
    const updated = updateNodeProgress(current, node.id, {
      iteration: 1,
      maxIterations: DEFAULT_MAX_CAPTURE_RETRIES,
      status: 'awaiting_capture',
    });
    const promptText = interpolate(
      node.source.type === 'prompt' ? node.source.text : '',
      current.variables,
    );
    return { state: updated, capturedPrompt: buildCapturePrompt(promptText, node.variableName) };
  }

  if (captureReader) {
    const captured = await captureReader.read(node.variableName);
    if (captured) {
      await captureReader.clear(node.variableName);
      return { state: current, value: captured };
    }
  }

  const iteration = progress.iteration;
  if (iteration < progress.maxIterations) {
    const updated = updateNodeProgress(current, node.id, {
      iteration: iteration + 1,
      maxIterations: progress.maxIterations,
      status: 'awaiting_capture',
    });
    return { state: updated, capturedPrompt: buildCaptureRetryPrompt(node.variableName) };
  }

  return {
    state: {
      ...current,
      warnings: [
        ...current.warnings,
        `Variable capture for '${node.variableName}' failed after ${progress.maxIterations} attempts; using empty string.`,
      ],
    },
    value: '',
  };
}

/** Advance a run node: execute command, set exit variables, handle try/catch. */
async function advanceRunNode(
  node: RunNode,
  current: SessionState,
  commandRunner?: CommandRunner,
): Promise<AutoAdvanceResult | { state: SessionState; advanced: true }> {
  if (!commandRunner) return { state: current, capturedPrompt: null };
  const command = shellInterpolate(node.command, current.variables);
  const result = await commandRunner.run(command);
  let state = setExitVariables(current, result.exitCode, result.stdout, result.stderr);

  if (result.exitCode !== 0) {
    const jumpTarget = findTryCatchJump(state.flowSpec.nodes, state.currentNodePath);
    if (jumpTarget) {
      return { state: advanceNode(state, jumpTarget), advanced: true };
    }
  }

  state = advanceNode(state, advancePath(state.currentNodePath));
  return { state, advanced: true };
}

export async function autoAdvanceNodes(
  state: SessionState,
  commandRunner?: CommandRunner,
  captureReader?: CaptureReader,
): Promise<AutoAdvanceResult> {
  const MAX_ADVANCES = 100;
  let advances = 0;
  let current = state;

  while (advances < MAX_ADVANCES) {
    const node = resolveCurrentNode(current.flowSpec.nodes, current.currentNodePath);

    if (!node) {
      const exhaustionResult = await handleBodyExhaustion(current, commandRunner);
      if (!exhaustionResult) break;
      current = exhaustionResult;
      advances += 1;
      continue;
    }

    const result = await advanceSingleNode(node, current, commandRunner, captureReader);
    if ('capturedPrompt' in result) return result;
    current = result.state;
    advances += 1;
  }

  if (advances >= MAX_ADVANCES) {
    current = {
      ...current,
      warnings: [
        ...current.warnings,
        'MAX_ADVANCES (100) reached; auto-advance stopped to prevent infinite loop.',
      ],
    };
  }

  return { state: current, capturedPrompt: null };
}

/** Advance a single node by kind. Returns either an early-exit result or updated state. */
async function advanceSingleNode(
  node: FlowNode,
  current: SessionState,
  commandRunner?: CommandRunner,
  captureReader?: CaptureReader,
): Promise<AutoAdvanceResult | { state: SessionState; advanced: true }> {
  switch (node.kind) {
    case 'let':
      return advanceLetNode(node, current, commandRunner, captureReader);
    case 'run':
      return advanceRunNode(node, current, commandRunner);
    case 'prompt': {
      const capturedPrompt = interpolate(node.text, current.variables);
      return { state: advanceNode(current, advancePath(current.currentNodePath)), capturedPrompt };
    }
    case 'while':
    case 'until':
      return advanceConditionLoop(node, current, commandRunner);
    case 'retry':
      return {
        state: advanceNode(
          updateNodeProgress(current, node.id, {
            iteration: 1,
            maxIterations: node.maxAttempts,
            status: 'running',
          }),
          [...current.currentNodePath, 0],
        ),
        advanced: true,
      };
    case 'if':
      return advanceIfNode(node, current, commandRunner);
    case 'try':
      return { state: advanceNode(current, [...current.currentNodePath, 0]), advanced: true };
    case 'foreach':
      return advanceForeachEntry(node, current);
  }
}

/** Advance a while or until node on first encounter. */
async function advanceConditionLoop(
  node: FlowNode & {
    readonly kind: 'while' | 'until';
    readonly condition: string;
    readonly maxIterations: number;
  },
  current: SessionState,
  commandRunner?: CommandRunner,
): Promise<AutoAdvanceResult | { state: SessionState; advanced: true }> {
  const condResult = await evaluateFlowCondition(node.condition, current.variables, commandRunner);
  if (condResult === null) return { state: current, capturedPrompt: null };
  const enterBody = node.kind === 'while' ? condResult : !condResult;

  if (enterBody) {
    let s = updateNodeProgress(current, node.id, {
      iteration: 1,
      maxIterations: node.maxIterations,
      status: 'running',
    });
    s = advanceNode(s, [...current.currentNodePath, 0]);
    return { state: s, advanced: true };
  }

  return { state: advanceNode(current, advancePath(current.currentNodePath)), advanced: true };
}

/** Advance an if node: evaluate condition and enter correct branch. */
async function advanceIfNode(
  node: FlowNode & {
    readonly kind: 'if';
    readonly condition: string;
    readonly thenBranch: readonly FlowNode[];
    readonly elseBranch: readonly FlowNode[];
  },
  current: SessionState,
  commandRunner?: CommandRunner,
): Promise<AutoAdvanceResult | { state: SessionState; advanced: true }> {
  const condResult = await evaluateFlowCondition(node.condition, current.variables, commandRunner);
  if (condResult === null) return { state: current, capturedPrompt: null };

  if (condResult) {
    return { state: advanceNode(current, [...current.currentNodePath, 0]), advanced: true };
  }
  if (node.elseBranch.length > 0) {
    return {
      state: advanceNode(current, [...current.currentNodePath, node.thenBranch.length]),
      advanced: true,
    };
  }
  return { state: advanceNode(current, advancePath(current.currentNodePath)), advanced: true };
}

/** Advance a foreach node on first encounter: set loop variable and enter body. */
function advanceForeachEntry(
  node: FlowNode & { readonly kind: 'foreach' },
  current: SessionState,
): { state: SessionState; advanced: true } {
  const rawList = interpolate(node.listExpression, current.variables);
  const items = splitIterable(rawList);

  if (items.length === 0) {
    return { state: advanceNode(current, advancePath(current.currentNodePath)), advanced: true };
  }

  const cappedItems = items.slice(0, node.maxIterations);
  let s = updateVariable(current, node.variableName, cappedItems[0]!);
  s = updateVariable(s, `${node.variableName}_index`, 0);
  s = updateVariable(s, `${node.variableName}_length`, cappedItems.length);
  s = updateNodeProgress(s, node.id, {
    iteration: 1,
    maxIterations: cappedItems.length,
    status: 'running',
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
