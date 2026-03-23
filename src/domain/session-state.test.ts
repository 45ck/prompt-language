import { describe, it, expect } from 'vitest';
import {
  createSessionState,
  advanceNode,
  updateVariable,
  updateNodeProgress,
  updateGateResult,
  updateSpawnedChild,
  markCompleted,
  markFailed,
  markCancelled,
  isFlowComplete,
  allGatesPassing,
} from './session-state.js';
import type { SessionState, NodeProgress, SpawnedChild } from './session-state.js';
import { createFlowSpec, createCompletionGate } from './flow-spec.js';

function makeState(overrides?: Partial<{ gates: boolean }>): SessionState {
  const gates = overrides?.gates
    ? [createCompletionGate('tests_pass'), createCompletionGate('lint_pass')]
    : [];
  const spec = createFlowSpec('test goal', [], gates);
  return createSessionState('s1', spec);
}

describe('createSessionState', () => {
  it('initialises with correct defaults', () => {
    const spec = createFlowSpec('goal', [], [], ['warn1']);
    const state = createSessionState('s1', spec);
    expect(state.sessionId).toBe('s1');
    expect(state.flowSpec).toBe(spec);
    expect(state.currentNodePath).toEqual([0]);
    expect(state.nodeProgress).toEqual({});
    expect(state.variables).toEqual({});
    expect(state.gateResults).toEqual({});
    expect(state.status).toBe('active');
    expect(state.warnings).toEqual(['warn1']);
  });

  // H#56: Version field
  it('includes version field set to 1', () => {
    const spec = createFlowSpec('goal', []);
    const state = createSessionState('s1', spec);
    expect(state.version).toBe(1);
  });
});

describe('advanceNode', () => {
  it('updates currentNodePath immutably', () => {
    const state = makeState();
    const next = advanceNode(state, [1, 0]);
    expect(next.currentNodePath).toEqual([1, 0]);
    expect(state.currentNodePath).toEqual([0]);
  });
});

describe('updateVariable', () => {
  it('sets a new variable', () => {
    const state = makeState();
    const next = updateVariable(state, 'count', 3);
    expect(next.variables).toEqual({ count: 3 });
  });

  it('overwrites an existing variable', () => {
    let state = makeState();
    state = updateVariable(state, 'x', 'a');
    state = updateVariable(state, 'x', 'b');
    expect(state.variables).toEqual({ x: 'b' });
  });

  it('preserves other variables', () => {
    let state = makeState();
    state = updateVariable(state, 'a', 1);
    state = updateVariable(state, 'b', 2);
    expect(state.variables).toEqual({ a: 1, b: 2 });
  });
});

describe('updateNodeProgress', () => {
  it('sets progress for a node', () => {
    const state = makeState();
    const progress: NodeProgress = {
      iteration: 2,
      maxIterations: 5,
      status: 'running',
    };
    const next = updateNodeProgress(state, 'w1', progress);
    expect(next.nodeProgress['w1']).toEqual(progress);
  });

  it('does not mutate original state', () => {
    const state = makeState();
    const progress: NodeProgress = {
      iteration: 1,
      maxIterations: 3,
      status: 'pending',
    };
    updateNodeProgress(state, 'n1', progress);
    expect(state.nodeProgress).toEqual({});
  });
});

describe('updateGateResult', () => {
  it('sets a gate result', () => {
    const state = makeState({ gates: true });
    const next = updateGateResult(state, 'tests_pass', true);
    expect(next.gateResults['tests_pass']).toBe(true);
  });

  it('can set gate to false', () => {
    let state = makeState({ gates: true });
    state = updateGateResult(state, 'tests_pass', true);
    state = updateGateResult(state, 'tests_pass', false);
    expect(state.gateResults['tests_pass']).toBe(false);
  });
});

describe('markCompleted', () => {
  it('sets status to completed', () => {
    const next = markCompleted(makeState());
    expect(next.status).toBe('completed');
  });
});

