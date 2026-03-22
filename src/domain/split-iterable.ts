/**
 * splitIterable — pure function to split a raw string into list items.
 *
 * Priority:
 * 1. JSON array — if the string starts with `[`, parse as JSON, stringify each element
 * 2. Markdown/numbered lists — strip `- `, `* `, `+ `, `1. `, `2) ` prefixes
 * 3. Newline-delimited — if the string contains `\n`, split on newlines, trim empties
 * 4. Whitespace-delimited — split on whitespace as fallback
 */

/** Matches markdown bullets (`- `, `* `, `+ `) or numbered lists (`1. `, `2) `). */
const LIST_PREFIX_RE = /^(?:[-*+]|\d+[.)]) /;

function isListFormatted(lines: string[]): boolean {
  const nonEmpty = lines.filter((l) => l.length > 0);
  if (nonEmpty.length < 2) return false;
  return nonEmpty.every((line) => LIST_PREFIX_RE.test(line));
}

function stripListPrefix(line: string): string {
  return line.replace(LIST_PREFIX_RE, '');
}

export function splitIterable(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // 1. JSON array
  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => (typeof item === 'string' ? item : JSON.stringify(item)));
      }
    } catch {
      // Not valid JSON — fall through to other strategies
    }
  }

  // 2. Markdown/numbered lists (require newlines and list prefixes on every non-empty line)
  if (trimmed.includes('\n')) {
    const lines = trimmed.split('\n').map((line) => line.trim());
    if (isListFormatted(lines)) {
      return lines
        .filter((line) => line.length > 0)
        .map(stripListPrefix)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    }

    // 3. Newline-delimited
    return lines.filter((line) => line.length > 0);
  }

  // 4. Whitespace-delimited
  return trimmed.split(/\s+/);
}
