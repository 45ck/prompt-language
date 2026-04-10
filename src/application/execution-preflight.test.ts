import { describe, expect, it } from 'vitest';
import { createFlowSpec, createCompletionGate } from '../domain/flow-spec.js';
import { PROFILE_DIAGNOSTIC_CODES, type FlowDiagnostic } from '../domain/diagnostic-report.js';
import { runExecutionPreflight } from './execution-preflight.js';
import {
  createApproveNode,
  createAwaitNode,
  createForeachNode,
  createForeachSpawnNode,
  createIfNode,
  createLetNode,
  createPromptNode,
  createReceiveNode,
  createRememberNode,
  createReviewNode,
  createRaceNode,
  createRetryNode,
  createRunNode,
  createSendNode,
  createSpawnNode,
  createTryNode,
  createUntilNode,
  createWhileNode,
} from '../domain/flow-node.js';

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

  it('blocks approve in non-interactive mode', () => {
    const spec = createFlowSpec('test', [createApproveNode('a1', 'Ship it?')]);
    const report = runExecutionPreflight(
      spec,
      { cwd: '/repo', runner: 'opencode', mode: 'headless' },
      { probeRunnerBinary: () => true },
    );

    expect(report.status).toBe('blocked');
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining<Partial<FlowDiagnostic>>({
          code: PROFILE_DIAGNOSTIC_CODES.unsupportedApprove,
        }),
      ]),
    );
  });

  it('warns for UX-only gaps in headless mode without blocking execution', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'hello')]);
    const report = runExecutionPreflight(
      spec,
      { cwd: '/repo', runner: 'codex', mode: 'headless' },
      { probeRunnerBinary: () => true },
    );

    expect(report.status).toBe('ok');
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining<Partial<FlowDiagnostic>>({
          code: PROFILE_DIAGNOSTIC_CODES.unavailableUxSurface,
          severity: 'warning',
          blocksExecution: false,
        }),
      ]),
    );
  });

  it('preserves ask/capture semantics on claude headless profiles', () => {
    const spec = createFlowSpec('test', [
      createLetNode('l1', 'answer', { type: 'prompt', text: 'Say hello' }),
    ]);
    const report = runExecutionPreflight(
      spec,
      { cwd: '/repo', runner: 'claude', mode: 'headless' },
      { probeRunnerBinary: () => true },
    );

    expect(report.status).toBe('ok');
    expect(
      report.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === PROFILE_DIAGNOSTIC_CODES.unsupportedCaptureSemantics &&
          diagnostic.blocksExecution,
      ),
    ).toBe(false);
  });

  it('preserves spawn/await semantics on claude headless profiles', () => {
    const spec = createFlowSpec('test', [
      createSpawnNode('s1', 'worker', [createPromptNode('p1', 'fix it')]),
      createAwaitNode('a1', 'worker'),
    ]);
    const report = runExecutionPreflight(
      spec,
      { cwd: '/repo', runner: 'claude', mode: 'headless' },
      { probeRunnerBinary: () => true },
    );

    expect(report.status).toBe('ok');
    expect(
      report.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === PROFILE_DIAGNOSTIC_CODES.unsupportedParallelSemantics &&
          diagnostic.summary.includes('spawn/await') &&
          diagnostic.blocksExecution,
      ),
    ).toBe(false);
  });

  it('accepts capture and spawn/await semantics on supported headless runners', () => {
    const spec = createFlowSpec('test', [
      createLetNode('l1', 'answer', { type: 'prompt_json', text: 'List fixes', schema: '{}' }),
      createSpawnNode('s1', 'worker', [createPromptNode('p1', 'fix it')]),
      createAwaitNode('a1', 'worker'),
    ]);
    const report = runExecutionPreflight(
      spec,
      { cwd: '/repo', runner: 'opencode', mode: 'headless' },
      { probeRunnerBinary: () => true },
    );

    expect(report.status).toBe('ok');
    expect(
      report.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === PROFILE_DIAGNOSTIC_CODES.unsupportedCaptureSemantics ||
          diagnostic.code === PROFILE_DIAGNOSTIC_CODES.unsupportedParallelSemantics,
      ),
    ).toBe(false);
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining<Partial<FlowDiagnostic>>({
          code: PROFILE_DIAGNOSTIC_CODES.unavailableUxSurface,
        }),
      ]),
    );
  });

  it('blocks unsupported interactive profiles for headless runners', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'hello')]);
    const report = runExecutionPreflight(
      spec,
      { cwd: '/repo', runner: 'codex', mode: 'interactive' },
      { probeRunnerBinary: () => true },
    );

    expect(report.status).toBe('blocked');
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining<Partial<FlowDiagnostic>>({
          code: PROFILE_DIAGNOSTIC_CODES.unsupportedHostOrMode,
        }),
      ]),
    );
  });

  it('blocks send/receive semantics on claude interactive profiles', () => {
    const spec = createFlowSpec('test', [
      createSendNode('s1', 'parent', 'done'),
      createReceiveNode('r1', 'reply', 'parent'),
    ]);
    const report = runExecutionPreflight(
      spec,
      { cwd: '/repo', runner: 'claude', mode: 'interactive' },
      { probeRunnerBinary: () => true },
    );

    expect(report.status).toBe('blocked');
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining<Partial<FlowDiagnostic>>({
          code: PROFILE_DIAGNOSTIC_CODES.unsupportedParallelSemantics,
          summary: 'send/receive semantics are unavailable for runner=claude mode=interactive.',
        }),
      ]),
    );
  });

  it('blocks send/receive semantics on claude headless profiles', () => {
    const spec = createFlowSpec('test', [createReceiveNode('r1', 'reply', 'parent')]);
    const report = runExecutionPreflight(
      spec,
      { cwd: '/repo', runner: 'claude', mode: 'headless' },
      { probeRunnerBinary: () => true },
    );

    expect(report.status).toBe('blocked');
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining<Partial<FlowDiagnostic>>({
          code: PROFILE_DIAGNOSTIC_CODES.unsupportedParallelSemantics,
          summary: 'send/receive semantics are unavailable for runner=claude mode=headless.',
        }),
      ]),
    );
  });

  it('collects compatibility requirements across composite node shapes without blocking supported headless profiles', () => {
    const spec = createFlowSpec('test', [
      createWhileNode('w1', 'ask:"ready?"', [createRememberNode('rm1', 'looping')]),
      createUntilNode('u1', 'ask:"done?"', [createRunNode('rn1', 'echo done')]),
      createIfNode(
        'if1',
        'ask:"safe?"',
        [createLetNode('lp1', 'captured', { type: 'prompt', text: 'capture it' })],
        [createLetNode('ll1', 'fallback', { type: 'literal', value: 'nope' })],
      ),
      createRetryNode('rt1', [createLetNode('lr1', 'result', { type: 'run', command: 'echo ok' })]),
      createForeachNode('fe1', 'item', 'items', [
        createLetNode('lm1', 'memo', { type: 'memory', key: 'item-note' }),
      ]),
      createTryNode(
        'tr1',
        [createLetNode('le1', 'empty', { type: 'empty_list' })],
        'failed',
        [createPromptNode('p1', 'recover')],
        [createRememberNode('rm2', undefined, 'done', 'true')],
      ),
      createReviewNode(
        'rv1',
        [createPromptNode('p2', 'review it')],
        2,
        undefined,
        undefined,
        false,
        'judge-a',
      ),
      createRaceNode('ra1', [
        createSpawnNode('sp1', 'worker-a', [createPromptNode('p3', 'A')]),
        createSpawnNode('sp2', 'worker-b', [createPromptNode('p4', 'B')]),
      ]),
      createForeachSpawnNode('fs1', 'item', 'items', [createPromptNode('p5', 'fan out')]),
      createAwaitNode('aw1', 'all'),
      createSendNode('sd1', 'worker-a', 'hello'),
    ]);
    const report = runExecutionPreflight(
      spec,
      { cwd: '/repo', runner: 'opencode', mode: 'headless' },
      { probeRunnerBinary: () => true },
    );

    expect(report.status).toBe('ok');
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining<Partial<FlowDiagnostic>>({
          code: PROFILE_DIAGNOSTIC_CODES.unavailableUxSurface,
          blocksExecution: false,
        }),
      ]),
    );
    expect(
      report.diagnostics.some(
        (diagnostic) => diagnostic.code === PROFILE_DIAGNOSTIC_CODES.unsupportedApprove,
      ),
    ).toBe(false);
  });
});
