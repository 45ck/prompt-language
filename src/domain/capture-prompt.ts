/**
 * capture-prompt — Pure functions to build meta-prompts for file-based variable capture.
 *
 * When `let x = prompt "..."` is encountered, we need Claude to write its
 * response to a file so the plugin can read it back. These functions generate
 * the meta-prompts that instruct Claude to do so.
 */

const MAX_CAPTURE_LENGTH = 2000;

const VARS_DIR = '.prompt-language/vars';

export function captureFilePath(varName: string): string {
  return `${VARS_DIR}/${varName}`;
}

export function buildCapturePrompt(promptText: string, varName: string): string {
  return `${promptText}

[Internal — prompt-language variable capture: After completing the task above, \
save your complete response to \`${captureFilePath(varName)}\` using the Write tool. \
If listing multiple items, write one item per line — no bullets, no numbers, just plain text lines. \
Maximum ${MAX_CAPTURE_LENGTH} characters.]`;
}

export function buildCaptureRetryPrompt(varName: string): string {
  return `[Internal — prompt-language: The file \`${captureFilePath(varName)}\` was \
not found or was empty. Please write your response there now. One item per line \
if listing multiple items.]`;
}

export const DEFAULT_MAX_CAPTURE_RETRIES = 3;
