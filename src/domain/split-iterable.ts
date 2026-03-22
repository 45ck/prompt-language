/**
 * splitIterable — pure function to split a raw string into list items.
 *
 * Priority:
 * 1. JSON array — if the string starts with `[`, parse as JSON, stringify each element
 * 2. Newline-delimited — if the string contains `\n`, split on newlines, trim empties
 * 3. Whitespace-delimited — split on whitespace as fallback
 */

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

  // 2. Newline-delimited
  if (trimmed.includes('\n')) {
    return trimmed
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  // 3. Whitespace-delimited
  return trimmed.split(/\s+/);
}
