import { describe, it, expect } from 'vitest';
import {
  resolveCurrentNode,
  advancePath,
  findTryCatchJump,
  evaluateFlowCondition,
  autoAdvanceNodes,
  maybeCompleteFlow,
} from './advance-flow.js';
import { createSessionState } from '../domain/session-state.js';
import { createFlowSpec } from '../domain/flow-spec.js';
import {
  createPromptNode,
  createRunNode,
  createWhileNode,
  createUntilNode,
  createRetryNode,
  createIfNode,
  createTryNode,
  createLetNode,
  createForeachNode,
  createBreakNode,
} from '../domain/flow-node.js';
import type { CommandRunner } from './ports/command-runner.js';

// ── resolveCurrentNode ───────────────────────────────────────────────

describe('resolveCurrentNode', () => {
  it('returns null for empty path', () => {
    const nodes = [createPromptNode('p1', 'hi')];
    expect(resolveCurrentNode(nodes, [])).toBeNull();
  });

  it('resolves top-level node at index 0', () => {
    const p1 = createPromptNode('p1', 'hello');
    expect(resolveCurrentNode([p1], [0])).toBe(p1);
  });

  it('resolves top-level node at higher index', () => {
    const p1 = createPromptNode('p1', 'a');
    const p2 = createPromptNode('p2', 'b');
    expect(resolveCurrentNode([p1, p2], [1])).toBe(p2);
  });

  it('returns null for out-of-bounds index', () => {
    expect(resolveCurrentNode([createPromptNode('p1', 'hi')], [5])).toBeNull();
  });

  it('resolves child inside while body', () => {
    const inner = createPromptNode('p1', 'inner');
    const whileNode = createWhileNode('w1', 'cond', [inner]);
    expect(resolveCurrentNode([whileNode], [0, 0])).toBe(inner);
  });

  it('resolves child inside until body', () => {
    const inner = createRunNode('r1', 'cmd');
    const untilNode = createUntilNode('u1', 'cond', [inner]);
    expect(resolveCurrentNode([untilNode], [0, 0])).toBe(inner);
  });

  it('resolves child inside retry body', () => {
    const inner = createRunNode('r1', 'cmd');
    const retryNode = createRetryNode('re1', [inner], 3);
    expect(resolveCurrentNode([retryNode], [0, 0])).toBe(inner);
  });

  it('resolves child inside foreach body', () => {
    const inner = createPromptNode('p1', 'work');
    const foreachNode = createForeachNode('fe1', 'x', '${list}', [inner]);
    expect(resolveCurrentNode([foreachNode], [0, 0])).toBe(inner);
  });

  it('resolves child inside if thenBranch', () => {
    const thenChild = createPromptNode('p1', 'then');
    const elseChild = createPromptNode('p2', 'else');
    const ifNode = createIfNode('i1', 'cond', [thenChild], [elseChild]);
    expect(resolveCurrentNode([ifNode], [0, 0])).toBe(thenChild);
  });

  it('resolves child inside if elseBranch', () => {
    const thenChild = createPromptNode('p1', 'then');
    const elseChild = createPromptNode('p2', 'else');
    const ifNode = createIfNode('i1', 'cond', [thenChild], [elseChild]);
    // elseBranch index = thenBranch.length = 1
    expect(resolveCurrentNode([ifNode], [0, 1])).toBe(elseChild);
  });

  it('resolves child inside try body', () => {
    const bodyChild = createRunNode('r1', 'build');
    const catchChild = createPromptNode('p1', 'handle');
    const tryNode = createTryNode('t1', [bodyChild], 'command_failed', [catchChild]);
    expect(resolveCurrentNode([tryNode], [0, 0])).toBe(bodyChild);
  });

  it('resolves child inside try catchBody', () => {
    const bodyChild = createRunNode('r1', 'build');
    const catchChild = createPromptNode('p1', 'handle');
    const tryNode = createTryNode('t1', [bodyChild], 'command_failed', [catchChild]);
    // catchBody index = body.length = 1
    expect(resolveCurrentNode([tryNode], [0, 1])).toBe(catchChild);
  });

  it('resolves deeply nested node (while > if > prompt)', () => {
    const deepPrompt = createPromptNode('p1', 'deep');
    const ifNode = createIfNode('i1', 'cond', [deepPrompt]);
    const whileNode = createWhileNode('w1', 'cond', [ifNode]);
    expect(resolveCurrentNode([whileNode], [0, 0, 0])).toBe(deepPrompt);
  });

  it('returns null for leaf node with deeper path', () => {
    const prompt = createPromptNode('p1', 'hi');
    // Trying to go deeper into a prompt node
    expect(resolveCurrentNode([prompt], [0, 0])).toBeNull();
  });

  it('returns null for run node with deeper path', () => {
    const run = createRunNode('r1', 'cmd');
    expect(resolveCurrentNode([run], [0, 0])).toBeNull();
  });

  it('returns null for let node with deeper path', () => {
    const letNode = createLetNode('l1', 'x', { type: 'literal', value: 'v' });
    expect(resolveCurrentNode([letNode], [0, 0])).toBeNull();
  });
});

