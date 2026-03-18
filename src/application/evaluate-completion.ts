/**
 * EvaluateCompletion — TaskCompleted hook use case.
 *
 * Runs completion gate commands and updates state.
 * Blocks completion if any gate fails.
 */

import { updateGateResult, markCompleted, allGatesPassing } from '../domain/session-state.js';
import type { SessionState } from '../domain/session-state.js';
import type { StateStore } from './ports/state-store.js';
import type { CommandRunner } from './ports/command-runner.js';

export interface EvaluateCompletionOutput {
  readonly blocked: boolean;
  readonly reason: string;
  readonly gateResults: Readonly<Record<string, boolean>>;
}

async function runGates(state: SessionState, runner: CommandRunner): Promise<SessionState> {
  let updated = state;

  for (const gate of state.flowSpec.completionGates) {
    if (gate.command) {
      const result = await runner.run(gate.command);
      const passed = result.exitCode === 0;
      updated = updateGateResult(updated, gate.predicate, passed);
    } else {
      const current = updated.gateResults[gate.predicate];
      if (current === undefined) {
        updated = updateGateResult(updated, gate.predicate, false);
      }
    }
  }

  return updated;
}

function buildFailureReason(state: SessionState): string {
  const failing = state.flowSpec.completionGates
    .filter((g) => state.gateResults[g.predicate] !== true)
    .map((g) => g.predicate);

  return (
    `Completion gates failed: ${failing.join(', ')}. ` +
    'Fix the failing checks before completing the task.'
  );
}

export async function evaluateCompletion(
  stateStore: StateStore,
  commandRunner: CommandRunner,
): Promise<EvaluateCompletionOutput> {
  const state = await stateStore.loadCurrent();

  if (!state) {
    return { blocked: false, reason: '', gateResults: {} };
  }

  if (state.flowSpec.completionGates.length === 0) {
    const done = markCompleted(state);
    await stateStore.save(done);
    return { blocked: false, reason: '', gateResults: {} };
  }

  const evaluated = await runGates(state, commandRunner);

  if (allGatesPassing(evaluated)) {
    const done = markCompleted(evaluated);
    await stateStore.save(done);
    return {
      blocked: false,
      reason: '',
      gateResults: done.gateResults,
    };
  }

  await stateStore.save(evaluated);
  return {
    blocked: true,
    reason: buildFailureReason(evaluated),
    gateResults: evaluated.gateResults,
  };
}
