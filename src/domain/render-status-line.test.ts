import { describe, expect, it } from 'vitest';

import { createCompletionGate, createFlowSpec } from './flow-spec.js';
import {
  createAwaitNode,
  createBreakNode,
  createForeachNode,
  createIfNode,
  createLetNode,
  createPromptNode,
  createRetryNode,
  createRunNode,
  createSpawnNode,
  createTryNode,
  createUntilNode,
  createWhileNode,
} from './flow-node.js';
import { renderStatusLine } from './render-status-line.js';
import { createSessionState } from './session-state.js';

function state(
  goal: string,
  nodes: Parameters<typeof createFlowSpec>[1],
  gates: Parameters<typeof createFlowSpec>[2] = [],
  overrides: Partial<ReturnType<typeof createSessionState>> = {},
) {
  const spec = createFlowSpec(goal, nodes, gates);
  return { ...createSessionState('test', spec), ...overrides };
}

describe('renderStatusLine', () => {
  it('returns no-active-flow for empty nodes', () => {
    expect(renderStatusLine(state('Goal', []))).toBe('[PL] No active flow');
  });

  it('shows completed status', () => {
    const line = renderStatusLine(
      state('Fix auth tests', [createPromptNode('p1', 'Fix it')], [], {
        status: 'completed',
      }),
    );
    expect(line).toContain('[PL] Fix auth tests');
    expect(line).toContain('Status: completed');
  });

  it('shows failed status', () => {
    const line = renderStatusLine(
      state('Fix bugs', [createPromptNode('p1', 'Fix')], [], { status: 'failed' }),
    );
    expect(line).toContain('Status: failed');
  });

  it('shows cancelled status', () => {
    const line = renderStatusLine(
      state('Task', [createPromptNode('p1', 'Do')], [], { status: 'cancelled' }),
    );
    expect(line).toContain('Status: cancelled');
  });

  it('shows prompt node summary for active flow', () => {
    const line = renderStatusLine(state('My goal', [createPromptNode('p1', 'Fix the auth tests')]));
    expect(line).toBe('[PL] My goal | prompt: Fix the auth tests');
  });

  it('shows run node summary', () => {
    const line = renderStatusLine(state('My goal', [createRunNode('r1', 'npm test')]));
    expect(line).toContain('run: npm test');
  });

  it('shows let node summary', () => {
    const line = renderStatusLine(
      state('Goal', [createLetNode('l1', 'myVar', { type: 'literal', value: 'hello' })]),
    );
    expect(line).toContain('let myVar');
  });

  it('shows retry loop progress with nested node', () => {
    const line = renderStatusLine(
      state('Fix it', [createRetryNode('retry1', [createRunNode('r1', 'npm test')])], [], {
        currentNodePath: [0, 0],
        nodeProgress: {
          retry1: { iteration: 2, maxIterations: 5, status: 'running' },
        },
      }),
    );
    expect(line).toContain('retry 2/5');
    expect(line).toContain('run: npm test');
  });

  it('shows while loop progress', () => {
    const line = renderStatusLine(
      state(
        'Goal',
        [createWhileNode('w1', 'not tests_pass', [createPromptNode('p1', 'Fix')])],
        [],
        {
          currentNodePath: [0, 0],
          nodeProgress: {
            w1: { iteration: 3, maxIterations: 5, status: 'running' },
          },
        },
      ),
    );
    expect(line).toContain('while 3/5');
    expect(line).toContain('prompt: Fix');
  });

  it('shows until loop progress', () => {
    const line = renderStatusLine(
      state('Goal', [createUntilNode('u1', 'tests_pass', [createPromptNode('p1', 'Fix')])], [], {
        currentNodePath: [0, 0],
        nodeProgress: {
          u1: { iteration: 1, maxIterations: 5, status: 'running' },
        },
      }),
    );
    expect(line).toContain('until 1/5');
  });

  it('shows foreach loop progress', () => {
    const line = renderStatusLine(
      state(
        'Goal',
        [createForeachNode('f1', 'item', '"a b c"', [createPromptNode('p1', 'Do')])],
        [],
        {
          currentNodePath: [0, 0],
          nodeProgress: {
            f1: { iteration: 2, maxIterations: 50, status: 'running' },
          },
        },
      ),
    );
    expect(line).toContain('foreach 2/50');
  });

  it('shows gate results (PASS/FAIL/PENDING)', () => {
    const line = renderStatusLine(
      state(
        'Fix tests',
        [createPromptNode('p1', 'Fix')],
        [createCompletionGate('tests_pass'), createCompletionGate('lint_pass')],
        {
          gateResults: { tests_pass: false, lint_pass: true },
        },
      ),
    );
    expect(line).toContain('tests_pass:FAIL');
    expect(line).toContain('lint_pass:PASS');
  });

  it('shows PENDING for unevaluated gates', () => {
    const line = renderStatusLine(
      state('Goal', [createPromptNode('p1', 'Fix')], [createCompletionGate('tests_pass')]),
    );
    expect(line).toContain('tests_pass:PENDING');
  });

  it('includes gates in completed status', () => {
    const line = renderStatusLine(
      state('Goal', [createPromptNode('p1', 'Fix')], [createCompletionGate('tests_pass')], {
        status: 'completed',
        gateResults: { tests_pass: true },
      }),
    );
    expect(line).toContain('Status: completed');
    expect(line).toContain('tests_pass:PASS');
  });

  it('truncates long goals to ~30 chars', () => {
    const longGoal = 'A very long goal description that exceeds thirty characters easily';
    const line = renderStatusLine(state(longGoal, [createPromptNode('p1', 'Do it')]));
    expect(line).toContain('[PL]');
    expect(line).not.toContain(longGoal);
    expect(line).toContain('\u2026'); // ellipsis
  });

  it('truncates overall line to max width', () => {
    const line = renderStatusLine(state('Goal', [createPromptNode('p1', 'A '.repeat(200))]));
    expect(line.length).toBeLessThanOrEqual(120);
  });

  it('shows advancing when path points past nodes', () => {
    const line = renderStatusLine(
      state('Goal', [createPromptNode('p1', 'test')], [], {
        currentNodePath: [99],
      }),
    );
    expect(line).toContain('advancing');
  });

  it('handles if node', () => {
    const line = renderStatusLine(
      state('Goal', [createIfNode('i1', 'command_failed', [createPromptNode('p1', 'Fix')])]),
    );
    expect(line).toContain('if command_failed');
  });

  it('handles nested if → then-branch node', () => {
    const line = renderStatusLine(
      state(
        'Goal',
        [createIfNode('i1', 'command_failed', [createPromptNode('p1', 'Fix it')])],
        [],
        { currentNodePath: [0, 0] },
      ),
    );
    expect(line).toContain('prompt: Fix it');
  });

  it('handles try node', () => {
    const line = renderStatusLine(
      state('Goal', [createTryNode('t1', [createRunNode('r1', 'npm test')], 'error', [])]),
    );
    expect(line).toContain('try');
  });

  it('handles break node', () => {
    const line = renderStatusLine(
      state('Goal', [createWhileNode('w1', 'true', [createBreakNode('b1')])], [], {
        currentNodePath: [0, 0],
      }),
    );
    expect(line).toContain('break');
  });

  it('handles spawn node', () => {
    const line = renderStatusLine(
      state('Goal', [createSpawnNode('s1', 'worker', [createRunNode('r1', 'echo hi')])]),
    );
    expect(line).toContain('spawn "worker"');
  });

  it('handles await node', () => {
    const line = renderStatusLine(state('Goal', [createAwaitNode('a1', 'all')]));
    expect(line).toContain('await all');
  });

  it('handles await with specific target', () => {
    const line = renderStatusLine(state('Goal', [createAwaitNode('a1', 'worker')]));
    expect(line).toContain('await "worker"');
  });

  it('shows innermost loop progress for nested loops', () => {
    const inner = createRetryNode('retry_inner', [createRunNode('r1', 'npm test')]);
    const outer = createWhileNode('while_outer', 'not done', [inner]);
    const line = renderStatusLine(
      state('Goal', [outer], [], {
        currentNodePath: [0, 0, 0],
        nodeProgress: {
          while_outer: { iteration: 1, maxIterations: 5, status: 'running' },
          retry_inner: { iteration: 3, maxIterations: 3, status: 'running' },
        },
      }),
    );
    // Innermost loop (retry) should be shown
    expect(line).toContain('retry 3/3');
  });

  it('no pipe separator when no gates', () => {
    const line = renderStatusLine(state('Goal', [createPromptNode('p1', 'Do')]));
    // Should have exactly one pipe: between goal and node
    const pipes = line.split(' | ');
    expect(pipes).toHaveLength(2);
  });

  it('completed with no gates has only two parts (no extra pipe)', () => {
    const line = renderStatusLine(
      state('Goal', [createPromptNode('p1', 'Do')], [], { status: 'completed' }),
    );
    const pipes = line.split(' | ');
    expect(pipes).toHaveLength(2);
    expect(pipes[0]).toBe('[PL] Goal');
    expect(pipes[1]).toBe('Status: completed');
  });

  it('loop ancestor without nodeProgress entry does not crash', () => {
    // Retry is an ancestor but has no entry in nodeProgress
    const line = renderStatusLine(
      state('Goal', [createRetryNode('retry1', [createRunNode('r1', 'npm test')])], [], {
        currentNodePath: [0, 0],
        nodeProgress: {},
      }),
    );
    // No loop progress shown, just the node summary
    expect(line).toContain('run: npm test');
    expect(line).not.toContain('retry');
  });

  it('spawn node in collectAncestors path', () => {
    // Path goes through spawn → body[0] which is a run node
    const line = renderStatusLine(
      state('Goal', [createSpawnNode('s1', 'worker', [createRunNode('r1', 'echo hi')])], [], {
        currentNodePath: [0, 0],
      }),
    );
    expect(line).toContain('run: echo hi');
  });

  it('shows retry summary when current node is a retry', () => {
    const line = renderStatusLine(
      state('Goal', [createRetryNode('retry1', [createRunNode('r1', 'npm test')])], [], {
        currentNodePath: [0],
      }),
    );
    expect(line).toContain('retry');
  });

  it('shows until summary when current node is an until', () => {
    const line = renderStatusLine(
      state('Goal', [createUntilNode('u1', 'tests_pass', [createPromptNode('p1', 'Fix')])], [], {
        currentNodePath: [0],
      }),
    );
    expect(line).toContain('until tests_pass');
  });

  it('shows while summary when current node is a while', () => {
    const line = renderStatusLine(
      state('Goal', [createWhileNode('w1', 'not done', [createPromptNode('p1', 'Fix')])], [], {
        currentNodePath: [0],
      }),
    );
    expect(line).toContain('while not done');
  });

  it('shows foreach summary when current node is a foreach', () => {
    const line = renderStatusLine(
      state(
        'Goal',
        [createForeachNode('f1', 'item', 'a b c', [createPromptNode('p1', 'Do')])],
        [],
        { currentNodePath: [0] },
      ),
    );
    expect(line).toContain('foreach item');
  });

  it('returns advancing when path descends into a leaf node', () => {
    // Path [0, 0] tries to go deeper into a prompt node (a leaf), triggering resolveNode default
    const line = renderStatusLine(
      state('Goal', [createPromptNode('p1', 'Do it')], [], {
        currentNodePath: [0, 0],
      }),
    );
    expect(line).toContain('advancing');
  });

  it('resolves node inside try catch body', () => {
    // try body has 1 node, catch body has 1 node → catch is at index 1
    const line = renderStatusLine(
      state(
        'Goal',
        [
          createTryNode('t1', [createRunNode('r1', 'npm test')], 'error', [
            createPromptNode('p1', 'Fix error'),
          ]),
        ],
        [],
        { currentNodePath: [0, 1] },
      ),
    );
    expect(line).toContain('prompt: Fix error');
  });
});
