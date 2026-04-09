import { describe, it, expect, vi } from 'vitest';
import {
  resolveCurrentNode,
  advancePath,
  findTryCatchJump,
  evaluateFlowCondition,
  autoAdvanceNodes,
  maybeCompleteFlow,
  MAX_AWAIT_POLLS,
} from './advance-flow.js';
import {
  createSessionState,
  updateNodeProgress,
  updateSpawnedChild,
} from '../domain/session-state.js';
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
  createContinueNode,
  createSpawnNode,
  createAwaitNode,
  createRaceNode,
} from '../domain/flow-node.js';
import type { CommandRunner } from './ports/command-runner.js';
import type { CaptureReader } from './ports/capture-reader.js';
import type { ProcessSpawner, SpawnInput } from './ports/process-spawner.js';

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

// ── autoAdvanceNodes — sequential let regression (P0) ────────────────

describe('autoAdvanceNodes — sequential auto-advance', () => {
  it('terminates normally with 12+ sequential let nodes', async () => {
    const nodes = Array.from({ length: 15 }, (_, i) =>
      createLetNode(`l${i}`, `v${i}`, { type: 'literal', value: `val-${i}` }),
    );
    const spec = createFlowSpec('test', nodes);
    const state = createSessionState('s1', spec);

    const { state: result, capturedPrompt } = await autoAdvanceNodes(state);

    // All 15 variables should be set
    for (let i = 0; i < 15; i++) {
      expect(result.variables[`v${i}`]).toBe(`val-${i}`);
    }
    // Path should be past all nodes
    expect(result.currentNodePath).toEqual([15]);
    // No MAX_ADVANCES warning
    expect(result.warnings).not.toEqual(
      expect.arrayContaining([expect.stringContaining('Flow paused')]),
    );
    // No captured prompt (all auto-advancing)
    expect(capturedPrompt).toBeNull();
  });

  it('processes mixed let + run nodes sequentially', async () => {
    const commands: string[] = [];
    const runner: CommandRunner = {
      run: async (cmd: string) => {
        commands.push(cmd);
        return { exitCode: 0, stdout: `out-${cmd}`, stderr: '' };
      },
    };
    const nodes = [
      createLetNode('l1', 'a', { type: 'literal', value: 'hello' }),
      createLetNode('l2', 'b', { type: 'literal', value: 'world' }),
      createRunNode('r1', 'cmd1'),
      createLetNode('l3', 'c', { type: 'literal', value: 'foo' }),
      createRunNode('r2', 'cmd2'),
      createLetNode('l4', 'd', { type: 'literal', value: 'bar' }),
      createPromptNode('p1', 'Done: ${a} ${b} ${c} ${d}'),
    ];
    const spec = createFlowSpec('test', nodes);
    const state = createSessionState('s1', spec);

    const { state: result, capturedPrompt } = await autoAdvanceNodes(state, runner);
    expect(result.variables['a']).toBe('hello');
    expect(result.variables['b']).toBe('world');
    expect(result.variables['c']).toBe('foo');
    expect(result.variables['d']).toBe('bar');
    expect(commands).toEqual(['cmd1', 'cmd2']);
    expect(capturedPrompt).toBe('Done: hello world foo bar');
  });

  it('detects stale state and breaks out', async () => {
    // A while node with unresolvable condition returns without advancing.
    // The stale-state check should break the loop immediately.
    const whileNode = createWhileNode('w1', 'unknown_condition', [createPromptNode('p1', 'inner')]);
    const spec = createFlowSpec('test', [whileNode]);
    const state = createSessionState('s1', spec);

    const { state: result, capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBeNull();
    // Path should still be at [0] — stale state detected
    expect(result.currentNodePath).toEqual([0]);
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
      expect.arrayContaining([expect.stringContaining('Flow paused')]),
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

// ── spawn/await nodes ──────────────────────────────────────────────

describe('resolveCurrentNode — spawn', () => {
  it('resolves child inside spawn body', () => {
    const spawn = createSpawnNode('sp1', 'task', [
      createPromptNode('p1', 'inner'),
      createRunNode('r1', 'test'),
    ]);
    const result = resolveCurrentNode([spawn], [0, 1]);
    expect(result?.kind).toBe('run');
  });
});

describe('autoAdvanceNodes — spawn', () => {
  it('skips spawn node when no processSpawner is provided', async () => {
    const spawn = createSpawnNode('sp1', 'task', [createPromptNode('p1', 'inner')]);
    const prompt = createPromptNode('p2', 'after spawn');
    const spec = createFlowSpec('test', [spawn, prompt]);
    const state = createSessionState('s1', spec);

    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('after spawn');
  });

  it('records spawned child and advances past spawn when spawner provided', async () => {
    const spawnedInputs: SpawnInput[] = [];
    const mockSpawner: ProcessSpawner = {
      async spawn(input) {
        spawnedInputs.push(input);
        return { pid: 42 };
      },
      async poll() {
        return { status: 'running' };
      },
    };

    const spawn = createSpawnNode('sp1', 'fix-auth', [createRunNode('r1', 'npm test')]);
    const prompt = createPromptNode('p2', 'after spawn');
    const spec = createFlowSpec('test', [spawn, prompt]);
    const state = createSessionState('s1', spec);

    const { state: result, capturedPrompt } = await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      mockSpawner,
    );
    expect(capturedPrompt).toBe('after spawn');
    expect(result.spawnedChildren['fix-auth']).toBeDefined();
    expect(result.spawnedChildren['fix-auth']?.status).toBe('running');
    expect(result.spawnedChildren['fix-auth']?.pid).toBe(42);
    expect(spawnedInputs).toHaveLength(1);
    expect(spawnedInputs[0]!.name).toBe('fix-auth');
  });
});

describe('autoAdvanceNodes — await', () => {
  it('skips await when no processSpawner is provided', async () => {
    const awaitNode = createAwaitNode('aw1', 'all');
    const prompt = createPromptNode('p1', 'after await');
    const spec = createFlowSpec('test', [awaitNode, prompt]);
    const state = createSessionState('s1', spec);

    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('after await');
  });

  it('advances past await when all children completed', async () => {
    const mockSpawner: ProcessSpawner = {
      async spawn() {
        return { pid: 1 };
      },
      async poll() {
        return { status: 'completed', variables: { result: 'ok' } };
      },
    };

    const awaitNode = createAwaitNode('aw1', 'all');
    const prompt = createPromptNode('p1', 'done');
    const spec = createFlowSpec('test', [awaitNode, prompt]);
    let state = createSessionState('s1', spec);
    state = updateSpawnedChild(state, 'fix-auth', {
      name: 'fix-auth',
      status: 'running',
      pid: 1,
      stateDir: '.prompt-language-fix-auth',
    });

    const { state: result, capturedPrompt } = await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      mockSpawner,
    );
    expect(capturedPrompt).toBe('done');
    expect(result.spawnedChildren['fix-auth']?.status).toBe('completed');
    expect(result.variables['fix-auth.result']).toBe('ok');
  });

  it('imports child variables with name prefix after await', async () => {
    const mockSpawner: ProcessSpawner = {
      async spawn() {
        return { pid: 1 };
      },
      async poll() {
        return {
          status: 'completed',
          variables: { last_exit_code: '0', last_stdout: 'hello' },
        };
      },
    };

    const awaitNode = createAwaitNode('aw1', 'task-a');
    const prompt = createPromptNode('p1', 'done');
    const spec = createFlowSpec('test', [awaitNode, prompt]);
    let state = createSessionState('s1', spec);
    state = updateSpawnedChild(state, 'task-a', {
      name: 'task-a',
      status: 'running',
      pid: 10,
      stateDir: '.prompt-language-task-a',
    });

    const { state: result } = await autoAdvanceNodes(state, undefined, undefined, mockSpawner);
    expect(result.variables['task-a.last_exit_code']).toBe('0');
    expect(result.variables['task-a.last_stdout']).toBe('hello');
  });

  it('does not advance when children are still running', async () => {
    const mockSpawner: ProcessSpawner = {
      async spawn() {
        return { pid: 1 };
      },
      async poll() {
        return { status: 'running' };
      },
    };

    const awaitNode = createAwaitNode('aw1', 'all');
    const spec = createFlowSpec('test', [awaitNode, createPromptNode('p1', 'done')]);
    let state = createSessionState('s1', spec);
    state = updateSpawnedChild(state, 'task-a', {
      name: 'task-a',
      status: 'running',
      pid: undefined,
      stateDir: '.prompt-language-task-a',
    });

    const { state: result, capturedPrompt } = await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      mockSpawner,
    );
    // Should not advance past await
    expect(capturedPrompt).toBeNull();
    expect(result.currentNodePath).toEqual([0]);
  });

  it('D6: warns when named await target does not match any spawned child', async () => {
    const mockSpawner: ProcessSpawner = {
      async spawn() {
        return { pid: 1 };
      },
      async poll() {
        return { status: 'running' };
      },
    };

    const awaitNode = createAwaitNode('aw1', 'nonexistent');
    const prompt = createPromptNode('p1', 'after');
    const spec = createFlowSpec('test', [awaitNode, prompt]);
    const state = createSessionState('s1', spec);

    const { state: result, capturedPrompt } = await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      mockSpawner,
    );
    expect(capturedPrompt).toBe('after');
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('does not match any spawned child')]),
    );
  });

  it('marks a running await child failed when its PID is gone', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(((
      pid: number,
      signal?: NodeJS.Signals | number,
    ) => {
      if (pid === 123 && signal === 0) {
        const error = new Error('ESRCH');
        (error as NodeJS.ErrnoException).code = 'ESRCH';
        throw error;
      }
      return true;
    }) as typeof process.kill);

    try {
      const mockSpawner: ProcessSpawner = {
        async spawn() {
          return { pid: 1 };
        },
        async poll() {
          return { status: 'running' };
        },
      };

      const awaitNode = createAwaitNode('aw1', 'all');
      const prompt = createPromptNode('p1', 'done');
      const spec = createFlowSpec('test', [awaitNode, prompt]);
      let state = createSessionState('s1', spec);
      state = updateSpawnedChild(state, 'task-a', {
        name: 'task-a',
        status: 'running',
        pid: 123,
        stateDir: '.prompt-language-task-a',
      });

      const { state: result } = await autoAdvanceNodes(state, undefined, undefined, mockSpawner);
      expect(result.spawnedChildren['task-a']?.status).toBe('failed');
    } finally {
      killSpy.mockRestore();
      platformSpy.mockRestore();
    }
  });

  it('D2: times out after MAX_AWAIT_POLLS and marks children failed', async () => {
    const mockSpawner: ProcessSpawner = {
      async spawn() {
        return { pid: 1 };
      },
      async poll() {
        return { status: 'running' };
      },
    };

    const awaitNode = createAwaitNode('aw1', 'all');
    const prompt = createPromptNode('p1', 'done');
    const spec = createFlowSpec('test', [awaitNode, prompt]);
    let state = createSessionState('s1', spec);
    state = updateSpawnedChild(state, 'task-a', {
      name: 'task-a',
      status: 'running',
      pid: undefined,
      stateDir: '.prompt-language-task-a',
    });
    // Simulate being at poll count = MAX_AWAIT_POLLS - 1 (next poll triggers timeout)
    state = {
      ...state,
      nodeProgress: {
        ...state.nodeProgress,
        aw1: { iteration: MAX_AWAIT_POLLS - 1, maxIterations: MAX_AWAIT_POLLS, status: 'running' },
      },
    };

    const { state: result, capturedPrompt } = await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      mockSpawner,
    );
    expect(capturedPrompt).toBe('done');
    expect(result.spawnedChildren['task-a']?.status).toBe('failed');
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('Await timeout')]),
    );
  });

  it('race node times out after its wall-clock limit', async () => {
    const mockSpawner: ProcessSpawner = {
      async spawn() {
        return { pid: 1 };
      },
      async poll() {
        return { status: 'running' };
      },
    };
    const raceChild = createSpawnNode('task-a', 'task-a', [createPromptNode('p1', 'inner')]);
    const raceNode = createRaceNode('race1', [raceChild], 1);
    const prompt = createPromptNode('p2', 'done');
    const spec = createFlowSpec('test', [raceNode, prompt]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      raceChildren: { race1: ['task-a'] },
      spawnedChildren: {
        'task-a': {
          name: 'task-a',
          status: 'running',
          pid: 1,
          stateDir: '.prompt-language-task-a',
        },
      },
      nodeProgress: {
        race1: {
          iteration: 1,
          maxIterations: MAX_AWAIT_POLLS,
          status: 'running',
          startedAt: Date.now() - 2000,
        },
      },
    };

    const { state: result, capturedPrompt } = await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      mockSpawner,
    );
    expect(capturedPrompt).toBe('done');
    expect(result.variables['race_winner']).toBe('');
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('Race node timed out after 1s')]),
    );
  });
});

