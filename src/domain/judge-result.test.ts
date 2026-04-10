import { describe, expect, it } from 'vitest';

import { createJudgeResult } from './judge-result.js';

describe('judge-result', () => {
  it('clamps confidence into the 0..1 range', () => {
    expect(createJudgeResult(true, -1, 'bad').confidence).toBe(0);
    expect(createJudgeResult(true, 2, 'good').confidence).toBe(1);
  });

  it('forces abstaining verdicts to non-pass', () => {
    const result = createJudgeResult(true, 0.9, 'not enough evidence', ['missing diff'], true);
    expect(result).toEqual({
      pass: false,
      confidence: 0.9,
      reason: 'not enough evidence',
      evidence: ['missing diff'],
      abstain: true,
    });
  });
});
