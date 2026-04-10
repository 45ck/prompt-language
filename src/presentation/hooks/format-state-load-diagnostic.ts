import type { FlowDiagnostic } from '../../domain/diagnostic-report.js';

export function formatStateLoadDiagnosticBanner(diagnostic: FlowDiagnostic): string {
  return `[prompt-language] ${diagnostic.code} ${diagnostic.summary}`;
}

export function formatStateLoadDiagnosticMessage(diagnostic: FlowDiagnostic): string {
  const banner = formatStateLoadDiagnosticBanner(diagnostic);
  return diagnostic.action == null ? banner : `${banner}\n\nAction: ${diagnostic.action}`;
}