// ── D4: renderNodeToDsl escaping ────────────────────────────────────

describe('autoAdvanceNodes — spawn body escaping (D4)', () => {
  it('escapes backslashes, quotes, and newlines in let literal values', async () => {
    const spawnedInputs: SpawnInput[] = [];
    const mockSpawner: ProcessSpawner = {
      async spawn(input) {
        spawnedInputs.push(input);
        return { pid: 42 };
      },
      async poll() {
        return { status: 'running' };
      },
    };

    const letNode = createLetNode('l1', 'msg', {
      type: 'literal',
      value: 'line1\nline2 "quoted" back\\slash',
    });
    const spawn = createSpawnNode('sp1', 'task', [letNode]);
    const spec = createFlowSpec('test', [spawn]);
    const state = createSessionState('s1', spec);

    await autoAdvanceNodes(state, undefined, undefined, mockSpawner);
    expect(spawnedInputs).toHaveLength(1);
    const flowText = spawnedInputs[0]!.flowText;
    // Should contain escaped versions
    expect(flowText).toContain('\\n');
    expect(flowText).toContain('\\"');
    expect(flowText).toContain('\\\\');
    // Should NOT contain raw newlines inside the let value
    expect(flowText).not.toMatch(/let msg = ".*\n.*"/);
  });
});

// ── D7: pid=0 spawn failure detection ───────────────────────────────

describe('autoAdvanceNodes — spawn failure (D7)', () => {
  it('marks child as failed and warns when spawn returns pid=0', async () => {
    const mockSpawner: ProcessSpawner = {
      async spawn() {
        return { pid: 0 };
      },
      async poll() {
        return { status: 'running' };
      },
    };

    const spawn = createSpawnNode('sp1', 'broken', [createPromptNode('p1', 'inner')]);
    const prompt = createPromptNode('p2', 'after');
    const spec = createFlowSpec('test', [spawn, prompt]);
    const state = createSessionState('s1', spec);

    const { state: result, capturedPrompt } = await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      mockSpawner,
    );
    expect(capturedPrompt).toBe('after');
    expect(result.spawnedChildren['broken']?.status).toBe('failed');
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('could not start child process')]),
    );
  });
});

// ── truncateOutput (>2000 chars) ────────────────────────────────────

describe('autoAdvanceNodes — truncateOutput', () => {
  it('truncates stdout longer than 2000 chars', async () => {
    const longOutput = 'x'.repeat(2500);
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: longOutput, stderr: '' }),
    };
    const spec = createFlowSpec('test', [
      createRunNode('r1', 'cmd'),
      createPromptNode('p1', 'done'),
    ]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state, runner);
    const stdout = result.variables['last_stdout'] as string;
    expect(stdout.length).toBeLessThan(longOutput.length);
    expect(stdout).toContain('... (truncated)');
  });

  it('truncates stderr longer than 2000 chars', async () => {
    const longErr = 'e'.repeat(2500);
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: '', stderr: longErr }),
    };
    const spec = createFlowSpec('test', [
      createRunNode('r1', 'cmd'),
      createPromptNode('p1', 'done'),
    ]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state, runner);
    const stderr = result.variables['last_stderr'] as string;
    expect(stderr.length).toBeLessThan(longErr.length);
    expect(stderr).toContain('... (truncated)');
  });
});

// ── H-LANG-001: let arithmetic ──────────────────────────────────────

describe('autoAdvanceNodes — let arithmetic', () => {
  it('evaluates arithmetic in literal and stores result as string', async () => {
    const spec = createFlowSpec('test', [
      createLetNode('l1', 'count', { type: 'literal', value: '3 + 5' }),
      createPromptNode('p1', 'done'),
    ]);
    const state = createSessionState('s1', spec);
    const { state: result } = await autoAdvanceNodes(state);
    expect(result.variables['count']).toBe('8');
  });

  it('evaluates arithmetic after variable interpolation', async () => {
    const spec = createFlowSpec('test', [
      createLetNode('l1', 'a', { type: 'literal', value: '3' }),
      createLetNode('l2', 'b', { type: 'literal', value: '5' }),
      createLetNode('l3', 'x', { type: 'literal', value: '${a} + ${b}' }),
      createPromptNode('p1', 'done'),
    ]);
    const state = createSessionState('s1', spec);
    const { state: result } = await autoAdvanceNodes(state);
    expect(result.variables['x']).toBe('8');
  });

  it('stores plain text as-is when not arithmetic', async () => {
    const spec = createFlowSpec('test', [
      createLetNode('l1', 'msg', { type: 'literal', value: 'hello world' }),
      createPromptNode('p1', 'done'),
    ]);
    const state = createSessionState('s1', spec);
    const { state: result } = await autoAdvanceNodes(state);
    expect(result.variables['msg']).toBe('hello world');
  });

  it('interpolates variables in literal even without arithmetic', async () => {
    const spec = createFlowSpec('test', [
      createLetNode('l1', 'name', { type: 'literal', value: 'world' }),
      createLetNode('l2', 'greeting', { type: 'literal', value: 'hello ${name}' }),
      createPromptNode('p1', 'done'),
    ]);
    const state = createSessionState('s1', spec);
    const { state: result } = await autoAdvanceNodes(state);
    expect(result.variables['greeting']).toBe('hello world');
  });
});

// ── let x = run (with and without commandRunner) ────────────────────

describe('autoAdvanceNodes — let run', () => {
  it('stays at path when commandRunner is not provided for let=run', async () => {
    const letRun = createLetNode('l1', 'result', { type: 'run', command: 'echo hello' });
    const spec = createFlowSpec('test', [letRun]);
    const state = createSessionState('s1', spec);

    const { state: result, capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBeNull();
    expect(result.currentNodePath).toEqual([0]);
  });

  it('executes command and stores stdout for let=run', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: 'hello world\n', stderr: '' }),
    };
    const letRun = createLetNode('l1', 'output', { type: 'run', command: 'echo hello world' });
    const spec = createFlowSpec('test', [letRun, createPromptNode('p1', 'done')]);
    const state = createSessionState('s1', spec);

    const { state: result, capturedPrompt } = await autoAdvanceNodes(state, runner);
    expect(result.variables['output']).toBe('hello world');
    expect(result.variables['command_succeeded']).toBe(true);
    expect(capturedPrompt).toBe('done');
  });

  it('jumps to catch when let=run fails inside try', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: '', stderr: 'fail' }),
    };
    const letRun = createLetNode('l1', 'x', { type: 'run', command: 'bad-cmd' });
    const tryNode = createTryNode('t1', [letRun], 'command_failed', [
      createPromptNode('p1', 'caught'),
    ]);
    const spec = createFlowSpec('test', [tryNode]);
    const state = createSessionState('s1', spec);

    const { state: result, capturedPrompt } = await autoAdvanceNodes(state, runner);
    expect(capturedPrompt).toBe('caught');
    expect(result.variables['command_failed']).toBe(true);
  });
});

// ── let x += (append) ──────────────────────────────────────────────

describe('autoAdvanceNodes — let append', () => {
  it('let x += "val" appends to list and sets x_length', async () => {
    const spec = createFlowSpec('test', [
      createLetNode('l1', 'items', { type: 'empty_list' }),
      createLetNode('l2', 'items', { type: 'literal', value: 'alpha' }, true),
      createLetNode('l3', 'items', { type: 'literal', value: 'beta' }, true),
      createPromptNode('p1', 'done'),
    ]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state);
    expect(result.variables['items_length']).toBe(2);
    const items = JSON.parse(result.variables['items'] as string);
    expect(items).toEqual(['alpha', 'beta']);
  });

  it('let x = [] sets x_length to 0', async () => {
    const spec = createFlowSpec('test', [
      createLetNode('l1', 'arr', { type: 'empty_list' }),
      createPromptNode('p1', 'done'),
    ]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state);
    expect(result.variables['arr']).toBe('[]');
    expect(result.variables['arr_length']).toBe(0);
  });
});

// ── let x = prompt (two-phase capture) ──────────────────────────────

describe('autoAdvanceNodes — let prompt capture', () => {
  it('emits capture meta-prompt on first visit', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };
    const letPrompt = createLetNode('l1', 'answer', { type: 'prompt', text: 'What color?' });
    const spec = createFlowSpec('test', [letPrompt]);
    const state = createSessionState('s1', spec);

    const { capturedPrompt, state: result } = await autoAdvanceNodes(
      state,
      undefined,
      captureReader,
    );
    expect(capturedPrompt).toContain('What color?');
    expect(capturedPrompt).toContain('.prompt-language/vars/');
    expect(result.nodeProgress['l1']?.status).toBe('awaiting_capture');
    expect(captureReader.clear).toHaveBeenCalledWith('answer');
  });

  it('reads captured value on second visit', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue('blue'),
      clear: vi.fn(),
    };
    const letPrompt = createLetNode('l1', 'answer', { type: 'prompt', text: 'What color?' });
    const spec = createFlowSpec('test', [letPrompt, createPromptNode('p1', 'Got: ${answer}')]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'l1', {
      iteration: 1,
      maxIterations: 3,
      status: 'awaiting_capture',
    });

    const { capturedPrompt, state: result } = await autoAdvanceNodes(
      state,
      undefined,
      captureReader,
    );
    expect(result.variables['answer']).toBe('blue');
    expect(capturedPrompt).toBe('Got: blue');
    expect(captureReader.clear).toHaveBeenCalledWith('answer');
  });

  it('retries capture when read returns null (not at max)', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };
    const letPrompt = createLetNode('l1', 'answer', { type: 'prompt', text: 'Question' });
    const spec = createFlowSpec('test', [letPrompt]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'l1', {
      iteration: 1,
      maxIterations: 3,
      status: 'awaiting_capture',
    });

    const { capturedPrompt, state: result } = await autoAdvanceNodes(
      state,
      undefined,
      captureReader,
    );
    expect(capturedPrompt).toContain('was not found');
    expect(result.nodeProgress['l1']?.iteration).toBe(2);
  });

  it('uses empty string after max capture retries exhausted', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };
    const letPrompt = createLetNode('l1', 'answer', { type: 'prompt', text: 'Question' });
    const spec = createFlowSpec('test', [letPrompt, createPromptNode('p1', 'next')]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'l1', {
      iteration: 3,
      maxIterations: 3,
      status: 'awaiting_capture',
    });

    const { state: result, capturedPrompt } = await autoAdvanceNodes(
      state,
      undefined,
      captureReader,
    );
    expect(result.variables['answer']).toBe('');
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('failed after 3 attempts')]),
    );
    expect(capturedPrompt).toBe('next');
  });

  it('let prompt without captureReader emits prompt then stalls on retry', async () => {
    const letPrompt = createLetNode('l1', 'answer', { type: 'prompt', text: 'Ask' });
    const spec = createFlowSpec('test', [letPrompt]);
    const state = createSessionState('s1', spec);

    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toContain('Ask');
  });
});

// ── run node without commandRunner ──────────────────────────────────

