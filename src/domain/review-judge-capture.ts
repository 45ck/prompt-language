import { buildJsonCapturePrompt, buildJsonCaptureRetryPrompt } from './capture-prompt.js';
import { createJudgeResult, type JudgeResult } from './judge-result.js';

export const REVIEW_JUDGE_RESULT_SCHEMA = `{
  "pass": true,
  "confidence": 0.91,
  "reason": "Short explanation of the verdict.",
  "evidence": ["Concrete supporting fact 1", "Concrete supporting fact 2"],
  "abstain": false
}`;

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
    REVIEW_JUDGE_RESULT_SCHEMA,
    nonce,
  );
}

export function buildReviewJudgeRetryPrompt(nodeId: string, nonce?: string): string {
  return buildJsonCaptureRetryPrompt(reviewJudgeVarName(nodeId), REVIEW_JUDGE_RESULT_SCHEMA, nonce);
}

function normalizeEvidence(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : String(entry).trim()))
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }

  if (value == null) return [];
  return null;
}

export function parseReviewJudgeCapture(text: string): JudgeResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const candidate = parsed as Record<string, unknown>;
  if (typeof candidate['pass'] !== 'boolean') return null;
  if (typeof candidate['reason'] !== 'string' || candidate['reason'].trim().length === 0)
    return null;
  if (typeof candidate['abstain'] !== 'boolean') return null;

  const confidence =
    typeof candidate['confidence'] === 'number'
      ? candidate['confidence']
      : typeof candidate['confidence'] === 'string'
        ? Number(candidate['confidence'])
        : Number.NaN;
  if (!Number.isFinite(confidence)) return null;

  const evidence = normalizeEvidence(candidate['evidence']);
  if (evidence == null) return null;

  return createJudgeResult(
    candidate['pass'],
    confidence,
    candidate['reason'].trim(),
    evidence,
    candidate['abstain'],
  );
}
