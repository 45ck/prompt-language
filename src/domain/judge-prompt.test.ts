import { describe, it, expect } from 'vitest';
import {
  ASK_CONDITION_PREFIX,
  isAskCondition,
  extractAskQuestion,
  judgeVarName,
  buildJudgePrompt,
  buildJudgeRetryPrompt,
} from './judge-prompt.js';

describe('isAskCondition', () => {
  it('returns true for ask: prefix', () => {
    expect(isAskCondition('ask:"is the code clean?"')).toBe(true);
  });

  it('returns false for regular conditions', () => {
    expect(isAskCondition('tests_fail')).toBe(false);
    expect(isAskCondition('command_succeeded')).toBe(false);
    expect(isAskCondition('')).toBe(false);
  });

  it('ASK_CONDITION_PREFIX constant matches prefix check', () => {
    expect('ask:something'.startsWith(ASK_CONDITION_PREFIX)).toBe(true);
  });
});

describe('extractAskQuestion', () => {
  it('strips ask: prefix and double quotes', () => {
    expect(extractAskQuestion('ask:"is the code clean?"')).toBe('is the code clean?');
  });

  it('strips ask: prefix and single quotes', () => {
    expect(extractAskQuestion("ask:'there are code smells'")).toBe('there are code smells');
  });

  it('returns raw value when no surrounding quotes', () => {
    expect(extractAskQuestion('ask:has compile errors')).toBe('has compile errors');
  });

  it('handles whitespace after prefix', () => {
    expect(extractAskQuestion('ask: "trimmed"')).toBe('trimmed');
  });
});

describe('judgeVarName', () => {
  it('generates a safe variable name from nodeId', () => {
    expect(judgeVarName('n1')).toBe('__judge_n1__');
  });

  it('works for typical node IDs', () => {
    expect(judgeVarName('n42')).toBe('__judge_n42__');
    expect(judgeVarName('n100')).toBe('__judge_n100__');
  });
});

describe('buildJudgePrompt', () => {
  it('includes the question in the output', () => {
    const prompt = buildJudgePrompt('is the code clean?', 'n1');
    expect(prompt).toContain('is the code clean?');
  });

  it('includes the capture tag for the verdict variable', () => {
    const prompt = buildJudgePrompt('question', 'n5');
    expect(prompt).toContain('__judge_n5__');
    expect(prompt).toContain('prompt-language-capture');
  });

  it('includes the nonce in the capture tag when provided', () => {
    const prompt = buildJudgePrompt('question', 'n1', 'abc123');
    expect(prompt).toContain('prompt-language-capture-abc123');
  });

  it('includes grounding output when provided', () => {
    const prompt = buildJudgePrompt('question', 'n1', undefined, 'test output here');
    expect(prompt).toContain('test output here');
    expect(prompt).toContain('grounding command');
  });

  it('truncates very long grounding output at 1000 chars', () => {
    const longOutput = 'x'.repeat(2000);
    const prompt = buildJudgePrompt('question', 'n1', undefined, longOutput);
    expect(prompt).toContain('x'.repeat(1000));
    expect(prompt).not.toContain('x'.repeat(1001));
  });

  it('omits grounding section when groundingOutput is undefined', () => {
    const prompt = buildJudgePrompt('question', 'n1', undefined, undefined);
    expect(prompt).not.toContain('grounding command');
  });

  it('asks for true or false answer', () => {
    const prompt = buildJudgePrompt('any question', 'n1');
    expect(prompt).toMatch(/true.*false|false.*true/i);
  });
});

describe('buildJudgeRetryPrompt', () => {
  it('includes the verdict variable name', () => {
    const prompt = buildJudgeRetryPrompt('n1');
    expect(prompt).toContain('__judge_n1__');
  });

  it('includes nonce in tag when provided', () => {
    const prompt = buildJudgeRetryPrompt('n2', 'xyz');
    expect(prompt).toContain('prompt-language-capture-xyz');
  });

  it('mentions that the capture was not detected', () => {
    const prompt = buildJudgeRetryPrompt('n1');
    expect(prompt).toContain('was not detected');
  });
});
