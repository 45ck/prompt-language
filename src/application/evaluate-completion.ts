/**
 * EvaluateCompletion — TaskCompleted hook use case.
 *
 * Runs completion gate commands and updates state.
 * Blocks completion if any gate fails.
 */

import {
  updateGateResult,
  updateGateDiagnostic,
  markCompleted,
  allGatesPassing,
} from '../domain/session-state.js';
import type { SessionState } from '../domain/session-state.js';
import type { StateStore } from './ports/state-store.js';
import type { CommandRunner } from './ports/command-runner.js';

export interface EvaluateCompletionOutput {
  readonly blocked: boolean;
  readonly reason: string;
  readonly gateResults: Readonly<Record<string, boolean>>;
}

// H#93: Multi-language gate predicates
const BUILTIN_GATE_COMMANDS: Readonly<Record<string, string>> = {
  tests_pass: 'npm test',
  tests_fail: 'npm test',
  lint_pass: 'npm run lint',
  lint_fail: 'npm run lint',
  diff_nonempty: 'git diff --quiet',
  pytest_pass: 'pytest',
  pytest_fail: 'pytest',
  go_test_pass: 'go test ./...',
  go_test_fail: 'go test ./...',
  cargo_test_pass: 'cargo test',
  cargo_test_fail: 'cargo test',
};

const INVERTED_PREDICATES = new Set([
  'tests_fail',
  'lint_fail',
  'diff_nonempty',
  'pytest_fail',
  'go_test_fail',
  'cargo_test_fail',
]);

const SAFE_PATH_RE = /^(?!\/)(?!.*\.\.)[\w ./-]+$/;

/** Map a built-in predicate to the shell command that evaluates it. */
// H#4: Support "not" prefix — recursively strip and resolve
export function resolveBuiltinCommand(predicate: string): string | undefined {
  if (predicate.startsWith('not ')) {
    return resolveBuiltinCommand(predicate.slice(4).trim());
  }
  if (predicate.startsWith('file_exists ')) {
    const path = predicate.slice('file_exists '.length).trim();
    if (!path || !SAFE_PATH_RE.test(path)) return undefined;
    return `test -f '${path}'`;
  }

  return BUILTIN_GATE_COMMANDS[predicate];
}

/** Inverted predicates pass when the command FAILS (exitCode !== 0). */
// H#4: "not" prefix flips inversion
export function isInvertedPredicate(predicate: string): boolean {
  if (predicate.startsWith('not ')) {
    return !isInvertedPredicate(predicate.slice(4).trim());
  }
  return INVERTED_PREDICATES.has(predicate);
}

// H#64: Parallel gate evaluation via Promise.all()
// H#5: Variable-based gate lookup for boolean variables
async function runGates(state: SessionState, runner: CommandRunner): Promise<SessionState> {
  const gatePromises = state.flowSpec.completionGates.map(async (gate) => {
    const command = gate.command ?? resolveBuiltinCommand(gate.predicate);
    if (!command) return { gate, result: null, command: null };
    const result = await runner.run(command);
    return { gate, result, command };
  });
  const gateResults = await Promise.all(gatePromises);

  let updated = state;
  for (const { gate, result, command } of gateResults) {
    if (result && command) {
      const inverted = isInvertedPredicate(gate.predicate);
      const passed = inverted ? result.exitCode !== 0 : result.exitCode === 0;
      updated = updateGateResult(updated, gate.predicate, passed);
      const stderrSnippet = result.stderr.trimEnd().slice(0, 200);
      updated = updateGateDiagnostic(updated, gate.predicate, {
        passed,
        command,
        exitCode: result.exitCode,
        ...(stderrSnippet ? { stderr: stderrSnippet } : {}),
      });
    } else {
      // H#5: Check variables as gate predicates (boolean)
      const varValue = updated.variables[gate.predicate];
      if (typeof varValue === 'boolean') {
        updated = updateGateResult(updated, gate.predicate, varValue);
        updated = updateGateDiagnostic(updated, gate.predicate, { passed: varValue });
      } else {
        const current = updated.gateResults[gate.predicate];
        if (current === undefined) {
          updated = updateGateResult(updated, gate.predicate, false);
          updated = updateGateDiagnostic(updated, gate.predicate, { passed: false });
        }
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
