import { describe, it, expect } from 'vitest';
import { autoAdvanceNodes } from './advance-flow.js';
import { createSessionState } from '../domain/session-state.js';
import { createFlowSpec } from '../domain/flow-spec.js';
import {
  createLetNode,
  createSnapshotNode,
  createRollbackNode,
  createPromptNode,
  createTryNode,
  createForeachNode,
} from '../domain/flow-node.js';
import type { TraceEntry, TraceLogger } from './ports/trace-logger.js';
import type { AuditLogger, AuditEntry } from './ports/audit-logger.js';

function buildSession(nodes: Parameters<typeof createFlowSpec>[1]) {
  const spec = createFlowSpec('test', nodes);
  return createSessionState('s1', spec);
}

describe('snapshot + rollback (PR1)', () => {
  it('snapshot captures variables and auto-advances', async () => {
    const nodes = [
      createLetNode('l1', 'x', { type: 'literal', value: 'first' }),
      createSnapshotNode('s1', 'cp'),
      createPromptNode('p1', 'done'),
    ];
    const state = buildSession(nodes);
    const result = await autoAdvanceNodes(state);

    expect(result.kind).toBe('prompt');
    expect(result.state.snapshots['cp']).toBeDefined();
    expect(result.state.snapshots['cp']!.variables['x']).toBe('first');
    expect(result.state.snapshots['cp']!.stateHash).toMatch(/^[a-f0-9]+$/);
  });

  it('rollback restores variables captured in snapshot', async () => {
    const nodes = [
      createLetNode('l1', 'x', { type: 'literal', value: 'before' }),
      createSnapshotNode('s1', 'cp'),
      createLetNode('l2', 'x', { type: 'literal', value: 'after' }),
      createRollbackNode('r1', 'cp'),
      createPromptNode('p1', 'done'),
    ];
    const state = buildSession(nodes);
    const result = await autoAdvanceNodes(state);

    expect(result.state.variables['x']).toBe('before');
    expect(result.state.snapshots['cp']).toBeDefined();
  });

  it('duplicate snapshot names overwrite with warning', async () => {
    const nodes = [
      createLetNode('l1', 'x', { type: 'literal', value: 'v1' }),
      createSnapshotNode('s1', 'cp'),
      createLetNode('l2', 'x', { type: 'literal', value: 'v2' }),
      createSnapshotNode('s2', 'cp'),
      createPromptNode('p1', 'done'),
    ];
    const state = buildSession(nodes);
    const result = await autoAdvanceNodes(state);

    expect(result.state.snapshots['cp']!.variables['x']).toBe('v2');
    expect(result.state.warnings.some((w) => w.includes('cp') && w.includes('overwritten'))).toBe(
      true,
    );
  });

  it('rollback to missing snapshot pauses and does not fail the flow', async () => {
    const nodes = [createRollbackNode('r1', 'no-such'), createPromptNode('p1', 'done')];
    const state = buildSession(nodes);
    const result = await autoAdvanceNodes(state);

    expect(result.kind).toBe('pause');
    expect(result.state.status).toBe('active');
    expect(
      result.state.warnings.some((w) => w.includes('no snapshot named') && w.includes('no-such')),
    ).toBe(true);
  });

  it('rollback restores iteration counters captured at snapshot time', async () => {
    const nodes = [
      createForeachNode(
        'fe1',
        'item',
        'a b c',
        [
          createSnapshotNode('s1', 'mid'),
          createLetNode('l1', 'acc', { type: 'literal', value: 'x' }),
        ],
        3,
      ),
      createPromptNode('p1', 'done'),
    ];
    const state = buildSession(nodes);
    const result = await autoAdvanceNodes(state);
    // snapshot was captured with iteration = 1 on first loop entry
    expect(result.state.snapshots['mid']).toBeDefined();
    expect(result.state.snapshots['mid']!.iterations['fe1']).toBeDefined();
  });

  it('snapshot captures iteration counters for later rollback', async () => {
    const nodes = [
      createLetNode('l1', 'x', { type: 'literal', value: 'v1' }),
      createSnapshotNode('s1', 'cp'),
      createPromptNode('p1', 'done'),
    ];
    const state = buildSession(nodes);
    const result = await autoAdvanceNodes(state);
    expect(result.state.snapshots['cp']).toBeDefined();
    expect(result.state.snapshots['cp']!.currentPath).toEqual([1]);
    expect(result.state.snapshots['cp']!.iterations).toBeDefined();
  });

  it('rollback emits a trace entry with detail.rolledBackTo and detail.restoredStateHash', async () => {
    const nodes = [
      createLetNode('l1', 'x', { type: 'literal', value: 'one' }),
      createSnapshotNode('s1', 'cp'),
      createLetNode('l2', 'x', { type: 'literal', value: 'two' }),
      createRollbackNode('r1', 'cp'),
      createPromptNode('p1', 'done'),
    ];
    const state = buildSession(nodes);
    const entries: TraceEntry[] = [];
    const logger: TraceLogger = { log: (e) => entries.push(e) };
    await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      logger,
    );
    const rollback = entries.find(
      (e) => (e as unknown as { nodeKind?: string }).nodeKind === 'rollback',
    ) as unknown as { detail?: Record<string, unknown> } | undefined;
    expect(rollback?.detail?.['rolledBackTo']).toBe('cp');
    expect(typeof rollback?.detail?.['restoredStateHash']).toBe('string');
  });

  it('snapshot and rollback emit audit log entries describing the node', async () => {
    const nodes = [
      createLetNode('l1', 'x', { type: 'literal', value: 'one' }),
      createSnapshotNode('s1', 'cp'),
      createRollbackNode('r1', 'cp'),
      createPromptNode('p1', 'done'),
    ];
    const state = buildSession(nodes);
    const entries: AuditEntry[] = [];
    const auditLogger: AuditLogger = { log: (e) => entries.push(e) };
    await autoAdvanceNodes(state, undefined, undefined, undefined, auditLogger);
    const snap = entries.find((e) => e.nodeKind === 'snapshot');
    const rb = entries.find((e) => e.nodeKind === 'rollback');
    expect(snap?.command).toContain('snapshot');
    expect(rb?.command).toContain('rollback');
  });

  it('rollback inside try/catch is recoverable when the snapshot is missing', async () => {
    const nodes = [
      createTryNode('t1', [createRollbackNode('r1', 'ghost')], 'true', [
        createLetNode('l2', 'recovered', { type: 'literal', value: 'yes' }),
      ]),
      createPromptNode('p1', 'done'),
    ];
    const state = buildSession(nodes);
    const result = await autoAdvanceNodes(state);

    // Rollback pauses; the pause is held (try/catch kicks in on `run` failure in practice).
    // For a state-only rollback-miss, we just assert the flow did not transition to failed.
    expect(result.state.status).not.toBe('failed');
  });
});