describe('autoAdvanceNodes — run without commandRunner', () => {
  it('stays at path when no commandRunner provided for run node', async () => {
    const spec = createFlowSpec('test', [createRunNode('r1', 'echo hi')]);
    const state = createSessionState('s1', spec);

    const { state: result, capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBeNull();
    expect(result.currentNodePath).toEqual([0]);
  });
});

// ── renderNodeToDsl coverage via spawn body ─────────────────────────

describe('autoAdvanceNodes — renderNodeToDsl via spawn', () => {
  const captureSpawnFlowText = async (body: import('../domain/flow-node.js').FlowNode[]) => {
    const spawnedInputs: SpawnInput[] = [];
    const mockSpawner: ProcessSpawner = {
      async spawn(input) {
        spawnedInputs.push(input);
        return { pid: 42 };
      },
      async poll() {
        return { status: 'running' };
      },
    };
    const spawn = createSpawnNode('sp1', 'task', body);
    const spec = createFlowSpec('test', [spawn]);
    const state = createSessionState('s1', spec);
    await autoAdvanceNodes(state, undefined, undefined, mockSpawner);
    return spawnedInputs[0]!.flowText;
  };

  it('renders let = prompt', async () => {
    const text = await captureSpawnFlowText([
      createLetNode('l1', 'x', { type: 'prompt', text: 'ask something' }),
    ]);
    expect(text).toContain('let x = prompt "ask something"');
  });

  it('renders let = run', async () => {
    const text = await captureSpawnFlowText([
      createLetNode('l1', 'x', { type: 'run', command: 'echo hi' }),
    ]);
    expect(text).toContain('let x = run "echo hi"');
  });

  it('renders let = []', async () => {
    const text = await captureSpawnFlowText([createLetNode('l1', 'x', { type: 'empty_list' })]);
    expect(text).toContain('let x = []');
  });

  it('renders let += (append)', async () => {
    const text = await captureSpawnFlowText([
      createLetNode('l1', 'x', { type: 'literal', value: 'val' }, true),
    ]);
    expect(text).toContain('let x += "val"');
  });

  it('renders break node', async () => {
    const text = await captureSpawnFlowText([createBreakNode('b1')]);
    expect(text).toContain('break');
  });

  it('renders while node', async () => {
    const text = await captureSpawnFlowText([
      createWhileNode('w1', 'flag', [createPromptNode('p1', 'work')], 3),
    ]);
    expect(text).toContain('while flag max 3');
    expect(text).toContain('prompt: work');
    expect(text).toContain('end');
  });

  it('renders until node', async () => {
    const text = await captureSpawnFlowText([
      createUntilNode('u1', 'done', [createPromptNode('p1', 'try')], 5),
    ]);
    expect(text).toContain('until done max 5');
    expect(text).toContain('prompt: try');
    expect(text).toContain('end');
  });

  it('renders retry node', async () => {
    const text = await captureSpawnFlowText([
      createRetryNode('re1', [createRunNode('r1', 'build')], 3),
    ]);
    expect(text).toContain('retry max 3');
    expect(text).toContain('run: build');
    expect(text).toContain('end');
  });

  it('renders if/else node', async () => {
    const text = await captureSpawnFlowText([
      createIfNode(
        'i1',
        'command_failed',
        [createPromptNode('p1', 'fix')],
        [createPromptNode('p2', 'ok')],
      ),
    ]);
    expect(text).toContain('if command_failed');
    expect(text).toContain('prompt: fix');
    expect(text).toContain('else');
    expect(text).toContain('prompt: ok');
    expect(text).toContain('end');
  });

  it('renders if without else', async () => {
    const text = await captureSpawnFlowText([
      createIfNode('i1', 'flag', [createPromptNode('p1', 'yes')]),
    ]);
    expect(text).toContain('if flag');
    expect(text).not.toContain('else');
  });

  it('renders try/catch/finally node', async () => {
    const text = await captureSpawnFlowText([
      createTryNode(
        't1',
        [createRunNode('r1', 'build')],
        'command_failed',
        [createPromptNode('p1', 'handle')],
        [createRunNode('r2', 'cleanup')],
      ),
    ]);
    expect(text).toContain('try');
    expect(text).toContain('run: build');
    expect(text).toContain('catch command_failed');
    expect(text).toContain('prompt: handle');
    expect(text).toContain('finally');
    expect(text).toContain('run: cleanup');
    expect(text).toContain('end');
  });

  it('renders try without catch or finally', async () => {
    const text = await captureSpawnFlowText([
      createTryNode('t1', [createRunNode('r1', 'cmd')], 'command_failed', []),
    ]);
    expect(text).toContain('try');
    expect(text).not.toContain('catch');
    expect(text).not.toContain('finally');
  });

  it('renders foreach node', async () => {
    const text = await captureSpawnFlowText([
      createForeachNode('fe1', 'item', 'a b c', [createPromptNode('p1', '${item}')]),
    ]);
    expect(text).toContain('foreach item in a b c');
    expect(text).toContain('prompt: ${item}');
    expect(text).toContain('end');
  });

  it('renders nested spawn node', async () => {
    const text = await captureSpawnFlowText([
      createSpawnNode('sp2', 'inner-task', [createRunNode('r1', 'test')]),
    ]);
    expect(text).toContain('spawn "inner-task"');
    expect(text).toContain('run: test');
    expect(text).toContain('end');
  });

  it('renders await all', async () => {
    const text = await captureSpawnFlowText([createAwaitNode('aw1', 'all')]);
    expect(text).toContain('await all');
  });

  it('renders await named', async () => {
    const text = await captureSpawnFlowText([createAwaitNode('aw1', 'subtask')]);
    expect(text).toContain('await "subtask"');
  });
});

// ── if node branching edge cases ────────────────────────────────────

describe('autoAdvanceNodes — if node branching', () => {
  it('enters then-branch when condition is true', async () => {
    const spec = createFlowSpec('test', [
      createIfNode(
        'i1',
        'flag',
        [createPromptNode('p1', 'then-branch')],
        [createPromptNode('p2', 'else-branch')],
      ),
    ]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { flag: true } };

    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('then-branch');
  });

  it('enters else-branch when condition is false', async () => {
    const spec = createFlowSpec('test', [
      createIfNode(
        'i1',
        'flag',
        [createPromptNode('p1', 'then-branch')],
        [createPromptNode('p2', 'else-branch')],
      ),
    ]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { flag: false } };

    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('else-branch');
  });

  it('skips past if when condition is false and no else-branch', async () => {
    const spec = createFlowSpec('test', [
      createIfNode('i1', 'flag', [createPromptNode('p1', 'then-branch')]),
      createPromptNode('p2', 'after-if'),
    ]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { flag: false } };

    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('after-if');
  });

  it('returns null capturedPrompt when if condition is unresolvable', async () => {
    const spec = createFlowSpec('test', [
      createIfNode('i1', 'unknown_var', [createPromptNode('p1', 'work')]),
    ]);
    const state = createSessionState('s1', spec);

    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBeNull();
  });
});

// ── while/until condition loop entry edge cases ─────────────────────

describe('autoAdvanceNodes — condition loop entry edge cases', () => {
  it('while skips body when condition is false', async () => {
    const spec = createFlowSpec('test', [
      createWhileNode('w1', 'flag', [createPromptNode('p1', 'inner')], 3),
      createPromptNode('p2', 'after-while'),
    ]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { flag: false } };

    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('after-while');
  });

  it('until skips body when condition is already true', async () => {
    const spec = createFlowSpec('test', [
      createUntilNode('u1', 'done', [createPromptNode('p1', 'inner')], 3),
      createPromptNode('p2', 'after-until'),
    ]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { done: true } };

    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('after-until');
  });
});

// ── retry first entry ───────────────────────────────────────────────

describe('autoAdvanceNodes — retry first entry', () => {
  it('enters retry body on first encounter and sets iteration 1', async () => {
    const spec = createFlowSpec('test', [
      createRetryNode('re1', [createPromptNode('p1', 'attempt')], 3),
    ]);
    const state = createSessionState('s1', spec);

    const { capturedPrompt, state: result } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('attempt');
    expect(result.nodeProgress['re1']?.iteration).toBe(1);
    expect(result.nodeProgress['re1']?.status).toBe('running');
  });
});

// ── try first entry ─────────────────────────────────────────────────

describe('autoAdvanceNodes — try first entry', () => {
  it('enters try body on first encounter', async () => {
    const spec = createFlowSpec('test', [
      createTryNode('t1', [createPromptNode('p1', 'try-body')], 'command_failed', [
        createPromptNode('p2', 'catch-body'),
      ]),
    ]);
    const state = createSessionState('s1', spec);

    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('try-body');
  });
});

// ── await all with empty spawnedChildren ────────────────────────────

describe('autoAdvanceNodes — await edge cases', () => {
  it('await all with no spawned children advances immediately', async () => {
    const mockSpawner: ProcessSpawner = {
      async spawn() {
        return { pid: 1 };
      },
      async poll() {
        return { status: 'running' };
      },
    };

    const awaitNode = createAwaitNode('aw1', 'all');
    const prompt = createPromptNode('p1', 'after');
    const spec = createFlowSpec('test', [awaitNode, prompt]);
    const state = createSessionState('s1', spec);

    const { capturedPrompt } = await autoAdvanceNodes(state, undefined, undefined, mockSpawner);
    expect(capturedPrompt).toBe('after');
  });

  it('await skips already-completed children without polling', async () => {
    const pollFn = vi.fn();
    const mockSpawner: ProcessSpawner = {
      async spawn() {
        return { pid: 1 };
      },
      async poll() {
        pollFn();
        return { status: 'running' };
      },
    };

    const awaitNode = createAwaitNode('aw1', 'all');
    const prompt = createPromptNode('p1', 'done');
    const spec = createFlowSpec('test', [awaitNode, prompt]);
    let state = createSessionState('s1', spec);
    state = updateSpawnedChild(state, 'child-a', {
      name: 'child-a',
      status: 'completed',
      pid: 1,
      stateDir: '.prompt-language-child-a',
    });

    const { capturedPrompt } = await autoAdvanceNodes(state, undefined, undefined, mockSpawner);
    expect(capturedPrompt).toBe('done');
    expect(pollFn).not.toHaveBeenCalled();
  });

  it('await skips already-failed children without polling', async () => {
    const pollFn = vi.fn();
    const mockSpawner: ProcessSpawner = {
      async spawn() {
        return { pid: 1 };
      },
      async poll() {
        pollFn();
        return { status: 'running' };
      },
    };

    const awaitNode = createAwaitNode('aw1', 'task-a');
    const prompt = createPromptNode('p1', 'done');
    const spec = createFlowSpec('test', [awaitNode, prompt]);
    let state = createSessionState('s1', spec);
    state = updateSpawnedChild(state, 'task-a', {
      name: 'task-a',
      status: 'failed',
      pid: 1,
      stateDir: '.prompt-language-task-a',
    });

    const { capturedPrompt } = await autoAdvanceNodes(state, undefined, undefined, mockSpawner);
    expect(capturedPrompt).toBe('done');
    expect(pollFn).not.toHaveBeenCalled();
  });
});

// ── body exhaustion inside spawn ────────────────────────────────────

describe('autoAdvanceNodes — spawn body exhaustion', () => {
  it('advances past spawn when body exhausted (via handleBodyExhaustion)', async () => {
    const spec = createFlowSpec('test', [
      createSpawnNode('sp1', 'task', [createPromptNode('p1', 'inner')]),
      createPromptNode('p2', 'after'),
    ]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [0, 1] };

    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('after');
  });
});

// ── let += run (append from command) ────────────────────────────────

describe('autoAdvanceNodes — let append run', () => {
  it('appends command output to list variable', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: 'new-item\n', stderr: '' }),
    };
    const spec = createFlowSpec('test', [
      createLetNode('l1', 'items', { type: 'empty_list' }),
      createLetNode('l2', 'items', { type: 'run', command: 'echo new-item' }, true),
      createPromptNode('p1', 'done'),
    ]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state, runner);
    expect(result.variables['items_length']).toBe(1);
    const items = JSON.parse(result.variables['items'] as string);
    expect(items).toEqual(['new-item']);
  });
});

// ── H-LANG-002: Continue node advancement ───────────────────────────

