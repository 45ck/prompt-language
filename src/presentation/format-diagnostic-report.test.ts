import { describe, expect, it } from 'vitest';
import {
  createBlockingProfileDiagnostic,
  createDiagnosticReport,
  createProfileWarningDiagnostic,
} from '../domain/diagnostic-report.js';
import { formatDiagnosticReport } from './format-diagnostic-report.js';

describe('formatDiagnosticReport', () => {
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
});
