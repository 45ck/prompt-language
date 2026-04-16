/**
 * PR2 integration tests: snapshot file-capture wiring in advance-flow.
 *
 * Uses in-memory doubles for the SnapshotStorePort and EnvReaderPort so
 * the pure-state restoration path (PR1) and the optional file-capture
 * path (PR2) can be exercised without touching the filesystem.
 */
import { describe, it, expect } from 'vitest';
import { autoAdvanceNodes } from './advance-flow.js';
import { createSessionState } from '../domain/session-state.js';
import { createFlowSpec } from '../domain/flow-spec.js';
import {
  createLetNode,
  createSnapshotNode,
  createRollbackNode,
  createPromptNode,
} from '../domain/flow-node.js';
import type { SnapshotStorePort } from './ports/snapshot-store.js';
import type { EnvReaderPort } from './ports/env-reader.js';
import type { TraceEntry, TraceLogger } from './ports/trace-logger.js';

class FakeEnvReader implements EnvReaderPort {
  constructor(private readonly values: Record<string, string>) {}
  read(name: string): string | undefined {
    return this.values[name];
  }
}

class FakeSnapshotStore implements SnapshotStorePort {
  readonly captures: { ref: string; stateDir: string }[] = [];
  readonly restores: { ref: string; stateDir: string }[] = [];
  private counter = 0;
  constructor(private readonly knownRefs = new Set<string>()) {}
  capture(stateDir: string): Promise<string> {
    const ref = `fake-ref-${++this.counter}`;
    this.captures.push({ ref, stateDir });
    this.knownRefs.add(ref);
    return Promise.resolve(ref);
  }
  restore(ref: string, stateDir: string): Promise<void> {
    this.restores.push({ ref, stateDir });
    if (!this.knownRefs.has(ref)) {
      return Promise.reject(new Error(`snapshot ref ${ref} not found; cannot restore files`));
    }
    return Promise.resolve();
  }
}

class FailingSnapshotStore implements SnapshotStorePort {
  capture(): Promise<string> {
    return Promise.reject(new Error('disk full'));
  }
  restore(ref: string): Promise<void> {
    return Promise.reject(new Error(`simulated restore error for ${ref}`));
  }
}

function buildSession(nodes: Parameters<typeof createFlowSpec>[1]) {
  const spec = createFlowSpec('pr2', nodes);
  return createSessionState('s-pr2', spec);
}

