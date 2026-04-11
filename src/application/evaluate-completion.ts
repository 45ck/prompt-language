/**
 * EvaluateCompletion — TaskCompleted hook use case.
 *
 * Runs completion gate commands and updates state.
 * Blocks completion if any gate fails.
 */

import {
  updateGateResult,
  updateGateDiagnostic,
  addWarning,
  markCompleted,
  markFailed,
  allGatesPassing,
} from '../domain/session-state.js';
import type { GateEvalResult, SessionState } from '../domain/session-state.js';
import { findSimilarPredicate } from '../domain/fuzzy-match.js';
import {
  createFlowOutcome,
  createRuntimeDiagnostic,
  FLOW_OUTCOME_CODES,
  RUNTIME_DIAGNOSTIC_CODES,
  type FlowDiagnostic,
  type FlowOutcome,
} from '../domain/diagnostic-report.js';
import type { StateStore } from './ports/state-store.js';
import type { CommandRunner, CommandResult } from './ports/command-runner.js';
import type { CompletionGate } from '../domain/flow-spec.js';
import type { AuditLogger } from './ports/audit-logger.js';
import { detectTestCommand } from './gate-prerequisites.js';
import {
  collectSpecialGatePredicateIssues,
  evaluateSpecialGatePredicate,
} from './artifacts/artifact-gate-state.js';

export { detectTestCommand } from './gate-prerequisites.js';

