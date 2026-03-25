import { describe, it, expect } from 'vitest';
import {
  createWhileNode,
  createUntilNode,
  createRetryNode,
  createIfNode,
  createPromptNode,
  createRunNode,
  createTryNode,
  createLetNode,
  createForeachNode,
  createSpawnNode,
  createAwaitNode,
  findNodeById,
} from './flow-node.js';

describe('createWhileNode', () => {
  it('creates a while node with explicit max', () => {
    const node = createWhileNode('w1', 'tests_fail', [], 10);
    expect(node).toEqual({
      kind: 'while',
      id: 'w1',
      condition: 'tests_fail',
      maxIterations: 10,
      body: [],
    });
  });

  it('defaults maxIterations to 5', () => {
    const node = createWhileNode('w2', 'x', []);
    expect(node.maxIterations).toBe(5);
  });

  it('preserves body nodes', () => {
    const child = createPromptNode('p1', 'hello');
    const node = createWhileNode('w3', 'cond', [child]);
    expect(node.body).toEqual([child]);
  });
});

describe('createUntilNode', () => {
  it('creates an until node with explicit max', () => {
    const node = createUntilNode('u1', 'tests_pass', [], 8);
    expect(node).toEqual({
      kind: 'until',
      id: 'u1',
      condition: 'tests_pass',
      maxIterations: 8,
      body: [],
    });
  });

  it('defaults maxIterations to 5', () => {
    const node = createUntilNode('u2', 'done', []);
    expect(node.maxIterations).toBe(5);
  });
});

describe('createRetryNode', () => {
  it('creates a retry node with explicit attempts', () => {
    const node = createRetryNode('r1', [], 7);
    expect(node).toEqual({
      kind: 'retry',
      id: 'r1',
      maxAttempts: 7,
      body: [],
    });
  });

  it('defaults maxAttempts to 3', () => {
    const node = createRetryNode('r2', []);
    expect(node.maxAttempts).toBe(3);
  });
});

describe('createIfNode', () => {
  it('creates an if node with both branches', () => {
    const then = [createPromptNode('p1', 'yes')];
    const els = [createPromptNode('p2', 'no')];
    const node = createIfNode('i1', 'flag == true', then, els);
    expect(node).toEqual({
      kind: 'if',
      id: 'i1',
      condition: 'flag == true',
      thenBranch: then,
      elseBranch: els,
    });
  });

  it('defaults elseBranch to empty array', () => {
    const node = createIfNode('i2', 'x', []);
    expect(node.elseBranch).toEqual([]);
  });
});

describe('createPromptNode', () => {
  it('creates a prompt node', () => {
    const node = createPromptNode('p1', 'fix the bug');
    expect(node).toEqual({ kind: 'prompt', id: 'p1', text: 'fix the bug' });
  });
});

describe('createRunNode', () => {
  it('creates a run node', () => {
    const node = createRunNode('r1', 'pnpm test');
    expect(node).toEqual({ kind: 'run', id: 'r1', command: 'pnpm test' });
  });

  it('creates a run node with timeout', () => {
    const node = createRunNode('r2', 'npm test', 60000);
    expect(node).toEqual({ kind: 'run', id: 'r2', command: 'npm test', timeoutMs: 60000 });
  });

  it('omits timeoutMs when not provided', () => {
    const node = createRunNode('r3', 'echo hi');
    expect(node).not.toHaveProperty('timeoutMs');
  });
});

describe('createTryNode', () => {
  it('creates a try node with catch', () => {
    const body = [createRunNode('r1', 'pnpm build')];
    const catchBody = [createPromptNode('p1', 'fix build')];
    const node = createTryNode('t1', body, 'command_failed', catchBody);
    expect(node).toEqual({
      kind: 'try',
      id: 't1',
      body,
      catchCondition: 'command_failed',
      catchBody,
      finallyBody: [],
    });
  });
});

describe('createLetNode', () => {
  it('creates a let node with literal source', () => {
    const node = createLetNode('l1', 'greeting', { type: 'literal', value: 'hello' });
    expect(node).toEqual({
      kind: 'let',
      id: 'l1',
      variableName: 'greeting',
      source: { type: 'literal', value: 'hello' },
      append: false,
    });
  });

  it('creates a let node with prompt source', () => {
    const node = createLetNode('l2', 'info', { type: 'prompt', text: 'summarize this' });
    expect(node).toEqual({
      kind: 'let',
      id: 'l2',
      variableName: 'info',
      source: { type: 'prompt', text: 'summarize this' },
      append: false,
    });
  });

  it('creates a let node with run source', () => {
    const node = createLetNode('l3', 'output', { type: 'run', command: 'echo hi' });
    expect(node).toEqual({
      kind: 'let',
      id: 'l3',
      variableName: 'output',
      source: { type: 'run', command: 'echo hi' },
      append: false,
    });
  });

  it('creates a let node with append=true', () => {
    const node = createLetNode('l4', 'items', { type: 'literal', value: 'x' }, true);
    expect(node).toEqual({
      kind: 'let',
      id: 'l4',
      variableName: 'items',
      source: { type: 'literal', value: 'x' },
      append: true,
    });
  });

  it('creates a let node with empty_list source', () => {
    const node = createLetNode('l5', 'items', { type: 'empty_list' });
    expect(node).toEqual({
      kind: 'let',
      id: 'l5',
      variableName: 'items',
      source: { type: 'empty_list' },
      append: false,
    });
  });
});

