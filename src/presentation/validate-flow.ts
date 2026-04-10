import { parseFlow } from '../application/parse-flow.js';
import { createDiagnosticReport, type DiagnosticReport } from '../domain/diagnostic-report.js';
import {
  runExecutionPreflight,
  type ExecutionMode,
  type RunnerName,
} from '../application/execution-preflight.js';
import { flowComplexityScore } from '../domain/flow-complexity.js';
import { lintFlow } from '../domain/lint-flow.js';
import { renderFlow } from '../domain/render-flow.js';
import { createSessionState } from '../domain/session-state.js';
import { formatDiagnosticReport } from './format-diagnostic-report.js';

export interface ValidateFlowPreview {
  readonly complexity: number;
  readonly lintWarningCount: number;
  readonly renderedFlow: string;
  readonly report: DiagnosticReport;
  readonly output: string;
}

export interface BuildValidateFlowPreviewOptions {
  readonly cwd?: string | undefined;
  readonly runner?: RunnerName | undefined;
  readonly mode?: ExecutionMode | undefined;
  readonly probeRunnerBinary?: ((runner: RunnerName) => boolean) | undefined;
}

export function buildValidateFlowPreview(
  flowText: string,
  options: BuildValidateFlowPreviewOptions = {},
): ValidateFlowPreview {
  const cwd = options.cwd ?? process.cwd();
  const spec = parseFlow(flowText, { basePath: cwd });
  const lintWarnings = lintFlow(spec);
  const state = createSessionState('validate-preview', spec, 'validate-preview-nonce');
  const warnings = [
    ...state.warnings,
    ...lintWarnings.map((warning) => `${warning.nodeId}: ${warning.message}`),
  ];
  const rendered = renderFlow({ ...state, warnings });
  const complexity = flowComplexityScore(spec);
  const report: DiagnosticReport =
    options.runner == null
      ? createDiagnosticReport([])
      : runExecutionPreflight(
          spec,
          {
            cwd,
            runner: options.runner,
            ...(options.mode != null ? { mode: options.mode } : {}),
          },
          { probeRunnerBinary: options.probeRunnerBinary },
        );

  const preflightSection =
    report.diagnostics.length > 0 ? ['', formatDiagnosticReport(report)] : [];

  return {
    complexity,
    lintWarningCount: lintWarnings.length,
    renderedFlow: rendered,
    report,
    output: [
      '[prompt-language validate] Flow parsed successfully.',
      `Complexity: ${complexity}/5`,
      `Lint warnings: ${lintWarnings.length}`,
      ...preflightSection,
      '',
      rendered,
    ].join('\n'),
  };
}
