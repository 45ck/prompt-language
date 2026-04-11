import { describe, expect, it } from 'vitest';
import {
  createExecutionReport,
  createFlowOutcome,
  createBlockingProfileDiagnostic,
  createDiagnosticReport,
  deriveDiagnosticReportExitCode,
  createProfileWarningDiagnostic,
  DIAGNOSTIC_CODE_RANGES,
  FLOW_OUTCOME_CODES,
  PROFILE_DIAGNOSTIC_CODES,
  RUNTIME_DIAGNOSTIC_CODES,
  createRuntimeDiagnostic,
  createRuntimeSessionDiagnostic,
  createRuntimeWarningDiagnostic,
} from './diagnostic-report.js';

describe('diagnostic-report', () => {
  it('marks reports blocked when any diagnostic blocks execution', () => {
    const report = createDiagnosticReport([
      createBlockingProfileDiagnostic(
        PROFILE_DIAGNOSTIC_CODES.missingRunnerBinary,
        'runner missing',
      ),
    ]);

    expect(report.status).toBe('blocked');
    expect(report.outcomes).toEqual([]);
  });

  it('keeps empty reports ok', () => {
    const report = createDiagnosticReport([]);

    expect(report.status).toBe('ok');
    expect(report.diagnostics).toEqual([]);
  });

  it('exposes stable code ranges and preflight profile codes', () => {
    expect(DIAGNOSTIC_CODE_RANGES.profile).toBe('PLC');
    expect(PROFILE_DIAGNOSTIC_CODES.unsupportedApprove).toBe('PLC-004');
    expect(PROFILE_DIAGNOSTIC_CODES.missingGatePrerequisite).toBe('PLC-005');
    expect(RUNTIME_DIAGNOSTIC_CODES.resumeStateCorruption).toBe('PLR-004');
    expect(RUNTIME_DIAGNOSTIC_CODES.captureRetryFallback).toBe('PLR-005');
    expect(RUNTIME_DIAGNOSTIC_CODES.gateEvaluationCrashed).toBe('PLR-006');
    expect(FLOW_OUTCOME_CODES.reviewRejected).toBe('PLO-002');
    expect(FLOW_OUTCOME_CODES.approvalDenied).toBe('PLO-003');
    expect(FLOW_OUTCOME_CODES.gateFailed).toBe('PLO-001');
  });

  it('preserves optional warning actions', () => {
    const diagnostic = createProfileWarningDiagnostic(
      PROFILE_DIAGNOSTIC_CODES.unavailableUxSurface,
      'Status line is unavailable.',
      'Use an interactive profile.',
    );

    expect(diagnostic.severity).toBe('warning');
    expect(diagnostic.action).toBe('Use an interactive profile.');
  });

  it('creates runtime diagnostics and flow outcomes', () => {
    const diagnostic = createRuntimeDiagnostic(
      RUNTIME_DIAGNOSTIC_CODES.gateEvaluationCrashed,
      'Gate evaluation crashed: network error',
      'Fix the gate command.',
      true,
    );
    const outcome = createFlowOutcome(FLOW_OUTCOME_CODES.gateFailed, 'Completion gates failed.');

    expect(diagnostic.kind).toBe('runtime');
    expect(diagnostic.phase).toBe('gate-eval');
    expect(diagnostic.blocksExecution).toBe(true);
    expect(diagnostic.retryable).toBe(true);
    expect(outcome).toEqual({
      code: FLOW_OUTCOME_CODES.gateFailed,
      summary: 'Completion gates failed.',
    });
  });

  it('creates non-blocking runtime warning diagnostics', () => {
    const diagnostic = createRuntimeWarningDiagnostic(
      RUNTIME_DIAGNOSTIC_CODES.captureRetryFallback,
      "Capture for 'answer' fell back to empty string after 3 attempts.",
      'Inspect the capture path.',
      true,
    );

    expect(diagnostic.kind).toBe('runtime');
    expect(diagnostic.phase).toBe('advance');
    expect(diagnostic.severity).toBe('warning');
    expect(diagnostic.blocksExecution).toBe(false);
    expect(diagnostic.retryable).toBe(true);
  });

  it('creates blocking session-init runtime diagnostics', () => {
    const diagnostic = createRuntimeSessionDiagnostic(
      RUNTIME_DIAGNOSTIC_CODES.resumeStateCorruption,
      'Resume state is corrupted and could not be recovered from backup.',
      'Reset the flow state before continuing.',
    );

    expect(diagnostic.kind).toBe('runtime');
    expect(diagnostic.phase).toBe('session-init');
    expect(diagnostic.severity).toBe('error');
    expect(diagnostic.blocksExecution).toBe(true);
    expect(diagnostic.retryable).toBe(false);
  });

  it('derives blocked execution reports from blocking preflight diagnostics', () => {
    const report = createExecutionReport({
      diagnostics: [
        createBlockingProfileDiagnostic(
          PROFILE_DIAGNOSTIC_CODES.unsupportedApprove,
          'approve is not supported in headless mode.',
        ),
      ],
    });

    expect(report.status).toBe('blocked');
    expect(deriveDiagnosticReportExitCode(report)).toBe(2);
  });

  it('derives unsuccessful execution reports from negative outcomes', () => {
    const report = createExecutionReport({
      outcomes: [createFlowOutcome(FLOW_OUTCOME_CODES.gateFailed, 'Completion gates failed.')],
    });

    expect(report.status).toBe('unsuccessful');
    expect(deriveDiagnosticReportExitCode(report)).toBe(1);
  });

  it('derives failed execution reports from blocking runtime diagnostics', () => {
    const report = createExecutionReport({
      diagnostics: [
        createRuntimeDiagnostic(
          RUNTIME_DIAGNOSTIC_CODES.gateEvaluationCrashed,
          'Gate evaluation crashed: network error',
          'Fix the gate command.',
        ),
      ],
      reason: 'Gate evaluation crashed: network error',
    });

    expect(report.status).toBe('failed');
    expect(report.reason).toBe('Gate evaluation crashed: network error');
    expect(deriveDiagnosticReportExitCode(report)).toBe(3);
  });

  it('treats internal execution errors as failed reports', () => {
    const report = createExecutionReport({
      diagnostics: [
        {
          code: 'PLI-001',
          kind: 'internal',
          phase: 'render',
          severity: 'error',
          blocksExecution: true,
          retryable: false,
          summary: 'Rendering crashed.',
        },
      ],
    });

    expect(report.status).toBe('failed');
  });

  it('returns ok exit code for successful reports', () => {
    expect(
      deriveDiagnosticReportExitCode({
        status: 'ok',
      }),
    ).toBe(0);
  });

  it('preserves explicit fallback status when no classification signal exists yet', () => {
    const report = createExecutionReport({
      status: 'failed',
      reason: 'Prompt runner completed without observable workspace progress.',
    });

    expect(report.status).toBe('failed');
    expect(report.diagnostics).toEqual([]);
    expect(report.outcomes).toEqual([]);
    expect(report.reason).toContain('without observable workspace progress');
  });

  it('omits optional action fields when not provided', () => {
    expect(
      createBlockingProfileDiagnostic(
        PROFILE_DIAGNOSTIC_CODES.missingRunnerBinary,
        'runner missing',
      ),
    ).not.toHaveProperty('action');
    expect(
      createProfileWarningDiagnostic(
        PROFILE_DIAGNOSTIC_CODES.unavailableUxSurface,
        'Status line unavailable.',
      ),
    ).not.toHaveProperty('action');
    expect(
      createRuntimeDiagnostic(RUNTIME_DIAGNOSTIC_CODES.gateEvaluationCrashed, 'gate crashed'),
    ).not.toHaveProperty('action');
  });
});