describe('createForeachNode', () => {
  it('creates a foreach node with explicit max', () => {
    const body = [createPromptNode('p1', 'process item')];
    const node = createForeachNode('fe1', 'item', '${files}', body, 10);
    expect(node).toEqual({
      kind: 'foreach',
      id: 'fe1',
      variableName: 'item',
      listExpression: '${files}',
      maxIterations: 10,
      body,
    });
  });

  it('defaults maxIterations to 50', () => {
    const node = createForeachNode('fe2', 'x', '${list}', []);
    expect(node.maxIterations).toBe(50);
  });

  it('preserves body nodes', () => {
    const child = createRunNode('r1', 'lint ${file}');
    const node = createForeachNode('fe3', 'file', '${files}', [child]);
    expect(node.body).toEqual([child]);
  });
});

describe('createSpawnNode', () => {
  it('creates a spawn node with name and body', () => {
    const body = [createPromptNode('p1', 'fix bug'), createRunNode('r1', 'npm test')];
    const node = createSpawnNode('sp1', 'fix-auth', body);
    expect(node).toEqual({
      kind: 'spawn',
      id: 'sp1',
      name: 'fix-auth',
      body,
    });
  });

  it('creates a spawn node with empty body', () => {
    const node = createSpawnNode('sp2', 'empty', []);
    expect(node.kind).toBe('spawn');
    expect(node.body).toEqual([]);
  });

  it('creates a spawn node with cwd', () => {
    const body = [createPromptNode('p1', 'work')];
    const node = createSpawnNode('sp3', 'worker', body, '/tmp/work');
    expect(node).toEqual({
      kind: 'spawn',
      id: 'sp3',
      name: 'worker',
      body,
      cwd: '/tmp/work',
    });
  });

  it('omits cwd when not provided', () => {
    const node = createSpawnNode('sp4', 'no-cwd', []);
    expect(node).not.toHaveProperty('cwd');
  });
});

describe('createAwaitNode', () => {
  it('creates an await all node', () => {
    const node = createAwaitNode('aw1', 'all');
    expect(node).toEqual({
      kind: 'await',
      id: 'aw1',
      target: 'all',
    });
  });

  it('creates an await node targeting a specific child', () => {
    const node = createAwaitNode('aw2', 'fix-auth');
    expect(node).toEqual({
      kind: 'await',
      id: 'aw2',
      target: 'fix-auth',
    });
  });
});

describe('findNodeById', () => {
  it('finds a top-level node', () => {
    const p1 = createPromptNode('p1', 'hello');
    const r1 = createRunNode('r1', 'echo');
    expect(findNodeById([p1, r1], 'r1')).toBe(r1);
  });

  it('returns null when id not found', () => {
    const p1 = createPromptNode('p1', 'hello');
    expect(findNodeById([p1], 'missing')).toBeNull();
  });

  it('finds node nested in while body', () => {
    const inner = createRunNode('r1', 'test');
    const w = createWhileNode('w1', 'cond', [inner]);
    expect(findNodeById([w], 'r1')).toBe(inner);
  });

  it('finds node nested in if thenBranch', () => {
    const inner = createPromptNode('p1', 'yes');
    const ifNode = createIfNode('i1', 'flag', [inner]);
    expect(findNodeById([ifNode], 'p1')).toBe(inner);
  });

  it('finds node nested in if elseBranch', () => {
    const inner = createPromptNode('p2', 'no');
    const ifNode = createIfNode('i1', 'flag', [], [inner]);
    expect(findNodeById([ifNode], 'p2')).toBe(inner);
  });

  it('finds node nested in try body', () => {
    const inner = createRunNode('r1', 'deploy');
    const tryNode = createTryNode('t1', [inner], 'command_failed', []);
    expect(findNodeById([tryNode], 'r1')).toBe(inner);
  });

  it('finds node nested in try catchBody', () => {
    const inner = createPromptNode('p1', 'fix it');
    const tryNode = createTryNode('t1', [], 'command_failed', [inner]);
    expect(findNodeById([tryNode], 'p1')).toBe(inner);
  });

  it('finds node nested in try finallyBody', () => {
    const inner = createRunNode('r1', 'cleanup');
    const tryNode = createTryNode('t1', [], 'command_failed', [], [inner]);
    expect(findNodeById([tryNode], 'r1')).toBe(inner);
  });

  it('finds node nested in foreach body', () => {
    const inner = createPromptNode('p1', 'process');
    const fe = createForeachNode('fe1', 'item', 'a b c', [inner]);
    expect(findNodeById([fe], 'p1')).toBe(inner);
  });

  it('finds node nested in spawn body', () => {
    const inner = createRunNode('r1', 'test');
    const sp = createSpawnNode('sp1', 'worker', [inner]);
    expect(findNodeById([sp], 'r1')).toBe(inner);
  });

  it('finds deeply nested node (try > foreach > let)', () => {
    const letNode = createLetNode('l1', 'x', { type: 'literal', value: 'v' });
    const fe = createForeachNode('fe1', 'item', 'a b', [letNode]);
    const tryNode = createTryNode('t1', [fe], 'command_failed', []);
    expect(findNodeById([tryNode], 'l1')).toBe(letNode);
  });

  it('returns empty array produces null', () => {
    expect(findNodeById([], 'any')).toBeNull();
  });
});
