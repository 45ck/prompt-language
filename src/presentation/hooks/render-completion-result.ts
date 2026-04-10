import type { EvaluateCompletionOutput } from '../../application/evaluate-completion.js';

export function renderCompletionResult(result: EvaluateCompletionOutput): string {
  const diagnostic = result.diagnostics[0];
  if (diagnostic) {
    return diagnostic.action == null
      ? `${diagnostic.code} ${diagnostic.summary}`
      : `${diagnostic.code} ${diagnostic.summary}\nFix: ${diagnostic.action}`;
  }

  const outcome = result.outcomes[0];
  if (outcome) {
    return `${outcome.code} ${outcome.summary}`;
  }

  return result.reason;
}
