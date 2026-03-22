import { describe, it, expect } from 'vitest';
import { flowComplexityScore } from './flow-complexity.js';
import { createFlowSpec, createCompletionGate } from './flow-spec.js';
import {
  createPromptNode,
  createRunNode,
  createWhileNode,
  createIfNode,
  createTryNode,
  createRetryNode,
  createForeachNode,
} from './flow-node.js';

describe('flowComplexityScore', () => {
  it('returns 1 for trivial linear flow', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'hi')]);
    expect(flowComplexityScore(spec)).toBe(1);
  });

  it('returns 1 for 3 linear nodes, no control flow', () => {
    const spec = createFlowSpec('test', [
      createPromptNode('p1', 'a'),
      createRunNode('r1', 'b'),
      createPromptNode('p2', 'c'),
    ]);
    expect(flowComplexityScore(spec)).toBe(1);
  });

  it('returns 2 for small flow with 1 control flow node', () => {
    const spec = createFlowSpec('test', [
      createIfNode('i1', 'cond', [createPromptNode('p1', 'yes')]),
    ]);
    expect(flowComplexityScore(spec)).toBe(2);
  });

  it('returns 3 or higher for moderate flow', () => {
    const spec = createFlowSpec('test', [
      createWhileNode(
        'w1',
        'cond',
        [createPromptNode('p1', 'fix'), createRunNode('r1', 'test')],
        5,
      ),
      createIfNode('i1', 'done', [createPromptNode('p2', 'a')], [createPromptNode('p3', 'b')]),
      createPromptNode('p4', 'wrap up'),
    ]);
    expect(flowComplexityScore(spec)).toBeGreaterThanOrEqual(3);
  });

  it('returns 4 or 5 for complex flow with deep nesting', () => {
    const inner = createWhileNode(
      'w2',
      'inner',
      [
        createRetryNode('re1', [createRunNode('r1', 'cmd')], 3),
        createIfNode('i1', 'check', [createPromptNode('p1', 'fix')]),
      ],
      3,
    );
    const outer = createTryNode(
      't1',
      [createWhileNode('w1', 'outer', [inner, createRunNode('r2', 'test')], 5)],
      'err',
      [createPromptNode('p2', 'catch')],
    );
    const spec = createFlowSpec(
      'test',
      [outer, createForeachNode('fe1', 'x', 'a b', [createPromptNode('p3', 'item')])],
      [createCompletionGate('tests_pass'), createCompletionGate('lint_pass')],
    );
    expect(flowComplexityScore(spec)).toBeGreaterThanOrEqual(4);
  });

  it('returns 1 for empty flow', () => {
    const spec = createFlowSpec('test', []);
    expect(flowComplexityScore(spec)).toBe(1);
  });
});
