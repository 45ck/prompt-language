/**
 * list-variable — Pure functions for list variable manipulation.
 *
 * Lists are stored as JSON array strings in the variable store.
 * Auto-upgrades scalars to arrays when appending.
 */

export function initEmptyList(): string {
  return '[]';
}

function parseJsonArray(value: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // not a JSON array
  }
  return null;
}

export function appendToList(
  currentValue: string | number | boolean | undefined,
  newItem: string,
): string {
  let items: string[];

  if (currentValue === undefined) {
    items = [];
  } else {
    const str = String(currentValue);
    const parsed = parseJsonArray(str);
    if (parsed) {
      items = parsed;
    } else {
      // Auto-upgrade scalar to array
      items = [str];
    }
  }

  items.push(newItem);
  return JSON.stringify(items);
}

export function listLength(value: string | number | boolean | undefined): number {
  if (value === undefined) return 0;
  const str = String(value);
  const parsed = parseJsonArray(str);
  return parsed ? parsed.length : 0;
}
