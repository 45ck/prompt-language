/**
 * EvaluateCompletion — TaskCompleted hook use case.
 *
 * Runs completion gate commands and updates state.
 * Blocks completion if any gate fails.
 */

import { existsSync } from 'node:fs';

import {
  updateGateResult,
  updateGateDiagnostic,
  addWarning,
  markCompleted,
  allGatesPassing,
} from '../domain/session-state.js';
import type { SessionState } from '../domain/session-state.js';
import { findSimilarPredicate } from '../domain/fuzzy-match.js';
import type { StateStore } from './ports/state-store.js';
import type { CommandRunner, CommandResult } from './ports/command-runner.js';
import type { CompletionGate } from '../domain/flow-spec.js';
import type { AuditLogger } from './ports/audit-logger.js';

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

// H-INT-002: Detect project type from filesystem markers and map tests_pass accordingly
export function detectTestCommand(): string {
  if (existsSync('go.mod')) return 'go test ./...';
  if (existsSync('pyproject.toml') || existsSync('setup.py')) return 'python -m pytest';
  if (existsSync('Cargo.toml')) return 'cargo test';
  return 'npm test';
}

/** Map a built-in predicate to the shell command that evaluates it. */
// H#4: Support "not" prefix — recursively strip and resolve
// H-INT-002: Environment-aware auto-detection for tests_pass/tests_fail
export function resolveBuiltinCommand(predicate: string): string | undefined {
  if (predicate.startsWith('not ')) {
    return resolveBuiltinCommand(predicate.slice(4).trim());
  }
  if (predicate.startsWith('file_exists ')) {
    const path = predicate.slice('file_exists '.length).trim();
    if (!path || !SAFE_PATH_RE.test(path)) return undefined;
    return `test -f '${path}'`;
  }

  // H-INT-002: For generic tests_pass/tests_fail, auto-detect the test runner
  if (predicate === 'tests_pass' || predicate === 'tests_fail') {
    return detectTestCommand();
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

// H-REL-002: Gate command timeout (default 60s, env override)
const GATE_TIMEOUT_MS = (() => {
  const envVal = process.env['PROMPT_LANGUAGE_GATE_TIMEOUT_MS'];
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 60_000;
})();

// H-SEC-003: Stderr truncation limit (increased from 200 to 2000)
const STDERR_LIMIT = 2000;

function truncateOutput(text: string, limit: number): string {
  const trimmed = text.trimEnd();
  if (trimmed.length <= limit) return trimmed;
  return trimmed.slice(0, limit) + ' [truncated]';
}

/** Evaluate a single (non-composite) gate predicate and return whether it passed. */
async function evaluateSingleGate(
  gate: CompletionGate,
  state: SessionState,
  runner: CommandRunner,
  timeoutMs: number,
): Promise<{ passed: boolean; command?: string; result?: CommandResult }> {
  const command = gate.command ?? resolveBuiltinCommand(gate.predicate);
  if (command) {
    const result = await runner.run(command, { timeoutMs });
    const inverted = isInvertedPredicate(gate.predicate);
    const passed = inverted ? result.exitCode !== 0 : result.exitCode === 0;
    return { passed, command, result };
  }
  // H#5: Check variables as gate predicates (boolean)
  const varValue = state.variables[gate.predicate];
  if (typeof varValue === 'boolean') {
    return { passed: varValue };
  }
  return { passed: false };
}

// H#64: Parallel gate evaluation via Promise.all()
// H#5: Variable-based gate lookup for boolean variables
// H-REL-002: Gate command timeout
// H-INT-010: any() composite gate support
async function runGates(
  state: SessionState,
  runner: CommandRunner,
  auditLogger?: AuditLogger,
): Promise<SessionState> {
  const timeoutMs = GATE_TIMEOUT_MS;
  const gatePromises = state.flowSpec.completionGates.map(async (gate) => {
    // H-INT-010: Handle any() composite gates
    if (gate.any && gate.any.length > 0) {
      const subResults = await Promise.all(
        gate.any.map((sub) => evaluateSingleGate(sub, state, runner, timeoutMs)),
      );
      const anyPassed = subResults.some((r) => r.passed);
      return { gate, anyPassed, subResults };
    }
    const command = gate.command ?? resolveBuiltinCommand(gate.predicate);
    if (!command) return { gate, result: null, command: null };
    const result = await runner.run(command, { timeoutMs });
    return { gate, result, command };
  });
  const gateResults = await Promise.all(gatePromises);

  let updated = state;
  for (const entry of gateResults) {
    const { gate } = entry;

    // H-INT-010: Process any() composite gate result
    if ('anyPassed' in entry) {
      updated = updateGateResult(updated, gate.predicate, entry.anyPassed);
      updated = updateGateDiagnostic(updated, gate.predicate, { passed: entry.anyPassed });
      continue;
    }

    const { result, command } = entry;
    if (result && command) {
      // H-SEC-006: Log gate evaluation to audit trail
      if (auditLogger) {
        auditLogger.log({
          timestamp: new Date().toISOString(),
          event: 'gate_evaluation',
          command,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
        });
      }
      const inverted = isInvertedPredicate(gate.predicate);
      const passed = inverted ? result.exitCode !== 0 : result.exitCode === 0;
      updated = updateGateResult(updated, gate.predicate, passed);
      // H-SEC-003: Increased truncation limit with [truncated] marker
      const stderrSnippet = truncateOutput(result.stderr, STDERR_LIMIT);
      // H-DX-004: Capture stdout alongside stderr
      const stdoutSnippet = truncateOutput(result.stdout, STDERR_LIMIT);
      updated = updateGateDiagnostic(updated, gate.predicate, {
        passed,
        command,
        exitCode: result.exitCode,
        ...(stderrSnippet ? { stderr: stderrSnippet } : {}),
        ...(stdoutSnippet ? { stdout: stdoutSnippet } : {}),
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
          // Unknown predicate — suggest a similar known predicate if possible
          const similar = findSimilarPredicate(gate.predicate);
          if (similar) {
            updated = addWarning(
              updated,
              `Unknown gate predicate '${gate.predicate}' \u2014 did you mean '${similar}'?`,
            );
          }
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
  auditLogger?: AuditLogger,
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

  const evaluated = await runGates(state, commandRunner, auditLogger);

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
