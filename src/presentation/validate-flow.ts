import { parseFlow } from '../application/parse-flow.js';
import { flowComplexityScore } from '../domain/flow-complexity.js';
import { lintFlow } from '../domain/lint-flow.js';
import { renderFlow } from '../domain/render-flow.js';
import { createSessionState } from '../domain/session-state.js';

export interface ValidateFlowPreview {
  readonly complexity: number;
  readonly lintWarningCount: number;
  readonly output: string;
}

export function buildValidateFlowPreview(flowText: string): ValidateFlowPreview {
  const spec = parseFlow(flowText);
  const lintWarnings = lintFlow(spec);
  const state = createSessionState('validate-preview', spec, 'validate-preview-nonce');
  const warnings = [
    ...state.warnings,
    ...lintWarnings.map((warning) => `${warning.nodeId}: ${warning.message}`),
  ];
  const rendered = renderFlow({ ...state, warnings });
  const complexity = flowComplexityScore(spec);

  return {
    complexity,
    lintWarningCount: lintWarnings.length,
    output: [
      '[prompt-language validate] Flow parsed successfully.',
      `Complexity: ${complexity}/5`,
      `Lint warnings: ${lintWarnings.length}`,
      '',
      rendered,
    ].join('\n'),
  };
}
