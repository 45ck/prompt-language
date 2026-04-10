import { autoAdvanceNodes, maybeCompleteFlow, resolveCurrentNode } from './advance-flow.js';
import { evaluateCompletion } from './evaluate-completion.js';
import type { AuditLogger } from './ports/audit-logger.js';
import type { CaptureReader } from './ports/capture-reader.js';
import type { CommandRunner } from './ports/command-runner.js';
import type { MemoryStore, MemoryEntry } from './ports/memory-store.js';
import type { MessageStore } from './ports/message-store.js';
import type { ProcessSpawner } from './ports/process-spawner.js';
import type { PromptTurnRunner } from './ports/prompt-turn-runner.js';
import type { StateStore } from './ports/state-store.js';
import { parseFlow } from './parse-flow.js';
import { renderFlow, renderFlowSummary } from '../domain/render-flow.js';
import { createSessionState, type SessionState } from '../domain/session-state.js';

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
  readonly turns: number;
}

const DEFAULT_MAX_TURNS = 24;
const MAX_ASSISTANT_TEXT_SNIPPET = 160;

function hasRunningChildren(state: SessionState): boolean {
  return Object.values(state.spawnedChildren).some((child) => child?.status === 'running');
}

function bindCommandRunnerCwd(commandRunner: CommandRunner, cwd: string): CommandRunner {
  return {
    run(command, options) {
      return commandRunner.run(command, {
        ...options,
        cwd: options?.cwd ?? cwd,
      });
    },
  };
}

function buildPromptEnvelope(state: SessionState, capturedPrompt: string): string {
  return `${renderFlow(state)}\n\n${capturedPrompt}\n\n${renderFlowSummary(state)}`;
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

function readMemoryValue(entry?: MemoryEntry): string {
  return entry?.value ?? entry?.text ?? '';
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
  },
): Promise<RunFlowHeadlessOutput> {
  const maxTurns = input.maxTurns ?? DEFAULT_MAX_TURNS;
  const spec = parseFlow(input.flowText, { basePath: input.cwd });
  const commandRunner = bindCommandRunnerCwd(deps.commandRunner, input.cwd);

  let state = await preloadMemoryVariables(
    createSessionState(input.sessionId, spec),
    deps.memoryStore,
  );
  await deps.stateStore.save(state);

  let turns = 0;

  while (true) {
    const step = await autoAdvanceNodes(
      state,
      commandRunner,
      deps.captureReader,
      deps.processSpawner,
      deps.auditLogger,
      deps.memoryStore,
      deps.messageStore,
    );

    state = step.state;
    await deps.stateStore.save(state);

    if (state.status === 'failed' || state.status === 'cancelled') {
      return {
        finalState: state,
        reason: state.failureReason ?? `Flow ended with status "${state.status}"`,
        turns,
      };
    }

    if (step.kind === 'pause') {
      if (hasRunningChildren(state)) {
        continue;
      }
      return {
        finalState: state,
        reason: 'Flow paused before reaching completion.',
        turns,
      };
    }

    if (step.kind === 'advance') {
      state = maybeCompleteFlow(state);
      await deps.stateStore.save(state);

      if (state.status === 'completed') {
        return { finalState: state, turns };
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
          deps.commandRunner,
          deps.auditLogger,
        );
        state = (await deps.stateStore.loadCurrent()) ?? state;
        if (!gateResult.blocked && state.status === 'completed') {
          return { finalState: state, turns };
        }

        turns += 1;
        if (turns > maxTurns) {
          return {
            finalState: state,
            reason: `Headless runner reached the max turn limit (${maxTurns}).`,
            turns,
          };
        }

        const runResult = await deps.promptTurnRunner.run({
          cwd: input.cwd,
          model: input.model,
          prompt: buildGateOnlyPrompt(state, input.flowText),
        });

        if (runResult.exitCode !== 0) {
          const detail = summarizeAssistantText(runResult.assistantText);
          return {
            finalState: state,
            reason:
              detail == null
                ? `Prompt runner exited with code ${runResult.exitCode}.`
                : `Prompt runner exited with code ${runResult.exitCode}. ${detail}`,
            turns,
          };
        }

        if (runResult.madeProgress === false) {
          const detail = summarizeAssistantText(runResult.assistantText);
          return {
            finalState: state,
            reason:
              detail == null
                ? 'Prompt runner completed without observable workspace progress.'
                : `Prompt runner completed without observable workspace progress. Last assistant output: ${detail}`,
            turns,
          };
        }

        continue;
      }
      if (current && currentNode === null && current.flowSpec.completionGates.length > 0) {
        const gateResult = await evaluateCompletion(
          deps.stateStore,
          commandRunner,
          deps.auditLogger,
        );
        state = (await deps.stateStore.loadCurrent()) ?? state;
        if (!gateResult.blocked && state.status === 'completed') {
          return { finalState: state, turns };
        }
      }
      continue;
    }

    turns += 1;
    if (turns > maxTurns) {
      return {
        finalState: state,
        reason: `Headless runner reached the max turn limit (${maxTurns}).`,
        turns,
      };
    }

    const runResult = await deps.promptTurnRunner.run({
      cwd: input.cwd,
      model: input.model,
      prompt: buildPromptEnvelope(state, step.capturedPrompt),
    });

    if (runResult.exitCode !== 0) {
      const detail = summarizeAssistantText(runResult.assistantText);
      return {
        finalState: state,
        reason:
          detail == null
            ? `Prompt runner exited with code ${runResult.exitCode}.`
            : `Prompt runner exited with code ${runResult.exitCode}. ${detail}`,
        turns,
      };
    }

    const current = await deps.stateStore.loadCurrent();
    const currentNode = current
      ? resolveCurrentNode(current.flowSpec.nodes, current.currentNodePath)
      : null;
    let gateBlocked = false;

    if (current && currentNode === null && current.flowSpec.completionGates.length > 0) {
      const gateResult = await evaluateCompletion(deps.stateStore, commandRunner, deps.auditLogger);
      gateBlocked = gateResult.blocked;
    }

    state = maybeCompleteFlow((await deps.stateStore.loadCurrent()) ?? state);
    await deps.stateStore.save(state);

    if (!gateBlocked && state.status === 'completed') {
      return { finalState: state, turns };
    }

    if (gateBlocked && currentNode === null) {
      const detail = summarizeAssistantText(runResult.assistantText);
      return {
        finalState: state,
        reason:
          detail == null
            ? 'Completion gates remained blocked after the final prompt turn.'
            : `Completion gates remained blocked after the final prompt turn. Last assistant output: ${detail}`,
        turns,
      };
    }
    if (runResult.madeProgress === false) {
      const detail = summarizeAssistantText(runResult.assistantText);
      return {
        finalState: state,
        reason:
          detail == null
            ? 'Prompt runner completed without observable workspace progress.'
            : `Prompt runner completed without observable workspace progress. Last assistant output: ${detail}`,
        turns,
      };
    }
  }
}
