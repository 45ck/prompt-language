/**
 * judge-prompt — Pure functions to build meta-prompts for AI condition evaluation.
 *
 * When `if ask "..."`, `while ask "..."`, or `until ask "..."` is encountered,
 * we ask Claude to evaluate the condition. Reuses the capture-prompt
 * infrastructure so no new hook or tag extraction code is needed.
 */

import { buildCapturePrompt, buildCaptureRetryPrompt } from './capture-prompt.js';
import { buildJsonCapturePrompt } from './capture-prompt.js';
import { JUDGE_RESULT_JSON_SCHEMA } from './judge-result.js';

/** Prefix used to encode AI-evaluated conditions in the condition string. */
export const ASK_CONDITION_PREFIX = 'ask:';

const MAX_GROUNDING_LENGTH = 1000;

/** Returns true if the condition should be evaluated by the AI. */
export function isAskCondition(condition: string): boolean {
  return condition.startsWith(ASK_CONDITION_PREFIX);
}

/**
 * Extracts the question text from an ask condition string.
 * Strips the 'ask:' prefix and surrounding quotes (single or double).
 */
export function extractAskQuestion(condition: string): string {
  const raw = condition.slice(ASK_CONDITION_PREFIX.length).trim();
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

/** Build the variable name used to cache an AI judgment verdict for a node. */
export function judgeVarName(nodeId: string): string {
  return `__judge_${nodeId}__`;
}

export function reviewJudgeVarName(nodeId: string): string {
  return `__review_judge_${nodeId}__`;
}

/**
 * Build a meta-prompt asking Claude to evaluate whether a condition is true or false.
 *
 * Uses the existing capture-prompt infrastructure so that the verdict ("true"/"false")
 * is captured via the standard tag + file mechanism — no additional hooks needed.
 */
export function buildJudgePrompt(
  question: string,
  nodeId: string,
  nonce?: string,
  groundingOutput?: string,
): string {
  const groundingSection = groundingOutput
    ? `\n\nOutput from grounding command:\n\`\`\`\n${groundingOutput.slice(0, MAX_GROUNDING_LENGTH)}\n\`\`\``
    : '';

  const questionText = `[Internal — prompt-language AI condition evaluation]

Evaluate whether the following is currently true or false:

"${question}"${groundingSection}

Answer with ONLY "true" or "false" — nothing else.`;

  return buildCapturePrompt(questionText, judgeVarName(nodeId), nonce);
}

/** Build a retry meta-prompt when the verdict was not captured on the first attempt. */
export function buildJudgeRetryPrompt(nodeId: string, nonce?: string): string {
  return buildCaptureRetryPrompt(judgeVarName(nodeId), nonce);
}

interface ReviewJudgePromptInput {
  readonly judgeName: string;
  readonly nodeId: string;
  readonly judgeLines: readonly string[];
  readonly rubricName?: string | undefined;
  readonly rubricLines?: readonly string[] | undefined;
  readonly criteria?: string | undefined;
  readonly evidenceSections?:
    | readonly { readonly label: string; readonly value: string }[]
    | undefined;
  readonly retryReason?: string | undefined;
  readonly nonce?: string | undefined;
}

export function buildReviewJudgePrompt(input: ReviewJudgePromptInput): string {
  const sections: string[] = [
    '[Internal — prompt-language named judge evaluation]',
    `Evaluate the completed review round using judge "${input.judgeName}".`,
  ];

  if (input.retryReason) {
    sections.push(`Previous capture issue: ${input.retryReason}.`);
  }

  if (input.criteria) {
    sections.push(`Review criteria:\n${input.criteria}`);
  }

  sections.push(`Judge definition:\n${input.judgeLines.join('\n')}`);

  if (input.rubricName && input.rubricLines && input.rubricLines.length > 0) {
    sections.push(`Rubric "${input.rubricName}":\n${input.rubricLines.join('\n')}`);
  }

  for (const section of input.evidenceSections ?? []) {
    sections.push(`${section.label}:\n${section.value}`);
  }

  sections.push(
    'Return one JSON verdict only. Keep `reason` brief and keep `evidence` concrete and short. Do not include hidden reasoning.',
  );

  return buildJsonCapturePrompt(
    sections.join('\n\n'),
    reviewJudgeVarName(input.nodeId),
    JUDGE_RESULT_JSON_SCHEMA,
    input.nonce,
  );
}
