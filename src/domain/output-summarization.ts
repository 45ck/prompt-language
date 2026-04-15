/**
 * output-summarization — Deterministic output summarization policy.
 *
 * Defines byte thresholds for when command output is inlined verbatim,
 * summarized (head + tail), or referenced as an artifact handle.
 *
 * Safety rules: error messages, stack traces, gate failure output, and
 * test failure details are NEVER summarized — they are always inlined.
 *
 * Pure domain function: zero external dependencies.
 */

// ── Thresholds ──────────────────────────────────────────────────────────

/** Output at or below this size is inlined verbatim. */
export const INLINE_THRESHOLD = 500;

/** Output between INLINE_THRESHOLD and SUMMARIZE_THRESHOLD is summarized. */
export const SUMMARIZE_THRESHOLD = 4000;

/** Output above SUMMARIZE_THRESHOLD is referenced as an artifact. */
// (artifact threshold is implicit: > SUMMARIZE_THRESHOLD)

/** Number of characters shown at the head of a summarized output. */
export const SUMMARY_HEAD_CHARS = 200;

/** Number of characters shown at the tail of a summarized output. */
export const SUMMARY_TAIL_CHARS = 200;

// ── Types ───────────────────────────────────────────────────────────────

export type OutputDisposition = 'inline' | 'summarized' | 'artifact';

export interface OutputContext {
  readonly isError: boolean;
  readonly isGateOutput: boolean;
  readonly isTestOutput: boolean;
  readonly nodeType: string;
}

export interface SummarizedOutput {
  readonly disposition: OutputDisposition;
  readonly originalLength: number;
  readonly rendered: string;
  readonly safetyBypass: boolean;
}

export interface SafetyWarning {
  readonly pattern: string;
  readonly description: string;
}

export interface SafetyResult {
  readonly safe: boolean;
  readonly warnings: readonly SafetyWarning[];
}

// ── Safety-critical patterns ────────────────────────────────────────────

const SAFETY_CRITICAL_PATTERNS: readonly { readonly re: RegExp; readonly description: string }[] = [
  { re: /(?:Error|TypeError|ReferenceError|SyntaxError|RangeError):/i, description: 'error type' },
  { re: /^\s+at\s+/m, description: 'stack trace' },
  { re: /FAIL|FAILED/i, description: 'test failure keyword' },
  { re: /AssertionError|assert/i, description: 'assertion failure' },
  { re: /ENOENT|EACCES|EPERM|ECONNREFUSED/i, description: 'system error code' },
  { re: /exit code [1-9]/i, description: 'non-zero exit code reference' },
  { re: /panic|segfault|segmentation fault/i, description: 'crash indicator' },
  { re: /Traceback \(most recent call last\)/i, description: 'Python traceback' },
];

// ── Core functions ──────────────────────────────────────────────────────

function hasSafetyCriticalContent(output: string): boolean {
  return SAFETY_CRITICAL_PATTERNS.some(({ re }) => re.test(output));
}

function shouldBypassSummarization(output: string, context: OutputContext): boolean {
  if (context.isError) return true;
  if (context.isGateOutput) return true;
  if (context.isTestOutput) return true;
  if (hasSafetyCriticalContent(output)) return true;
  return false;
}

function buildSummaryText(output: string): string {
  const head = output.slice(0, SUMMARY_HEAD_CHARS);
  const tail = output.slice(-SUMMARY_TAIL_CHARS);
  const omitted = output.length - SUMMARY_HEAD_CHARS - SUMMARY_TAIL_CHARS;
  return (
    `Output: ${output.length} chars` +
    `\n--- head (${SUMMARY_HEAD_CHARS} chars) ---\n${head}` +
    `\n--- ${omitted} chars omitted ---` +
    `\n--- tail (${SUMMARY_TAIL_CHARS} chars) ---\n${tail}`
  );
}

/**
 * Determine disposition and render output according to the summarization policy.
 *
 * - Output at or below INLINE_THRESHOLD chars: inline verbatim
 * - Output between INLINE_THRESHOLD and SUMMARIZE_THRESHOLD: summarized (head + tail)
 * - Output above SUMMARIZE_THRESHOLD: artifact reference (head + tail + size note)
 *
 * Safety bypass: if the context indicates error, gate, or test output, or if
 * safety-critical patterns are detected, the output is always inlined regardless
 * of size.
 */
export function summarizeOutput(output: string, context: OutputContext): SummarizedOutput {
  const length = output.length;
  const safetyBypass = shouldBypassSummarization(output, context);

  if (safetyBypass || length <= INLINE_THRESHOLD) {
    return {
      disposition: 'inline',
      originalLength: length,
      rendered: output,
      safetyBypass,
    };
  }

  if (length <= SUMMARIZE_THRESHOLD) {
    return {
      disposition: 'summarized',
      originalLength: length,
      rendered: buildSummaryText(output),
      safetyBypass: false,
    };
  }

  return {
    disposition: 'artifact',
    originalLength: length,
    rendered: buildSummaryText(output),
    safetyBypass: false,
  };
}

/**
 * Validate that a summarized output preserves safety-critical information.
 *
 * Checks that patterns present in the original output are also present in the
 * rendered summary. Returns warnings for any critical patterns that were dropped.
 */
export function validateSummarySafety(original: string, summary: SummarizedOutput): SafetyResult {
  if (summary.disposition === 'inline') {
    return { safe: true, warnings: [] };
  }

  const warnings: SafetyWarning[] = [];

  for (const { re, description } of SAFETY_CRITICAL_PATTERNS) {
    if (re.test(original) && !re.test(summary.rendered)) {
      warnings.push({ pattern: re.source, description });
    }
  }

  return {
    safe: warnings.length === 0,
    warnings,
  };
}