describe('autoAdvanceNodes — continue', () => {
  it('continue skips rest of foreach body and advances to next item', async () => {
    const fe = createForeachNode(
      'f1',
      'x',
      'a b c',
      [
        createLetNode('l1', 'marker', { type: 'literal', value: '${x}' }),
        createContinueNode('c1'),
        createLetNode('l2', 'never', { type: 'literal', value: 'oops' }),
      ],
      50,
    );
    const spec = createFlowSpec('test', [
      fe,
      createLetNode('l3', 'after', { type: 'literal', value: 'yes' }),
    ]);
    const state = createSessionState('s1', spec);

    // Process all items — continue should skip l2 each time
    const r1 = await autoAdvanceNodes(state);
    // marker is set to interpolated ${x} on each iteration; last value is 'c'
    expect(r1.state.variables['marker']).toBe('c');
    // 'never' should not be set since continue skips it
    expect(r1.state.variables['never']).toBeUndefined();
  });

  it('continue exits while loop when condition becomes false', async () => {
    const wh = createWhileNode(
      'w1',
      'flag',
      [createContinueNode('c1'), createLetNode('l1', 'never', { type: 'literal', value: 'oops' })],
      5,
    );
    const spec = createFlowSpec('test', [
      wh,
      createLetNode('l2', 'after', { type: 'literal', value: 'done' }),
    ]);
    let state = createSessionState('s1', spec);
    // flag is true initially so while enters, continue triggers re-evaluation
    // On re-entry, flag will still be true but iteration increments
    // Set flag to false so the loop exits on the re-evaluation after continue
    state = { ...state, variables: { flag: false } };

    const { state: result } = await autoAdvanceNodes(state);
    // while condition is false on entry, should skip body entirely
    expect(result.variables['after']).toBe('done');
    expect(result.variables['never']).toBeUndefined();
  });

  it('continue re-enters while loop body when condition is true', async () => {
    const wh = createWhileNode(
      'w1',
      'flag',
      [
        createLetNode('l1', 'count', { type: 'literal', value: 'hit' }),
        createContinueNode('c1'),
        createLetNode('l2', 'skip', { type: 'literal', value: 'no' }),
      ],
      3,
    );
    const spec = createFlowSpec('test', [wh]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { flag: true } };

    // Enter while, set count=hit, continue -> re-evaluate -> true -> re-enter body
    // This should keep looping until max iterations
    const { state: result } = await autoAdvanceNodes(state);
    expect(result.variables['count']).toBe('hit');
    expect(result.variables['skip']).toBeUndefined();
    // Should have reached max iterations (3)
    expect(result.nodeProgress['w1']?.iteration).toBe(3);
  });

  it('continue works inside until loop', async () => {
    const ut = createUntilNode(
      'u1',
      'done_flag',
      [createContinueNode('c1'), createLetNode('l1', 'never', { type: 'literal', value: 'no' })],
      3,
    );
    const spec = createFlowSpec('test', [
      ut,
      createLetNode('l2', 'after', { type: 'literal', value: 'yes' }),
    ]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { done_flag: false } };

    const { state: result } = await autoAdvanceNodes(state);
    // Until loop should run until max iterations since done_flag stays false
    expect(result.variables['never']).toBeUndefined();
    expect(result.nodeProgress['u1']?.iteration).toBe(3);
  });

  it('continue works inside retry loop', async () => {
    const rt = createRetryNode(
      'r1',
      [createContinueNode('c1'), createLetNode('l1', 'never', { type: 'literal', value: 'no' })],
      3,
    );
    const spec = createFlowSpec('test', [
      rt,
      createLetNode('l2', 'after', { type: 'literal', value: 'yes' }),
    ]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { command_failed: true } };

    const { state: result } = await autoAdvanceNodes(state);
    expect(result.variables['never']).toBeUndefined();
    expect(result.nodeProgress['r1']?.iteration).toBe(3);
  });

  it('continue outside loop just advances past continue', async () => {
    const spec = createFlowSpec('test', [
      createContinueNode('c1'),
      createLetNode('l1', 'after', { type: 'literal', value: 'yes' }),
    ]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state);
    expect(result.variables['after']).toBe('yes');
  });

  it('continue inside nested if within loop skips to next iteration', async () => {
    const wh = createWhileNode(
      'w1',
      'flag',
      [
        createIfNode('i1', 'flag', [createContinueNode('c1')]),
        createLetNode('l1', 'skip', { type: 'literal', value: 'no' }),
      ],
      3,
    );
    const spec = createFlowSpec('test', [wh]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { flag: true } };

    const { state: result } = await autoAdvanceNodes(state);
    // Continue inside if should skip the let node after the if
    expect(result.variables['skip']).toBeUndefined();
    expect(result.nodeProgress['w1']?.iteration).toBe(3);
  });
});

// ── H-LANG-006: Condition defaults via interpolation ────────────────

describe('evaluateFlowCondition — interpolation', () => {
  it('resolves ${var:-default} in condition before evaluation', async () => {
    // ${status:-pending} == "ready" with empty variables should resolve to
    // pending == "ready" which is false
    const result = await evaluateFlowCondition('${status:-pending} == "ready"', {});
    expect(result).toBe(false);
  });

  it('resolves ${var:-default} to variable value when present', async () => {
    const result = await evaluateFlowCondition('${status:-pending} == "ready"', {
      status: 'ready',
    });
    expect(result).toBe(true);
  });

  it('resolves ${var} in condition to variable value', async () => {
    const result = await evaluateFlowCondition('${count} > 0', { count: 5 });
    expect(result).toBe(true);
  });

  it('${var:-default} with numeric comparison', async () => {
    const result = await evaluateFlowCondition('${limit:-10} > 5', {});
    expect(result).toBe(true);
  });

  it('interpolation preserves plain conditions (no ${} refs)', async () => {
    const result = await evaluateFlowCondition('command_failed', { command_failed: true });
    expect(result).toBe(true);
  });
});

// ── Edge cases: stale-state detection ────────────────────────────────

describe('autoAdvanceNodes — stale-state detection', () => {
  it('breaks loop when prompt node does not change path (waiting for input)', async () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'Please respond')]);
    const state = createSessionState('s1', spec);

    const { state: result, capturedPrompt } = await autoAdvanceNodes(state);
    // Prompt should be captured (not infinite loop)
    expect(capturedPrompt).toBe('Please respond');
    // Path should have advanced past the prompt
    expect(result.currentNodePath).toEqual([1]);
  });

  it('processes many sequential let nodes followed by a prompt without stale detection', async () => {
    const lets = Array.from({ length: 7 }, (_, i) =>
      createLetNode(`l${i}`, `v${i}`, { type: 'literal', value: `val-${i}` }),
    );
    const spec = createFlowSpec('test', [...lets, createPromptNode('p1', 'All done')]);
    const state = createSessionState('s1', spec);

    const { state: result, capturedPrompt } = await autoAdvanceNodes(state);
    // All 7 let variables should be set
    for (let i = 0; i < 7; i++) {
      expect(result.variables[`v${i}`]).toBe(`val-${i}`);
    }
    // Prompt should be captured
    expect(capturedPrompt).toBe('All done');
    // No stale-state or MAX_ADVANCES warnings
    expect(result.warnings).not.toEqual(
      expect.arrayContaining([expect.stringContaining('Flow paused')]),
    );
  });
});

// ── Edge cases: deeply nested break ──────────────────────────────────

describe('autoAdvanceNodes — deeply nested break', () => {
  it('break inside if inside while exits the while loop', async () => {
    const wh = createWhileNode(
      'w1',
      'flag',
      [
        createIfNode('i1', 'flag', [createBreakNode('b1')]),
        createLetNode('l1', 'never', { type: 'literal', value: 'x' }),
      ],
      5,
    );
    const spec = createFlowSpec('test', [
      wh,
      createLetNode('l2', 'after', { type: 'literal', value: 'done' }),
    ]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { flag: true } };

    const { state: result } = await autoAdvanceNodes(state);
    // Break should have exited while — 'never' should not be set
    expect(result.variables['never']).toBeUndefined();
    // Code after while should have executed
    expect(result.variables['after']).toBe('done');
  });
});

// ── Edge cases: try → finally (no catch) ─────────────────────────────

describe('autoAdvanceNodes — try/finally without catch', () => {
  it('finally executes after successful body when no catch body exists', async () => {
    const runner: CommandRunner = {
      run: async (cmd: string) => {
        return { exitCode: 0, stdout: cmd, stderr: '' };
      },
    };
    const tryNode = createTryNode(
      't1',
      [createRunNode('r1', 'body-ok')],
      'command_failed',
      [], // no catch body
      [createLetNode('lf', 'cleanup', { type: 'literal', value: 'cleaned' })],
    );
    const spec = createFlowSpec('test', [
      tryNode,
      createLetNode('l2', 'after', { type: 'literal', value: 'past-try' }),
    ]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state, runner);
    // Finally body let should have executed
    expect(result.variables['cleanup']).toBe('cleaned');
    // Should have advanced past try
    expect(result.variables['after']).toBe('past-try');
  });
});

// ── Edge cases: try → catch → finally ordering ──────────────────────

describe('autoAdvanceNodes — try/catch/finally ordering', () => {
  it('catch and finally both execute when body fails', async () => {
    const runner: CommandRunner = {
      run: async (cmd: string) => {
        if (cmd === 'fail-cmd') {
          return { exitCode: 1, stdout: '', stderr: 'error' };
        }
        return { exitCode: 0, stdout: cmd, stderr: '' };
      },
    };
    const tryNode = createTryNode(
      't1',
      [createRunNode('r1', 'fail-cmd')],
      'command_failed',
      [createLetNode('lc', 'caught', { type: 'literal', value: 'yes' })],
      [createLetNode('lf', 'finalized', { type: 'literal', value: 'yes' })],
    );
    const spec = createFlowSpec('test', [tryNode]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state, runner);
    // Both catch and finally lets should have executed
    expect(result.variables['caught']).toBe('yes');
    expect(result.variables['finalized']).toBe('yes');
  });
});

// ── Edge cases: foreach single-item and empty iterable ───────────────

describe('autoAdvanceNodes — foreach edge cases (single/empty)', () => {
  it('foreach with single-item iterable iterates once', async () => {
    const foreachNode = createForeachNode('fe1', 'x', 'solo', [
      createPromptNode('p1', 'item: ${x}'),
    ]);
    const promptAfter = createPromptNode('p2', 'Done');
    const spec = createFlowSpec('test', [foreachNode, promptAfter]);
    const state = createSessionState('s1', spec);

    // First call: enters foreach with x=solo
    const r1 = await autoAdvanceNodes(state);
    expect(r1.capturedPrompt).toBe('item: solo');
    expect(r1.state.variables['x']).toBe('solo');

    // Second call: body exhausted, no more items, advance past foreach
    const r2 = await autoAdvanceNodes(r1.state);
    expect(r2.capturedPrompt).toBe('Done');
  });

  it('foreach with empty string skips body entirely', async () => {
    const foreachNode = createForeachNode('fe1', 'x', '', [
      createPromptNode('p1', 'should not appear'),
    ]);
    const promptAfter = createPromptNode('p2', 'Skipped');
    const spec = createFlowSpec('test', [foreachNode, promptAfter]);
    const state = createSessionState('s1', spec);

    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('Skipped');
  });
});

// ── Edge cases: spawn body exhaustion ────────────────────────────────

describe('autoAdvanceNodes — spawn body exhaustion edge case', () => {
  it('advances past spawn when path is beyond body end', async () => {
    const spawn = createSpawnNode('sp1', 'task', [
      createLetNode('l1', 'inner', { type: 'literal', value: 'val' }),
    ]);
    const spec = createFlowSpec('test', [
      spawn,
      createLetNode('l2', 'after', { type: 'literal', value: 'yes' }),
    ]);
    let state = createSessionState('s1', spec);
    // Set path to [0, 1] — past the single body node
    state = { ...state, currentNodePath: [0, 1] };

    const { state: result } = await autoAdvanceNodes(state);
    // Should have advanced past spawn and executed the let after it
    expect(result.variables['after']).toBe('yes');
  });
});

// ── H-LANG-005: Pipe transforms ──────────────────────────────────────

