import { describe, expect, it } from 'vitest';

import {
  buildReviewJudgeCapturePrompt,
  buildReviewJudgeRetryPrompt,
  parseReviewJudgeCapture,
  reviewJudgeVarName,
} from './review-judge-capture.js';

describe('review-judge-capture', () => {
  it('uses a dedicated capture variable name for review judges', () => {
    expect(reviewJudgeVarName('rv1')).toBe('__review_judge_rv1__');
  });

  it('builds a JSON capture prompt for review judges', () => {
    const prompt = buildReviewJudgeCapturePrompt('Judge this round.', 'rv1');
    expect(prompt).toContain('Judge this round.');
    expect(prompt).toContain('.prompt-language/vars/__review_judge_rv1__');
    expect(prompt).toContain('"pass"');
    expect(prompt).toContain('"abstain"');
  });

  it('builds a JSON retry prompt for review judges', () => {
    const prompt = buildReviewJudgeRetryPrompt('rv1');
    expect(prompt).toContain('JSON capture');
    expect(prompt).toContain('__review_judge_rv1__');
  });

  it('parses a valid captured judge result', () => {
    const result = parseReviewJudgeCapture(`{
      "pass": true,
      "confidence": 0.9,
      "reason": "Tests passed cleanly.",
      "evidence": ["exit 0", "stderr empty"],
      "abstain": false
    }`);

    expect(result).toEqual({
      pass: true,
      confidence: 0.9,
      reason: 'Tests passed cleanly.',
      evidence: ['exit 0', 'stderr empty'],
      abstain: false,
    });
  });

  it('rejects invalid captured payloads', () => {
    expect(parseReviewJudgeCapture('not json')).toBeNull();
    expect(parseReviewJudgeCapture('{"pass":true}')).toBeNull();
    expect(
      parseReviewJudgeCapture(
        '{"pass":true,"confidence":"wat","reason":"bad","evidence":[],"abstain":false}',
      ),
    ).toBeNull();
  });

  it('forces abstaining captures to non-pass', () => {
    const result = parseReviewJudgeCapture(`{
      "pass": true,
      "confidence": 0.2,
      "reason": "Not enough evidence.",
      "evidence": "missing diff",
      "abstain": true
    }`);

    expect(result).toEqual({
      pass: false,
      confidence: 0.2,
      reason: 'Not enough evidence.',
      evidence: ['missing diff'],
      abstain: true,
    });
  });
});
