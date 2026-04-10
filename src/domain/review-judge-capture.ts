import { buildJsonCapturePrompt, buildJsonCaptureRetryPrompt } from './capture-prompt.js';
import {
  JUDGE_RESULT_JSON_SCHEMA,
  parseCapturedJudgeResult,
  type JudgeResult,
} from './judge-result.js';

export function reviewJudgeVarName(nodeId: string): string {
  return `__review_judge_${nodeId}__`;
}

export function buildReviewJudgeCapturePrompt(
  promptText: string,
  nodeId: string,
  nonce?: string,
): string {
  return buildJsonCapturePrompt(
    promptText,
    reviewJudgeVarName(nodeId),
    JUDGE_RESULT_JSON_SCHEMA,
    nonce,
  );
}

export function buildReviewJudgeRetryPrompt(nodeId: string, nonce?: string): string {
  return buildJsonCaptureRetryPrompt(reviewJudgeVarName(nodeId), JUDGE_RESULT_JSON_SCHEMA, nonce);
}

export function parseReviewJudgeCapture(text: string): JudgeResult | null {
  return parseCapturedJudgeResult(text);
}
