import { parseFlow } from '../application/parse-flow.js';
import {
  createBlockingProfileDiagnostic,
  createDiagnosticReport,
  type DiagnosticReport,
} from '../domain/diagnostic-report.js';
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
import { expandSwarmDocument } from '../application/lower-swarm.js';
import { collectSpecialGatePredicateIssues } from '../application/artifacts/artifact-gate-state.js';

const UNSUPPORTED_SPECIAL_GATE_PROFILE_DIAGNOSTIC_CODE = 'PLC-009';

export interface ValidateFlowPreview {
  readonly complexity: number;
  readonly expandedFlow?: string | undefined;
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
  const expanded = expandSwarmDocument(flowText);
  const parseSource = expanded.changed ? expanded.text : flowText;
  const spec = parseFlow(parseSource, { basePath: cwd });
  const lintWarnings = lintFlow(spec);
  const state = createSessionState('validate-preview', spec, 'validate-preview-nonce');
  const warnings = [
    ...expanded.warnings,
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
  const specialGateDiagnostics = collectSpecialGatePredicateIssues(spec.completionGates).map(
    (issue) =>
      createBlockingProfileDiagnostic(
        UNSUPPORTED_SPECIAL_GATE_PROFILE_DIAGNOSTIC_CODE,
        issue.summary,
        issue.action,
      ),
  );
  const mergedReport =
    specialGateDiagnostics.length === 0
      ? report
      : createDiagnosticReport([...report.diagnostics, ...specialGateDiagnostics], report.outcomes);

  const preflightSection =
    mergedReport.diagnostics.length > 0 ? ['', formatDiagnosticReport(mergedReport)] : [];

  return {
    complexity,
    ...(expanded.loweredFlowText != null ? { expandedFlow: expanded.loweredFlowText } : {}),
    lintWarningCount: lintWarnings.length,
    renderedFlow: rendered,
    report: mergedReport,
    output: [
      '[prompt-language validate] Flow parsed successfully.',
      `Complexity: ${complexity}/5`,
      `Lint warnings: ${lintWarnings.length}`,
      ...preflightSection,
      ...(expanded.loweredFlowText != null
        ? ['', 'Lowered swarm flow:', expanded.loweredFlowText, '', 'Rendered runtime flow:']
        : []),
      '',
      rendered,
    ].join('\n'),
  };
}
