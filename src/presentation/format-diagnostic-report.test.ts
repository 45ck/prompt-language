import { describe, expect, it } from 'vitest';
import {
  createBlockingProfileDiagnostic,
  createDiagnosticReport,
  createExecutionReport,
  createFlowOutcome,
  createProfileWarningDiagnostic,
  FLOW_OUTCOME_CODES,
} from '../domain/diagnostic-report.js';
import { formatDiagnosticReport } from './format-diagnostic-report.js';

describe('formatDiagnosticReport', () => {
  it('renders an OK fast path when no diagnostics, outcomes, or reason exist', () => {
    const report = createExecutionReport({});

    expect(formatDiagnosticReport(report)).toBe('[prompt-language preflight] OK');
  });

  it('renders blocked diagnostics in a compact CLI-friendly format', () => {
    const report = createDiagnosticReport([
      createBlockingProfileDiagnostic(
        'PLC-001',
        'Runner "codex" is unavailable.',
        'Install codex.',
      ),
    ]);

    expect(formatDiagnosticReport(report)).toContain('BLOCKED');
    expect(formatDiagnosticReport(report)).toContain('PLC-001');
    expect(formatDiagnosticReport(report)).toContain('Install codex.');
  });

  it('renders warning-only diagnostics without a blocked header', () => {
    const report = createDiagnosticReport([
      createProfileWarningDiagnostic('PLC-007', 'Watch mode is unavailable in headless mode.'),
    ]);

    expect(formatDiagnosticReport(report)).toContain('WARN');
    expect(formatDiagnosticReport(report)).toContain('PLC-007');
    expect(formatDiagnosticReport(report)).not.toContain('BLOCKED');
  });

  it('renders unsuccessful outcomes separately from diagnostics', () => {
    const report = createExecutionReport({
      outcomes: [
        createFlowOutcome(
          FLOW_OUTCOME_CODES.gateFailed,
          'Completion gates failed: file_exists done.txt.',
        ),
      ],
    });

    expect(formatDiagnosticReport(report, '[prompt-language run]')).toContain('UNSUCCESSFUL');
    expect(formatDiagnosticReport(report, '[prompt-language run]')).toContain('PLO-001');
  });

  it('renders reason-only failed reports when no structured signal exists yet', () => {
    const report = createExecutionReport({
      status: 'failed',
      reason: 'Prompt runner completed without observable workspace progress.',
    });

    expect(formatDiagnosticReport(report, '[prompt-language ci]')).toContain('FAILED');
    expect(formatDiagnosticReport(report, '[prompt-language ci]')).toContain(
      'without observable workspace progress',
    );
  });
});