// ── advancePath ──────────────────────────────────────────────────────

describe('advancePath', () => {
  it('returns [0] for empty path', () => {
    expect(advancePath([])).toEqual([0]);
  });

  it('increments last element of single-element path', () => {
    expect(advancePath([2])).toEqual([3]);
  });

  it('increments last element preserving prefix', () => {
    expect(advancePath([0, 1, 3])).toEqual([0, 1, 4]);
  });
});

// ── findTryCatchJump ─────────────────────────────────────────────────

describe('findTryCatchJump', () => {
  it('returns null when no try ancestor exists', () => {
    const nodes = [createRunNode('r1', 'cmd')];
    expect(findTryCatchJump(nodes, [0])).toBeNull();
  });

  it('returns null for top-level path', () => {
    const tryNode = createTryNode('t1', [createRunNode('r1', 'cmd')], 'command_failed', [
      createPromptNode('p1', 'handle'),
    ]);
    // Path [0] is the try itself, no parent try
    expect(findTryCatchJump([tryNode], [0])).toBeNull();
  });

  it('returns catch jump target for failed run in try body', () => {
    const tryNode = createTryNode(
      't1',
      [createRunNode('r1', 'fail-cmd'), createPromptNode('p1', 'after')],
      'command_failed',
      [createPromptNode('p2', 'caught')],
    );
    // Path [0, 0] = first child of try body
    expect(findTryCatchJump([tryNode], [0, 0])).toEqual([0, 2]);
  });

  it('returns null when try has no catch body', () => {
    const tryNode = createTryNode('t1', [createRunNode('r1', 'cmd')], 'command_failed', []);
    expect(findTryCatchJump([tryNode], [0, 0])).toBeNull();
  });

  it('returns null when path is in catch body (not try body)', () => {
    const tryNode = createTryNode('t1', [createRunNode('r1', 'cmd')], 'command_failed', [
      createPromptNode('p1', 'handle'),
    ]);
    // Path [0, 1] = first child of catch body (index >= body.length)
    expect(findTryCatchJump([tryNode], [0, 1])).toBeNull();
  });

  it('finds catch target in nested try/catch', () => {
    const innerTry = createTryNode('t2', [createRunNode('r1', 'inner-fail')], 'command_failed', [
      createPromptNode('p1', 'inner-catch'),
    ]);
    const outerTry = createTryNode('t1', [innerTry], 'command_failed', [
      createPromptNode('p2', 'outer-catch'),
    ]);
    // Path [0, 0, 0] = run inside inner try body
    // Should find innerTry's catch at [0, 0, 1]
    expect(findTryCatchJump([outerTry], [0, 0, 0])).toEqual([0, 0, 1]);
  });

  it('falls through to outer try when inner try has no catch', () => {
    const innerTry = createTryNode(
      't2',
      [createRunNode('r1', 'inner-fail')],
      'command_failed',
      [], // no catch body
    );
    const outerTry = createTryNode('t1', [innerTry], 'command_failed', [
      createPromptNode('p2', 'outer-catch'),
    ]);
    // Inner try has no catch → falls through to outer try's catch at [0, 1]
    expect(findTryCatchJump([outerTry], [0, 0, 0])).toEqual([0, 1]);
  });
});

