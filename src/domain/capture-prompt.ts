/**
 * capture-prompt — Pure functions to build meta-prompts for variable capture.
 *
 * When `let x = prompt "..."` is encountered, we need Claude to capture its
 * response. Capture channel: Write-tool file write to .prompt-language/vars/{varName}.
 */

const MAX_CAPTURE_LENGTH = 2000;

export const CAPTURE_VARS_DIR = '.prompt-language/vars';

/**
 * @deprecated Tag-based capture has been removed. Kept for tag-capture-reader.ts compatibility.
 * The sole capture channel is now file write via the Write tool.
 */
export const CAPTURE_TAG_BASE = 'prompt-language-capture';

/** @deprecated Tag-based capture has been removed. */
export const CAPTURE_TAG = CAPTURE_TAG_BASE;

/** @deprecated Tag-based capture has been removed. Kept for tag-capture-reader.ts compatibility. */
export function captureTagName(nonce: string): string {
  return `${CAPTURE_TAG_BASE}-${nonce}`;
}

export function captureFilePath(varName: string): string {
  return `${CAPTURE_VARS_DIR}/${varName}`;
}

export function buildCapturePrompt(promptText: string, varName: string, _nonce?: string): string {
  return `${promptText}

[Internal — prompt-language variable capture: After completing the task above, \
save your answer to \`${captureFilePath(varName)}\` using the Write tool. \
If listing multiple items, write one item per line — no bullets, no numbers, just plain text lines. \
Maximum ${MAX_CAPTURE_LENGTH} characters.]`;
}

export function buildCaptureRetryPrompt(varName: string, _nonce?: string): string {
  return `[Internal — prompt-language: Variable capture for "${varName}" was not found. \
Please save your response to \`${captureFilePath(varName)}\` using the Write tool.]`;
}

export const DEFAULT_MAX_CAPTURE_RETRIES = 3;

/**
 * @deprecated Tag-based capture has been removed. Use file-based capture instead.
 * Kept for backward compatibility only. Will be removed in a future version.
 */
export function extractCaptureTag(text: string, varName: string, nonce?: string): string | null {
  const tag = nonce ? captureTagName(nonce) : CAPTURE_TAG_BASE;
  // Escape special regex chars in tag name (hyphens are fine in character class but not in raw)
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<${escaped}\\s+name="${varName}"\\s*>([\\s\\S]*?)</${escaped}>`);
  const match = re.exec(text);
  if (!match?.[1]) return null;
  const value = match[1].trim();
  if (!value) return null;
  return value.length > MAX_CAPTURE_LENGTH ? value.slice(0, MAX_CAPTURE_LENGTH) : value;
}

/**
 * Build a meta-prompt that asks Claude to respond with a JSON object matching the given schema.
 *
 * The response is captured via file write to .prompt-language/vars/{varName}.
 */
export function buildJsonCapturePrompt(
  promptText: string,
  varName: string,
  schema: string,
  _nonce?: string,
): string {
  return `${promptText}

[Internal — prompt-language JSON capture: Respond with a JSON object that matches this schema:
\`\`\`
${schema}
\`\`\`
Save your JSON answer to \`${captureFilePath(varName)}\` using the Write tool. \
Respond with ONLY valid JSON — no explanation, no markdown fences, just the JSON object. \
Maximum ${MAX_CAPTURE_LENGTH} characters.]`;
}

/**
 * Build a retry prompt when a JSON capture response was not valid JSON or not found.
 */
export function buildJsonCaptureRetryPrompt(
  varName: string,
  schema: string,
  _nonce?: string,
): string {
  return `[Internal — prompt-language: JSON capture for "${varName}" failed. \
Please provide a valid JSON object matching this schema:
\`\`\`
${schema}
\`\`\`
Save it to \`${captureFilePath(varName)}\` using the Write tool. \
Respond with ONLY valid JSON.]`;
}
