import { describe, expect, it } from 'vitest';
import { selectPreCompactMode } from './context-adaptive-mode.js';
import type { StateLoadStatus } from '../../infrastructure/adapters/file-state-store.js';

function makeState() {
  return {
    version: 1,
    sessionId: 'test-session',
    flowSpec: {
      goal: 'Test goal',
      nodes: [{ kind: 'prompt', id: 'p1', text: 'do work' }],
      completionGates: [],
      defaults: { maxIterations: 5, maxAttempts: 3 },
      warnings: [],
    },
    currentNodePath: [0],
    nodeProgress: {},
    variables: {},
    gateResults: {},
    gateDiagnostics: {},
    status: 'active',
    warnings: [],
    spawnedChildren: {},
    raceChildren: {},
    captureNonce: 'test-nonce-00000000',
  } as const;
}

describe('selectPreCompactMode', () => {
  it('always classifies pre-compact as a compaction boundary and escalates to full mode', () => {
    const decision = selectPreCompactMode(makeState(), null);

    expect(decision.requestedMode).toBe('compact');
    expect(decision.actualMode).toBe('full');
    expect(decision.escalated).toBe(true);
    expect(decision.triggerIds).toEqual(['compaction_boundary']);
    expect(decision.summary).toContain('hook pre-compact crossed a compaction boundary');
  });

  it('accumulates backup recovery and capture-failure triggers with matrix-aligned names', () => {
    const state = {
      ...makeState(),
      nodeProgress: {
        l1: { iteration: 2, maxIterations: 3, status: 'awaiting_capture' as const },
      },
    };
    const loadStatus: StateLoadStatus = {
      source: 'backup',
      recoveredFrom: 'session-state.bak.json',
    };

    const decision = selectPreCompactMode(state, loadStatus);

    expect(decision.actualMode).toBe('full');
    expect(decision.triggerIds).toEqual([
      'compaction_boundary',
      'resume_boundary',
      'state_mismatch',
      'capture_failure',
    ]);
    expect(decision.summary).toContain('state recovered from session-state.bak.json');
    expect(decision.summary).toContain('capture recovery is active');
  });
});