describe('snapshot/rollback (PR2 — file capture wiring)', () => {
  it('records filesDigestRef when PL_SNAPSHOT_INCLUDE_FILES=1', async () => {
    const nodes = [
      createLetNode('l1', 'x', { type: 'literal', value: 'hello' }),
      createSnapshotNode('s1', 'cp'),
      createPromptNode('p1', 'ok'),
    ];
    const state = buildSession(nodes);
    const store = new FakeSnapshotStore();
    const env = new FakeEnvReader({ PL_SNAPSHOT_INCLUDE_FILES: '1' });
    const result = await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      store,
      env,
      '/fake/state',
    );
    expect(result.state.snapshots['cp']?.filesDigestRef).toBe('fake-ref-1');
    expect(store.captures).toEqual([{ ref: 'fake-ref-1', stateDir: '/fake/state' }]);
  });

  it('omits filesDigestRef when PL_SNAPSHOT_INCLUDE_FILES is unset', async () => {
    const nodes = [createSnapshotNode('s1', 'cp'), createPromptNode('p1', 'ok')];
    const state = buildSession(nodes);
    const store = new FakeSnapshotStore();
    const env = new FakeEnvReader({});
    const result = await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      store,
      env,
      '/fake/state',
    );
    expect(result.state.snapshots['cp']?.filesDigestRef).toBeUndefined();
    expect(store.captures).toEqual([]);
  });

  it('rollback restores files when snapshot has a filesDigestRef', async () => {
    const nodes = [
      createSnapshotNode('s1', 'cp'),
      createLetNode('l1', 'y', { type: 'literal', value: 'drift' }),
      createRollbackNode('r1', 'cp'),
      createPromptNode('p1', 'ok'),
    ];
    const state = buildSession(nodes);
    const store = new FakeSnapshotStore();
    const env = new FakeEnvReader({ PL_SNAPSHOT_INCLUDE_FILES: '1' });
    const result = await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      store,
      env,
      '/fake/state',
    );
    expect(store.restores).toHaveLength(1);
    expect(store.restores[0]?.ref).toBe('fake-ref-1');
    expect(store.restores[0]?.stateDir).toBe('/fake/state');
    expect(result.state.variables['y']).toBeUndefined();
  });

  it('rollback without filesDigestRef falls back to PR1 pure-state behavior', async () => {
    const nodes = [
      createSnapshotNode('s1', 'cp'),
      createLetNode('l1', 'y', { type: 'literal', value: 'drift' }),
      createRollbackNode('r1', 'cp'),
      createPromptNode('p1', 'ok'),
    ];
    const state = buildSession(nodes);
    const store = new FakeSnapshotStore();
    const result = await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      store,
      new FakeEnvReader({}),
      '/fake/state',
    );
    expect(store.restores).toEqual([]);
    expect(result.state.variables['y']).toBeUndefined();
  });

  it('marks the flow failed with reason prefix when files restore fails', async () => {
    const nodes = [
      createSnapshotNode('s1', 'cp'),
      createRollbackNode('r1', 'cp'),
      createPromptNode('p1', 'ok'),
    ];
    const state = buildSession(nodes);
    const captureStore = new FakeSnapshotStore();
    const env = new FakeEnvReader({ PL_SNAPSHOT_INCLUDE_FILES: '1' });
    const firstLeg = await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      captureStore,
      env,
      '/fake/state',
    );
    expect(firstLeg.state.snapshots['cp']?.filesDigestRef).toBe('fake-ref-1');

    const withDigest = {
      ...firstLeg.state,
      currentNodePath: [1],
      status: 'active' as const,
    };
    const second = await autoAdvanceNodes(
      withDigest,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new FailingSnapshotStore(),
      env,
      '/fake/state',
    );
    expect(second.state.status).toBe('failed');
    expect(second.state.failureReason).toMatch(/^rollback files failed:/);
  });

  it('records a warning and still lands the snapshot when capture fails', async () => {
    const nodes = [createSnapshotNode('s1', 'cp'), createPromptNode('p1', 'ok')];
    const state = buildSession(nodes);
    const result = await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      new FailingSnapshotStore(),
      new FakeEnvReader({ PL_SNAPSHOT_INCLUDE_FILES: '1' }),
      '/fake/state',
    );
    expect(result.state.snapshots['cp']).toBeDefined();
    expect(result.state.snapshots['cp']?.filesDigestRef).toBeUndefined();
    expect(result.state.warnings.some((w) => w.includes('snapshot files capture failed'))).toBe(
      true,
    );
  });

  it('emits trace detail with filesCaptured and filesDigestRef when capture runs', async () => {
    const nodes = [createSnapshotNode('s1', 'cp'), createPromptNode('p1', 'ok')];
    const state = buildSession(nodes);
    const traceEntries: TraceEntry[] = [];
    const traceLogger: TraceLogger = {
      log: (e: TraceEntry) => {
        traceEntries.push(e);
      },
    };
    const store = new FakeSnapshotStore();
    const env = new FakeEnvReader({ PL_SNAPSHOT_INCLUDE_FILES: '1' });
    await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      traceLogger,
      store,
      env,
      '/fake/state',
    );
    const snapEntry = traceEntries.find(
      (e) => (e as { nodeKind?: string }).nodeKind === 'snapshot',
    ) as { detail?: Record<string, unknown> } | undefined;
    expect(snapEntry?.detail?.['filesCaptured']).toBe(true);
    expect(snapEntry?.detail?.['filesDigestRef']).toBe('fake-ref-1');
  });
});
