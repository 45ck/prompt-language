import { describe, expect, it } from 'vitest';
import {
  createFlowOutcome,
  createBlockingProfileDiagnostic,
  createDiagnosticReport,
  createProfileWarningDiagnostic,
  DIAGNOSTIC_CODE_RANGES,
  FLOW_OUTCOME_CODES,
  PROFILE_DIAGNOSTIC_CODES,
  RUNTIME_DIAGNOSTIC_CODES,
  createRuntimeDiagnostic,
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
    expect(RUNTIME_DIAGNOSTIC_CODES.gateEvaluationCrashed).toBe('PLR-006');
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
});
