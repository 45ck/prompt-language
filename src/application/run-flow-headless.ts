import {
  autoAdvanceNodes,
  completeAwaitingPrompt,
  maybeCompleteFlow,
  resolveCurrentNode,
} from './advance-flow.js';
import { evaluateCompletion, type EvaluateCompletionOutput } from './evaluate-completion.js';
import type { AuditLogger } from './ports/audit-logger.js';
import { NULL_TRACE_LOGGER, type TraceLogger } from './ports/trace-logger.js';
import type { CaptureReader } from './ports/capture-reader.js';
import type { CommandRunner } from './ports/command-runner.js';
import type { MemoryStore, MemoryEntry } from './ports/memory-store.js';
import type { MessageStore } from './ports/message-store.js';
import type { ProcessSpawner } from './ports/process-spawner.js';
import type { PromptTurnResult, PromptTurnRunner } from './ports/prompt-turn-runner.js';
import type { StateStore } from './ports/state-store.js';
import type { SnapshotStorePort } from './ports/snapshot-store.js';
import type { EnvReaderPort } from './ports/env-reader.js';
import { parseFlow } from './parse-flow.js';
import { renderFlow, renderFlowSummaryBlock } from '../domain/render-flow.js';
import {
  createSessionState,
  markFailed,
  updateVariable,
  type SessionState,
} from '../domain/session-state.js';
import {
  createRuntimeDiagnostic,
  createExecutionReport,
  createFlowOutcome,
  FLOW_OUTCOME_CODES,
  RUNTIME_DIAGNOSTIC_CODES,
  type DiagnosticReport,
  type FlowDiagnostic,
  type FlowOutcome,
} from '../domain/diagnostic-report.js';

export interface RunFlowHeadlessInput {
  readonly cwd: string;
  readonly flowText: string;
  readonly model?: string | undefined;
  readonly sessionId: string;
  readonly maxTurns?: number | undefined;
}

export interface RunFlowHeadlessOutput {
  readonly finalState: SessionState;
  readonly reason?: string | undefined;
  readonly report: DiagnosticReport;
  readonly turns: number;
}

const DEFAULT_MAX_TURNS = 24;
const MAX_ASSISTANT_TEXT_SNIPPET = 160;
const DEFAULT_HEADLESS_COMMAND_TIMEOUT_MS = 300_000;
function hasRunningChildren(state: SessionState): boolean {
  return Object.values(state.spawnedChildren).some((child) => child?.status === 'running');
}

function completeAwaitingPromptTurn(state: SessionState): SessionState {
  const currentNode = resolveCurrentNode(state.flowSpec.nodes, state.currentNodePath);
  if (currentNode?.kind !== 'prompt') {
    return state;
  }

  if (state.nodeProgress[currentNode.id]?.status !== 'awaiting_capture') {
    return state;
  }

  return completeAwaitingPrompt(state, currentNode.id);
}

function bindCommandRunnerCwd(commandRunner: CommandRunner, cwd: string): CommandRunner {
  return {
    run(command, options) {
      return commandRunner.run(command, {
        ...options,
        cwd: options?.cwd ?? cwd,
        timeoutMs: options?.timeoutMs ?? DEFAULT_HEADLESS_COMMAND_TIMEOUT_MS,
      });
    },
  };
}

function buildPromptEnvelope(state: SessionState, capturedPrompt: string): string {
  return `${renderFlow(state)}\n\n${capturedPrompt}\n\n${renderFlowSummaryBlock(state)}`;
}

function extractGateOnlyGoal(flowText: string): string {
  const doneWhenIndex = flowText.search(/^\s*done when:\s*$/im);
  return (doneWhenIndex >= 0 ? flowText.slice(0, doneWhenIndex) : flowText).trim();
}

function buildGateOnlyPrompt(state: SessionState, flowText: string): string {
  const goal = state.flowSpec.goal.trim() || extractGateOnlyGoal(flowText);
  const gates = state.flowSpec.completionGates.map((gate) => `  ${gate.predicate}`).join('\n');
  return gates ? `${goal}\n\ndone when:\n${gates}` : goal;
}

function summarizeAssistantText(text?: string): string | undefined {
  if (!text) return undefined;
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  if (normalized.length <= MAX_ASSISTANT_TEXT_SNIPPET) {
    return normalized;
  }
  return normalized.slice(0, MAX_ASSISTANT_TEXT_SNIPPET) + '...';
}

function summarizeCompletionBlock(result: EvaluateCompletionOutput): string {
  return (
    (result.diagnostics[0]?.summary ?? result.outcomes[0]?.summary ?? result.reason) ||
    'Completion remained blocked.'
  );
}

