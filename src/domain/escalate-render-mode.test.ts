import { describe, expect, it } from 'vitest';
import { createFlowSpec } from './flow-spec.js';
import {
  createPromptNode,
  createRetryNode,
  createRunNode,
  createSpawnNode,
  createTryNode,
} from './flow-node.js';
import { createSessionState } from './session-state.js';
import { shouldEscalateToFullMode } from './escalate-render-mode.js';
import type { SessionState } from './session-state.js';

function makeActiveState(overrides: Partial<SessionState> = {}): SessionState {
  const spec = createFlowSpec('test', [createPromptNode('p1', 'Hello')]);
  return { ...createSessionState('session-1', spec), ...overrides };
}

describe('shouldEscalateToFullMode', () => {
  it('returns no escalation for a simple active flow', () => {
    const state = makeActiveState();
    const result = shouldEscalateToFullMode(state);
    expect(result.escalate).toBe(false);
    expect(result.triggerIds).toEqual([]);
    expect(result.reason).toBe('no escalation triggers detected');
  });

  it('returns no escalation for non-active flows', () => {
    const state = makeActiveState({ status: 'completed' });
    const result = shouldEscalateToFullMode(state);
    expect(result.escalate).toBe(false);
    expect(result.reason).toBe('flow is not active');
  });

  describe('resume_boundary trigger', () => {
    it('escalates when currentSessionId differs from state sessionId', () => {
      const state = makeActiveState({ sessionId: 'old-session' });
      const result = shouldEscalateToFullMode(state, 'new-session');
      expect(result.escalate).toBe(true);
      expect(result.triggerIds).toContain('resume_boundary');
      expect(result.reason).toContain('flow resumed after session change');
    });

    it('does not escalate when sessionIds match', () => {
      const state = makeActiveState({ sessionId: 'same-session' });
      const result = shouldEscalateToFullMode(state, 'same-session');
      expect(result.triggerIds).not.toContain('resume_boundary');
    });

    it('does not escalate when no currentSessionId is provided', () => {
      const state = makeActiveState({ sessionId: 'some-session' });
      const result = shouldEscalateToFullMode(state);
      expect(result.triggerIds).not.toContain('resume_boundary');
    });
  });

  describe('host_compaction_boundary trigger (active try/catch)', () => {
    it('escalates when current path is inside a try block', () => {
      const tryNode = createTryNode(
        'try1',
        [createPromptNode('p1', 'inside try')],
        'command_failed',
        [createRunNode('r1', 'echo recover')],
      );
      const spec = createFlowSpec('test', [tryNode]);
      const state = { ...createSessionState('s1', spec), currentNodePath: [0, 0] };
      const result = shouldEscalateToFullMode(state);
      expect(result.escalate).toBe(true);
      expect(result.triggerIds).toContain('host_compaction_boundary');
      expect(result.reason).toContain('try/catch');
    });

    it('does not escalate when not inside try', () => {
      const state = makeActiveState();
      const result = shouldEscalateToFullMode(state);
      expect(result.triggerIds).not.toContain('host_compaction_boundary');
    });
  });

  describe('spawn_recovery trigger', () => {
    it('escalates when there are running spawned children', () => {
      const state = makeActiveState({
        spawnedChildren: {
          worker: {
            name: 'worker',
            status: 'running',
            pid: 123,
            stateDir: '.prompt-language-worker',
          },
        },
      });
      const result = shouldEscalateToFullMode(state);
      expect(result.escalate).toBe(true);
      expect(result.triggerIds).toContain('spawn_recovery');
      expect(result.reason).toContain('spawn/await');
    });

    it('does not escalate when all children are completed', () => {
      const state = makeActiveState({
        spawnedChildren: {
          worker: {
            name: 'worker',
            status: 'completed',
            pid: 123,
            stateDir: '.prompt-language-worker',
          },
        },
      });
      const result = shouldEscalateToFullMode(state);
      expect(result.triggerIds).not.toContain('spawn_recovery');
    });

    it('escalates when current path is inside a spawn node', () => {
      const spawnNode = createSpawnNode('sp1', 'worker', [createPromptNode('p1', 'child work')]);
      const spec = createFlowSpec('test', [spawnNode]);
      const state = { ...createSessionState('s1', spec), currentNodePath: [0, 0] };
      const result = shouldEscalateToFullMode(state);
      expect(result.triggerIds).toContain('spawn_recovery');
    });
  });

  describe('retry_failure trigger', () => {
    it('escalates when inside retry and command_failed is true', () => {
      const retryNode = createRetryNode('r1', [createRunNode('run1', 'make test')], 3);
      const spec = createFlowSpec('test', [retryNode]);
      const state: SessionState = {
        ...createSessionState('s1', spec),
        currentNodePath: [0, 0],
        variables: { command_failed: 'true' },
      };
      const result = shouldEscalateToFullMode(state);
      expect(result.escalate).toBe(true);
      expect(result.triggerIds).toContain('retry_failure');
      expect(result.reason).toContain('retry loop with previous failure');
    });

    it('escalates when inside retry with iteration > 1', () => {
      const retryNode = createRetryNode('r1', [createRunNode('run1', 'make test')], 3);
      const spec = createFlowSpec('test', [retryNode]);
      const state: SessionState = {
        ...createSessionState('s1', spec),
        currentNodePath: [0, 0],
        nodeProgress: {
          r1: { iteration: 2, maxIterations: 3, status: 'running' },
        },
      };
      const result = shouldEscalateToFullMode(state);
      expect(result.triggerIds).toContain('retry_failure');
    });

    it('does not escalate on first retry attempt', () => {
      const retryNode = createRetryNode('r1', [createRunNode('run1', 'make test')], 3);
      const spec = createFlowSpec('test', [retryNode]);
      const state: SessionState = {
        ...createSessionState('s1', spec),
        currentNodePath: [0, 0],
        nodeProgress: {
          r1: { iteration: 1, maxIterations: 3, status: 'running' },
        },
      };
      const result = shouldEscalateToFullMode(state);
      expect(result.triggerIds).not.toContain('retry_failure');
    });

    it('does not escalate when not inside retry', () => {
      const state = makeActiveState({ variables: { command_failed: 'true' } });
      const result = shouldEscalateToFullMode(state);
      expect(result.triggerIds).not.toContain('retry_failure');
    });
  });

  describe('variable_density trigger', () => {
    it('escalates when variable count exceeds threshold', () => {
      const vars: Record<string, string> = {};
      for (let i = 0; i < 21; i++) {
        vars[`var_${i}`] = `value_${i}`;
      }
      const state = makeActiveState({ variables: vars });
      const result = shouldEscalateToFullMode(state);
      expect(result.escalate).toBe(true);
      expect(result.triggerIds).toContain('variable_density');
      expect(result.reason).toContain('variable count exceeds 20');
    });

    it('does not escalate at exactly the threshold', () => {
      const vars: Record<string, string> = {};
      for (let i = 0; i < 20; i++) {
        vars[`var_${i}`] = `value_${i}`;
      }
      const state = makeActiveState({ variables: vars });
      const result = shouldEscalateToFullMode(state);
      expect(result.triggerIds).not.toContain('variable_density');
    });
  });

  describe('multiple triggers', () => {
    it('reports all triggered conditions', () => {
      const tryNode = createTryNode(
        'try1',
        [createPromptNode('p1', 'inside try')],
        'command_failed',
        [createRunNode('r1', 'echo recover')],
      );
      const spec = createFlowSpec('test', [tryNode]);
      const vars: Record<string, string> = {};
      for (let i = 0; i < 25; i++) {
        vars[`var_${i}`] = `value_${i}`;
      }
      const state: SessionState = {
        ...createSessionState('old-session', spec),
        currentNodePath: [0, 0],
        variables: vars,
        spawnedChildren: {
          worker: {
            name: 'worker',
            status: 'running',
            pid: 42,
            stateDir: '.prompt-language-worker',
          },
        },
      };
      const result = shouldEscalateToFullMode(state, 'new-session');
      expect(result.escalate).toBe(true);
      expect(result.triggerIds).toContain('resume_boundary');
      expect(result.triggerIds).toContain('host_compaction_boundary');
      expect(result.triggerIds).toContain('spawn_recovery');
      expect(result.triggerIds).toContain('variable_density');
      expect(result.triggerIds.length).toBeGreaterThanOrEqual(4);
    });
  });
});
