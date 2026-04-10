import { describe, expect, it } from 'vitest';
import { createFlowSpec, createCompletionGate } from '../domain/flow-spec.js';
import { PROFILE_DIAGNOSTIC_CODES, type FlowDiagnostic } from '../domain/diagnostic-report.js';
import { runExecutionPreflight } from './execution-preflight.js';

describe('execution-preflight', () => {
  it('blocks when the selected runner binary is missing', () => {
    const spec = createFlowSpec('test', []);
    const report = runExecutionPreflight(
      spec,
      { cwd: '/repo', runner: 'codex' },
      { probeRunnerBinary: () => false },
    );

    expect(report.status).toBe('blocked');
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining<Partial<FlowDiagnostic>>({
          code: PROFILE_DIAGNOSTIC_CODES.missingRunnerBinary,
          phase: 'preflight',
        }),
      ]),
    );
  });

  it('blocks when built-in gate prerequisites are missing', () => {
    const spec = createFlowSpec('test', [], [createCompletionGate('tests_pass')]);
    const report = runExecutionPreflight(
      spec,
      { cwd: '/repo', runner: 'codex' },
      {
        probeRunnerBinary: () => true,
        workspaceAccess: {
          exists: () => false,
          readText: () => '',
        },
      },
    );

    expect(report.status).toBe('blocked');
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining<Partial<FlowDiagnostic>>({
          code: PROFILE_DIAGNOSTIC_CODES.missingGatePrerequisite,
        }),
      ]),
    );
  });

  it('does not block goal-state gates like file_exists', () => {
    const spec = createFlowSpec('test', [], [createCompletionGate('file_exists out.txt')]);
    const report = runExecutionPreflight(
      spec,
      { cwd: '/repo', runner: 'codex' },
      {
        probeRunnerBinary: () => true,
        workspaceAccess: {
          exists: () => false,
          readText: () => '',
        },
      },
    );

    expect(report.status).toBe('ok');
    expect(report.diagnostics).toEqual([]);
  });

  it('dedupes repeated prerequisite failures', () => {
    const spec = createFlowSpec(
      'test',
      [],
      [createCompletionGate('lint_pass'), createCompletionGate('lint_fail')],
    );
    const report = runExecutionPreflight(
      spec,
      { cwd: '/repo', runner: 'codex' },
      {
        probeRunnerBinary: () => true,
        workspaceAccess: {
          exists: () => false,
          readText: () => '',
        },
      },
    );

    expect(
      report.diagnostics.filter(
        (diagnostic) => diagnostic.code === PROFILE_DIAGNOSTIC_CODES.missingGatePrerequisite,
      ),
    ).toHaveLength(1);
  });
});