describe('autoAdvanceNodes — pipe transforms', () => {
  it('applies trim transform to let=run output', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: '  hello world  \n', stderr: '' }),
    };
    const spec = createFlowSpec('test', [
      createLetNode('l1', 'result', { type: 'run', command: 'echo hello' }, false, 'trim'),
      createPromptNode('p1', 'done'),
    ]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state, runner);
    expect(result.variables['result']).toBe('hello world');
  });

  it('applies upper transform to let=run output', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: 'hello\n', stderr: '' }),
    };
    const spec = createFlowSpec('test', [
      createLetNode('l1', 'result', { type: 'run', command: 'echo' }, false, 'upper'),
      createPromptNode('p1', 'done'),
    ]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state, runner);
    expect(result.variables['result']).toBe('HELLO');
  });

  it('applies lower transform to literal', async () => {
    const spec = createFlowSpec('test', [
      createLetNode('l1', 'result', { type: 'literal', value: 'HELLO' }, false, 'lower'),
      createPromptNode('p1', 'done'),
    ]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state);
    expect(result.variables['result']).toBe('hello');
  });

  it('applies first transform to multi-line output', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: 'line1\nline2\nline3\n', stderr: '' }),
    };
    const spec = createFlowSpec('test', [
      createLetNode('l1', 'result', { type: 'run', command: 'cmd' }, false, 'first'),
      createPromptNode('p1', 'done'),
    ]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state, runner);
    expect(result.variables['result']).toBe('line1');
  });

  it('applies last transform to multi-line output', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: 'line1\nline2\nline3\n', stderr: '' }),
    };
    const spec = createFlowSpec('test', [
      createLetNode('l1', 'result', { type: 'run', command: 'cmd' }, false, 'last'),
      createPromptNode('p1', 'done'),
    ]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state, runner);
    expect(result.variables['result']).toBe('line3');
  });

  it('no transform when not specified', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: '  spaced  \n', stderr: '' }),
    };
    const spec = createFlowSpec('test', [
      createLetNode('l1', 'result', { type: 'run', command: 'cmd' }),
      createPromptNode('p1', 'done'),
    ]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state, runner);
    // trimEnd is always applied to run output, but leading spaces remain
    expect(result.variables['result']).toBe('  spaced');
  });
});

// ── H-LANG-007: foreach with run command ──────────────────────────────

describe('autoAdvanceNodes — foreach with listCommand', () => {
  it('executes command and iterates over output items', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: 'alpha\nbeta\ngamma\n', stderr: '' }),
    };
    const foreachNode = createForeachNode(
      'fe1',
      'item',
      '',
      [createPromptNode('p1', 'process ${item}')],
      50,
      undefined,
      'ls -1',
    );
    const spec = createFlowSpec('test', [foreachNode, createPromptNode('p2', 'Done')]);
    const state = createSessionState('s1', spec);

    const r1 = await autoAdvanceNodes(state, runner);
    expect(r1.capturedPrompt).toBe('process alpha');

    const r2 = await autoAdvanceNodes(r1.state, runner);
    expect(r2.capturedPrompt).toBe('process beta');

    const r3 = await autoAdvanceNodes(r2.state, runner);
    expect(r3.capturedPrompt).toBe('process gamma');

    const r4 = await autoAdvanceNodes(r3.state, runner);
    expect(r4.capturedPrompt).toBe('Done');
  });

  it('stays at path when no commandRunner provided for foreach run', async () => {
    const foreachNode = createForeachNode(
      'fe1',
      'item',
      '',
      [createPromptNode('p1', '${item}')],
      50,
      undefined,
      'ls -1',
    );
    const spec = createFlowSpec('test', [foreachNode]);
    const state = createSessionState('s1', spec);

    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBeNull();
  });

  it('skips foreach when command output is empty', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    };
    const foreachNode = createForeachNode(
      'fe1',
      'item',
      '',
      [createPromptNode('p1', '${item}')],
      50,
      undefined,
      'echo',
    );
    const spec = createFlowSpec('test', [foreachNode, createPromptNode('p2', 'Skipped')]);
    const state = createSessionState('s1', spec);

    const { capturedPrompt } = await autoAdvanceNodes(state, runner);
    expect(capturedPrompt).toBe('Skipped');
  });
});

// ── H-REL-004: Retry exponential backoff ──────────────────────────────

describe('autoAdvanceNodes — retry backoff', () => {
  it('sets _retry_backoff_seconds on re-loop when backoff configured', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: '', stderr: '' }),
    };
    const retryNode = createRetryNode(
      're1',
      [createRunNode('r1', 'build')],
      3,
      undefined,
      undefined,
      2000,
    );
    const spec = createFlowSpec('test', [retryNode]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      variables: { command_failed: true },
      currentNodePath: [0, 1], // past body end
      nodeProgress: { re1: { iteration: 1, maxIterations: 3, status: 'running' } },
    };

    const { state: result } = await autoAdvanceNodes(state, runner);
    // autoAdvanceNodes runs all iterations: final backoff = 2000 * 2^(2-1) = 4000ms,
    // but last re-loop sets iteration 3 which hits max, so last set value is iteration 2: 2000*2^1/1000=4
    // Wait — iteration starts at 1, run fails, exhaust sets backoff at iter 1 (=2s), re-enter at iter 2,
    // run fails, exhaust sets backoff at iter 2 (=4s), re-enter at iter 3 but 3 >= max 3 so exits.
    // Last backoff set was at iter 2: 2000*2^(2-1)/1000 = 4, but iter 3 tries to re-loop,
    // shouldReLoop=true but iteration(3) >= max(3), exits without setting backoff again.
    // Actually: iter 1 → backoff=2s, handleLoopReentry increments to 2 and re-enters
    // iter 2 → run, fail, exhaust → backoff=2000*2^(2-1)/1000=4, re-enter at iter 3
    // iter 3 → run, fail, exhaust → backoff=2000*2^(3-1)/1000=8, but handleLoopReentry says 3 >= 3 → exit
    // The last _retry_backoff_seconds = 8
    expect(result.variables['_retry_backoff_seconds']).toBe(8);
  });

  it('doubles backoff on subsequent iterations', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: '', stderr: '' }),
    };
    const retryNode = createRetryNode(
      're1',
      [createRunNode('r1', 'build')],
      5,
      undefined,
      undefined,
      1000,
    );
    const spec = createFlowSpec('test', [retryNode]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      variables: { command_failed: true },
      currentNodePath: [0, 1],
      nodeProgress: { re1: { iteration: 3, maxIterations: 5, status: 'running' } },
    };

    const { state: result } = await autoAdvanceNodes(state, runner);
    // autoAdvanceNodes runs remaining iterations from 3 to 5 (max):
    // iter 3 → backoff=1000*2^(3-1)/1000=4, re-enter iter 4
    // iter 4 → backoff=1000*2^(4-1)/1000=8, re-enter iter 5
    // iter 5 → backoff=1000*2^(5-1)/1000=16, but 5 >= max 5 → exit
    // Last _retry_backoff_seconds = 16
    expect(result.variables['_retry_backoff_seconds']).toBe(16);
  });

  it('caps backoff at 60s', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: '', stderr: '' }),
    };
    const retryNode = createRetryNode(
      're1',
      [createRunNode('r1', 'build')],
      20,
      undefined,
      undefined,
      10000,
    );
    const spec = createFlowSpec('test', [retryNode]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      variables: { command_failed: true },
      currentNodePath: [0, 1],
      nodeProgress: { re1: { iteration: 10, maxIterations: 20, status: 'running' } },
    };

    const { state: result } = await autoAdvanceNodes(state, runner);
    // 10000 * 2^9 = 5120000ms but capped at 60000ms = 60s
    expect(result.variables['_retry_backoff_seconds']).toBe(60);
  });

  it('does not set backoff variable when retry has no backoff', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: '', stderr: '' }),
    };
    const retryNode = createRetryNode('re1', [createRunNode('r1', 'build')], 3);
    const spec = createFlowSpec('test', [retryNode]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      variables: { command_failed: true },
      currentNodePath: [0, 1],
      nodeProgress: { re1: { iteration: 1, maxIterations: 3, status: 'running' } },
    };

    const { state: result } = await autoAdvanceNodes(state, runner);
    expect(result.variables['_retry_backoff_seconds']).toBeUndefined();
  });
});

// ── H-REL-007: Graceful MAX_ADVANCES with prompt ──────────────────────

describe('autoAdvanceNodes — MAX_ADVANCES with prompt', () => {
  it('emits current prompt node when MAX_ADVANCES reached', async () => {
    // 100 let nodes followed by a prompt — the prompt should be emitted
    const nodes = [
      ...Array.from({ length: 100 }, (_, i) =>
        createLetNode(`l${i}`, `v${i}`, { type: 'literal', value: String(i) }),
      ),
      createPromptNode('p1', 'Continue here'),
    ];
    const spec = createFlowSpec('test', nodes);
    const state = createSessionState('s1', spec);

    const { state: result, capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('Continue here');
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('Flow paused')]),
    );
  });
});

// ── H-REL-010: Per-variable size guard ────────────────────────────────

describe('autoAdvanceNodes — variable size guard', () => {
  it('truncates let=run output exceeding MAX_OUTPUT_LENGTH', async () => {
    const longOutput = 'x'.repeat(3000);
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: longOutput + '\n', stderr: '' }),
    };
    const spec = createFlowSpec('test', [
      createLetNode('l1', 'data', { type: 'run', command: 'cat bigfile' }),
      createPromptNode('p1', 'done'),
    ]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state, runner);
    const data = result.variables['data'] as string;
    expect(data.length).toBeLessThan(longOutput.length);
    expect(data).toContain('[truncated]');
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Variable 'data' truncated")]),
    );
  });

  it('does not truncate let=run output within limit', async () => {
    const normalOutput = 'x'.repeat(100);
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: normalOutput + '\n', stderr: '' }),
    };
    const spec = createFlowSpec('test', [
      createLetNode('l1', 'data', { type: 'run', command: 'echo hi' }),
      createPromptNode('p1', 'done'),
    ]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state, runner);
    expect(result.variables['data']).toBe(normalOutput);
    expect(result.warnings).not.toEqual(
      expect.arrayContaining([expect.stringContaining('truncated')]),
    );
  });
});

// ── H-LANG-011: Labeled break/continue ──────────────────────────────────

describe('autoAdvanceNodes — labeled break', () => {
  it('break with label exits the labeled outer loop', async () => {
    // outer: while loop_flag max 5
    //   while loop_flag max 5
    //     break outer
    //   end
    // end
    // prompt: done
    const innerWhile = createWhileNode('w2', 'loop_flag', [createBreakNode('b1', 'outer')], 5);
    const outerWhile = createWhileNode('w1', 'loop_flag', [innerWhile], 5, 'outer');
    const spec = createFlowSpec('test', [outerWhile, createPromptNode('p1', 'done')]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { loop_flag: true } };

    const { state: result, capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('done');
    // Should have advanced past the outer while
    expect(result.currentNodePath).toEqual([2]);
  });

  it('break without label exits nearest loop even when outer is labeled', async () => {
    const innerWhile = createWhileNode('w2', 'loop_flag', [createBreakNode('b1')], 5);
    const outerWhile = createWhileNode('w1', 'loop_flag', [innerWhile], 5, 'outer');
    const spec = createFlowSpec('test', [outerWhile, createPromptNode('p1', 'done')]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { loop_flag: true } };

    const { capturedPrompt } = await autoAdvanceNodes(state);
    // Inner break exits inner loop; outer loop re-evaluates and repeats.
    // Eventually hits max iterations on outer loop.
    expect(capturedPrompt).toBe('done');
  });
});

describe('autoAdvanceNodes — labeled continue', () => {
  it('continue with label re-enters the labeled outer loop', async () => {
    // outer: foreach item in "a b"
    //   foreach sub in "x y"
    //     continue outer
    //   end
    // end
    // prompt: done
    const innerForeach = createForeachNode(
      'f2',
      'sub',
      'x y',
      [createContinueNode('c1', 'outer')],
      50,
    );
    const outerForeach = createForeachNode('f1', 'item', 'a b', [innerForeach], 50, 'outer');
    const spec = createFlowSpec('test', [outerForeach, createPromptNode('p1', 'done')]);
    const state = createSessionState('s1', spec);

    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('done');
  });
});

// ── H-LANG-008: Wall-clock loop timeout ──────────────────────────────────

describe('autoAdvanceNodes — loop timeout', () => {
  it('exits while loop when timeout exceeded', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    };
    const whileNode = createWhileNode(
      'w1',
      'loop_flag',
      [createRunNode('r1', 'echo hi')],
      100,
      undefined,
      0.001, // near-zero timeout — will immediately expire (0 means no timeout)
    );
    const spec = createFlowSpec('test', [whileNode, createPromptNode('p1', 'done')]);
    let state = createSessionState('s1', spec);

    // Simulate that the loop has been running: set loopStartedAt to the past
    state = {
      ...state,
      variables: { loop_flag: true },
      currentNodePath: [0, 1], // past body end
      nodeProgress: {
        w1: {
          iteration: 1,
          maxIterations: 100,
          status: 'running',
          startedAt: Date.now() - 5000,
          loopStartedAt: Date.now() - 5000,
        },
      },
    };

    const { state: result, capturedPrompt } = await autoAdvanceNodes(state, runner);
    expect(capturedPrompt).toBe('done');
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('timed out')]));
  });
});

