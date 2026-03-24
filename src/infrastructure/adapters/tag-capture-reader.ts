/**
 * Tag-based capture extraction — pure function to extract variable values
 * from inline capture tags in Claude's response text.
 *
 * Tags have the format (with nonce):
 *   <prompt-language-capture-{nonce} name="varName">value</prompt-language-capture-{nonce}>
 * Legacy format (without nonce):
 *   <prompt-language-capture name="varName">value</prompt-language-capture>
 */

import { CAPTURE_TAG_BASE, captureTagName } from '../../domain/capture-prompt.js';

const MAX_CAPTURE_LENGTH = 2000;

const SAFE_VAR_NAME = /^\w+$/;

/** Resolve the tag name to use for extraction. */
function resolveTag(nonce?: string): string {
  return nonce ? captureTagName(nonce) : CAPTURE_TAG_BASE;
}

/**
 * Extract a captured variable value from text containing capture tags.
 * Returns the trimmed content between the tags, or null if not found/empty.
 * When nonce is provided, only tags with that nonce are matched.
 */
export function extractCaptureTag(text: string, varName: string, nonce?: string): string | null {
  if (!SAFE_VAR_NAME.test(varName)) return null; // D7: reject unsafe variable names
  const tag = resolveTag(nonce);
  const openTag = `<${tag} name="${varName}">`;
  const closeTag = `</${tag}>`;

  const startIdx = text.indexOf(openTag);
  if (startIdx === -1) return null;

  const contentStart = startIdx + openTag.length;
  const endIdx = text.indexOf(closeTag, contentStart);
  if (endIdx === -1) return null;

  const content = text.slice(contentStart, endIdx).trim();
  if (!content) return null;

  // D7: reject content containing nested capture tags (malformed/unclosed upstream tag)
  if (content.includes(`<${tag}`)) return null;

  if (content.length > MAX_CAPTURE_LENGTH) {
    return content.slice(0, MAX_CAPTURE_LENGTH);
  }

  return content;
}

/**
 * Extract all captured variable name/value pairs from text containing capture tags.
 * Uses extractCaptureTag for each match, inheriting its D7 security checks.
 * When nonce is provided, only tags with that nonce are matched.
 */
export function extractAllCaptureTags(
  text: string,
  nonce?: string,
): { varName: string; value: string }[] {
  const tag = resolveTag(nonce);
  const namePattern = new RegExp(`<${tag} name="([^"]+)">`, 'g');
  const seen = new Set<string>();
  const results: { varName: string; value: string }[] = [];

  let match: RegExpExecArray | null;
  while ((match = namePattern.exec(text)) !== null) {
    const varName = match[1]!;
    if (seen.has(varName)) continue;
    seen.add(varName);

    const value = extractCaptureTag(text, varName, nonce);
    if (value !== null) {
      results.push({ varName, value });
    }
  }

  return results;
}
