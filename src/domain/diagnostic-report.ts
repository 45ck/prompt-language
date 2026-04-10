export type DiagnosticKind = 'parse' | 'profile' | 'runtime' | 'internal';
export type DiagnosticPhase =
  | 'parse'
  | 'preflight'
  | 'session-init'
  | 'advance'
  | 'gate-eval'
  | 'render';
export type DiagnosticSeverity = 'error' | 'warning';
export type DiagnosticStatus = 'ok' | 'blocked';

export interface FlowDiagnostic {
  readonly code: string;
  readonly kind: DiagnosticKind;
  readonly phase: DiagnosticPhase;
  readonly severity: DiagnosticSeverity;
  readonly blocksExecution: boolean;
  readonly retryable: boolean;
  readonly summary: string;
  readonly action?: string | undefined;
}

export interface FlowOutcome {
  readonly code: string;
  readonly summary: string;
}

export interface DiagnosticReport {
  readonly status: DiagnosticStatus;
  readonly diagnostics: readonly FlowDiagnostic[];
  readonly outcomes: readonly FlowOutcome[];
}

export const DIAGNOSTIC_CODE_RANGES = {
  parse: 'PLP',
  profile: 'PLC',
  runtime: 'PLR',
  internal: 'PLI',
  outcome: 'PLO',
} as const;

export const PROFILE_DIAGNOSTIC_CODES = {
  missingRunnerBinary: 'PLC-001',
  missingHarnessAccess: 'PLC-002',
  unsupportedHostOrMode: 'PLC-003',
  unsupportedApprove: 'PLC-004',
  missingGatePrerequisite: 'PLC-005',
  unsupportedParallelSemantics: 'PLC-006',
  unavailableUxSurface: 'PLC-007',
  unsupportedCaptureSemantics: 'PLC-008',
} as const;

export function createDiagnosticReport(
  diagnostics: readonly FlowDiagnostic[],
  outcomes: readonly FlowOutcome[] = [],
): DiagnosticReport {
  return {
    status: diagnostics.some((diagnostic) => diagnostic.blocksExecution) ? 'blocked' : 'ok',
    diagnostics,
    outcomes,
  };
}

export function createBlockingProfileDiagnostic(
  code: string,
  summary: string,
  action?: string,
): FlowDiagnostic {
  return {
    code,
    kind: 'profile',
    phase: 'preflight',
    severity: 'error',
    blocksExecution: true,
    retryable: false,
    summary,
    ...(action != null ? { action } : {}),
  };
}
