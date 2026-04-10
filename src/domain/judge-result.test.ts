import { describe, expect, it } from 'vitest';

import {
  createJudgeResult,
  JUDGE_RESULT_JSON_SCHEMA,
  parseCapturedJudgeResult,
} from './judge-result.js';

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

  it('exports the canonical JSON schema example', () => {
    expect(JUDGE_RESULT_JSON_SCHEMA).toContain('"pass"');
    expect(JUDGE_RESULT_JSON_SCHEMA).toContain('"evidence"');
  });

  it('parses a valid captured judge result', () => {
    expect(
      parseCapturedJudgeResult(
        JSON.stringify({
          pass: true,
          confidence: 0.8,
          reason: 'Looks good',
          evidence: ['Tests pass'],
          abstain: false,
        }),
      ),
    ).toEqual({
      pass: true,
      confidence: 0.8,
      reason: 'Looks good',
      evidence: ['Tests pass'],
      abstain: false,
    });
  });

  it('parses fenced JSON judge results', () => {
    expect(
      parseCapturedJudgeResult(
        '```json\n{"pass":false,"confidence":0.2,"reason":"Missing evidence","evidence":[],"abstain":true}\n```',
      ),
    ).toEqual({
      pass: false,
      confidence: 0.2,
      reason: 'Missing evidence',
      evidence: [],
      abstain: true,
    });
  });

  it('rejects malformed captured judge results', () => {
    expect(parseCapturedJudgeResult('not json')).toBeNull();
    expect(
      parseCapturedJudgeResult(
        JSON.stringify({
          pass: 'yes',
          confidence: 0.8,
          reason: 'Looks good',
          evidence: ['Tests pass'],
          abstain: false,
        }),
      ),
    ).toBeNull();
  });
});
