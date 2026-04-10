import { describe, it, expect } from 'vitest';
import {
  createFlowSpec,
  createCompletionGate,
  createRubricDefinition,
  createJudgeDefinition,
} from './flow-spec.js';
import { createPromptNode } from './flow-node.js';

describe('createCompletionGate', () => {
  it('creates a gate with predicate only', () => {
    const gate = createCompletionGate('tests_pass');
    expect(gate).toEqual({ predicate: 'tests_pass', command: undefined });
  });

  it('creates a gate with predicate and command', () => {
    const gate = createCompletionGate('lint_pass', 'pnpm lint');
    expect(gate).toEqual({ predicate: 'lint_pass', command: 'pnpm lint' });
  });
});

describe('createFlowSpec', () => {
  it('creates a minimal flow spec with defaults', () => {
    const spec = createFlowSpec('fix bug', []);
    expect(spec).toEqual({
      goal: 'fix bug',
      nodes: [],
      completionGates: [],
      defaults: { maxIterations: 5, maxAttempts: 3 },
      warnings: [],
    });
  });

  it('includes nodes and completion gates', () => {
    const node = createPromptNode('p1', 'inspect');
    const gate = createCompletionGate('tests_pass');
    const spec = createFlowSpec('goal', [node], [gate]);
    expect(spec.nodes).toEqual([node]);
    expect(spec.completionGates).toEqual([gate]);
  });

  it('includes warnings', () => {
    const spec = createFlowSpec('g', [], [], ['missing end']);
    expect(spec.warnings).toEqual(['missing end']);
  });

  it('merges partial defaults', () => {
    const spec = createFlowSpec('g', [], [], [], { maxIterations: 10 });
    expect(spec.defaults).toEqual({ maxIterations: 10, maxAttempts: 3 });
  });

  it('overrides both defaults', () => {
    const spec = createFlowSpec('g', [], [], [], {
      maxIterations: 20,
      maxAttempts: 7,
    });
    expect(spec.defaults).toEqual({ maxIterations: 20, maxAttempts: 7 });
  });

  it('includes rubric and judge declarations when provided', () => {
    const rubric = createRubricDefinition('bugfix_quality', ['criterion correctness type boolean']);
    const judge = createJudgeDefinition(
      'impl_quality',
      ['kind: model', 'rubric: "bugfix_quality"'],
      'bugfix_quality',
    );
    const spec = createFlowSpec(
      'g',
      [],
      [],
      [],
      undefined,
      undefined,
      undefined,
      undefined,
      [rubric],
      [judge],
    );

    expect(spec.rubrics).toEqual([rubric]);
    expect(spec.judges).toEqual([judge]);
  });
});
