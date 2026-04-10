import { describe, expect, it } from 'vitest';
import {
  createBlockingProfileDiagnostic,
  createDiagnosticReport,
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
});
