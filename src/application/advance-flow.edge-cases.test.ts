import { describe, expect, it, vi } from 'vitest';
import { autoAdvanceNodes, maybeCompleteFlow, resolveCurrentNode } from './advance-flow.js';
import { createFlowSpec } from '../domain/flow-spec.js';
import {
  createBreakNode,
  createContinueNode,
  createForeachNode,
  createIfNode,
  createLetNode,
  createPromptNode,
  createRetryNode,
  createRunNode,
  createSpawnNode,
  createTryNode,
  createWhileNode,
} from '../domain/flow-node.js';
import { createSessionState } from '../domain/session-state.js';
import type { CommandRunner } from './ports/command-runner.js';
import type { ProcessSpawner } from './ports/process-spawner.js';

function createState(nodes: Parameters<typeof createFlowSpec>[1]) {
  return createSessionState('edge-cases', createFlowSpec('edge-case coverage', nodes));
}

describe('advance-flow edge cases', () => {
  it('skips an empty foreach body and reaches the next prompt', async () => {
    const state = createState([
      createForeachNode('fe1', 'item', '', [createPromptNode('p1', 'unreachable')]),
      createPromptNode('p2', 'after foreach'),
    ]);

    const result = await autoAdvanceNodes(state);

    expect(result.kind).toBe('prompt');
    expect(result.capturedPrompt).toBe('after foreach');
  });

  it('runs a while body once when maxIterations is 1', async () => {
    let state = createState([
      createWhileNode(
        'w1',
        'keepGoing',
        [createLetNode('l1', 'seen', { type: 'literal', value: 'once' })],
        1,
      ),
      createPromptNode('p2', 'after while'),
    ]);
    state = { ...state, variables: { keepGoing: true } };

    const result = await autoAdvanceNodes(state);

    expect(result.kind).toBe('prompt');
    expect(result.capturedPrompt).toBe('after while');
    expect(result.state.variables['seen']).toBe('once');
    expect(result.state.nodeProgress['w1']).toMatchObject({
      iteration: 1,
      maxIterations: 1,
      status: 'completed',
    });
  });

  it('runs a retry body once when maxAttempts is 1', async () => {
    const runner: CommandRunner = {
      run: vi.fn().mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'boom' }),
    };
    const state = createState([
      createRetryNode('re1', [createRunNode('r1', 'build')], 1),
      createPromptNode('p2', 'after retry'),
    ]);

    const result = await autoAdvanceNodes(state, runner);

    expect(runner.run).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe('prompt');
    expect(result.capturedPrompt).toBe('after retry');
    expect(result.state.variables['command_failed']).toBe(true);
    expect(result.state.nodeProgress['re1']).toMatchObject({
      iteration: 1,
      maxIterations: 1,
      status: 'completed',
    });
  });

  it.each([
    ['break', () => createBreakNode('b1')],
    ['continue', () => createContinueNode('c1')],
  ] as const)('%s outside a loop advances to the following node', async (_kind, createNode) => {
    const state = createState([createNode(), createPromptNode('p2', 'after control node')]);

    const result = await autoAdvanceNodes(state);

    expect(result.kind).toBe('prompt');
    expect(result.capturedPrompt).toBe('after control node');
  });

  it('breaks out of a loop immediately without executing the rest of the body', async () => {
    const state = createState([
      createForeachNode('fe1', 'item', 'a b', [
        createBreakNode('b1'),
        createPromptNode('p1', 'unreachable body'),
      ]),
      createPromptNode('p2', 'after break'),
    ]);

    const result = await autoAdvanceNodes(state);

    expect(result.kind).toBe('prompt');
    expect(result.capturedPrompt).toBe('after break');
    expect(result.state.currentNodePath).toEqual([2]);
  });

  it('continue at the end of a loop re-enters once per item without double-executing', async () => {
    const state = createState([
      createForeachNode('fe1', 'item', 'alpha beta', [
        createPromptNode('p1', 'item=${item}'),
        createContinueNode('c1'),
        createPromptNode('p2', 'unreachable after continue'),
      ]),
      createPromptNode('p3', 'after continue'),
    ]);

    const first = await autoAdvanceNodes(state);
    expect(first.kind).toBe('prompt');
    expect(first.capturedPrompt).toBe('item=alpha');

    const second = await autoAdvanceNodes(first.state);
    expect(second.kind).toBe('prompt');
    expect(second.capturedPrompt).toBe('item=beta');

    const third = await autoAdvanceNodes(second.state);
    expect(third.kind).toBe('prompt');
    expect(third.capturedPrompt).toBe('after continue');
  });

  it('tracks nested foreach indices while walking three nested body paths', async () => {
    const prompt = createPromptNode(
      'p1',
      'outer=${outer_index} middle=${middle_index} inner=${inner_index} ${outer}/${middle}/${inner}',
    );
    const inner = createForeachNode('fe-inner', 'inner', 'x y', [prompt]);
    const middle = createForeachNode('fe-middle', 'middle', 'm1 m2', [inner]);
    const outer = createForeachNode('fe-outer', 'outer', 'a b', [middle]);
    const state = createState([outer]);

    expect(resolveCurrentNode([outer], [0])).toBe(outer);
    expect(resolveCurrentNode([outer], [0, 0])).toBe(middle);
    expect(resolveCurrentNode([outer], [0, 0, 0])).toBe(inner);
    expect(resolveCurrentNode([outer], [0, 0, 0, 0])).toBe(prompt);

    const first = await autoAdvanceNodes(state);
    expect(first.kind).toBe('prompt');
    expect(first.capturedPrompt).toBe('outer=0 middle=0 inner=0 a/m1/x');
    expect(first.state.currentNodePath).toEqual([0, 0, 0, 1]);

    const second = await autoAdvanceNodes(first.state);
    expect(second.kind).toBe('prompt');
    expect(second.capturedPrompt).toBe('outer=0 middle=0 inner=1 a/m1/y');

    const third = await autoAdvanceNodes(second.state);
    expect(third.kind).toBe('prompt');
    expect(third.capturedPrompt).toBe('outer=0 middle=1 inner=0 a/m2/x');
  });

  it('falls through a try body when there is no catch or finally branch', async () => {
    const state = createState([
      createTryNode(
        't1',
        [createLetNode('l1', 'done', { type: 'literal', value: 'yes' })],
        'command_failed',
        [],
      ),
      createPromptNode('p2', 'after try'),
    ]);

    const result = await autoAdvanceNodes(state);

    expect(result.kind).toBe('prompt');
    expect(result.capturedPrompt).toBe('after try');
    expect(result.state.variables['done']).toBe('yes');
  });

  it('marks the flow failed when a try body fails with no catch or finally branch', async () => {
    const runner: CommandRunner = {
      run: vi.fn().mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'boom' }),
    };
    const state = createState([
      createTryNode('t1', [createRunNode('r1', 'explode')], 'command_failed', []),
      createPromptNode('p2', 'after failed try'),
    ]);

    const result = await autoAdvanceNodes(state, runner);

    expect(result.kind).toBe('advance');
    expect(result.capturedPrompt).toBeNull();
    expect(result.state.status).toBe('failed');
    expect(result.state.variables['command_failed']).toBe(true);
  });

  it('skips an if node with no else branch when the condition is false', async () => {
    let state = createState([
      createIfNode('i1', 'takeThen', [
        createLetNode('l1', 'branch', { type: 'literal', value: 'then' }),
      ]),
      createPromptNode('p2', 'after if'),
    ]);
    state = { ...state, variables: { takeThen: false } };

    const result = await autoAdvanceNodes(state);

    expect(result.kind).toBe('prompt');
    expect(result.capturedPrompt).toBe('after if');
    expect(result.state.variables['branch']).toBeUndefined();
    expect(result.state.nodeProgress['i1']).toMatchObject({
      iteration: 1,
      maxIterations: 1,
      status: 'completed',
    });
  });

  it('spawns a child with an explicit empty variable scope', async () => {
    const spawner: ProcessSpawner = {
      spawn: vi.fn().mockResolvedValue({ pid: 42 }),
      poll: vi.fn().mockResolvedValue({ status: 'running' }),
    };
    let state = createState([
      createSpawnNode('sp1', 'worker', [createPromptNode('p1', 'child work')], undefined, []),
      createPromptNode('p2', 'after spawn'),
    ]);
    state = {
      ...state,
      variables: {
        visible: 'yes',
        api_token: 'secret',
      },
    };

    const result = await autoAdvanceNodes(state, undefined, undefined, spawner);

    expect(spawner.spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'worker',
        variables: {},
      }),
    );
    expect(result.kind).toBe('prompt');
    expect(result.capturedPrompt).toBe('after spawn');
    expect(result.state.spawnedChildren['worker']).toMatchObject({
      name: 'worker',
      status: 'running',
      pid: 42,
    });
  });

  it('stores an empty string literal in let nodes', async () => {
    const state = createState([
      createLetNode('l1', 'empty', { type: 'literal', value: '' }),
      createPromptNode('p2', 'after let'),
    ]);

    const result = await autoAdvanceNodes(state);

    expect(result.kind).toBe('prompt');
    expect(result.capturedPrompt).toBe('after let');
    expect(result.state.variables['empty']).toBe('');
  });

  it('completes an empty flow immediately', () => {
    const state = createState([]);

    expect(maybeCompleteFlow(state).status).toBe('completed');
  });

  it('captures and then completes a single-prompt flow', async () => {
    const state = createState([createPromptNode('p1', 'only prompt')]);

    const result = await autoAdvanceNodes(state);

    expect(result.kind).toBe('prompt');
    expect(result.capturedPrompt).toBe('only prompt');
    expect(result.state.currentNodePath).toEqual([1]);
    expect(maybeCompleteFlow(result.state).status).toBe('completed');
  });
});
