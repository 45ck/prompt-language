export type DebugCategory = 'hook' | 'advance' | 'condition' | 'gate' | 'capture';

function parseDebugLevel(value: string | undefined): 0 | 1 | 2 | 3 {
  if (!value) return 0;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === '0' || normalized === 'false') return 0;
  if (normalized === '1' || normalized === 'true') return 1;
  if (normalized === '2') return 2;
  if (normalized === '3') return 3;
  return 1;
}

function debugLevel(): 0 | 1 | 2 | 3 {
  if (typeof process === 'undefined') return 0;
  return parseDebugLevel(process.env['PROMPT_LANGUAGE_DEBUG']);
}

/**
 * Write a debug message to stderr when requested by PROMPT_LANGUAGE_DEBUG.
 * Level 1: basic lifecycle
 * Level 2: condition/path/variable details
 * Level 3: deep gate/capture diagnostics
 */
export function debug(
  message: string,
  opts?: { readonly category?: DebugCategory; readonly level?: 1 | 2 | 3 },
): void {
  const level = opts?.level ?? 1;
  if (debugLevel() < level) return;
  const category = opts?.category ?? 'hook';
  process.stderr.write(`[PL:${category}] ${message}\n`);
}
