import { existsSync, readFileSync } from 'node:fs';
import type { CompletionGate, FlowSpec } from '../domain/flow-spec.js';
import {
  createBlockingProfileDiagnostic,
  createDiagnosticReport,
  PROFILE_DIAGNOSTIC_CODES,
  type DiagnosticReport,
  type FlowDiagnostic,
} from '../domain/diagnostic-report.js';
import { explainGatePrerequisite, type WorkspaceAccess } from './gate-prerequisites.js';

export type RunnerName = 'claude' | 'codex' | 'opencode' | 'ollama';

export interface ExecutionPreflightInput {
  readonly cwd: string;
  readonly runner: RunnerName;
}

export interface ExecutionPreflightDeps {
  readonly probeRunnerBinary?: ((runner: RunnerName) => boolean) | undefined;
  readonly workspaceAccess?: WorkspaceAccess | undefined;
}

const defaultWorkspaceAccess: WorkspaceAccess = {
  exists: existsSync,
  readText: (path) => readFileSync(path, 'utf8'),
};

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

function dedupeDiagnostics(diagnostics: readonly FlowDiagnostic[]): FlowDiagnostic[] {
  const seen = new Set<string>();
  const deduped: FlowDiagnostic[] = [];

  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.code}:${diagnostic.summary}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(diagnostic);
  }

  return deduped;
}

export function runExecutionPreflight(
  spec: FlowSpec,
  input: ExecutionPreflightInput,
  deps: ExecutionPreflightDeps = {},
): DiagnosticReport {
  const diagnostics: FlowDiagnostic[] = [];
  const probeRunnerBinary = deps.probeRunnerBinary ?? (() => true);
  const workspaceAccess = deps.workspaceAccess ?? defaultWorkspaceAccess;

  if (!probeRunnerBinary(input.runner)) {
    diagnostics.push(
      createBlockingProfileDiagnostic(
        PROFILE_DIAGNOSTIC_CODES.missingRunnerBinary,
        `Runner "${input.runner}" is unavailable because the binary was not found on PATH.`,
        `Install ${input.runner}, or choose a different runner before executing this flow.`,
      ),
    );
  }

  for (const gate of flattenCompletionGates(spec.completionGates)) {
    const issue = explainGatePrerequisite(gate.predicate, input.cwd, workspaceAccess);
    if (!issue) continue;
    diagnostics.push(
      createBlockingProfileDiagnostic(
        PROFILE_DIAGNOSTIC_CODES.missingGatePrerequisite,
        issue.summary,
        issue.action,
      ),
    );
  }

  return createDiagnosticReport(dedupeDiagnostics(diagnostics));
}