// ── Bead prompt-language-1jbe: renderNodeToDsl escapes newlines in prompt/run text ──

describe('renderNodeToDsl — newline escaping in prompt/run', () => {
  const captureSpawnFlowText = async (body: import('../domain/flow-node.js').FlowNode[]) => {
    const spawnedInputs: SpawnInput[] = [];
    const mockSpawner: ProcessSpawner = {
      async spawn(input) {
        spawnedInputs.push(input);
        return { pid: 42 };
      },
      async poll() {
        return { status: 'running' };
      },
    };
    const spawn = createSpawnNode('sp1', 'task', body);
    const spec = createFlowSpec('test', [spawn]);
    const state = createSessionState('s1', spec);
    await autoAdvanceNodes(state, undefined, undefined, mockSpawner);
    return spawnedInputs[0]!.flowText;
  };

  it('escapes newlines in prompt text to prevent DSL injection', async () => {
    const text = await captureSpawnFlowText([
      createPromptNode('p1', 'line1\nrun: malicious\nline3'),
    ]);
    // Newlines should be replaced with spaces — no multi-line DSL injection
    expect(text).toContain('prompt: line1 run: malicious line3');
    expect(text).not.toContain('prompt: line1\n');
  });

  it('escapes newlines in run command to prevent DSL injection', async () => {
    const text = await captureSpawnFlowText([createRunNode('r1', 'echo hi\nrm -rf /')]);
    expect(text).toContain('run: echo hi rm -rf /');
    expect(text).not.toContain('run: echo hi\n');
  });
});

// ── Tagged union discriminant on AutoAdvanceResult ──

describe('autoAdvanceNodes — tagged union result kind', () => {
  it('returns kind "prompt" when a prompt node is encountered', async () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'hello')]);
    const state = createSessionState('s1', spec);

    const result = await autoAdvanceNodes(state);
    expect(result.kind).toBe('prompt');
    expect(result.capturedPrompt).toBe('hello');
  });

  it('returns kind "advance" when flow completes with no prompt', async () => {
    const spec = createFlowSpec('test', [
      createLetNode('l1', 'x', { type: 'literal', value: 'done' }),
    ]);
    const state = createSessionState('s1', spec);

    const result = await autoAdvanceNodes(state);
    expect(result.kind).toBe('advance');
    expect(result.capturedPrompt).toBeNull();
  });

  it('returns kind "pause" when condition is unresolvable', async () => {
    const spec = createFlowSpec('test', [
      createWhileNode('w1', 'totally_unknown', [createPromptNode('p1', 'work')]),
    ]);
    const state = createSessionState('s1', spec);

    const result = await autoAdvanceNodes(state);
    expect(result.kind).toBe('pause');
    expect(result.capturedPrompt).toBeNull();
  });

  it('returns kind "pause" when run node has no command runner', async () => {
    const spec = createFlowSpec('test', [createRunNode('r1', 'echo hi')]);
    const state = createSessionState('s1', spec);

    const result = await autoAdvanceNodes(state);
    // autoAdvanceNodes wraps pause result but stale-state detection kicks in
    expect(result.capturedPrompt).toBeNull();
  });
});

// ── Bead prompt-language-ntk8: Foreach re-entry uses cached maxIterations ──

describe('autoAdvanceNodes — foreach cached maxIterations', () => {
  it('uses cached maxIterations on re-entry even if list variable was mutated', async () => {
    // Create a foreach that iterates over 3 items (a, b, c)
    // During body, the list variable may be mutated. The re-entry should
    // use the cached maxIterations (3) from NodeProgress, not re-derive.
    const foreachNode = createForeachNode('fe1', 'item', 'a b c', [
      createPromptNode('p1', 'process ${item}'),
    ]);
    const spec = createFlowSpec('test', [foreachNode, createPromptNode('p2', 'Done')]);
    const state = createSessionState('s1', spec);

    // First call enters foreach, sets item=a
    const r1 = await autoAdvanceNodes(state);
    expect(r1.capturedPrompt).toBe('process a');
    expect(r1.state.nodeProgress['fe1']?.maxIterations).toBe(3);

    // Mutate the list variable between iterations to test cached maxIterations
    const mutatedState1 = {
      ...r1.state,
      variables: { ...r1.state.variables, list: '["x","y","z","w","v"]' },
    } as typeof r1.state;

    // Second call: body exhausted, re-enter with item=b (cached maxIterations=3 unchanged)
    const r2 = await autoAdvanceNodes(mutatedState1);
    expect(r2.capturedPrompt).toBe('process b');
    // maxIterations should still be 3 (cached), not re-derived from mutated list
    expect(r2.state.nodeProgress['fe1']?.maxIterations).toBe(3);

    // Third call: body exhausted, re-enter with item=c
    const r3 = await autoAdvanceNodes(r2.state);
    expect(r3.capturedPrompt).toBe('process c');

    // Fourth call: exhausted all items
    const r4 = await autoAdvanceNodes(r3.state);
    expect(r4.capturedPrompt).toBe('Done');
  });
});

// ── Bead prompt-language-3zmu: Zero timeout not silently ignored ──

describe('handleLoopReentry — zero timeout', () => {
  it('zero timeoutSeconds does not trigger timeout (treated as no timeout)', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    };
    const whileNode = createWhileNode(
      'w1',
      'loop_flag',
      [createRunNode('r1', 'echo hi')],
      5,
      undefined,
      0, // zero timeout — should be ignored, not trigger timeout
    );
    const spec = createFlowSpec('test', [whileNode, createPromptNode('p1', 'done')]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      variables: { loop_flag: true },
      currentNodePath: [0, 1],
      nodeProgress: {
        w1: {
          iteration: 1,
          maxIterations: 5,
          status: 'running',
          startedAt: Date.now() - 999999,
          loopStartedAt: Date.now() - 999999,
        },
      },
    };

    const { state: result } = await autoAdvanceNodes(state, runner);
    // Should NOT have timed out — zero means no timeout
    expect(result.warnings).not.toEqual(
      expect.arrayContaining([expect.stringContaining('timed out')]),
    );
  });
});

// ── ask condition — while/until AI-evaluated conditions ─────────────

describe('autoAdvanceNodes — while ask condition (AI-evaluated)', () => {
  it('Phase 1: emits judge prompt on first encounter', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };
    const whileNode = createWhileNode(
      'w1',
      'ask:"is the code clean?"',
      [createPromptNode('p1', 'fix it')],
      3,
    );
    const spec = createFlowSpec('test', [whileNode]);
    const state = createSessionState('s1', spec);

    const { capturedPrompt, state: result } = await autoAdvanceNodes(
      state,
      undefined,
      captureReader,
    );
    expect(capturedPrompt).toContain('is the code clean?');
    expect(capturedPrompt).toContain('.prompt-language/vars/');
    expect(capturedPrompt).toContain('__judge_w1__');
    expect(result.nodeProgress['w1']?.status).toBe('awaiting_capture');
    expect(captureReader.clear).toHaveBeenCalledWith('__judge_w1__');
  });

  it('max-retries reruns grounded evidence and pauses when exhausted', async () => {
    let groundingCall = 0;
    const runner: CommandRunner = {
      run: async () => ({
        exitCode: 0,
        stdout: `evidence-${++groundingCall}`,
        stderr: '',
      }),
    };
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };
    const whileNode = createWhileNode(
      'w1',
      'ask:"is it passing?"',
      [createPromptNode('p1', 'fix')],
      3,
      undefined,
      undefined,
      'npm test',
      1,
    );
    expect(whileNode.askMaxRetries).toBe(1);
    const spec = createFlowSpec('test', [whileNode]);
    let state = createSessionState('s1', spec);

    const phase1 = await autoAdvanceNodes(state, runner, captureReader);
    expect(phase1.capturedPrompt).toContain('evidence-1');
    expect(phase1.state.nodeProgress['w1']?.askRetryCount).toBe(0);

    state = phase1.state;
    const phase2 = await autoAdvanceNodes(state, runner, captureReader);
    expect(phase2.capturedPrompt).toContain('evidence-2');
    expect(phase2.state.nodeProgress['w1']?.askRetryCount).toBe(1);

    state = phase2.state;
    const phase3 = await autoAdvanceNodes(state, runner, captureReader);
    expect((phase3 as { kind?: string }).kind).toBe('pause');
    expect(phase3.capturedPrompt).toBeNull();
  });

  it('grounded-by with exit 0: enters while body (deterministic — no AI judge)', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: 'grounding evidence here', stderr: '' }),
    };
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };
    const whileNode = createWhileNode(
      'w1',
      'ask:"is it passing?"',
      [createPromptNode('p1', 'fix')],
      3,
      undefined,
      undefined,
      'npm test',
    );
    const spec = createFlowSpec('test', [whileNode]);
    const state = createSessionState('s1', spec);

    // grounded-by exit 0 = condition true => enter while body (no AI judge needed)
    const { capturedPrompt, state: result } = await autoAdvanceNodes(state, runner, captureReader);
    expect(capturedPrompt).toBe('fix');
    expect(result.nodeProgress['w1']?.status).toBe('running');
  });

  it('grounded-by with exit non-zero: exits while loop (deterministic — no AI judge)', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: 'tests failed', stderr: '' }),
    };
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };
    const whileNode = createWhileNode(
      'w1',
      'ask:"is it passing?"',
      [createPromptNode('p1', 'fix')],
      3,
      undefined,
      undefined,
      'npm test',
    );
    const spec = createFlowSpec('test', [whileNode]);
    const state = createSessionState('s1', spec);

    // grounded-by exit non-zero = condition false => exit while loop
    const { capturedPrompt, state: result } = await autoAdvanceNodes(state, runner, captureReader);
    expect(capturedPrompt).toBeNull();
    // Path advances past the while node (to index 1, past the only node)
    expect(result.currentNodePath).toEqual([1]);
  });

  it('Phase 2: verdict=true enters while body', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue('true'),
      clear: vi.fn(),
    };
    const whileNode = createWhileNode(
      'w1',
      'ask:"still needed?"',
      [createPromptNode('p1', 'inner work')],
      3,
    );
    const spec = createFlowSpec('test', [whileNode]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'w1', {
      iteration: 0,
      maxIterations: 3,
      status: 'awaiting_capture',
      startedAt: Date.now(),
      loopStartedAt: Date.now(),
    });

    const { capturedPrompt, state: result } = await autoAdvanceNodes(
      state,
      undefined,
      captureReader,
    );
    expect(capturedPrompt).toBe('inner work');
    expect(result.nodeProgress['w1']?.iteration).toBe(1);
    expect(result.nodeProgress['w1']?.status).toBe('running');
  });

  it('Phase 2: verdict=true times out and exits while loop', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue('true'),
      clear: vi.fn(),
    };
    const whileNode = createWhileNode(
      'w1',
      'ask:"still needed?"',
      [createPromptNode('p1', 'inner work')],
      3,
      undefined,
      1,
    );
    const spec = createFlowSpec('test', [whileNode, createPromptNode('p2', 'after-while')]);
    let state = createSessionState('s1', spec);
    const now = Date.now();
    state = updateNodeProgress(state, 'w1', {
      iteration: 0,
      maxIterations: 3,
      status: 'awaiting_capture',
      startedAt: now - 2000,
      loopStartedAt: now - 2000,
    });

    const { capturedPrompt, state: result } = await autoAdvanceNodes(
      state,
      undefined,
      captureReader,
    );
    expect(capturedPrompt).toBe('after-while');
    expect(result.nodeProgress['w1']?.status).toBe('completed');
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('timed out after 1s')]),
    );
  });

  it('Phase 2: verdict=false exits while loop', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue('false'),
      clear: vi.fn(),
    };
    const whileNode = createWhileNode('w1', 'ask:"continue?"', [createPromptNode('p1', 'body')], 3);
    const spec = createFlowSpec('test', [whileNode, createPromptNode('p2', 'after-while')]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'w1', {
      iteration: 0,
      maxIterations: 3,
      status: 'awaiting_capture',
      startedAt: Date.now(),
      loopStartedAt: Date.now(),
    });

    const { capturedPrompt, state: result } = await autoAdvanceNodes(
      state,
      undefined,
      captureReader,
    );
    expect(capturedPrompt).toBe('after-while');
    expect(result.nodeProgress['w1']?.status).toBe('completed');
  });

  it('Phase 2: no verdict captured → retries judge prompt', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };
    const whileNode = createWhileNode('w1', 'ask:"ready?"', [createPromptNode('p1', 'body')], 3);
    const spec = createFlowSpec('test', [whileNode]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'w1', {
      iteration: 0,
      maxIterations: 3,
      status: 'awaiting_capture',
      startedAt: Date.now(),
      loopStartedAt: Date.now(),
    });

    const { capturedPrompt } = await autoAdvanceNodes(state, undefined, captureReader);
    expect(capturedPrompt).toContain('was not found');
    expect(capturedPrompt).toContain('__judge_w1__');
  });

  it('max-retries with grounded-by re-prompts with fresh evidence and then pauses when exhausted', async () => {
    const runner: CommandRunner = {
      run: vi
        .fn()
        .mockResolvedValue({ exitCode: 0, stdout: 'grounding evidence here', stderr: '' }),
    };
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };
    const whileNode = createWhileNode(
      'w1',
      'ask:"is it good?"',
      [createPromptNode('p1', 'body')],
      3,
      undefined,
      undefined,
      'npm test',
      1,
    );
    const spec = createFlowSpec('test', [whileNode]);
    const state = createSessionState('s1', spec);

    const first = await autoAdvanceNodes(state, runner, captureReader);
    expect(first.capturedPrompt).toContain('grounding evidence here');
    expect(first.state.nodeProgress['w1']?.askRetryCount).toBe(0);

    const second = await autoAdvanceNodes(first.state, runner, captureReader);
    expect(second.capturedPrompt).toContain('grounding evidence here');
    expect(second.state.nodeProgress['w1']?.askRetryCount).toBe(1);

    const third = await autoAdvanceNodes(second.state, runner, captureReader);
    expect((third as { kind?: string }).kind).toBe('pause');
    expect(third.capturedPrompt).toBeNull();
  });

  it('max-retries re-runs grounded evidence and tracks askRetryCount', async () => {
    const runs: string[] = [];
    const runner: CommandRunner = {
      run: async (command: string) => {
        runs.push(command);
        return {
          exitCode: 0,
          stdout: `fresh evidence ${runs.length}`,
          stderr: '',
        };
      },
    };
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue('maybe'),
      clear: vi.fn(),
    };
    const whileNode = createWhileNode(
      'w1',
      'ask:"ready?"',
      [createPromptNode('p1', 'body')],
      3,
      undefined,
      undefined,
      'npm test',
      2,
    );
    const spec = createFlowSpec('test', [whileNode]);
    const phase1 = await autoAdvanceNodes(createSessionState('s1', spec), runner, captureReader);
    expect(phase1.capturedPrompt).toContain('fresh evidence 1');
    expect(phase1.state.nodeProgress['w1']?.askRetryCount).toBe(0);

    const phase2 = await autoAdvanceNodes(phase1.state, runner, captureReader);
    expect(phase2.capturedPrompt).toContain('fresh evidence 2');
    expect(phase2.state.nodeProgress['w1']?.askRetryCount).toBe(1);
    expect(runs).toHaveLength(2);
  });

  it('Phase 2: max iterations reached → exits loop with warning', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue('true'),
      clear: vi.fn(),
    };
    const whileNode = createWhileNode(
      'w1',
      'ask:"still running?"',
      [createPromptNode('p1', 'body')],
      3,
    );
    const spec = createFlowSpec('test', [whileNode, createPromptNode('p2', 'after')]);
    let state = createSessionState('s1', spec);
    // iteration equals maxIterations → max exceeded
    state = updateNodeProgress(state, 'w1', {
      iteration: 3,
      maxIterations: 3,
      status: 'awaiting_capture',
      startedAt: Date.now(),
      loopStartedAt: Date.now(),
    });

    const { capturedPrompt, state: result } = await autoAdvanceNodes(
      state,
      undefined,
      captureReader,
    );
    expect(capturedPrompt).toBe('after');
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('max iterations')]),
    );
  });
});