// ── evaluateFlowCondition ────────────────────────────────────────────

describe('evaluateFlowCondition', () => {
  it('resolves condition from variables (true)', async () => {
    const result = await evaluateFlowCondition('command_failed', { command_failed: true });
    expect(result).toBe(true);
  });

  it('resolves condition from variables (false)', async () => {
    const result = await evaluateFlowCondition('command_failed', { command_failed: false });
    expect(result).toBe(false);
  });

  it('returns null when variable not found and no command runner', async () => {
    const result = await evaluateFlowCondition('tests_pass', {});
    expect(result).toBeNull();
  });

  it('falls back to command execution for builtin predicate', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    };
    const result = await evaluateFlowCondition('tests_pass', {}, runner);
    expect(result).toBe(true);
  });

  it('handles inverted predicate (tests_fail) correctly', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: '', stderr: '' }),
    };
    // tests_fail is inverted — passes when command exits non-zero
    const result = await evaluateFlowCondition('tests_fail', {}, runner);
    expect(result).toBe(true);
  });

  it('returns null when predicate is unknown and variable is missing', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    };
    const result = await evaluateFlowCondition('completely_unknown', {}, runner);
    expect(result).toBeNull();
  });
});

// ── autoAdvanceNodes — handleBodyExhaustion paths ────────────────────

describe('autoAdvanceNodes — body exhaustion', () => {
  it('re-loops while when condition stays true', async () => {
    const spec = createFlowSpec('test', [
      createWhileNode('w1', 'command_failed', [createPromptNode('p1', 'Fix')], 3),
    ]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      variables: { command_failed: true },
      currentNodePath: [0, 1], // past body end
      nodeProgress: { w1: { iteration: 1, maxIterations: 3, status: 'running' } },
    };

    const { state: result, capturedPrompt } = await autoAdvanceNodes(state);
    expect(result.nodeProgress['w1']?.iteration).toBe(2);
    // Re-loops to [0, 0], then prompt auto-advances to [0, 1]
    expect(capturedPrompt).toBe('Fix');
  });

  it('exits while when condition becomes false', async () => {
    const spec = createFlowSpec('test', [
      createWhileNode('w1', 'command_failed', [createPromptNode('p1', 'Fix')], 3),
      createPromptNode('p2', 'Done'),
    ]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      variables: { command_failed: false },
      currentNodePath: [0, 1],
      nodeProgress: { w1: { iteration: 1, maxIterations: 3, status: 'running' } },
    };

    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('Done');
  });

  it('re-loops until when condition stays false', async () => {
    const spec = createFlowSpec('test', [
      createUntilNode('u1', 'command_succeeded', [createPromptNode('p1', 'Try')], 5),
    ]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      variables: { command_succeeded: false },
      currentNodePath: [0, 1],
      nodeProgress: { u1: { iteration: 1, maxIterations: 5, status: 'running' } },
    };

    const { state: result } = await autoAdvanceNodes(state);
    expect(result.nodeProgress['u1']?.iteration).toBe(2);
  });

  it('exits until when condition becomes true', async () => {
    const spec = createFlowSpec('test', [
      createUntilNode('u1', 'command_succeeded', [createPromptNode('p1', 'Try')], 5),
      createPromptNode('p2', 'Success'),
    ]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      variables: { command_succeeded: true },
      currentNodePath: [0, 1],
      nodeProgress: { u1: { iteration: 1, maxIterations: 5, status: 'running' } },
    };

    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('Success');
  });

  it('re-loops retry when command_failed is true', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: '', stderr: '' }),
    };
    const spec = createFlowSpec('test', [
      createRetryNode('re1', [createRunNode('r1', 'build'), createPromptNode('p1', 'Fix')], 3),
    ]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      variables: { command_failed: true },
      currentNodePath: [0, 2], // past body end
      nodeProgress: { re1: { iteration: 1, maxIterations: 3, status: 'running' } },
    };

    const { state: result, capturedPrompt } = await autoAdvanceNodes(state, runner);
    expect(result.nodeProgress['re1']?.iteration).toBe(2);
    expect(capturedPrompt).toContain('Fix');
  });

  it('exits retry at max attempts even when command_failed', async () => {
    const spec = createFlowSpec('test', [
      createRetryNode('re1', [createPromptNode('p1', 'Fix')], 2),
      createPromptNode('p2', 'Gave up'),
    ]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      variables: { command_failed: true },
      currentNodePath: [0, 1],
      nodeProgress: { re1: { iteration: 2, maxIterations: 2, status: 'running' } },
    };

    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('Gave up');
  });

  it('advances past if when body exhausted', async () => {
    const spec = createFlowSpec('test', [
      createIfNode('i1', 'command_failed', [createPromptNode('p1', 'Fix')]),
      createPromptNode('p2', 'After if'),
    ]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [0, 1] };

    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('After if');
  });

  it('advances past try when body/catch exhausted', async () => {
    const spec = createFlowSpec('test', [
      createTryNode('t1', [createRunNode('r1', 'cmd')], 'command_failed', [
        createPromptNode('p1', 'handle'),
      ]),
      createPromptNode('p2', 'After try'),
    ]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [0, 2] }; // past try body+catch

    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('After try');
  });
});

