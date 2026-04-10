import type { DiagnosticReport } from '../domain/diagnostic-report.js';

export function formatDiagnosticReport(
  report: DiagnosticReport,
  header = '[prompt-language preflight]',
): string {
  if (report.diagnostics.length === 0) {
    return `${header} OK`;
  }

  const lines = [`${header} BLOCKED (${report.diagnostics.length})`];
  for (const diagnostic of report.diagnostics) {
    lines.push(`- ${diagnostic.code} ${diagnostic.summary}`);
    if (diagnostic.action) {
      lines.push(`  Action: ${diagnostic.action}`);
    }
  }
  return lines.join('\n');
}
