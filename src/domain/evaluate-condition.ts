import { interpolate } from './interpolate.js';
import type { VariableStore, VariableValue } from './variable-value.js';
import { stringifyVariableValue } from './variable-value.js';

/**
 * evaluateCondition — Pure condition evaluation against variable state.
 *
 * Resolves conditions like "command_failed", "tests_pass", "not done"
 * by looking up variables. Returns null when the condition cannot be
 * resolved from variables alone (needs command execution).
 *
 * H#1: Supports "and"/"or" logical operators with standard precedence
 *      ("and" binds tighter than "or"). Left-to-right associativity within
 *      each precedence level. Parentheses override precedence: (a or b) and c.
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
function resolveOperand(token: string, variables: VariableStore): VariableValue {
  const trimmed = token.trim();

  // Direct variable name
  if (trimmed in variables) return variables[trimmed]!;

  // ${var} or ${var.field} reference (dot-notation for JSON field access)
  const varMatch = /^\$\{([\w.]+)\}$/.exec(trimmed);
  if (varMatch?.[1] && varMatch[1] in variables) return variables[varMatch[1]]!;

  // Quoted string literal
  return stripQuotes(trimmed);
}

// H#3: Evaluate a comparison expression
function evaluateComparison(
  lhs: string,
  op: string,
  rhs: string,
  variables: VariableStore,
): boolean | null {
  const left = resolveOperand(lhs, variables);
  const right = resolveOperand(rhs, variables);

  const numLeft = typeof left === 'number' ? left : Number(left);
  const numRight = typeof right === 'number' ? right : Number(right);
  const bothNumeric = !isNaN(numLeft) && !isNaN(numRight);

  switch (op) {
    case '==':
      return bothNumeric
        ? numLeft === numRight
        : stringifyVariableValue(left) === stringifyVariableValue(right);
    case '!=':
      return bothNumeric
        ? numLeft !== numRight
        : stringifyVariableValue(left) !== stringifyVariableValue(right);
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
 * Find the rightmost "and" or "or" operator at paren-depth 0.
 *
 * Implements standard precedence: "or" has lower precedence than "and",
 * so we prefer splitting on "or" first. Left-to-right associativity within
 * each level is achieved by taking the rightmost match.
 *
 * Examples:
 *   "a or b and c"  → splits at "or"  → a or (b and c)   [standard precedence]
 *   "a and b or c"  → splits at "or"  → (a and b) or c   [standard precedence]
 *   "(a or b) and c"→ splits at "and" → (a or b) and c   [parens override]
 *   "a and b and c" → splits at last "and" → (a and b) and c [left-to-right]
 */
function findRightmostOperatorOutsideParens(
  condition: string,
): { operator: 'and' | 'or'; index: number; length: number } | null {
  // Build depth array: depth[i] = number of unclosed '(' before character i
  const depths: number[] = new Array(condition.length).fill(0);
  let d = 0;
  for (let i = 0; i < condition.length; i++) {
    depths[i] = d;
    if (condition[i] === '(') d++;
    else if (condition[i] === ')') d--;
  }

  // Find rightmost 'or' and rightmost 'and' at depth 0
  let orMatch: { index: number; length: number } | null = null;
  let andMatch: { index: number; length: number } | null = null;

  const re = /\s+(and|or)\s+/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(condition)) !== null) {
    if ((depths[match.index] ?? 0) === 0) {
      const op = match[1]!.toLowerCase() as 'and' | 'or';
      // Always overwrite — gives rightmost match (left-to-right associativity)
      if (op === 'or') {
        orMatch = { index: match.index, length: match[0].length };
      } else {
        andMatch = { index: match.index, length: match[0].length };
      }
    }
  }

  // 'or' has lower precedence → split on 'or' first when present
  if (orMatch) return { operator: 'or', ...orMatch };
  if (andMatch) return { operator: 'and', ...andMatch };
  return null;
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
 * - Unset command_failed/command_succeeded default to false before any run executes.
 * - Returns null when the variable is not present (needs external evaluation).
 */
export function evaluateCondition(condition: string, variables: VariableStore): boolean | null {
  const trimmed = interpolate(condition, variables).trim();

  // Strip outer parentheses: (expr) → recurse on expr
  if (trimmed.startsWith('(')) {
    let depth = 0;
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] === '(') depth++;
      else if (trimmed[i] === ')') {
        depth--;
        if (depth === 0) {
          if (i === trimmed.length - 1) {
            return evaluateCondition(trimmed.slice(1, -1), variables);
          }
          break; // '(' at start but matching ')' is not at end — not fully wrapped
        }
      }
    }
  }

  // H#1: Split on 'or'/'and' at paren-depth 0 with standard precedence
  const operatorMatch = findRightmostOperatorOutsideParens(trimmed);
  if (operatorMatch) {
    const { operator, index, length } = operatorMatch;
    const left = evaluateCondition(trimmed.slice(0, index), variables);
    const right = evaluateCondition(trimmed.slice(index + length), variables);
    if (operator === 'and') {
      if (left === false || right === false) return false;
      if (left === null || right === null) return null;
      return left && right;
    } else {
      // operator === 'or'
      if (left === true || right === true) return true;
      if (left === null || right === null) return null;
      return left || right;
    }
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

  // Simple variable lookup (D06-fix: check variables BEFORE literal booleans)
  if (trimmed in variables) {
    const value = variables[trimmed];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    return true;
  }

  if (trimmed === 'command_failed' || trimmed === 'command_succeeded') {
    return false;
  }

  // Literal boolean values (after variable lookup so vars named 'true'/'false' work)
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  return null;
}
