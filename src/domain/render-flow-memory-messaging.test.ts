/**
 * Render tests for RememberNode, SendNode, ReceiveNode.
 *
 * beads: prompt-language-7g58, prompt-language-n6gr
 */

import { describe, it, expect } from 'vitest';
import {
  createRememberNode,
  createSendNode,
  createReceiveNode,
  createLetNode,
} from './flow-node.js';
import { createFlowSpec } from './flow-spec.js';
import { createSessionState, updateNodeProgress } from './session-state.js';
import { renderFlow } from './render-flow.js';

function makeState(nodes: ReturnType<typeof createFlowSpec>['nodes']) {
  const spec = createFlowSpec('Test flow', nodes);
  return createSessionState('test-session-1', spec);
}

describe('renderFlow — RememberNode', () => {
  it('renders free-form text remember node', () => {
    const node = createRememberNode('r1', 'User prefers TypeScript');
    const state = makeState([node]);
    const output = renderFlow(state);
    expect(output).toContain('remember "User prefers TypeScript"');
  });

  it('renders key-value remember node', () => {
    const node = createRememberNode('r2', undefined, 'lang_pref', 'TypeScript');
    const state = makeState([node]);
    const output = renderFlow(state);
    expect(output).toContain('remember key="lang_pref" value="TypeScript"');
  });

  it('renders remember node as current step with arrow', () => {
    const node = createRememberNode('r3', 'some fact');
    const state = makeState([node]);
    const output = renderFlow(state);
    expect(output).toContain('<-- current');
  });
});

describe('renderFlow — SendNode', () => {
  it('renders send to child', () => {
    const node = createSendNode('s1', 'fix-lint', 'Focus on imports');
    const state = makeState([node]);
    const output = renderFlow(state);
    expect(output).toContain('send "fix-lint" "Focus on imports"');
  });

  it('renders send to parent', () => {
    const node = createSendNode('s2', 'parent', 'Done');
    const state = makeState([node]);
    const output = renderFlow(state);
    expect(output).toContain('send "parent" "Done"');
  });
});

describe('renderFlow — ReceiveNode', () => {
  it('renders bare receive with no from', () => {
    const node = createReceiveNode('rec1', 'msg');
    const state = makeState([node]);
    const output = renderFlow(state);
    expect(output).toContain('receive msg');
    // No [waiting] or [received] tag when no progress recorded
    expect(output).not.toContain('[waiting]');
    expect(output).not.toContain('[received]');
  });

  it('renders receive with from source', () => {
    const node = createReceiveNode('rec2', 'result', 'fix-lint');
    const state = makeState([node]);
    const output = renderFlow(state);
    expect(output).toContain('receive result from "fix-lint"');
  });

  it('shows [waiting] when receive is in running status', () => {
    const node = createReceiveNode('rec3', 'msg', 'child-a');
    let state = makeState([node]);
    state = updateNodeProgress(state, 'rec3', {
      iteration: 1,
      maxIterations: 1,
      status: 'running',
      startedAt: Date.now(),
    });
    const output = renderFlow(state);
    expect(output).toContain('[waiting]');
  });

  it('shows [received] when receive is completed', () => {
    const node = createReceiveNode('rec4', 'msg', 'child-b');
    let state = makeState([node]);
    state = updateNodeProgress(state, 'rec4', {
      iteration: 1,
      maxIterations: 1,
      status: 'completed',
      startedAt: Date.now() - 1000,
      completedAt: Date.now(),
    });
    // Advance past it so it shows as completed
    state = { ...state, currentNodePath: [1] };
    const output = renderFlow(state);
    expect(output).toContain('[received]');
  });
});

describe('renderFlow — memory let source', () => {
  it('renders let x = memory "key"', () => {
    const node = createLetNode('l1', 'pref', { type: 'memory', key: 'preferred_language' });
    const state = makeState([node]);
    const output = renderFlow(state);
    expect(output).toContain('let pref = memory "preferred_language"');
  });
});
