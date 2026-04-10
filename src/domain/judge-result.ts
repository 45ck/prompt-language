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
