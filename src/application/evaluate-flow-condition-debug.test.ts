import { describe, expect, it } from 'vitest';
import { createFlowSpec } from '../domain/flow-spec.js';
import { createPromptNode } from '../domain/flow-node.js';
import { createSessionState } from '../domain/session-state.js';
import {
  evaluateFlowConditionWithTrace,
  resolveFlowEvalVariables,
} from './evaluate-flow-condition-debug.js';

describe('evaluateFlowConditionWithTrace', () => {
  it('evaluates comparisons with resolved operand values in trace', () => {
    const result = evaluateFlowConditionWithTrace('count >= threshold', {
      count: 5,
      threshold: 3,
    });

    expect(result.result).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.trace).toContainEqual(
      expect.objectContaining({
        kind: 'comparison',
        expression: 'count >= threshold',
        result: true,
        left: expect.objectContaining({ variableName: 'count', resolved: 5 }),
        right: expect.objectContaining({ variableName: 'threshold', resolved: 3 }),
      }),
    );
  });

  it('evaluates and/or/not and records intermediate results', () => {
    const result = evaluateFlowConditionWithTrace('not (a and b) or c', {
      a: true,
      b: false,
      c: false,
    });

    expect(result.result).toBe(true);
    expect(result.trace).toContainEqual(
      expect.objectContaining({
        kind: 'and',
        expression: 'a and b',
        result: false,
      }),
    );
    expect(result.trace).toContainEqual(
      expect.objectContaining({
        kind: 'not',
        expression: 'not (a and b)',
        result: true,
        innerResult: false,
      }),
    );
    expect(result.trace).toContainEqual(
      expect.objectContaining({
        kind: 'or',
        expression: 'not (a and b) or c',
        result: true,
        leftResult: true,
      }),
    );
  });

  it('resolves ${var} references and reports undefined variable errors clearly', () => {
    const result = evaluateFlowConditionWithTrace('${count} > ${limit}', {
      count: 2,
    });

    expect(result.result).toBeNull();
    expect(result.undefinedVariables).toEqual(['limit']);
    expect(result.errors).toEqual(['Undefined variable: limit']);
  });

  it('supports contains expressions and records operand traces', () => {
    const result = evaluateFlowConditionWithTrace('title contains keyword', {
      title: 'hello world',
      keyword: 'world',
    });

    expect(result.result).toBe(true);
    expect(result.trace).toContainEqual(
      expect.objectContaining({
        kind: 'contains',
        expression: 'title contains keyword',
        result: true,
      }),
    );
  });

  it('evaluates truthiness for non-boolean variable types', () => {
    expect(evaluateFlowConditionWithTrace('name', { name: 'x' }).result).toBe(true);
    expect(evaluateFlowConditionWithTrace('count', { count: 0 }).result).toBe(false);
    expect(evaluateFlowConditionWithTrace('items', { items: ['a'] }).result).toBe(true);
    expect(evaluateFlowConditionWithTrace('meta', { meta: { ok: true } }).result).toBe(true);
  });

  it('treats built-in implicit flags as false literals when unset', () => {
    const result = evaluateFlowConditionWithTrace('command_failed', {});

    expect(result.result).toBe(false);
    expect(result.errors).toEqual([]);
  });
});

describe('resolveFlowEvalVariables', () => {
  it('uses active session variables when flow is active', () => {
    const state = {
      ...createSessionState('s1', createFlowSpec('goal', [createPromptNode('p1', 'do work')])),
      status: 'active' as const,
      variables: { from: 'active' },
    };

    expect(resolveFlowEvalVariables(state, null)).toEqual({
      source: 'active_session',
      variables: { from: 'active' },
    });
  });

  it('falls back to last-session variables when there is no active flow', () => {
    const lastSession = {
      ...createSessionState('s1', createFlowSpec('goal', [createPromptNode('p1', 'done')])),
      status: 'completed' as const,
      variables: { from: 'last' },
    };

    expect(resolveFlowEvalVariables(lastSession, null)).toEqual({
      source: 'last_session',
      variables: { from: 'last' },
    });
  });

  it('returns empty variables when no session state is available', () => {
    expect(resolveFlowEvalVariables(null, null)).toEqual({
      source: 'none',
      variables: {},
    });
  });
});