describe('isFlowComplete', () => {
  it('returns false for active', () => {
    expect(isFlowComplete(makeState())).toBe(false);
  });

  it('returns true for completed', () => {
    expect(isFlowComplete(markCompleted(makeState()))).toBe(true);
  });

  it('returns true for failed', () => {
    expect(isFlowComplete(markFailed(makeState()))).toBe(true);
  });

  it('returns true for cancelled', () => {
    expect(isFlowComplete(markCancelled(makeState()))).toBe(true);
  });
});

describe('markFailed', () => {
  it('sets status to failed', () => {
    const state = makeState();
    const failed = markFailed(state);
    expect(failed.status).toBe('failed');
    expect(state.status).toBe('active');
  });
});

describe('markCancelled', () => {
  it('sets status to cancelled', () => {
    const state = makeState();
    const cancelled = markCancelled(state);
    expect(cancelled.status).toBe('cancelled');
    expect(state.status).toBe('active');
  });
});

describe('allGatesPassing', () => {
  it('returns true when no gates exist', () => {
    expect(allGatesPassing(makeState())).toBe(true);
  });

  it('returns false when gates exist but no results', () => {
    expect(allGatesPassing(makeState({ gates: true }))).toBe(false);
  });

  it('returns false when only some gates pass', () => {
    let state = makeState({ gates: true });
    state = updateGateResult(state, 'tests_pass', true);
    expect(allGatesPassing(state)).toBe(false);
  });

  it('returns true when all gates pass', () => {
    let state = makeState({ gates: true });
    state = updateGateResult(state, 'tests_pass', true);
    state = updateGateResult(state, 'lint_pass', true);
    expect(allGatesPassing(state)).toBe(true);
  });

  it('returns false when any gate is false', () => {
    let state = makeState({ gates: true });
    state = updateGateResult(state, 'tests_pass', true);
    state = updateGateResult(state, 'lint_pass', false);
    expect(allGatesPassing(state)).toBe(false);
  });
});

describe('spawnedChildren', () => {
  it('initialises with empty spawnedChildren', () => {
    const state = makeState();
    expect(state.spawnedChildren).toEqual({});
  });

  it('adds a spawned child immutably', () => {
    const state = makeState();
    const child: SpawnedChild = {
      name: 'fix-auth',
      status: 'running',
      pid: 1234,
      stateDir: '.prompt-language-fix-auth',
    };
    const next = updateSpawnedChild(state, 'fix-auth', child);
    expect(next.spawnedChildren['fix-auth']).toEqual(child);
    expect(state.spawnedChildren).toEqual({});
  });

  it('updates an existing spawned child', () => {
    let state = makeState();
    const running: SpawnedChild = {
      name: 'task-a',
      status: 'running',
      pid: 100,
      stateDir: '.prompt-language-task-a',
    };
    state = updateSpawnedChild(state, 'task-a', running);

    const completed: SpawnedChild = {
      ...running,
      status: 'completed',
      variables: { last_exit_code: '0' },
    };
    state = updateSpawnedChild(state, 'task-a', completed);
    expect(state.spawnedChildren['task-a']?.status).toBe('completed');
    expect(state.spawnedChildren['task-a']?.variables).toEqual({ last_exit_code: '0' });
  });

  it('preserves other children when updating one', () => {
    let state = makeState();
    const childA: SpawnedChild = {
      name: 'a',
      status: 'running',
      stateDir: '.prompt-language-a',
    };
    const childB: SpawnedChild = {
      name: 'b',
      status: 'running',
      stateDir: '.prompt-language-b',
    };
    state = updateSpawnedChild(state, 'a', childA);
    state = updateSpawnedChild(state, 'b', childB);
    state = updateSpawnedChild(state, 'a', { ...childA, status: 'completed' });
    expect(state.spawnedChildren['a']?.status).toBe('completed');
    expect(state.spawnedChildren['b']?.status).toBe('running');
  });
});