describe('autoAdvanceNodes — until ask condition (AI-evaluated)', () => {
  it('Phase 2: verdict=false enters until body', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue('false'),
      clear: vi.fn(),
    };
    const untilNode = createUntilNode(
      'u1',
      'ask:"is it done?"',
      [createPromptNode('p1', 'make progress')],
      3,
    );
    const spec = createFlowSpec('test', [untilNode]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'u1', {
      iteration: 0,
      maxIterations: 3,
      status: 'awaiting_capture',
      startedAt: Date.now(),
      loopStartedAt: Date.now(),
    });

    const { capturedPrompt, state: result } = await autoAdvanceNodes(
      state,
      undefined,
      captureReader,
    );
    expect(capturedPrompt).toBe('make progress');
    expect(result.nodeProgress['u1']?.iteration).toBe(1);
  });

  it('Phase 2: verdict=true exits until loop', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue('true'),
      clear: vi.fn(),
    };
    const untilNode = createUntilNode(
      'u1',
      'ask:"is it done?"',
      [createPromptNode('p1', 'body')],
      3,
    );
    const spec = createFlowSpec('test', [untilNode, createPromptNode('p2', 'after-until')]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'u1', {
      iteration: 0,
      maxIterations: 3,
      status: 'awaiting_capture',
      startedAt: Date.now(),
      loopStartedAt: Date.now(),
    });

    const { capturedPrompt } = await autoAdvanceNodes(state, undefined, captureReader);
    expect(capturedPrompt).toBe('after-until');
  });
});

// ── ask condition — if AI-evaluated conditions ───────────────────────

describe('autoAdvanceNodes — if ask condition (AI-evaluated)', () => {
  it('Phase 1: emits judge prompt on first encounter', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };
    const ifNode = createIfNode('i1', 'ask:"is the code clean?"', [
      createPromptNode('p1', 'then-branch'),
    ]);
    const spec = createFlowSpec('test', [ifNode]);
    const state = createSessionState('s1', spec);

    const { capturedPrompt, state: result } = await autoAdvanceNodes(
      state,
      undefined,
      captureReader,
    );
    expect(capturedPrompt).toContain('is the code clean?');
    expect(capturedPrompt).toContain('__judge_i1__');
    expect(result.nodeProgress['i1']?.status).toBe('awaiting_capture');
    expect(captureReader.clear).toHaveBeenCalledWith('__judge_i1__');
  });

  it('max-retries pauses once the retry budget is exhausted', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };
    const ifNode = createIfNode(
      'i1',
      'ask:"is it good?"',
      [createPromptNode('p1', 'then-action')],
      [createPromptNode('p2', 'else-action')],
      undefined,
      1,
    );
    expect(ifNode.askMaxRetries).toBe(1);
    const spec = createFlowSpec('test', [ifNode]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'i1', {
      iteration: 1,
      maxIterations: 1,
      status: 'awaiting_capture',
      askRetryCount: 1,
      startedAt: Date.now(),
    });

    const result = await autoAdvanceNodes(state, undefined, captureReader);
    expect((result as { kind?: string }).kind).toBe('pause');
    expect(result.capturedPrompt).toBeNull();
  });

  it('Phase 2: verdict=true enters then-branch', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue('true'),
      clear: vi.fn(),
    };
    const ifNode = createIfNode(
      'i1',
      'ask:"is it good?"',
      [createPromptNode('p1', 'then-action')],
      [createPromptNode('p2', 'else-action')],
    );
    const spec = createFlowSpec('test', [ifNode]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'i1', {
      iteration: 1,
      maxIterations: 1,
      status: 'awaiting_capture',
      startedAt: Date.now(),
    });

    const { capturedPrompt } = await autoAdvanceNodes(state, undefined, captureReader);
    expect(capturedPrompt).toBe('then-action');
  });

  it('Phase 2: verdict=false enters else-branch', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue('false'),
      clear: vi.fn(),
    };
    const ifNode = createIfNode(
      'i1',
      'ask:"all good?"',
      [createPromptNode('p1', 'then-action')],
      [createPromptNode('p2', 'else-action')],
    );
    const spec = createFlowSpec('test', [ifNode]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'i1', {
      iteration: 1,
      maxIterations: 1,
      status: 'awaiting_capture',
      startedAt: Date.now(),
    });

    const { capturedPrompt } = await autoAdvanceNodes(state, undefined, captureReader);
    expect(capturedPrompt).toBe('else-action');
  });

  it('Phase 2: verdict=false skips past if when no else-branch', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue('false'),
      clear: vi.fn(),
    };
    const ifNode = createIfNode('i1', 'ask:"apply fix?"', [
      createPromptNode('p1', 'fix something'),
    ]);
    const spec = createFlowSpec('test', [ifNode, createPromptNode('p2', 'after')]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'i1', {
      iteration: 1,
      maxIterations: 1,
      status: 'awaiting_capture',
      startedAt: Date.now(),
    });

    const { capturedPrompt } = await autoAdvanceNodes(state, undefined, captureReader);
    expect(capturedPrompt).toBe('after');
  });

  it('Phase 2: no verdict captured → retries judge prompt', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };
    const ifNode = createIfNode('i1', 'ask:"ready?"', [createPromptNode('p1', 'then')]);
    const spec = createFlowSpec('test', [ifNode]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'i1', {
      iteration: 1,
      maxIterations: 1,
      status: 'awaiting_capture',
      startedAt: Date.now(),
    });

    const { capturedPrompt } = await autoAdvanceNodes(state, undefined, captureReader);
    expect(capturedPrompt).toContain('was not found');
    expect(capturedPrompt).toContain('__judge_i1__');
  });

  it('max-retries re-runs grounded evidence for if ask conditions', async () => {
    const runs: string[] = [];
    const runner: CommandRunner = {
      run: async (command: string) => {
        runs.push(command);
        return {
          exitCode: 0,
          stdout: `fresh evidence ${runs.length}`,
          stderr: '',
        };
      },
    };
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue('maybe'),
      clear: vi.fn(),
    };
    const ifNode = createIfNode(
      'i1',
      'ask:"ready?"',
      [createPromptNode('p1', 'then')],
      [createPromptNode('p2', 'else')],
      'npm test',
      1,
    );
    const spec = createFlowSpec('test', [ifNode]);
    const phase1 = await autoAdvanceNodes(createSessionState('s1', spec), runner, captureReader);
    expect(phase1.capturedPrompt).toContain('fresh evidence 1');
    expect(phase1.state.nodeProgress['i1']?.askRetryCount).toBe(0);

    const phase2 = await autoAdvanceNodes(phase1.state, runner, captureReader);
    expect(phase2.capturedPrompt).toContain('fresh evidence 2');
    expect(phase2.state.nodeProgress['i1']?.askRetryCount).toBe(1);
    expect(runs).toHaveLength(2);
  });
});

// ── ask condition body exhaustion re-entry ───────────────────────────