// ── autoAdvanceNodes — foreach edge cases ────────────────────────────

describe('autoAdvanceNodes — foreach', () => {
  it('caps iterations at maxIterations on entry', async () => {
    const foreachNode = createForeachNode(
      'fe1',
      'item',
      'a b c d e',
      [createPromptNode('p1', '${item}')],
      2,
    );
    const spec = createFlowSpec('test', [foreachNode]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state);
    expect(result.variables['item']).toBe('a');
    expect(result.variables['item_length']).toBe(2);
    expect(result.nodeProgress['fe1']?.maxIterations).toBe(2);
  });

  it('skips foreach with empty list', async () => {
    const foreachNode = createForeachNode('fe1', 'item', '', [
      createPromptNode('p1', 'should not appear'),
    ]);
    const promptAfter = createPromptNode('p2', 'Skipped');
    const spec = createFlowSpec('test', [foreachNode, promptAfter]);
    const state = createSessionState('s1', spec);

    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('Skipped');
  });

  it('advances foreach through all items via body exhaustion', async () => {
    const foreachNode = createForeachNode('fe1', 'x', 'alpha beta', [
      createPromptNode('p1', 'item: ${x}'),
    ]);
    const promptAfter = createPromptNode('p2', 'Done');
    const spec = createFlowSpec('test', [foreachNode, promptAfter]);
    const state = createSessionState('s1', spec);

    // First: enters foreach with x=alpha
    const r1 = await autoAdvanceNodes(state);
    expect(r1.capturedPrompt).toBe('item: alpha');

    // Second: body exhausted, x=beta, re-enter
    const r2 = await autoAdvanceNodes(r1.state);
    expect(r2.capturedPrompt).toBe('item: beta');

    // Third: body exhausted, no more items, advance past
    const r3 = await autoAdvanceNodes(r2.state);
    expect(r3.capturedPrompt).toBe('Done');
  });
});

// ── autoAdvanceNodes — condition loop (while/until) first entry ──────

describe('autoAdvanceNodes — condition loop entry', () => {
  it('while enters body when condition true via builtin command', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: '', stderr: '' }),
    };
    const whileNode = createWhileNode('w1', 'tests_fail', [createPromptNode('p1', 'Fix')], 3);
    const spec = createFlowSpec('test', [whileNode]);
    const state = createSessionState('s1', spec);

    const { capturedPrompt } = await autoAdvanceNodes(state, runner);
    expect(capturedPrompt).toBe('Fix');
  });

  it('until enters body when condition false', async () => {
    const spec = createFlowSpec('test', [
      createUntilNode('u1', 'command_succeeded', [createPromptNode('p1', 'Try again')], 3),
    ]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { command_succeeded: false } };

    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('Try again');
  });

  it('while returns null capturedPrompt when condition unresolvable', async () => {
    const whileNode = createWhileNode('w1', 'totally_unknown', [createPromptNode('p1', 'work')]);
    const spec = createFlowSpec('test', [whileNode]);
    const state = createSessionState('s1', spec);

    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBeNull();
  });
});

