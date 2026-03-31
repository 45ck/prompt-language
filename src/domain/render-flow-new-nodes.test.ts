/**
 * Supplementary render tests for new node kinds added after initial coverage pass.
 * Covers: approve, review, race, foreach_spawn, remember, send, receive —
 * both in renderFlow (full) and renderFlowCompact (compact sidebar) views.
 */

import { describe, it, expect } from 'vitest';
import { renderFlow, renderFlowCompact } from './render-flow.js';
import { createSessionState, updateNodeProgress } from './session-state.js';
import { createFlowSpec } from './flow-spec.js';
import {
  createApproveNode,
  createReviewNode,
  createRaceNode,
  createForeachSpawnNode,
  createRememberNode,
  createSendNode,
  createReceiveNode,
  createSpawnNode,
  createPromptNode,
  createWhileNode,
  createRetryNode,
  createIfNode,
  createTryNode,
  createRunNode,
} from './flow-node.js';

// ── renderFlow — approve node ─────────────────────────────────────────

describe('renderFlow — approve node', () => {
  it('renders approve with pending status when no response yet', () => {
    const spec = createFlowSpec('test', [createApproveNode('a1', 'Deploy to prod?')]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('approve "Deploy to prod?"');
    expect(output).toContain('[pending]');
  });

  it('renders approve with approved status when approve_rejected = false', () => {
    const spec = createFlowSpec('test', [createApproveNode('a1', 'Deploy?')]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { approve_rejected: 'false' } };
    const output = renderFlow(state);
    expect(output).toContain('[approved]');
  });

  it('renders approve with rejected status when approve_rejected = true', () => {
    const spec = createFlowSpec('test', [createApproveNode('a1', 'Deploy?')]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { approve_rejected: 'true' } };
    const output = renderFlow(state);
    expect(output).toContain('[rejected]');
  });

  it('renders approve with timeout annotation', () => {
    const spec = createFlowSpec('test', [createApproveNode('a1', 'Ready?', 120)]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    // 120 seconds → 2 minutes
    expect(output).toContain('timeout 2m');
  });
});

// ── renderFlow — review node ──────────────────────────────────────────

describe('renderFlow — review node', () => {
  it('renders review block with body', () => {
    const spec = createFlowSpec('test', [
      createReviewNode('rv1', [createPromptNode('p1', 'Write it')], 3),
    ]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('review max 3');
    expect(output).toContain('Write it');
  });

  it('renders review round progress when in progress', () => {
    const spec = createFlowSpec('test', [
      createReviewNode('rv1', [createPromptNode('p1', 'Draft')], 3),
    ]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'rv1', {
      iteration: 2,
      maxIterations: 3,
      status: 'running',
    });
    const output = renderFlow(state);
    expect(output).toContain('[round 2/3]');
  });
});

// ── renderFlow — race node ────────────────────────────────────────────

describe('renderFlow — race node', () => {
  it('renders race block with children', () => {
    const spawnA = createSpawnNode('s1', 'alpha', [createPromptNode('pa', 'work')]);
    const raceNode = createRaceNode('r1', [spawnA]);
    const spec = createFlowSpec('test', [raceNode]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('race');
    expect(output).toContain('alpha');
  });

  it('renders race winner tag when race_winner is set', () => {
    const spawnA = createSpawnNode('s1', 'alpha', [createPromptNode('pa', 'work')]);
    const raceNode = createRaceNode('r1', [spawnA]);
    const spec = createFlowSpec('test', [raceNode]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { race_winner: 'alpha' } };
    const output = renderFlow(state);
    expect(output).toContain('[winner: alpha]');
  });

  it('does not render winner tag when race_winner is empty string', () => {
    const spawnA = createSpawnNode('s1', 'alpha', [createPromptNode('pa', 'work')]);
    const raceNode = createRaceNode('r1', [spawnA]);
    const spec = createFlowSpec('test', [raceNode]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { race_winner: '' } };
    const output = renderFlow(state);
    expect(output).not.toContain('[winner:');
  });
});

// ── renderFlow — foreach_spawn node ──────────────────────────────────

describe('renderFlow — foreach_spawn node', () => {
  it('renders foreach-spawn with variable and list expression', () => {
    const feSpawn = createForeachSpawnNode('fs1', 'item', 'a b c', [
      createPromptNode('p1', 'work'),
    ]);
    const spec = createFlowSpec('test', [feSpawn]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('foreach-spawn item in "a b c"');
  });

  it('renders foreach-spawn with iteration progress when in progress', () => {
    const feSpawn = createForeachSpawnNode('fs1', 'item', 'a b c', []);
    const spec = createFlowSpec('test', [feSpawn]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'fs1', {
      iteration: 1,
      maxIterations: 3,
      status: 'running',
    });
    const output = renderFlow(state);
    expect(output).toContain('[1/3]');
  });
});

// ── renderFlow — remember node ────────────────────────────────────────

describe('renderFlow — remember node', () => {
  it('renders remember with text form', () => {
    const spec = createFlowSpec('test', [createRememberNode('rm1', 'The sky is blue')]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('remember "The sky is blue"');
  });

  it('renders remember with key-value form', () => {
    const spec = createFlowSpec('test', [createRememberNode('rm1', undefined, 'user', 'Alice')]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('key="user"');
    expect(output).toContain('value="Alice"');
  });
});

// ── renderFlow — send node ────────────────────────────────────────────

describe('renderFlow — send node', () => {
  it('renders send with target and message', () => {
    const spec = createFlowSpec('test', [createSendNode('sn1', 'parent', 'Hello parent')]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('send "parent"');
    expect(output).toContain('"Hello parent"');
  });
});

// ── renderFlow — receive node ─────────────────────────────────────────

describe('renderFlow — receive node', () => {
  it('renders receive with variable name', () => {
    const spec = createFlowSpec('test', [createReceiveNode('rc1', 'inbox_msg')]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('receive inbox_msg');
  });

  it('renders receive with from source', () => {
    const spec = createFlowSpec('test', [createReceiveNode('rc1', 'inbox_msg', 'worker')]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('from "worker"');
  });

  it('renders receive with waiting status when running', () => {
    const spec = createFlowSpec('test', [createReceiveNode('rc1', 'inbox_msg')]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'rc1', {
      iteration: 1,
      maxIterations: 1,
      status: 'running',
    });
    const output = renderFlow(state);
    expect(output).toContain('[waiting]');
  });

  it('renders receive with received status when completed', () => {
    const spec = createFlowSpec('test', [createReceiveNode('rc1', 'inbox_msg')]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'rc1', {
      iteration: 1,
      maxIterations: 1,
      status: 'completed',
    });
    const output = renderFlow(state);
    expect(output).toContain('[received]');
  });
});

// ── renderFlowCompact — new node kinds ───────────────────────────────

describe('renderFlowCompact — new node kinds', () => {
  it('renders approve in compact form', () => {
    const spec = createFlowSpec('test', [createApproveNode('a1', 'Deploy to production?')]);
    const state = createSessionState('s1', spec);
    const output = renderFlowCompact(state);
    expect(output).toContain('approve');
    expect(output).toContain('Deploy to production?');
  });

  it('renders review in compact form with progress', () => {
    const spec = createFlowSpec('test', [
      createReviewNode('rv1', [createPromptNode('p1', 'Draft')], 3),
    ]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'rv1', {
      iteration: 1,
      maxIterations: 3,
      status: 'running',
    });
    const output = renderFlowCompact(state);
    expect(output).toContain('review');
    expect(output).toContain('1/3');
  });

  it('renders race in compact form', () => {
    const spawnA = createSpawnNode('s1', 'alpha', [createPromptNode('pa', 'work')]);
    const raceNode = createRaceNode('r1', [spawnA]);
    const spec = createFlowSpec('test', [raceNode]);
    const state = createSessionState('s1', spec);
    const output = renderFlowCompact(state);
    expect(output).toContain('race');
  });

  it('renders race winner in compact form when winner is set', () => {
    const spawnA = createSpawnNode('s1', 'alpha', [createPromptNode('pa', 'work')]);
    const raceNode = createRaceNode('r1', [spawnA]);
    const spec = createFlowSpec('test', [raceNode]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { race_winner: 'alpha' } };
    const output = renderFlowCompact(state);
    expect(output).toContain('alpha');
  });

  it('renders foreach-spawn in compact form', () => {
    const feSpawn = createForeachSpawnNode('fs1', 'item', 'a b', [createPromptNode('p1', 'w')]);
    const spec = createFlowSpec('test', [feSpawn]);
    const state = createSessionState('s1', spec);
    const output = renderFlowCompact(state);
    expect(output).toContain('foreach-spawn');
    expect(output).toContain('item');
  });

  it('renders remember in compact form', () => {
    const spec = createFlowSpec('test', [createRememberNode('rm1', 'note text')]);
    const state = createSessionState('s1', spec);
    const output = renderFlowCompact(state);
    expect(output).toContain('remember');
  });

  it('renders send in compact form', () => {
    const spec = createFlowSpec('test', [createSendNode('sn1', 'parent', 'msg')]);
    const state = createSessionState('s1', spec);
    const output = renderFlowCompact(state);
    expect(output).toContain('send');
    expect(output).toContain('parent');
  });

  it('renders receive in compact form', () => {
    const spec = createFlowSpec('test', [createReceiveNode('rc1', 'msg_var')]);
    const state = createSessionState('s1', spec);
    const output = renderFlowCompact(state);
    expect(output).toContain('receive');
    expect(output).toContain('msg_var');
  });

  it('renders while with progress in compact form', () => {
    const spec = createFlowSpec('test', [
      createWhileNode('w1', 'flag', [createPromptNode('p1', 'work')], 3),
    ]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'w1', { iteration: 1, maxIterations: 3, status: 'running' });
    const output = renderFlowCompact(state);
    expect(output).toContain('while');
    expect(output).toContain('1/3');
  });

  it('renders retry with progress in compact form', () => {
    const spec = createFlowSpec('test', [
      createRetryNode('re1', [createPromptNode('p1', 'do')], 3),
    ]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 're1', { iteration: 1, maxIterations: 3, status: 'running' });
    const output = renderFlowCompact(state);
    expect(output).toContain('retry');
    expect(output).toContain('1/3');
  });

  it('renders if with else branch in compact form', () => {
    const spec = createFlowSpec('test', [
      createIfNode(
        'i1',
        'flag',
        [createPromptNode('p1', 'then')],
        [createPromptNode('p2', 'else')],
      ),
    ]);
    const state = createSessionState('s1', spec);
    const output = renderFlowCompact(state);
    expect(output).toContain('if');
    expect(output).toContain('else');
  });

  it('renders try with catch body in compact form', () => {
    const spec = createFlowSpec('test', [
      createTryNode('t1', [createRunNode('r1', 'cmd')], 'command_failed', [
        createPromptNode('p1', 'handle'),
      ]),
    ]);
    const state = createSessionState('s1', spec);
    const output = renderFlowCompact(state);
    expect(output).toContain('try');
    expect(output).toContain('catch');
  });
});
