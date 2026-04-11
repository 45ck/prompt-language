import {
  createBlockingProfileDiagnostic,
  createExecutionReport,
  createRuntimeDiagnostic,
  PROFILE_DIAGNOSTIC_CODES,
  RUNTIME_DIAGNOSTIC_CODES,
  type DiagnosticReport,
} from '../domain/diagnostic-report.js';
import {
  createSessionState,
  type GateEvalResult,
  type SessionState,
} from '../domain/session-state.js';
import type { CompletionGate, FlowSpec } from '../domain/flow-spec.js';
import { collectSpecialGatePredicateIssues } from './artifacts/artifact-gate-state.js';
import { evaluateCompletion } from './evaluate-completion.js';
import { explainGatePrerequisite } from './gate-prerequisites.js';
import type { AuditLogger } from './ports/audit-logger.js';
import type { CommandRunner } from './ports/command-runner.js';
import type { StateStore } from './ports/state-store.js';

const UNSUPPORTED_SPECIAL_GATE_PROFILE_DIAGNOSTIC_CODE = 'PLC-009';

export interface DryRunGateCheckEntry {
  readonly predicate: string;
  readonly passed?: boolean | undefined;
  readonly command?: string | undefined;
  readonly exitCode?: number | undefined;
  readonly stdout?: string | undefined;
  readonly stderr?: string | undefined;
}

export interface DryRunGateCheckResult {
  readonly report: DiagnosticReport;
  readonly state: SessionState;
  readonly entries: readonly DryRunGateCheckEntry[];
}

class EphemeralStateStore implements StateStore {
  private current: SessionState | null;

  constructor(initialState: SessionState) {
    this.current = initialState;
  }

  async load(sessionId: string): Promise<SessionState | null> {
    return this.current?.sessionId === sessionId ? this.current : null;
  }

  async save(state: SessionState): Promise<void> {
    this.current = state;
  }

  async clear(sessionId: string): Promise<void> {
    if (sessionId === '' || this.current?.sessionId === sessionId) {
      this.current = null;
    }
  }

  async exists(): Promise<boolean> {
    return this.current != null;
  }

  async loadCurrent(): Promise<SessionState | null> {
    return this.current;
  }

  async savePendingPrompt(_prompt: string): Promise<void> {
    return;
  }

  async loadPendingPrompt(): Promise<string | null> {
    return null;
  }

  async clearPendingPrompt(): Promise<void> {
    return;
  }
}

function flattenCompletionGates(gates: readonly CompletionGate[]): CompletionGate[] {
  const flattened: CompletionGate[] = [];

  for (const gate of gates) {
    flattened.push(gate);
    if (gate.any) {
      flattened.push(...flattenCompletionGates(gate.any));
    }
    if (gate.all) {
      flattened.push(...flattenCompletionGates(gate.all));
    }
    if (gate.nOf) {
      flattened.push(...flattenCompletionGates(gate.nOf.gates));
    }
  }

  return flattened;
}

function createGateEntries(
  gates: readonly CompletionGate[],
  gateResults: Readonly<Record<string, boolean>>,
  gateDiagnostics: Readonly<Record<string, GateEvalResult>>,
): DryRunGateCheckEntry[] {
  return gates.map((gate) => {
    const diagnostic = gateDiagnostics[gate.predicate];
    return {
      predicate: gate.predicate,
      ...(gateResults[gate.predicate] !== undefined ? { passed: gateResults[gate.predicate] } : {}),
      ...(diagnostic?.command != null ? { command: diagnostic.command } : {}),
      ...(diagnostic?.exitCode !== undefined ? { exitCode: diagnostic.exitCode } : {}),
      ...(diagnostic?.stdout ? { stdout: diagnostic.stdout } : {}),
      ...(diagnostic?.stderr ? { stderr: diagnostic.stderr } : {}),
    };
  });
}

function formatGateState(report: DiagnosticReport): string {
  if (report.status === 'blocked') return 'BLOCKED';
  if (report.status === 'failed') return 'FAILED';
  if (report.status === 'unsuccessful') return 'UNSUCCESSFUL';
  return report.diagnostics.length > 0 ? 'WARN' : 'OK';
}

function pushOutputLines(lines: string[], label: 'stdout' | 'stderr', value?: string): void {
  if (!value) {
    return;
  }

  const outputLines = value.split('\n');
  if (outputLines.length === 0) {
    return;
  }

  lines.push(`    ${label}: ${outputLines[0]}`);
  for (let index = 1; index < outputLines.length; index += 1) {
    lines.push(`      ${outputLines[index]}`);
  }
}