function appendAssistantDetail(reason: string, assistantText?: string): string {
  const detail = summarizeAssistantText(assistantText);
  return detail == null ? reason : `${reason} Last assistant output: ${detail}`;
}

function readPersistedRuntimeDiagnosticReason(state: SessionState): string | undefined {
  const code = String(state.variables['_runtime_diagnostic.code'] ?? '').trim();
  const summary = String(state.variables['_runtime_diagnostic.summary'] ?? '').trim();
  if (code.length === 0 || summary.length === 0) {
    return undefined;
  }
  return `${code} ${summary}`;
}

function markPromptRunnerFailed(
  state: SessionState,
  runResult: PromptTurnResult,
): { readonly state: SessionState; readonly reason: string; readonly diagnostic: FlowDiagnostic } {
  const detail = summarizeAssistantText(runResult.assistantText);
  const reason =
    detail == null
      ? `Prompt runner exited with code ${runResult.exitCode}.`
      : `Prompt runner exited with code ${runResult.exitCode}. ${detail}`;
  const diagnostic = createRuntimeDiagnostic(
    RUNTIME_DIAGNOSTIC_CODES.promptRunnerFailed,
    reason,
    'Inspect _runtime_diagnostic.prompt_runner.* in the saved session state for full runner output.',
    true,
  );

  let nextState = updateVariable(
    state,
    '_runtime_diagnostic.code',
    RUNTIME_DIAGNOSTIC_CODES.promptRunnerFailed,
  );
  nextState = updateVariable(nextState, '_runtime_diagnostic.summary', reason);
  nextState = updateVariable(
    nextState,
    '_runtime_diagnostic.prompt_runner.exit_code',
    String(runResult.exitCode),
  );
  nextState = updateVariable(
    nextState,
    '_runtime_diagnostic.prompt_runner.made_progress',
    String(runResult.madeProgress ?? ''),
  );
  if (runResult.assistantText != null && runResult.assistantText.trim().length > 0) {
    nextState = updateVariable(
      nextState,
      '_runtime_diagnostic.prompt_runner.output',
      runResult.assistantText,
    );
  }

  return {
    state: markFailed(nextState, reason),
    reason,
    diagnostic,
  };
}

function readMemoryValue(entry?: MemoryEntry): string {
  return entry?.value ?? entry?.text ?? '';
}

function mergeSignals(
  current: { diagnostics: FlowDiagnostic[]; outcomes: FlowOutcome[] },
  next?: {
    readonly diagnostics?: readonly FlowDiagnostic[] | undefined;
    readonly outcomes?: readonly FlowOutcome[] | undefined;
  },
): void {
  if (next?.diagnostics) {
    current.diagnostics.push(...next.diagnostics);
  }
  if (next?.outcomes) {
    current.outcomes.push(...next.outcomes);
  }
}

function createCompletedExecutionOutcome(outcomes: readonly FlowOutcome[]): readonly FlowOutcome[] {
  return outcomes.length === 0
    ? [createFlowOutcome(FLOW_OUTCOME_CODES.completed, 'Flow completed.')]
    : outcomes;
}

function createBudgetExhaustedOutcome(summary: string): FlowOutcome {
  return createFlowOutcome(FLOW_OUTCOME_CODES.budgetExhausted, summary);
}

function terminalOutcomes(
  collected: readonly FlowOutcome[],
  extra: readonly FlowOutcome[],
  completed: boolean,
): readonly FlowOutcome[] {
  if (completed) {
    return createCompletedExecutionOutcome(extra);
  }
  return [...collected, ...extra];
}

async function preloadMemoryVariables(
  state: SessionState,
  memoryStore?: MemoryStore,
): Promise<SessionState> {
  if (!memoryStore || !state.flowSpec.memoryKeys || state.flowSpec.memoryKeys.length === 0) {
    return state;
  }

  let changed = false;
  const variables = { ...state.variables };

  for (const key of state.flowSpec.memoryKeys) {
    if (variables[key] !== undefined) continue;
    variables[key] = readMemoryValue(await memoryStore.findByKey(key));
    changed = true;
  }

  return changed ? { ...state, variables } : state;
}

