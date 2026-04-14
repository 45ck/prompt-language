import { describe, it, expect } from 'vitest';
import {
  addSnapshot,
  applySnapshot,
  createSessionState,
  updateNodeProgress,
  updateSpawnedChild,
  updateVariable,
  type StateSnapshot,
} from './session-state.js';
import { createFlowSpec } from './flow-spec.js';
import { createPromptNode } from './flow-node.js';

function baseState() {
  const spec = createFlowSpec('g', [createPromptNode('p1', 'hi')]);
  return createSessionState('s', spec);
}

function makeSnapshot(overrides: Partial<StateSnapshot> = {}): StateSnapshot {
  return {
    name: 'cp',
    createdAt: new Date(0).toISOString(),
    stateHash: 'abc',
    variables: { x: 'before' },
    currentPath: [0],
    iterations: {},
    ...overrides,
  };
}

describe('addSnapshot / applySnapshot', () => {
  it('addSnapshot stores under the given name', () => {
    const s = addSnapshot(baseState(), makeSnapshot());
    expect(s.snapshots['cp']?.variables['x']).toBe('before');
  });

  it('addSnapshot overwrites and emits a warning on duplicate name', () => {
    let s = addSnapshot(baseState(), makeSnapshot({ variables: { x: 'v1' } }));
    s = addSnapshot(s, makeSnapshot({ variables: { x: 'v2' } }));
    expect(s.snapshots['cp']?.variables['x']).toBe('v2');
    expect(s.warnings.some((w) => w.includes('overwritten'))).toBe(true);
  });

  it('applySnapshot restores variables and currentNodePath', () => {
    let s = addSnapshot(baseState(), makeSnapshot({ currentPath: [0] }));
    s = updateVariable(s, 'x', 'after');
    s = { ...s, currentNodePath: [5] };
    const restored = applySnapshot(s, 'cp')!;
    expect(restored.variables['x']).toBe('before');
    expect(restored.currentNodePath).toEqual([0]);
  });

  it('applySnapshot preserves spawnedChildren and warnings', () => {
    let s = addSnapshot(baseState(), makeSnapshot());
    s = updateSpawnedChild(s, 'c1', {
      name: 'c1',
      status: 'running',
      stateDir: '/tmp/c1',
    });
    const restored = applySnapshot(s, 'cp')!;
    expect(restored.spawnedChildren['c1']?.status).toBe('running');
  });

  it('applySnapshot returns null for an unknown name', () => {
    expect(applySnapshot(baseState(), 'missing')).toBeNull();
  });

  it('applySnapshot restores iteration counters but preserves status/startedAt', () => {
    let s = baseState();
    s = updateNodeProgress(s, 'loop', {
      iteration: 1,
      maxIterations: 3,
      status: 'running',
      startedAt: 1000,
    });
    s = addSnapshot(s, makeSnapshot({ iterations: { loop: 1 } }));
    s = updateNodeProgress(s, 'loop', {
      iteration: 3,
      maxIterations: 3,
      status: 'running',
      startedAt: 1000,
    });
    const restored = applySnapshot(s, 'cp')!;
    expect(restored.nodeProgress['loop']?.iteration).toBe(1);
    expect(restored.nodeProgress['loop']?.status).toBe('running');
    expect(restored.nodeProgress['loop']?.startedAt).toBe(1000);
  });
});
