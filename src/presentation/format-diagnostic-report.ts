import type { DiagnosticReport } from '../domain/diagnostic-report.js';

export function formatDiagnosticReport(
  report: DiagnosticReport,
  header = '[prompt-language preflight]',
): string {
  const itemCount = report.diagnostics.length + report.outcomes.length;

  if (itemCount === 0 && report.reason == null) {
    return `${header} OK`;
  }

  const state =
    report.status === 'blocked'
      ? 'BLOCKED'
      : report.status === 'failed'
        ? 'FAILED'
        : report.status === 'unsuccessful'
          ? 'UNSUCCESSFUL'
          : report.diagnostics.length > 0
            ? 'WARN'
            : 'OK';
  const countSuffix = itemCount > 0 ? ` (${itemCount})` : '';
  const lines = [`${header} ${state}${countSuffix}`];
  for (const diagnostic of report.diagnostics) {
    lines.push(`- ${diagnostic.code} ${diagnostic.summary}`);
    if (diagnostic.action) {
      lines.push(`  Action: ${diagnostic.action}`);
    }
  }
  for (const outcome of report.outcomes) {
    lines.push(`- ${outcome.code} ${outcome.summary}`);
  }
  if (itemCount === 0 && report.reason) {
    lines.push(`- ${report.reason}`);
  }
  return lines.join('\n');
}
