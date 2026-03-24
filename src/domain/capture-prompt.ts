/**
 * capture-prompt — Pure functions to build meta-prompts for variable capture.
 *
 * When `let x = prompt "..."` is encountered, we need Claude to capture its
 * response. Dual strategy: inline capture tag (primary) + file write (fallback).
 */

const MAX_CAPTURE_LENGTH = 2000;

export const CAPTURE_VARS_DIR = '.prompt-language/vars';

export const CAPTURE_TAG = 'prompt-language-capture';

export function captureFilePath(varName: string): string {
  return `${CAPTURE_VARS_DIR}/${varName}`;
}

export function buildCapturePrompt(promptText: string, varName: string): string {
  return `${promptText}

[Internal — prompt-language variable capture: After completing the task above, \
you MUST do both of the following:
1. Wrap your answer in tags: <${CAPTURE_TAG} name="${varName}">your answer here</${CAPTURE_TAG}>
2. Also save your answer to \`${captureFilePath(varName)}\` using the Write tool.
If listing multiple items, write one item per line — no bullets, no numbers, just plain text lines. \
Maximum ${MAX_CAPTURE_LENGTH} characters.]`;
}

export function buildCaptureRetryPrompt(varName: string): string {
  return `[Internal — prompt-language: Variable capture for "${varName}" was not detected. \
Please provide your response again, wrapping it in tags: \
<${CAPTURE_TAG} name="${varName}">your answer</${CAPTURE_TAG}> \
and also save it to \`${captureFilePath(varName)}\` using the Write tool.]`;
}

export const DEFAULT_MAX_CAPTURE_RETRIES = 3;
