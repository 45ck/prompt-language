import { describe, it, expect } from 'vitest';
import {
  createSessionState,
  advanceNode,
  updateVariable,
  updateNodeProgress,
  updateGateResult,
  updateGateDiagnostic,
  updateSpawnedChild,
  addWarning,
  markCompleted,
  markFailed,
  markCancelled,
  isFlowComplete,
  allGatesPassing,
  generateCaptureNonce,
} from './session-state.js';
import type { SessionState, NodeProgress, SpawnedChild, GateEvalResult } from './session-state.js';
import { createFlowSpec, createCompletionGate } from './flow-spec.js';
import { createLetNode } from './flow-node.js';

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

  // H-SEC-004: Capture nonce (128-bit = 32 hex chars)
  it('generates a captureNonce as 32-char hex string', () => {
    const spec = createFlowSpec('goal', []);
    const state = createSessionState('s1', spec);
    expect(state.captureNonce).toMatch(/^[0-9a-f]{32}$/);
  });

  it('generates unique nonces across sessions', () => {
    const spec = createFlowSpec('goal', []);
    const nonces = new Set(
      Array.from({ length: 10 }, () => createSessionState('s', spec).captureNonce),
    );
    expect(nonces.size).toBeGreaterThan(1);
  });

  it('accepts explicit captureNonce parameter', () => {
    const spec = createFlowSpec('goal', []);
    const state = createSessionState('s1', spec, 'custom-nonce-value');
    expect(state.captureNonce).toBe('custom-nonce-value');
  });
});

describe('generateCaptureNonce', () => {
  it('returns a 32-char hex string (128-bit)', () => {
    const nonce = generateCaptureNonce();
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
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

  it('adds a soft warning when reassigning a const variable', () => {
    const spec = createFlowSpec('goal', [
      createLetNode('l1', 'answer', { type: 'literal', value: '1' }, false, undefined, 'const'),
    ]);
    let state = createSessionState('s1', spec);
    state = updateVariable(state, 'answer', '1');
    state = updateVariable(state, 'answer', '2');

    expect(state.variables['answer']).toBe('2');
    expect(state.warnings).toContain(
      "Const variable 'answer' was reassigned; keeping latest value for backward compatibility.",
    );
  });

  it('does not warn when reassigning a non-const variable', () => {
    const spec = createFlowSpec('goal', [
      createLetNode('l1', 'answer', { type: 'literal', value: '1' }),
    ]);
    let state = createSessionState('s1', spec);
    state = updateVariable(state, 'answer', '1');
    state = updateVariable(state, 'answer', '2');

    expect(state.warnings).not.toContain(
      "Const variable 'answer' was reassigned; keeping latest value for backward compatibility.",
    );
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

  it('preserves cached run-result fields on node progress', () => {
    const state = makeState();
    const progress: NodeProgress = {
      iteration: 1,
      maxIterations: 1,
      status: 'completed',
      exitCode: 0,
      stdout: 'stdout',
      stderr: 'stderr',
      timedOut: false,
    };

    const next = updateNodeProgress(state, 'r1', progress);

    expect(next.nodeProgress['r1']).toEqual(progress);
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

  it('stores failureReason when provided', () => {
    const state = makeState();
    const failed = markFailed(state, 'TypeError: Cannot read properties of null');
    expect(failed.status).toBe('failed');
    expect(failed.failureReason).toBe('TypeError: Cannot read properties of null');
  });

  it('does not set failureReason when not provided', () => {
    const state = makeState();
    const failed = markFailed(state);
    expect(failed.failureReason).toBeUndefined();
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

describe('addWarning', () => {
  it('adds a new warning to the state', () => {
    const state = makeState();
    const next = addWarning(state, 'something is off');
    expect(next.warnings).toContain('something is off');
  });

  it('returns the same state object when warning is a duplicate', () => {
    let state = makeState();
    state = addWarning(state, 'duplicate warning');
    const again = addWarning(state, 'duplicate warning');
    expect(again).toBe(state); // identity check — same reference
  });

  it('does not mutate the original state', () => {
    const state = makeState();
    const originalWarnings = [...state.warnings];
    addWarning(state, 'new warning');
    expect(state.warnings).toEqual(originalWarnings);
  });

  it('preserves existing warnings when adding a new one', () => {
    const spec = createFlowSpec('goal', [], [], ['existing']);
    const state = createSessionState('s1', spec);
    const next = addWarning(state, 'another');
    expect(next.warnings).toEqual(['existing', 'another']);
  });
});

describe('updateGateDiagnostic', () => {
  it('stores a diagnostic for a gate predicate', () => {
    const state = makeState({ gates: true });
    const diag: GateEvalResult = {
      passed: true,
      command: 'npm test',
      exitCode: 0,
      stdout: 'OK',
    };
    const next = updateGateDiagnostic(state, 'tests_pass', diag);
    expect(next.gateDiagnostics['tests_pass']).toEqual(diag);
  });

  it('does not mutate the original state', () => {
    const state = makeState({ gates: true });
    const diag: GateEvalResult = { passed: false, command: 'npm test', exitCode: 1 };
    updateGateDiagnostic(state, 'tests_pass', diag);
    expect(state.gateDiagnostics).toEqual({});
  });

  it('overwrites an existing diagnostic for the same predicate', () => {
    let state = makeState({ gates: true });
    state = updateGateDiagnostic(state, 'tests_pass', {
      passed: false,
      command: 'npm test',
      exitCode: 1,
    });
    state = updateGateDiagnostic(state, 'tests_pass', {
      passed: true,
      command: 'npm test',
      exitCode: 0,
    });
    expect(state.gateDiagnostics['tests_pass']?.passed).toBe(true);
    expect(state.gateDiagnostics['tests_pass']?.exitCode).toBe(0);
  });
});
