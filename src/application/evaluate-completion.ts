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

const BUILTIN_GATE_COMMANDS: Readonly<Record<string, string>> = {
  tests_pass: 'npm test',
  tests_fail: 'npm test',
  lint_pass: 'npm run lint',
  lint_fail: 'npm run lint',
  diff_nonempty: 'git diff --quiet',
};

const INVERTED_PREDICATES = new Set(['tests_fail', 'lint_fail', 'diff_nonempty']);

const SAFE_PATH_RE = /^(?!.*\.\.)[\w./-]+$/;

/** Map a built-in predicate to the shell command that evaluates it. */
export function resolveBuiltinCommand(predicate: string): string | undefined {
  if (predicate.startsWith('file_exists ')) {
    const path = predicate.slice('file_exists '.length).trim();
    if (!path || !SAFE_PATH_RE.test(path)) return undefined;
    return `test -f '${path}'`;
  }

  return BUILTIN_GATE_COMMANDS[predicate];
}

/** Inverted predicates pass when the command FAILS (exitCode !== 0). */
export function isInvertedPredicate(predicate: string): boolean {
  return INVERTED_PREDICATES.has(predicate);
}

async function runGates(state: SessionState, runner: CommandRunner): Promise<SessionState> {
  let updated = state;

  for (const gate of state.flowSpec.completionGates) {
    const command = gate.command ?? resolveBuiltinCommand(gate.predicate);
    if (command) {
      const result = await runner.run(command);
      const inverted = isInvertedPredicate(gate.predicate);
      const passed = inverted ? result.exitCode !== 0 : result.exitCode === 0;
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