// ── maybeCompleteFlow ────────────────────────────────────────────────

describe('maybeCompleteFlow', () => {
  it('does not complete when status is not active', () => {
    const spec = createFlowSpec('test', []);
    let state = createSessionState('s1', spec);
    state = { ...state, status: 'completed' };
    expect(maybeCompleteFlow(state).status).toBe('completed');
  });

  it('does not complete when inside a control-flow scope', () => {
    const spec = createFlowSpec('test', [
      createWhileNode('w1', 'cond', [createPromptNode('p1', 'work')]),
    ]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [0, 1] };
    expect(maybeCompleteFlow(state).status).toBe('active');
  });

  it('does not complete when current node exists', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    const state = createSessionState('s1', spec);
    // currentNodePath = [0], node exists
    expect(maybeCompleteFlow(state).status).toBe('active');
  });

  it('completes when all nodes exhausted and no gates', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [1] }; // past all nodes
    expect(maybeCompleteFlow(state).status).toBe('completed');
  });

  it('does not complete when gates are present and not passing', () => {
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'work')],
      [{ predicate: 'tests_pass' }],
    );
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [1] };
    expect(maybeCompleteFlow(state).status).toBe('active');
  });

  it('completes when gates are all passing', () => {
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'work')],
      [{ predicate: 'tests_pass' }],
    );
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [1], gateResults: { tests_pass: true } };
    expect(maybeCompleteFlow(state).status).toBe('completed');
  });
});

// ── autoAdvanceNodes — MAX_ADVANCES safety ───────────────────────────

describe('autoAdvanceNodes — safety limits', () => {
  it('stops at MAX_ADVANCES and adds warning', async () => {
    const nodes = Array.from({ length: 101 }, (_, i) =>
      createLetNode(`l${i}`, `v${i}`, { type: 'literal', value: String(i) }),
    );
    const spec = createFlowSpec('test', nodes);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('MAX_ADVANCES')]),
    );
    expect(result.currentNodePath).toEqual([100]);
  });
});

// ── H#15: Break node advancement ─────────────────────────────────────

describe('autoAdvanceNodes — break', () => {
  it('break exits foreach loop early — only first item processed', async () => {
    const fe = createForeachNode(
      'f1',
      'x',
      'a b c',
      [createLetNode('l1', 'marker', { type: 'literal', value: 'hit' }), createBreakNode('b1')],
      50,
    );
    const spec = createFlowSpec('test', [
      fe,
      createLetNode('l2', 'after', { type: 'literal', value: 'yes' }),
    ]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state);
    // Break should exit loop after first item, then advance to the let after loop
    expect(result.variables['marker']).toBe('hit');
    expect(result.variables['after']).toBe('yes');
    // Only first item processed — x stays as 'a'
    expect(result.variables['x']).toBe('a');
  });

  it('break exits while loop early', async () => {
    const wh = createWhileNode('w1', 'flag', [createBreakNode('b1')], 5);
    const spec = createFlowSpec('test', [
      wh,
      createLetNode('l1', 'after', { type: 'literal', value: 'done' }),
    ]);
    const state = createSessionState('s1', spec);
    const withFlag = { ...state, variables: { ...state.variables, flag: true } };

    const { state: result } = await autoAdvanceNodes(withFlag);
    expect(result.variables['after']).toBe('done');
  });

  it('break outside loop just advances past break', async () => {
    const spec = createFlowSpec('test', [
      createBreakNode('b1'),
      createLetNode('l1', 'after', { type: 'literal', value: 'yes' }),
    ]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state);
    expect(result.variables['after']).toBe('yes');
  });
});

