/**
 * evaluateCondition — Pure condition evaluation against variable state.
 *
 * Resolves conditions like "command_failed", "tests_pass", "not done"
 * by looking up variables. Returns null when the condition cannot be
 * resolved from variables alone (needs command execution).
 */

/**
 * Evaluate a condition string against the current variable state.
 *
 * - Boolean variables: returns the boolean value directly.
 * - Number variables: truthy = non-zero.
 * - String variables: truthy = non-empty.
 * - "not <condition>": negates the inner result.
 * - Returns null when the variable is not present (needs external evaluation).
 */
export function evaluateCondition(
  condition: string,
  variables: Readonly<Record<string, string | number | boolean>>,
): boolean | null {
  const trimmed = condition.trim();

  if (trimmed.startsWith('not ')) {
    const inner = evaluateCondition(trimmed.slice(4), variables);
    return inner === null ? null : !inner;
  }

  if (!(trimmed in variables)) return null;

  const value = variables[trimmed];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.length > 0;

  return null;
}
