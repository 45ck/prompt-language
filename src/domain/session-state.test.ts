import { describe, it, expect } from 'vitest';
import {
  createSessionState,
  advanceNode,
  updateVariable,
  updateNodeProgress,
  updateGateResult,
  markCompleted,
  isFlowComplete,
  allGatesPassing,
} from './session-state.js';
import type { SessionState, NodeProgress } from './session-state.js';
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
    expect(isFlowComplete({ ...makeState(), status: 'failed' })).toBe(true);
  });

  it('returns true for cancelled', () => {
    expect(isFlowComplete({ ...makeState(), status: 'cancelled' })).toBe(true);
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
