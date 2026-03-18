import { describe, it, expect } from 'vitest';
import {
  createWhileNode,
  createUntilNode,
  createRetryNode,
  createIfNode,
  createPromptNode,
  createRunNode,
  createTryNode,
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
    });
  });
});
