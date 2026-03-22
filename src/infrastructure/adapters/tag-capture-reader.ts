/**
 * Tag-based capture extraction — pure function to extract variable values
 * from inline capture tags in Claude's response text.
 *
 * Tags have the format:
 *   <prompt-language-capture name="varName">value</prompt-language-capture>
 */

import { CAPTURE_TAG } from '../../domain/capture-prompt.js';

const MAX_CAPTURE_LENGTH = 2000;

/**
 * Extract a captured variable value from text containing capture tags.
 * Returns the trimmed content between the tags, or null if not found/empty.
 */
export function extractCaptureTag(text: string, varName: string): string | null {
  if (!/^\w+$/.test(varName)) return null; // D7: reject unsafe variable names
  const openTag = `<${CAPTURE_TAG} name="${varName}">`;
  const closeTag = `</${CAPTURE_TAG}>`;

  const startIdx = text.indexOf(openTag);
  if (startIdx === -1) return null;

  const contentStart = startIdx + openTag.length;
  const endIdx = text.indexOf(closeTag, contentStart);
  if (endIdx === -1) return null;

  const content = text.slice(contentStart, endIdx).trim();
  if (!content) return null;

  // D7: reject content containing nested capture tags (malformed/unclosed upstream tag)
  if (content.includes(`<${CAPTURE_TAG}`)) return null;

  if (content.length > MAX_CAPTURE_LENGTH) {
    return content.slice(0, MAX_CAPTURE_LENGTH);
  }

  return content;
}