export async function runFlowHeadless(
  input: RunFlowHeadlessInput,
  deps: {
    readonly auditLogger?: AuditLogger | undefined;
    readonly captureReader?: CaptureReader | undefined;
    readonly commandRunner: CommandRunner;
    readonly memoryStore?: MemoryStore | undefined;
    readonly messageStore?: MessageStore | undefined;
    readonly processSpawner?: ProcessSpawner | undefined;
    readonly promptTurnRunner: PromptTurnRunner;
    readonly stateStore: StateStore;
    readonly traceLogger?: TraceLogger | undefined;
    readonly snapshotStore?: SnapshotStorePort | undefined;
    readonly envReader?: EnvReaderPort | undefined;
    readonly stateDir?: string | undefined;
  },
): Promise<RunFlowHeadlessOutput> {
  const maxTurns = input.maxTurns ?? DEFAULT_MAX_TURNS;
  const spec = parseFlow(input.flowText, { basePath: input.cwd });
  const commandRunner = bindCommandRunnerCwd(deps.commandRunner, input.cwd);
  const collectedSignals: { diagnostics: FlowDiagnostic[]; outcomes: FlowOutcome[] } = {
    diagnostics: [],
    outcomes: [],
  };

  let state = await preloadMemoryVariables(
    createSessionState(input.sessionId, spec),
    deps.memoryStore,
  );
  await deps.stateStore.save(state);

  let turns = 0;
  const buildOutput = (
    finalState: SessionState,
    options: {
      readonly reason?: string | undefined;
      readonly diagnostics?: readonly FlowDiagnostic[] | undefined;
      readonly outcomes?: readonly FlowOutcome[] | undefined;
      readonly status?: DiagnosticReport['status'] | undefined;
      readonly completed?: boolean | undefined;
    } = {},
  ): RunFlowHeadlessOutput => {
    const diagnostics = [...collectedSignals.diagnostics, ...(options.diagnostics ?? [])];
    const outcomes = terminalOutcomes(
      collectedSignals.outcomes,
      options.outcomes ?? [],
      options.completed ?? false,
    );
    return {
      finalState,
      reason: options.reason,
      report: createExecutionReport({
        diagnostics,
        outcomes,
        reason: options.reason,
        ...(options.status != null ? { status: options.status } : {}),
      }),
      turns,
    };
  };

  while (true) {
    const step = await autoAdvanceNodes(
      state,
      commandRunner,
      deps.captureReader,
      deps.processSpawner,
      deps.auditLogger,
      deps.memoryStore,
      deps.messageStore,
      deps.traceLogger ?? NULL_TRACE_LOGGER,
      deps.snapshotStore,
      deps.envReader,
      deps.stateDir,
    );

    mergeSignals(collectedSignals, step);
    state = step.state;
    await deps.stateStore.save(state);

    if (state.status === 'failed' || state.status === 'cancelled') {
      const reason = state.failureReason ?? `Flow ended with status "${state.status}"`;
      const hasStructuredSignals =
        collectedSignals.diagnostics.length > 0 || collectedSignals.outcomes.length > 0;
      return buildOutput(state, {
        reason,
        ...(hasStructuredSignals ? {} : { status: 'failed' as const }),
      });
    }

    if (step.kind === 'pause') {
      const pausedNode = resolveCurrentNode(state.flowSpec.nodes, state.currentNodePath);
      if (pausedNode?.kind === 'receive' && pausedNode.timeoutSeconds != null) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      if (hasRunningChildren(state)) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }
      return buildOutput(state, {
        reason: 'Flow paused before reaching completion.',
        status: 'failed',
      });
    }

    if (step.kind === 'advance') {
      state = maybeCompleteFlow(state);
      await deps.stateStore.save(state);

      if (state.status === 'completed') {
        return buildOutput(state, {
          reason: readPersistedRuntimeDiagnosticReason(state),
          completed: true,
        });
      }

      const current = await deps.stateStore.loadCurrent();
      const currentNode = current
        ? resolveCurrentNode(current.flowSpec.nodes, current.currentNodePath)
        : null;
      if (
        current &&
        currentNode === null &&
        current.flowSpec.nodes.length === 0 &&
        current.flowSpec.completionGates.length > 0
      ) {
        const gateResult = await evaluateCompletion(
          deps.stateStore,
          commandRunner,
          deps.auditLogger,
        );
        mergeSignals(collectedSignals, gateResult);
        state = (await deps.stateStore.loadCurrent()) ?? state;
        if (!gateResult.blocked && state.status === 'completed') {
          return buildOutput(state, {
            reason: readPersistedRuntimeDiagnosticReason(state),
            completed: true,
          });
        }
        if (gateResult.diagnostics.length > 0 || state.status === 'failed') {
          return buildOutput(state, {
            reason: summarizeCompletionBlock(gateResult),
          });
        }

        turns += 1;
        if (turns > maxTurns) {
          const summary = `Headless runner reached the max turn limit (${maxTurns}).`;
          return buildOutput(state, {
            reason: summary,
            outcomes: [createBudgetExhaustedOutcome(summary)],
          });
        }

        const gatePrompt = buildGateOnlyPrompt(state, input.flowText);
        const runResult = await deps.promptTurnRunner.run({
          cwd: input.cwd,
          model: input.model,
          prompt: gatePrompt,
          scopePrompt: gatePrompt,
        });

        if (runResult.exitCode !== 0) {
          const failure = markPromptRunnerFailed(state, runResult);
          state = failure.state;
          await deps.stateStore.save(state);
          return buildOutput(state, {
            reason: failure.reason,
            diagnostics: [failure.diagnostic],
          });
        }

        if (runResult.madeProgress === false) {
          const detail = summarizeAssistantText(runResult.assistantText);
          return buildOutput(state, {
            reason:
              detail == null
                ? 'Prompt runner completed without observable workspace progress.'
                : `Prompt runner completed without observable workspace progress. Last assistant output: ${detail}`,
            status: 'failed',
          });
        }

        continue;
      }
      if (current && currentNode === null && current.flowSpec.completionGates.length > 0) {
        const gateResult = await evaluateCompletion(
          deps.stateStore,
          commandRunner,
          deps.auditLogger,
        );
        mergeSignals(collectedSignals, gateResult);
        state = (await deps.stateStore.loadCurrent()) ?? state;
        if (!gateResult.blocked && state.status === 'completed') {
          return buildOutput(state, {
            reason: readPersistedRuntimeDiagnosticReason(state),
            completed: true,
          });
        }
        if (gateResult.diagnostics.length > 0 || state.status === 'failed') {
          return buildOutput(state, {
            reason: summarizeCompletionBlock(gateResult),
          });
        }
      }
      continue;
    }

    turns += 1;
    if (turns > maxTurns) {
      const summary = `Headless runner reached the max turn limit (${maxTurns}).`;
      return buildOutput(state, {
        reason: summary,
        outcomes: [createBudgetExhaustedOutcome(summary)],
      });
    }

    const runResult = await deps.promptTurnRunner.run({
      cwd: input.cwd,
      model: input.model ?? step.model,
      prompt: buildPromptEnvelope(state, step.capturedPrompt),
      scopePrompt: step.capturedPrompt,
    });

    if (runResult.exitCode !== 0) {
      const failure = markPromptRunnerFailed(state, runResult);
      state = failure.state;
      await deps.stateStore.save(state);
      return buildOutput(state, {
        reason: failure.reason,
        diagnostics: [failure.diagnostic],
      });
    }

    if (runResult.madeProgress === false) {
      const detail = summarizeAssistantText(runResult.assistantText);
      return buildOutput((await deps.stateStore.loadCurrent()) ?? state, {
        reason:
          detail == null
            ? 'Prompt runner completed without observable workspace progress.'
            : `Prompt runner completed without observable workspace progress. Last assistant output: ${detail}`,
        status: 'failed',
      });
    }

    state = completeAwaitingPromptTurn((await deps.stateStore.loadCurrent()) ?? state);
    await deps.stateStore.save(state);
    state = maybeCompleteFlow(state);
    await deps.stateStore.save(state);

    const current = await deps.stateStore.loadCurrent();
    const currentNode = current
      ? resolveCurrentNode(current.flowSpec.nodes, current.currentNodePath)
      : null;
    let gateBlocked = false;
    let gateBlockReason: string | undefined;
    let gateBlockedByDiagnostic = false;

    if (current && currentNode === null && current.flowSpec.completionGates.length > 0) {
      const gateResult = await evaluateCompletion(deps.stateStore, commandRunner, deps.auditLogger);
      mergeSignals(collectedSignals, gateResult);
      gateBlocked = gateResult.blocked;
      gateBlockedByDiagnostic = gateResult.diagnostics.length > 0;
      gateBlockReason = gateBlocked ? summarizeCompletionBlock(gateResult) : undefined;
      state = (await deps.stateStore.loadCurrent()) ?? state;

      if (gateBlockedByDiagnostic || state.status === 'failed') {
        return buildOutput(state, {
          reason: summarizeCompletionBlock(gateResult),
        });
      }
    }

    if (!gateBlocked && state.status === 'completed') {
      return buildOutput(state, {
        reason: readPersistedRuntimeDiagnosticReason(state),
        completed: true,
      });
    }

    if (
      gateBlocked &&
      current != null &&
      currentNode === null &&
      current.currentNodePath.length <= 1
    ) {
      const reason = gateBlockedByDiagnostic
        ? (gateBlockReason ?? 'Completion remained blocked after the final prompt turn.')
        : appendAssistantDetail(
            gateBlockReason ?? 'Completion remained blocked after the final prompt turn.',
            runResult.assistantText,
          );
      state = markFailed(state, reason);
      await deps.stateStore.save(state);
      return buildOutput(state, { reason });
    }
  }
}