export interface EvaluateCompletionOutput {
  readonly blocked: boolean;
  readonly reason: string;
  readonly gateResults: Readonly<Record<string, boolean>>;
  readonly diagnostics: readonly FlowDiagnostic[];
  readonly outcomes: readonly FlowOutcome[];
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

/** Reject absolute paths including Windows drive letters (C:\...) and UNC paths (\\...). */
function isAbsoluteOrUnsafePath(p: string): boolean {
  if (p.startsWith('/')) return true;
  if (p.includes('\\')) return true;
  if (/^[A-Za-z]:/.test(p)) return true;
  return false;
}

function createFileExistsCommand(path: string): string {
  return `node -e "process.exit(require('node:fs').existsSync('${path}') ? 0 : 1)"`;
}

export function resolveFileExistsPredicatePath(predicate: string): string | undefined {
  if (!predicate.startsWith('file_exists ')) return undefined;

  const path = predicate.slice('file_exists '.length).trim();
  if (!path || !SAFE_PATH_RE.test(path) || isAbsoluteOrUnsafePath(path)) return undefined;
  return path;
}

/** Map a built-in predicate to the shell command that evaluates it. */
// H#4: Support "not" prefix — recursively strip and resolve
// H-INT-002: Environment-aware auto-detection for tests_pass/tests_fail
export function resolveBuiltinCommand(predicate: string): string | undefined {
  if (predicate.startsWith('not ')) {
    return resolveBuiltinCommand(predicate.slice(4).trim());
  }
  if (predicate.startsWith('file_exists ')) {
    const path = resolveFileExistsPredicatePath(predicate);
    if (!path) return undefined;
    return createFileExistsCommand(path);
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

const GATE_CACHE_TTL_MS = (() => {
  const envVal = process.env['PROMPT_LANGUAGE_GATE_CACHE_TTL'];
  if (envVal) {
    const parsedSeconds = parseInt(envVal, 10);
    if (!isNaN(parsedSeconds) && parsedSeconds > 0) return parsedSeconds * 1000;
  }
  return 30_000;
})();

// H-SEC-003: Stderr truncation limit (increased from 200 to 2000)
const STDERR_LIMIT = 2000;

// H-SEC-010: Gate rate limiting thresholds
const GATE_BACKOFF_THRESHOLD = 20;
const GATE_HARD_STOP_THRESHOLD = 50;
const GATE_BACKOFF_MS = 5000;
const UNSUPPORTED_SPECIAL_GATE_DIAGNOSTIC_CODE = 'PLR-007';

function truncateOutput(text: string, limit: number): string {
  const trimmed = text.trimEnd();
  if (trimmed.length <= limit) return trimmed;
  return trimmed.slice(0, limit) + ' [truncated]';
}

type CachedPassingGateDiagnostic = Readonly<
  GateEvalResult & { passed: true; command: string; gateEvaluatedAt: number }
>;

function getCachedPassingGateDiagnostic(
  state: SessionState,
  gate: CompletionGate,
  command: string,
  now: number,
): CachedPassingGateDiagnostic | undefined {
  if (state.gateResults[gate.predicate] !== true) return undefined;
  const diagnostic = state.gateDiagnostics[gate.predicate];
  if (diagnostic?.passed !== true) return undefined;
  if (diagnostic.command !== command) return undefined;
  if (diagnostic.gateEvaluatedAt === undefined) return undefined;
  if (now - diagnostic.gateEvaluatedAt > GATE_CACHE_TTL_MS) return undefined;
  return {
    passed: true,
    command,
    gateEvaluatedAt: diagnostic.gateEvaluatedAt,
    ...(diagnostic.exitCode !== undefined ? { exitCode: diagnostic.exitCode } : {}),
    ...(diagnostic.stderr !== undefined ? { stderr: diagnostic.stderr } : {}),
    ...(diagnostic.stdout !== undefined ? { stdout: diagnostic.stdout } : {}),
  };
}

/** Evaluate a single (non-composite) gate predicate and return whether it passed. */
async function evaluateSingleGate(
  gate: CompletionGate,
  state: SessionState,
  runner: CommandRunner,
  timeoutMs: number,
  envOpt?: { env?: Readonly<Record<string, string>> },
): Promise<{
  recognized: boolean;
  passed: boolean;
  command?: string;
  result?: CommandResult;
  cachedDiagnostic?: Readonly<{ passed: true; command: string; gateEvaluatedAt: number }>;
  gateEvaluatedAt?: number;
}> {
  const specialEvaluation = evaluateSpecialGatePredicate(gate.predicate, state.variables);
  if (specialEvaluation !== undefined) {
    return {
      recognized: true,
      passed: specialEvaluation.passed,
      gateEvaluatedAt: Date.now(),
    };
  }

  const command = gate.command ?? resolveBuiltinCommand(gate.predicate);
  if (command) {
    const cachedDiagnostic = getCachedPassingGateDiagnostic(state, gate, command, Date.now());
    if (cachedDiagnostic) {
      return {
        recognized: true,
        passed: true,
        command,
        cachedDiagnostic: {
          passed: true,
          command,
          gateEvaluatedAt: cachedDiagnostic.gateEvaluatedAt,
        },
      };
    }
    const result = await runner.run(command, { timeoutMs, ...envOpt });
    const inverted = isInvertedPredicate(gate.predicate);
    const passed = inverted ? result.exitCode !== 0 : result.exitCode === 0;
    return { recognized: true, passed, command, result, gateEvaluatedAt: Date.now() };
  }
  // H#5: Check variables as gate predicates (boolean)
  const varValue = state.variables[gate.predicate];
  if (typeof varValue === 'boolean') {
    return { recognized: true, passed: varValue, gateEvaluatedAt: Date.now() };
  }
  return { recognized: false, passed: false, gateEvaluatedAt: Date.now() };
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
  // H-LANG-009: Pass env from flowSpec to gate commands
  const envOpt = state.flowSpec.env != null ? { env: state.flowSpec.env } : {};
  const gatePromises = state.flowSpec.completionGates.map(async (gate) => {
    // H-INT-010: Handle any() composite gates
    if (gate.any && gate.any.length > 0) {
      const subResults = await Promise.all(
        gate.any.map((sub) => evaluateSingleGate(sub, state, runner, timeoutMs, envOpt)),
      );
      const anyPassed = subResults.some((r) => r.passed);
      return { gate, anyPassed, subResults };
    }
    // H-LANG-010: Handle all() composite gates (explicit AND)
    if (gate.all && gate.all.length > 0) {
      const subResults = await Promise.all(
        gate.all.map((sub) => evaluateSingleGate(sub, state, runner, timeoutMs, envOpt)),
      );
      const allPassed = subResults.every((r) => r.passed);
      return { gate, allPassed, subResults };
    }
    // H-LANG-010: Handle N_of() composite gates
    if (gate.nOf && gate.nOf.gates.length > 0) {
      const subResults = await Promise.all(
        gate.nOf.gates.map((sub) => evaluateSingleGate(sub, state, runner, timeoutMs, envOpt)),
      );
      const passCount = subResults.filter((r) => r.passed).length;
      const nOfPassed = passCount >= gate.nOf.n;
      return { gate, nOfPassed, subResults };
    }
    const singleResult = await evaluateSingleGate(gate, state, runner, timeoutMs, envOpt);
    return { gate, ...singleResult };
  });
  const gateResults = await Promise.all(gatePromises);

  let updated = state;
  for (const entry of gateResults) {
    const { gate } = entry;

    // H-INT-010: Process any() composite gate result
    if ('anyPassed' in entry) {
      updated = updateGateResult(updated, gate.predicate, entry.anyPassed);
      updated = updateGateDiagnostic(updated, gate.predicate, {
        passed: entry.anyPassed,
        gateEvaluatedAt: Date.now(),
      });
      continue;
    }
    // H-LANG-010: Process all() composite gate result
    if ('allPassed' in entry) {
      updated = updateGateResult(updated, gate.predicate, entry.allPassed);
      updated = updateGateDiagnostic(updated, gate.predicate, {
        passed: entry.allPassed,
        gateEvaluatedAt: Date.now(),
      });
      continue;
    }
    // H-LANG-010: Process N_of() composite gate result
    if ('nOfPassed' in entry) {
      updated = updateGateResult(updated, gate.predicate, entry.nOfPassed);
      updated = updateGateDiagnostic(updated, gate.predicate, {
        passed: entry.nOfPassed,
        gateEvaluatedAt: Date.now(),
      });
      continue;
    }

    if ('cachedDiagnostic' in entry && entry.cachedDiagnostic) {
      updated = updateGateResult(updated, gate.predicate, true);
      updated = updateGateDiagnostic(updated, gate.predicate, entry.cachedDiagnostic);
      continue;
    }

    const { result, command, gateEvaluatedAt, recognized, passed } = entry;
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
        ...(gateEvaluatedAt !== undefined ? { gateEvaluatedAt } : {}),
      });
    } else if (recognized) {
      updated = updateGateResult(updated, gate.predicate, passed);
      updated = updateGateDiagnostic(updated, gate.predicate, {
        passed,
        ...(gateEvaluatedAt !== undefined ? { gateEvaluatedAt } : {}),
      });
    } else {
      // H#5: Check variables as gate predicates (boolean)
      const varValue = updated.variables[gate.predicate];
      if (typeof varValue === 'boolean') {
        updated = updateGateResult(updated, gate.predicate, varValue);
        updated = updateGateDiagnostic(updated, gate.predicate, {
          passed: varValue,
          ...(gateEvaluatedAt !== undefined ? { gateEvaluatedAt } : {}),
        });
      } else {
        const current = updated.gateResults[gate.predicate];
        if (current === undefined) {
          updated = updateGateResult(updated, gate.predicate, false);
          updated = updateGateDiagnostic(updated, gate.predicate, {
            passed: false,
            ...(gateEvaluatedAt !== undefined ? { gateEvaluatedAt } : {}),
          });
          if (!recognized) {
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

function createCompletionOutput(input: {
  blocked: boolean;
  reason: string;
  gateResults: Readonly<Record<string, boolean>>;
  diagnostics?: readonly FlowDiagnostic[];
  outcomes?: readonly FlowOutcome[];
}): EvaluateCompletionOutput {
  return {
    blocked: input.blocked,
    reason: input.reason,
    gateResults: input.gateResults,
    diagnostics: input.diagnostics ?? [],
    outcomes: input.outcomes ?? [],
  };
}

export async function evaluateCompletion(
  stateStore: StateStore,
  commandRunner: CommandRunner,
  auditLogger?: AuditLogger,
): Promise<EvaluateCompletionOutput> {
  const state = await stateStore.loadCurrent();

  if (!state) {
    return createCompletionOutput({ blocked: false, reason: '', gateResults: {} });
  }

  if (state.flowSpec.completionGates.length === 0) {
    const done = markCompleted(state);
    await stateStore.save(done);
    return createCompletionOutput({ blocked: false, reason: '', gateResults: {} });
  }

  const specialGateIssues = collectSpecialGatePredicateIssues(state.flowSpec.completionGates);
  if (specialGateIssues.length > 0) {
    const diagnostics = specialGateIssues.map((issue) =>
      createRuntimeDiagnostic(
        UNSUPPORTED_SPECIAL_GATE_DIAGNOSTIC_CODE,
        issue.summary,
        issue.action,
        false,
      ),
    );
    return createCompletionOutput({
      blocked: true,
      reason: diagnostics[0]?.summary ?? 'Unsupported artifact-aware completion gate.',
      gateResults: state.gateResults,
      diagnostics,
    });
  }

  // H-SEC-010: Hard stop after too many consecutive gate failures
  const failureCount = state.gateFailureCount ?? 0;
  if (failureCount >= GATE_HARD_STOP_THRESHOLD) {
    const summary = `Gate evaluation hard-stopped after ${GATE_HARD_STOP_THRESHOLD} consecutive failures. Flow marked as failed.`;
    const failed = markFailed(
      state,
      `Gate evaluation stopped after ${GATE_HARD_STOP_THRESHOLD} consecutive failures.`,
    );
    await stateStore.save(failed);
    return createCompletionOutput({
      blocked: true,
      reason: summary,
      gateResults: failed.gateResults,
      outcomes: [createFlowOutcome(FLOW_OUTCOME_CODES.budgetExhausted, summary)],
    });
  }

  // H-SEC-010: Apply backoff delay after threshold
  if (failureCount >= GATE_BACKOFF_THRESHOLD) {
    await new Promise((resolve) => setTimeout(resolve, GATE_BACKOFF_MS));
  }

  let evaluated: SessionState;
  try {
    evaluated = await runGates(state, commandRunner, auditLogger);
  } catch (error) {
    const diagnostic = createRuntimeDiagnostic(
      RUNTIME_DIAGNOSTIC_CODES.gateEvaluationCrashed,
      error instanceof Error
        ? `Gate evaluation crashed: ${error.message}`
        : `Gate evaluation crashed: ${String(error)}`,
      'Fix the failing gate command or predicate before rerunning completion.',
      true,
    );
    return createCompletionOutput({
      blocked: true,
      reason: diagnostic.summary,
      gateResults: state.gateResults,
      diagnostics: [diagnostic],
    });
  }

  if (allGatesPassing(evaluated)) {
    // Reset failure count on success
    const done = markCompleted({ ...evaluated, gateFailureCount: 0 });
    await stateStore.save(done);
    return createCompletionOutput({
      blocked: false,
      reason: '',
      gateResults: done.gateResults,
    });
  }

  // H-SEC-010: Increment consecutive failure count
  const updatedWithCount = { ...evaluated, gateFailureCount: failureCount + 1 };
  await stateStore.save(updatedWithCount);
  return createCompletionOutput({
    blocked: true,
    reason: buildFailureReason(updatedWithCount),
    gateResults: updatedWithCount.gateResults,
    outcomes: [
      createFlowOutcome(FLOW_OUTCOME_CODES.gateFailed, buildFailureReason(updatedWithCount)),
    ],
  });
}
