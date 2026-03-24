/**
 * transforms — Pure string transforms for pipe operator in let expressions.
 *
 * H-LANG-005: Supports `let x = run "cmd" | trim` and similar.
 */

export function applyTransform(value: string, transform: string): string {
  switch (transform.toLowerCase()) {
    case 'trim':
      return value.trim();
    case 'upper':
      return value.toUpperCase();
    case 'lower':
      return value.toLowerCase();
    case 'first':
      return value.split('\n')[0] ?? '';
    case 'last': {
      const lines = value.split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i] !== '') return lines[i]!;
      }
      return '';
    }
    default:
      return value;
  }
}
