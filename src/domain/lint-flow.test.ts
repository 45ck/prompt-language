import { describe, it, expect } from 'vitest';
import { lintFlow } from './lint-flow.js';
import { createFlowSpec } from './flow-spec.js';
import {
  createPromptNode,
  createRunNode,
  createWhileNode,
  createUntilNode,
  createRetryNode,
  createIfNode,
  createTryNode,
  createForeachNode,
  createBreakNode,
  createSpawnNode,
} from './flow-node.js';

describe('lintFlow', () => {
  it('returns no warnings for a valid flow', () => {
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'do something'), createRunNode('r1', 'npm test')],
      [],
    );
    expect(lintFlow(spec)).toEqual([]);
  });

  it('warns on missing goal', () => {
    const spec = createFlowSpec('', [createPromptNode('p1', 'hi')], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({ nodeId: '', message: 'Missing Goal' });
  });

  it('warns on empty flow', () => {
    const spec = createFlowSpec('test', [], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({ nodeId: '', message: 'Empty flow — no nodes defined' });
  });

  it('warns on empty while body', () => {
    const spec = createFlowSpec('test', [createWhileNode('w1', 'true', [], 5)], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({ nodeId: 'w1', message: 'Empty while body' });
  });

  it('warns on retry without run node', () => {
    const spec = createFlowSpec(
      'test',
      [createRetryNode('r1', [createPromptNode('p1', 'fix')], 3)],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'r1',
      message: 'Retry without run node — retry re-loops on command_failed',
    });
  });

  it('no warning for retry with run node', () => {
    const spec = createFlowSpec(
      'test',
      [createRetryNode('r1', [createRunNode('run1', 'npm test')], 3)],
      [],
    );
    expect(lintFlow(spec)).toEqual([]);
  });

  it('warns on empty if branches', () => {
    const spec = createFlowSpec('test', [createIfNode('i1', 'cond', [], [])], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'i1',
      message: 'Empty if — both branches are empty',
    });
  });

  it('warns on empty try body', () => {
    const spec = createFlowSpec(
      'test',
      [createTryNode('t1', [], 'command_failed', [createPromptNode('p1', 'rollback')])],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({ nodeId: 't1', message: 'Empty try body' });
  });

  it('warns on break outside loop', () => {
    const spec = createFlowSpec('test', [createBreakNode('b1')], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({ nodeId: 'b1', message: 'Break outside of loop' });
  });

  it('no warning for break inside loop', () => {
    const spec = createFlowSpec(
      'test',
      [createForeachNode('f1', 'item', 'a b c', [createBreakNode('b1')], 10)],
      [],
    );
    expect(lintFlow(spec)).toEqual([]);
  });

  it('warns on empty foreach body', () => {
    const spec = createFlowSpec('test', [createForeachNode('f1', 'x', 'a b', [], 10)], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({ nodeId: 'f1', message: 'Empty foreach body' });
  });

  it('warns on empty spawn body', () => {
    const spec = createFlowSpec('test', [createSpawnNode('s1', 'task', [])], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({ nodeId: 's1', message: 'Empty spawn body' });
  });

  it('no warning for spawn with body', () => {
    const spec = createFlowSpec(
      'test',
      [createSpawnNode('s1', 'task', [createRunNode('r1', 'echo hi')])],
      [],
    );
    expect(lintFlow(spec)).toEqual([]);
  });

  it('no warning when if has only then-branch non-empty', () => {
    const spec = createFlowSpec(
      'test',
      [createIfNode('i1', 'cond', [createPromptNode('p1', 'yes')], [])],
      [],
    );
    expect(lintFlow(spec)).toEqual([]);
  });

  it('warns on empty until body', () => {
    const spec = createFlowSpec('test', [createUntilNode('u1', 'done', [], 5)], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({ nodeId: 'u1', message: 'Empty until body' });
  });

  it('warns on empty retry body', () => {
    const spec = createFlowSpec('test', [createRetryNode('r1', [], 3)], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({ nodeId: 'r1', message: 'Empty retry body' });
  });

  it('no false break-outside-loop warning for break inside retry inside foreach', () => {
    const retryWithBreak = createRetryNode('re1', [createBreakNode('b1')], 3);
    const spec = createFlowSpec(
      'test',
      [createForeachNode('f1', 'item', 'a b c', [retryWithBreak], 10)],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).not.toContainEqual(
      expect.objectContaining({ message: 'Break outside of loop' }),
    );
  });

  it('lints nodes inside spawn body', () => {
    const spec = createFlowSpec(
      'test',
      [createSpawnNode('s1', 'task', [createBreakNode('b1')])],
      [],
    );
    const warnings = lintFlow(spec);
    // spawn resets insideLoop to false, so break inside spawn body should warn
    expect(warnings).toContainEqual({ nodeId: 'b1', message: 'Break outside of loop' });
  });
});