// ── H#20: Try/finally advancement ────────────────────────────────────

describe('autoAdvanceNodes — try/finally', () => {
  it('finally body executes after catch body', async () => {
    const commands: string[] = [];
    const runner: CommandRunner = {
      run: async (cmd: string) => {
        commands.push(cmd);
        if (cmd.includes('fail')) {
          return { exitCode: 1, stdout: '', stderr: 'err' };
        }
        return { exitCode: 0, stdout: 'cleaned', stderr: '' };
      },
    };
    const tryNode = createTryNode(
      't1',
      [createRunNode('r1', 'fail')],
      'command_failed',
      [createRunNode('r2', 'recover')],
      [createRunNode('r3', 'cleanup')],
    );
    const spec = createFlowSpec('test', [tryNode]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state, runner);
    // All three run nodes should have executed: fail, recover, cleanup
    expect(commands).toContain('fail');
    expect(commands).toContain('recover');
    expect(commands).toContain('cleanup');
    expect(result.variables['last_stdout']).toBe('cleaned');
  });

  it('finally body executes after normal body completion (no failure)', async () => {
    const commands: string[] = [];
    const runner: CommandRunner = {
      run: async (cmd: string) => {
        commands.push(cmd);
        return { exitCode: 0, stdout: cmd, stderr: '' };
      },
    };
    const tryNode = createTryNode(
      't1',
      [createRunNode('r1', 'body-cmd')],
      'command_failed',
      [],
      [createRunNode('r3', 'finally-cmd')],
    );
    const spec = createFlowSpec('test', [tryNode]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state, runner);
    expect(commands).toContain('body-cmd');
    expect(commands).toContain('finally-cmd');
    expect(result.variables['last_stdout']).toBe('finally-cmd');
  });

  it('resolveCurrentNode includes finallyBody', () => {
    const tryNode = createTryNode(
      't1',
      [createRunNode('r1', 'body')],
      'command_failed',
      [createRunNode('r2', 'catch')],
      [createRunNode('r3', 'cleanup')],
    );
    // finallyBody[0] is at index: body.length + catchBody.length = 1 + 1 = 2
    const node = resolveCurrentNode([tryNode], [0, 2]);
    expect(node?.kind).toBe('run');
    expect((node as import('../domain/flow-node.js').RunNode).command).toBe('cleanup');
  });
});

// ── timeout propagation ─────────────────────────────────────────────

describe('autoAdvanceNodes — timeout propagation', () => {
  it('passes timeoutMs to commandRunner.run() for run nodes', async () => {
    const receivedOptions: { timeoutMs?: number }[] = [];
    const mockRunner: CommandRunner = {
      run: async (_cmd: string, options?: { timeoutMs?: number }) => {
        receivedOptions.push(options ?? {});
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    };
    const runNode = createRunNode('r1', 'npm test', 30000);
    const promptNode = createPromptNode('p1', 'done');
    const spec = createFlowSpec('test', [runNode, promptNode]);
    const session = createSessionState('s1', spec);

    await autoAdvanceNodes(session, mockRunner);

    expect(receivedOptions).toHaveLength(1);
    expect(receivedOptions[0]!.timeoutMs).toBe(30000);
  });

  it('does not pass timeoutMs when run node has no timeout', async () => {
    const receivedOptions: { timeoutMs?: number }[] = [];
    const mockRunner: CommandRunner = {
      run: async (_cmd: string, options?: { timeoutMs?: number }) => {
        receivedOptions.push(options ?? {});
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    };
    const runNode = createRunNode('r1', 'echo hi');
    const promptNode = createPromptNode('p1', 'done');
    const spec = createFlowSpec('test', [runNode, promptNode]);
    const session = createSessionState('s1', spec);

    await autoAdvanceNodes(session, mockRunner);

    expect(receivedOptions).toHaveLength(1);
    expect(receivedOptions[0]!.timeoutMs).toBeUndefined();
  });
});
