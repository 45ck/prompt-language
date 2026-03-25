/**
 * Debug logging helper for hook execution.
 *
 * When `PROMPT_LANGUAGE_DEBUG` is set (any truthy value), writes
 * timestamped messages to stderr with [PL:debug] prefix.
 */

const isDebug =
  typeof process !== 'undefined' &&
  !!process.env['PROMPT_LANGUAGE_DEBUG'] &&
  process.env['PROMPT_LANGUAGE_DEBUG'] !== '0' &&
  process.env['PROMPT_LANGUAGE_DEBUG'] !== 'false';

/**
 * Write a debug message to stderr if PROMPT_LANGUAGE_DEBUG is set.
 * Messages are prefixed with `[PL:debug]` for easy filtering.
 */
export function debug(message: string): void {
  if (!isDebug) return;
  process.stderr.write(`[PL:debug] ${message}\n`);
}