export function formatDryRunGateCheckSection(result: DryRunGateCheckResult): string {
  const itemCount = result.report.diagnostics.length + result.report.outcomes.length;
  const countSuffix = itemCount > 0 ? ` (${itemCount})` : '';
  const lines = [`[prompt-language gate-check] ${formatGateState(result.report)}${countSuffix}`];

  for (const diagnostic of result.report.diagnostics) {
    lines.push(`- ${diagnostic.code} ${diagnostic.summary}`);
    if (diagnostic.action) {
      lines.push(`  Action: ${diagnostic.action}`);
    }
  }

  for (const outcome of result.report.outcomes) {
    lines.push(`- ${outcome.code} ${outcome.summary}`);
  }

  lines.push('Gate results:');

  if (result.entries.length === 0) {
    lines.push('  (no completion gates defined)');
    return lines.join('\n');
  }

  for (const entry of result.entries) {
    const state = entry.passed === true ? 'PASS' : entry.passed === false ? 'FAIL' : 'PENDING';
    const detailParts = [
      entry.exitCode !== undefined ? `exit ${entry.exitCode}` : undefined,
      entry.command != null ? `"${entry.command}"` : undefined,
    ].filter((part): part is string => part != null);
    const detailSuffix = detailParts.length > 0 ? ` — ${detailParts.join(': ')}` : '';
    lines.push(`  ${entry.predicate} [${state}${detailSuffix}]`);
    pushOutputLines(lines, 'stdout', entry.stdout);
    pushOutputLines(lines, 'stderr', entry.stderr);
  }

  return lines.join('\n');
}

export async function runDryRunGateChecks(
  spec: FlowSpec,
  options: {
    readonly cwd?: string | undefined;
    readonly commandRunner?: CommandRunner | undefined;
    readonly auditLogger?: AuditLogger | undefined;
    readonly sessionId?: string | undefined;
  } = {},
): Promise<DryRunGateCheckResult> {
  const session = createSessionState(options.sessionId ?? 'dry-run-gate-check', spec);
  const entries = createGateEntries(
    spec.completionGates,
    session.gateResults,
    session.gateDiagnostics,
  );

  if (spec.completionGates.length === 0) {
    return {
      report: createExecutionReport({}),
      state: session,
      entries,
    };
  }

  const prerequisiteDiagnostics = flattenCompletionGates(spec.completionGates)
    .map((gate) => explainGatePrerequisite(gate.predicate, options.cwd))
    .filter((issue): issue is NonNullable<typeof issue> => issue != null)
    .map((issue) =>
      createBlockingProfileDiagnostic(
        PROFILE_DIAGNOSTIC_CODES.missingGatePrerequisite,
        issue.summary,
        issue.action,
      ),
    );
  const specialGateDiagnostics = collectSpecialGatePredicateIssues(spec.completionGates).map(
    (issue) =>
      createBlockingProfileDiagnostic(
        UNSUPPORTED_SPECIAL_GATE_PROFILE_DIAGNOSTIC_CODE,
        issue.summary,
        issue.action,
      ),
  );

  if (prerequisiteDiagnostics.length > 0 || specialGateDiagnostics.length > 0) {
    return {
      report: createExecutionReport({
        diagnostics: [...prerequisiteDiagnostics, ...specialGateDiagnostics],
      }),
      state: session,
      entries,
    };
  }

  if (!options.commandRunner) {
    return {
      report: createExecutionReport({
        diagnostics: [
          createRuntimeDiagnostic(
            RUNTIME_DIAGNOSTIC_CODES.gateEvaluationCrashed,
            'Gate evaluation crashed: no command runner was provided.',
            'Run dry-run gate checks from the CLI or hook path that supports shell execution.',
            true,
          ),
        ],
      }),
      state: session,
      entries,
    };
  }

  const store = new EphemeralStateStore(session);
  const completion = await evaluateCompletion(store, options.commandRunner, options.auditLogger);
  const evaluatedState = (await store.loadCurrent()) ?? session;

  return {
    report: createExecutionReport({
      diagnostics: completion.diagnostics,
      outcomes: completion.outcomes,
      reason: completion.reason,
    }),
    state: evaluatedState,
    entries: createGateEntries(
      spec.completionGates,
      evaluatedState.gateResults,
      evaluatedState.gateDiagnostics,
    ),
  };
}