describe('handleBodyExhaustion — ask condition re-entry', () => {
  it('while ask: body exhaustion resets to while node, Phase 1 re-emits judge prompt', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };
    const whileNode = createWhileNode('w1', 'ask:"continue?"', [createPromptNode('p1', 'body')], 3);
    const spec = createFlowSpec('test', [whileNode, createPromptNode('p2', 'after')]);
    const base = createSessionState('s1', spec);
    // Simulate: body exhausted — path past last body item, status running (not awaiting)
    const state = {
      ...base,
      currentNodePath: [0, 1] as readonly number[],
      nodeProgress: {
        w1: {
          iteration: 1,
          maxIterations: 3,
          status: 'running' as const,
          startedAt: Date.now(),
          loopStartedAt: Date.now(),
        },
      },
    };

    const { capturedPrompt, state: result } = await autoAdvanceNodes(
      state,
      undefined,
      captureReader,
    );
    expect(capturedPrompt).toContain('continue?');
    expect(capturedPrompt).toContain('__judge_w1__');
    expect(result.nodeProgress['w1']?.status).toBe('awaiting_capture');
  });

  it('until ask: body exhaustion resets to until node, Phase 1 re-emits judge prompt', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };
    const untilNode = createUntilNode('u1', 'ask:"done?"', [createPromptNode('p1', 'body')], 3);
    const spec = createFlowSpec('test', [untilNode, createPromptNode('p2', 'after')]);
    const base = createSessionState('s1', spec);
    const state = {
      ...base,
      currentNodePath: [0, 1] as readonly number[],
      nodeProgress: {
        u1: {
          iteration: 1,
          maxIterations: 3,
          status: 'running' as const,
          startedAt: Date.now(),
          loopStartedAt: Date.now(),
        },
      },
    };

    const { capturedPrompt, state: result } = await autoAdvanceNodes(
      state,
      undefined,
      captureReader,
    );
    expect(capturedPrompt).toContain('done?');
    expect(capturedPrompt).toContain('__judge_u1__');
    expect(result.nodeProgress['u1']?.status).toBe('awaiting_capture');
  });
});

// ── ask condition edge cases ─────────────────────────────────────────

describe('autoAdvanceNodes — ask condition edge cases', () => {
  it('captureReader undefined: Phase 1 emits judge prompt, Phase 2 retries without crashing', async () => {
    // Phase 1: no captureReader — should still emit judge prompt
    const whileNode = createWhileNode('w1', 'ask:"ready?"', [createPromptNode('p1', 'body')], 3);
    const spec = createFlowSpec('test', [whileNode]);
    const state = createSessionState('s1', spec);

    const phase1 = await autoAdvanceNodes(state, undefined, undefined);
    expect(phase1.capturedPrompt).toContain('ready?');
    expect(phase1.capturedPrompt).toContain('__judge_w1__');
    expect(phase1.state.nodeProgress['w1']?.status).toBe('awaiting_capture');

    // Phase 2: still no captureReader — should fall through to retry path
    const phase2 = await autoAdvanceNodes(phase1.state, undefined, undefined);
    expect(phase2.capturedPrompt).toContain('was not found');
    expect(phase2.capturedPrompt).toContain('__judge_w1__');
  });

  it('grounded-by with empty stdout but exit 0: still enters while body (exit code wins)', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    };
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };
    const whileNode = createWhileNode(
      'w1',
      'ask:"is it clean?"',
      [createPromptNode('p1', 'fix')],
      3,
      undefined,
      undefined,
      'npm test',
    );
    const spec = createFlowSpec('test', [whileNode]);
    const state = createSessionState('s1', spec);

    // Exit code 0 = condition true => enters while body (no AI judge, even with empty stdout)
    const { capturedPrompt, state: result } = await autoAdvanceNodes(state, runner, captureReader);
    expect(capturedPrompt).toBe('fix');
    expect(result.nodeProgress['w1']?.status).toBe('running');
  });

  it('ask condition iteration count preserved across body re-entry', async () => {
    // Simulate: body exhausted after iteration 2, re-entry should preserve count
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue('true'),
      clear: vi.fn(),
    };
    const whileNode = createWhileNode('w1', 'ask:"continue?"', [createPromptNode('p1', 'body')], 5);
    const spec = createFlowSpec('test', [whileNode]);
    const base = createSessionState('s1', spec);
    // Simulate body exhaustion at iteration 2: path past body end, status awaiting_capture
    // (handleBodyExhaustion resets to while node, then advanceConditionLoop handles Phase 1/2)
    // We set status to awaiting_capture as if Phase 1 already ran after re-entry
    const state = {
      ...base,
      currentNodePath: [0] as readonly number[],
      nodeProgress: {
        w1: {
          iteration: 2,
          maxIterations: 5,
          status: 'awaiting_capture' as const,
          startedAt: Date.now(),
          loopStartedAt: Date.now(),
        },
      },
    };

    const { state: result } = await autoAdvanceNodes(state, undefined, captureReader);
    // Iteration should increment from 2 to 3
    expect(result.nodeProgress['w1']?.iteration).toBe(3);
    expect(result.nodeProgress['w1']?.status).toBe('running');
  });
});

// ── autoAdvanceNodes — let prompt_json capture ───────────────────────

describe('autoAdvanceNodes — let prompt_json capture', () => {
  it('Phase 1: emits JSON-guided capture meta-prompt on first visit', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };
    const letNode = createLetNode('l1', 'analysis', {
      type: 'prompt_json',
      text: 'Analyze this code',
      schema: 'severity: "low"|"medium"|"high"',
    });
    const spec = createFlowSpec('test', [letNode]);
    const state = createSessionState('s1', spec);

    const { capturedPrompt, state: result } = await autoAdvanceNodes(
      state,
      undefined,
      captureReader,
    );
    expect(capturedPrompt).toContain('Analyze this code');
    expect(capturedPrompt).toContain('JSON');
    expect(result.nodeProgress['l1']?.status).toBe('awaiting_capture');
    expect(captureReader.clear).toHaveBeenCalledWith('analysis');
  });

  it('Phase 2: parses JSON response and stores flat keys', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue('{"severity":"high","summary":"bad code"}'),
      clear: vi.fn(),
    };
    const letNode = createLetNode('l1', 'analysis', {
      type: 'prompt_json',
      text: 'Analyze this code',
      schema: 'severity: "low"|"medium"|"high", summary: string',
    });
    const spec = createFlowSpec('test', [letNode, createPromptNode('p1', 'done')]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'l1', {
      iteration: 1,
      maxIterations: 3,
      status: 'awaiting_capture',
    });

    const { capturedPrompt, state: result } = await autoAdvanceNodes(
      state,
      undefined,
      captureReader,
    );
    expect(capturedPrompt).toBe('done');
    expect(result.variables['analysis.severity']).toBe('high');
    expect(result.variables['analysis.summary']).toBe('bad code');
  });

  it('Phase 2: parses fenced JSON response', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue('```json\n{"severity":"low"}\n```'),
      clear: vi.fn(),
    };
    const letNode = createLetNode('l1', 'result', {
      type: 'prompt_json',
      text: 'Analyze',
      schema: 'severity: string',
    });
    const spec = createFlowSpec('test', [letNode, createPromptNode('p1', 'next')]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'l1', {
      iteration: 1,
      maxIterations: 3,
      status: 'awaiting_capture',
    });

    const { state: result } = await autoAdvanceNodes(state, undefined, captureReader);
    expect(result.variables['result.severity']).toBe('low');
  });

  it('Phase 2: stores array field as JSON string and sets _length variable', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue('{"files":["a.ts","b.ts"]}'),
      clear: vi.fn(),
    };
    const letNode = createLetNode('l1', 'analysis', {
      type: 'prompt_json',
      text: 'List files',
      schema: 'files: string[]',
    });
    const spec = createFlowSpec('test', [letNode, createPromptNode('p1', 'next')]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'l1', {
      iteration: 1,
      maxIterations: 3,
      status: 'awaiting_capture',
    });

    const { state: result } = await autoAdvanceNodes(state, undefined, captureReader);
    expect(result.variables['analysis.files']).toBe('["a.ts","b.ts"]');
    expect(result.variables['analysis.files_length']).toBe(2);
  });

  it('Phase 2: warns and stores raw string when JSON parse fails', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue('not valid json'),
      clear: vi.fn(),
    };
    const letNode = createLetNode('l1', 'analysis', {
      type: 'prompt_json',
      text: 'Analyze',
      schema: 'severity: string',
    });
    const spec = createFlowSpec('test', [letNode, createPromptNode('p1', 'next')]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'l1', {
      iteration: 1,
      maxIterations: 3,
      status: 'awaiting_capture',
    });

    const { state: result } = await autoAdvanceNodes(state, undefined, captureReader);
    expect(result.variables['analysis']).toBe('not valid json');
    expect(result.warnings.some((w) => w.includes('JSON parse failed'))).toBe(true);
  });

  it('retries JSON capture when read returns null', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };
    const letNode = createLetNode('l1', 'analysis', {
      type: 'prompt_json',
      text: 'Analyze',
      schema: 'severity: string',
    });
    const spec = createFlowSpec('test', [letNode]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'l1', {
      iteration: 1,
      maxIterations: 3,
      status: 'awaiting_capture',
    });

    const { capturedPrompt, state: result } = await autoAdvanceNodes(
      state,
      undefined,
      captureReader,
    );
    expect(capturedPrompt).toContain('JSON capture for');
    expect(capturedPrompt).toContain('failed');
    expect(result.nodeProgress['l1']?.iteration).toBe(2);
  });

  it('uses empty string after max JSON capture retries exhausted', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };
    const letNode = createLetNode('l1', 'analysis', {
      type: 'prompt_json',
      text: 'Analyze',
      schema: 'severity: string',
    });
    const spec = createFlowSpec('test', [letNode, createPromptNode('p1', 'next')]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'l1', {
      iteration: 3,
      maxIterations: 3,
      status: 'awaiting_capture',
    });

    const { capturedPrompt, state: result } = await autoAdvanceNodes(
      state,
      undefined,
      captureReader,
    );
    expect(capturedPrompt).toBe('next');
    expect(result.variables['analysis']).toBe('');
    expect(result.warnings.some((w) => w.includes('failed after'))).toBe(true);
  });
});

// ── autoAdvanceNodes — if grounded-by fast path ───────────────────────

describe('autoAdvanceNodes — if grounded-by fast path', () => {
  it('grounded-by exit 0: enters then-branch (no AI judge)', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    };
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };
    const ifNode = createIfNode(
      'i1',
      'ask:"is it ready?"',
      [createPromptNode('p1', 'then-body')],
      [],
      'npm test',
    );
    const spec = createFlowSpec('test', [ifNode]);
    const state = createSessionState('s1', spec);

    const { capturedPrompt } = await autoAdvanceNodes(state, runner, captureReader);
    expect(capturedPrompt).toBe('then-body');
  });

  it('grounded-by exit non-zero: skips if node (no else branch)', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: '', stderr: '' }),
    };
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };
    const ifNode = createIfNode(
      'i1',
      'ask:"is it ready?"',
      [createPromptNode('p1', 'then-body')],
      [],
      'npm test',
    );
    const spec = createFlowSpec('test', [ifNode, createPromptNode('p2', 'after-if')]);
    const state = createSessionState('s1', spec);

    const { capturedPrompt } = await autoAdvanceNodes(state, runner, captureReader);
    expect(capturedPrompt).toBe('after-if');
  });

  it('grounded-by exit non-zero: enters else-branch when present', async () => {
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: '', stderr: '' }),
    };
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };
    const ifNode = createIfNode(
      'i1',
      'ask:"is it ready?"',
      [createPromptNode('p1', 'then-body')],
      [createPromptNode('p2', 'else-body')],
      'npm test',
    );
    const spec = createFlowSpec('test', [ifNode]);
    const state = createSessionState('s1', spec);

    const { capturedPrompt } = await autoAdvanceNodes(state, runner, captureReader);
    expect(capturedPrompt).toBe('else-body');
  });

  it('grounded-by command failure: falls through to AI judge path', async () => {
    const runner: CommandRunner = {
      run: async () => {
        throw new Error('command not found');
      },
    };
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn(),
    };
    const ifNode = createIfNode(
      'i1',
      'ask:"is it ready?"',
      [createPromptNode('p1', 'then-body')],
      [],
      'nonexistent-command',
    );
    const spec = createFlowSpec('test', [ifNode]);
    const state = createSessionState('s1', spec);

    const { capturedPrompt, state: result } = await autoAdvanceNodes(state, runner, captureReader);
    // Should fall through to AI judge — emits judge prompt (Phase 1)
    expect(capturedPrompt).toContain('__judge_i1__');
    expect(result.nodeProgress['i1']?.status).toBe('awaiting_capture');
  });
});
