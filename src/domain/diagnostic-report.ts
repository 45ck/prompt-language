export type DiagnosticKind = 'parse' | 'profile' | 'runtime' | 'internal';
export type DiagnosticPhase =
  | 'parse'
  | 'preflight'
  | 'session-init'
  | 'advance'
  | 'gate-eval'
  | 'render';
export type DiagnosticSeverity = 'error' | 'warning';
export type DiagnosticStatus = 'ok' | 'blocked' | 'unsuccessful' | 'failed';

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
  readonly reason?: string | undefined;
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

export const RUNTIME_DIAGNOSTIC_CODES = {
  resumeStateCorruption: 'PLR-004',
  captureRetryFallback: 'PLR-005',
  gateEvaluationCrashed: 'PLR-006',
  promptRunnerFailed: 'PLR-007',
} as const;

export const FLOW_OUTCOME_CODES = {
  gateFailed: 'PLO-001',
  reviewRejected: 'PLO-002',
  approvalDenied: 'PLO-003',
  budgetExhausted: 'PLO-004',
  completed: 'PLO-005',
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

function hasBlockingPreflightDiagnostic(diagnostics: readonly FlowDiagnostic[]): boolean {
  return diagnostics.some(
    (diagnostic) =>
      diagnostic.blocksExecution && (diagnostic.kind === 'parse' || diagnostic.kind === 'profile'),
  );
}

function hasRuntimeFailureDiagnostic(diagnostics: readonly FlowDiagnostic[]): boolean {
  return diagnostics.some(
    (diagnostic) =>
      (diagnostic.kind === 'runtime' || diagnostic.kind === 'internal') &&
      (diagnostic.blocksExecution || diagnostic.severity === 'error'),
  );
}

function hasNegativeOutcome(outcomes: readonly FlowOutcome[]): boolean {
  return outcomes.some((outcome) => outcome.code !== FLOW_OUTCOME_CODES.completed);
}

export function deriveExecutionReportStatus(
  diagnostics: readonly FlowDiagnostic[],
  outcomes: readonly FlowOutcome[],
  fallbackStatus: DiagnosticStatus = 'ok',
): DiagnosticStatus {
  if (hasBlockingPreflightDiagnostic(diagnostics)) {
    return 'blocked';
  }

  if (hasRuntimeFailureDiagnostic(diagnostics)) {
    return 'failed';
  }

  if (hasNegativeOutcome(outcomes)) {
    return 'unsuccessful';
  }

  return fallbackStatus;
}

export function createExecutionReport(input: {
  readonly diagnostics?: readonly FlowDiagnostic[] | undefined;
  readonly outcomes?: readonly FlowOutcome[] | undefined;
  readonly reason?: string | undefined;
  readonly status?: DiagnosticStatus | undefined;
}): DiagnosticReport {
  const diagnostics = input.diagnostics ?? [];
  const outcomes = input.outcomes ?? [];
  const report: DiagnosticReport = {
    status:
      input.status ??
      deriveExecutionReportStatus(diagnostics, outcomes, diagnostics.length > 0 ? 'ok' : 'ok'),
    diagnostics,
    outcomes,
  };

  return input.reason == null ? report : { ...report, reason: input.reason };
}

export function deriveDiagnosticReportExitCode(
  report: Pick<DiagnosticReport, 'status'>,
): 0 | 1 | 2 | 3 {
  switch (report.status) {
    case 'blocked':
      return 2;
    case 'unsuccessful':
      return 1;
    case 'failed':
      return 3;
    case 'ok':
    default:
      return 0;
  }
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

export function createProfileWarningDiagnostic(
  code: string,
  summary: string,
  action?: string,
): FlowDiagnostic {
  return {
    code,
    kind: 'profile',
    phase: 'preflight',
    severity: 'warning',
    blocksExecution: false,
    retryable: false,
    summary,
    ...(action != null ? { action } : {}),
  };
}

export function createRuntimeDiagnostic(
  code: string,
  summary: string,
  action?: string,
  retryable = false,
): FlowDiagnostic {
  return {
    code,
    kind: 'runtime',
    phase: 'gate-eval',
    severity: 'error',
    blocksExecution: true,
    retryable,
    summary,
    ...(action != null ? { action } : {}),
  };
}

export function createRuntimeSessionDiagnostic(
  code: string,
  summary: string,
  action?: string,
): FlowDiagnostic {
  return {
    code,
    kind: 'runtime',
    phase: 'session-init',
    severity: 'error',
    blocksExecution: true,
    retryable: false,
    summary,
    ...(action != null ? { action } : {}),
  };
}

export function createRuntimeWarningDiagnostic(
  code: string,
  summary: string,
  action?: string,
  retryable = false,
): FlowDiagnostic {
  return {
    code,
    kind: 'runtime',
    phase: 'advance',
    severity: 'warning',
    blocksExecution: false,
    retryable,
    summary,
    ...(action != null ? { action } : {}),
  };
}

export function createFlowOutcome(code: string, summary: string): FlowOutcome {
  return { code, summary };
}
