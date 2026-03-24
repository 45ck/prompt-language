/**
 * evaluateCondition — Pure condition evaluation against variable state.
 *
 * Resolves conditions like "command_failed", "tests_pass", "not done"
 * by looking up variables. Returns null when the condition cannot be
 * resolved from variables alone (needs command execution).
 *
 * H#1: Supports "and"/"or" logical operators (left-to-right, no precedence).
 * H#3: Supports comparison operators ==, !=, >, <, >=, <=.
 * H#6: Supports ${var} references and quoted strings in comparisons.
 */

// H#3: Comparison operators
const COMPARISON_RE = /^(.+?)\s+(==|!=|>=|<=|>|<)\s+(.+)$/;

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

// H#6: Resolve an operand — variable name, ${var} reference, or quoted literal
function resolveOperand(
  token: string,
  variables: Readonly<Record<string, string | number | boolean>>,
): string | number | boolean {
  const trimmed = token.trim();

  // Direct variable name
  if (trimmed in variables) return variables[trimmed]!;

  // ${var} reference
  const varMatch = /^\$\{(\w+)\}$/.exec(trimmed);
  if (varMatch?.[1] && varMatch[1] in variables) return variables[varMatch[1]]!;

  // Quoted string literal
  return stripQuotes(trimmed);
}

// H#3: Evaluate a comparison expression
function evaluateComparison(
  lhs: string,
  op: string,
  rhs: string,
  variables: Readonly<Record<string, string | number | boolean>>,
): boolean | null {
  const left = resolveOperand(lhs, variables);
  const right = resolveOperand(rhs, variables);

  const numLeft = typeof left === 'number' ? left : Number(left);
  const numRight = typeof right === 'number' ? right : Number(right);
  const bothNumeric = !isNaN(numLeft) && !isNaN(numRight);

  switch (op) {
    case '==':
      return bothNumeric ? numLeft === numRight : String(left) === String(right);
    case '!=':
      return bothNumeric ? numLeft !== numRight : String(left) !== String(right);
    case '>':
      return bothNumeric ? numLeft > numRight : null;
    case '<':
      return bothNumeric ? numLeft < numRight : null;
    case '>=':
      return bothNumeric ? numLeft >= numRight : null;
    case '<=':
      return bothNumeric ? numLeft <= numRight : null;
    default:
      return null;
  }
}

/**
 * Evaluate a condition string against the current variable state.
 *
 * - Boolean variables: returns the boolean value directly.
 * - Number variables: truthy = non-zero.
 * - String variables: truthy = non-empty.
 * - "not <condition>": negates the inner result.
 * - "A and B": both must be true (returns false if either is false, null if either unknown).
 * - "A or B": either must be true (returns true if either is true, null if both unknown).
 * - Comparison operators: ==, !=, >, <, >=, <=.
 * - Returns null when the variable is not present (needs external evaluation).
 */
export function evaluateCondition(
  condition: string,
  variables: Readonly<Record<string, string | number | boolean>>,
): boolean | null {
  const trimmed = condition.trim();

  // H#1: Split on " and " (case-insensitive)
  const andIdx = trimmed.search(/\s+and\s+/i);
  if (andIdx >= 0) {
    const andMatch = /\s+and\s+/i.exec(trimmed.slice(andIdx));
    const left = evaluateCondition(trimmed.slice(0, andIdx), variables);
    const right = evaluateCondition(trimmed.slice(andIdx + andMatch![0].length), variables);
    if (left === false || right === false) return false;
    if (left === null || right === null) return null;
    return left && right;
  }

  // H#1: Split on " or " (case-insensitive)
  const orIdx = trimmed.search(/\s+or\s+/i);
  if (orIdx >= 0) {
    const orMatch = /\s+or\s+/i.exec(trimmed.slice(orIdx));
    const left = evaluateCondition(trimmed.slice(0, orIdx), variables);
    const right = evaluateCondition(trimmed.slice(orIdx + orMatch![0].length), variables);
    if (left === true || right === true) return true;
    if (left === null || right === null) return null;
    return left || right;
  }

  // "not" prefix
  if (trimmed.startsWith('not ')) {
    const inner = evaluateCondition(trimmed.slice(4), variables);
    return inner === null ? null : !inner;
  }

  // H-LANG-012: "contains" operator — left string includes right string
  const containsIdx = trimmed.search(/\s+contains\s+/i);
  if (containsIdx >= 0) {
    const containsMatch = /\s+contains\s+/i.exec(trimmed.slice(containsIdx));
    const left = resolveOperand(trimmed.slice(0, containsIdx), variables);
    const right = resolveOperand(trimmed.slice(containsIdx + containsMatch![0].length), variables);
    return String(left).includes(String(right));
  }

  // H#3: Comparison operators
  const compMatch = COMPARISON_RE.exec(trimmed);
  if (compMatch?.[1] && compMatch[2] && compMatch[3]) {
    return evaluateComparison(compMatch[1], compMatch[2], compMatch[3], variables);
  }

  // Literal boolean values
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Simple variable lookup
  if (!(trimmed in variables)) return null;

  const value = variables[trimmed];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.length > 0;

  return null;
}
