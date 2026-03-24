/**
 * capture-prompt — Pure functions to build meta-prompts for variable capture.
 *
 * When `let x = prompt "..."` is encountered, we need Claude to capture its
 * response. Dual strategy: inline capture tag (primary) + file write (fallback).
 */

const MAX_CAPTURE_LENGTH = 2000;

export const CAPTURE_VARS_DIR = '.prompt-language/vars';

export const CAPTURE_TAG_BASE = 'prompt-language-capture';

/** @deprecated Use captureTagName(nonce) for nonce-aware tag names. */
export const CAPTURE_TAG = CAPTURE_TAG_BASE;

/** Build the nonce-specific capture tag name. */
export function captureTagName(nonce: string): string {
  return `${CAPTURE_TAG_BASE}-${nonce}`;
}

export function captureFilePath(varName: string): string {
  return `${CAPTURE_VARS_DIR}/${varName}`;
}

export function buildCapturePrompt(promptText: string, varName: string, nonce?: string): string {
  const tag = nonce ? captureTagName(nonce) : CAPTURE_TAG_BASE;
  return `${promptText}

[Internal — prompt-language variable capture: After completing the task above, \
you MUST do both of the following:
1. Wrap your answer in tags: <${tag} name="${varName}">your answer here</${tag}>
2. Also save your answer to \`${captureFilePath(varName)}\` using the Write tool.
If listing multiple items, write one item per line — no bullets, no numbers, just plain text lines. \
Maximum ${MAX_CAPTURE_LENGTH} characters.]`;
}

export function buildCaptureRetryPrompt(varName: string, nonce?: string): string {
  const tag = nonce ? captureTagName(nonce) : CAPTURE_TAG_BASE;
  return `[Internal — prompt-language: Variable capture for "${varName}" was not detected. \
Please provide your response again, wrapping it in tags: \
<${tag} name="${varName}">your answer</${tag}> \
and also save it to \`${captureFilePath(varName)}\` using the Write tool.]`;
}

export const DEFAULT_MAX_CAPTURE_RETRIES = 3;
