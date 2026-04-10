/**
 * Minimal reusable review/judge verdict envelope for runtime and tooling.
 * Later eval/report layers can add richer criterion detail without changing this core shape.
 */
export interface JudgeResult {
  readonly pass: boolean;
  readonly confidence: number;
  readonly reason: string;
  readonly evidence: readonly string[];
  readonly abstain: boolean;
}

export const JUDGE_RESULT_JSON_SCHEMA = `{
  "pass": true,
  "confidence": 0.9,
  "reason": "Short explanation",
  "evidence": ["Concrete support"],
  "abstain": false
}`;

function clampConfidence(confidence: number): number {
  if (!Number.isFinite(confidence)) return 0;
  if (confidence < 0) return 0;
  if (confidence > 1) return 1;
  return confidence;
}

export function createJudgeResult(
  pass: boolean,
  confidence: number,
  reason: string,
  evidence: readonly string[] = [],
  abstain = false,
): JudgeResult {
  return {
    pass: abstain ? false : pass,
    confidence: clampConfidence(confidence),
    reason,
    evidence,
    abstain,
  };
}

function unwrapCapturedJson(text: string): string {
  const fencedMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  return fencedMatch?.[1]?.trim() ?? text.trim();
}

export function parseCapturedJudgeResult(text: string): JudgeResult | null {
  try {
    const parsed: unknown = JSON.parse(unwrapCapturedJson(text));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate['pass'] !== 'boolean') return null;
    if (typeof candidate['confidence'] !== 'number') return null;
    if (typeof candidate['reason'] !== 'string') return null;
    if (typeof candidate['abstain'] !== 'boolean') return null;
    if (!Array.isArray(candidate['evidence'])) return null;

    const evidence = candidate['evidence'];
    if (!evidence.every((entry) => typeof entry === 'string')) return null;

    return createJudgeResult(
      candidate['pass'],
      candidate['confidence'],
      candidate['reason'],
      evidence,
      candidate['abstain'],
    );
  } catch {
    return null;
  }
}
