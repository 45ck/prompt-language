import { describe, expect, it } from 'vitest';

import { createJudgeDefinition } from './flow-spec.js';
import { extractJudgeInputs, extractJudgeKind, extractJudgeModel } from './judge-definition.js';

describe('judge-definition', () => {
  it('defaults missing kind to model', () => {
    const judge = createJudgeDefinition('impl_quality', ['rubric: "bugfix_quality"']);
    expect(extractJudgeKind(judge)).toBe('model');
  });

  it('extracts supported judge kinds', () => {
    expect(extractJudgeKind(createJudgeDefinition('j1', ['kind: model']))).toBe('model');
    expect(extractJudgeKind(createJudgeDefinition('j2', ['kind: code']))).toBe('code');
    expect(extractJudgeKind(createJudgeDefinition('j3', ['kind: human']))).toBe('human');
  });

  it('returns unknown for unsupported judge kinds', () => {
    const judge = createJudgeDefinition('impl_quality', ['kind: orbital']);
    expect(extractJudgeKind(judge)).toBe('unknown');
  });

  it('extracts quoted model names', () => {
    const judge = createJudgeDefinition('impl_quality', ['model: "best-available-judge"']);
    expect(extractJudgeModel(judge)).toBe('best-available-judge');
  });

  it('extracts inline input lists', () => {
    const judge = createJudgeDefinition('impl_quality', ['inputs: [diff, test_output, output]']);
    expect(extractJudgeInputs(judge)).toEqual(['diff', 'test_output', 'output']);
  });

  it('returns empty inputs for malformed input lists', () => {
    const judge = createJudgeDefinition('impl_quality', ['inputs: diff, test_output']);
    expect(extractJudgeInputs(judge)).toEqual([]);
  });
});
