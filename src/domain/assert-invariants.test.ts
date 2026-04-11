import { describe, expect, it } from 'vitest';
import { assertStateInvariants } from './assert-invariants.js';
import { createSessionState, updateNodeProgress, updateVariable } from './session-state.js';
import { createFlowSpec } from './flow-spec.js';
import { createPromptNode } from './flow-node.js';

function makeState() {
  return createSessionState(
    's1',
    createFlowSpec('goal', [createPromptNode('p1', 'work')]),
    'nonce123',
  );
}

describe('assertStateInvariants', () => {
  it('accepts a valid session state', () => {
    expect(() => assertStateInvariants(makeState())).not.toThrow();
  });

  it('rejects an invalid node path', () => {
    const state = { ...makeState(), currentNodePath: [2] as const };
    expect(() => assertStateInvariants(state)).toThrow(/currentNodePath is invalid/);
  });

  it('rejects node progress whose iteration exceeds maxIterations', () => {
    const state = updateNodeProgress(makeState(), 'p1', {
      iteration: 3,
      maxIterations: 2,
      status: 'running',
    });
    expect(() => assertStateInvariants(state)).toThrow(/iteration 3 exceeds maxIterations 2/);
  });

  it('rejects active states with an empty path', () => {
    const state = { ...makeState(), currentNodePath: [] as const };
    expect(() => assertStateInvariants(state)).toThrow(/currentNodePath length >= 1/);
  });

  it('rejects inconsistent exit variables', () => {
    let state = updateVariable(makeState(), 'command_failed', true);
    state = updateVariable(state, 'command_succeeded', true);
    expect(() => assertStateInvariants(state)).toThrow(/command_failed and command_succeeded/);
  });

  it('rejects missing or negative transitionSeq values', () => {
    expect(() => assertStateInvariants({ ...makeState(), transitionSeq: undefined })).toThrow(
      /transitionSeq must be present and non-negative/,
    );
    expect(() => assertStateInvariants({ ...makeState(), transitionSeq: -1 })).toThrow(
      /transitionSeq must be present and non-negative/,
    );
  });

  it('rejects variable names that contain the capture nonce', () => {
    const state = updateVariable(makeState(), 'bad_nonce123_key', 'value');
    expect(() => assertStateInvariants(state)).toThrow(/must not contain the capture nonce/);
  });
});
