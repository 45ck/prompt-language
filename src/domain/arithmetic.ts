/**
 * evaluateArithmetic — Pure arithmetic expression evaluator.
 *
 * Evaluates simple integer arithmetic expressions with +, -, *, /, %.
 * Uses left-to-right evaluation (no operator precedence).
 * Returns null for non-arithmetic input or division by zero.
 */

const OPERATOR_RE = /\s*([+\-*/%])\s*/;

export function evaluateArithmetic(expr: string): number | null {
  const trimmed = expr.trim();
  if (trimmed === '') return null;

  // Tokenize: split on operators while keeping them
  // We need to handle negative numbers at the start: "-5 + 3"
  const tokens: string[] = [];
  const ops: string[] = [];

  let remaining = trimmed;

  // Handle leading negative sign
  let negative = false;
  if (remaining.startsWith('-')) {
    negative = true;
    remaining = remaining.slice(1).trimStart();
  }

  // Parse first number
  const firstMatch = /^(\d+)/.exec(remaining);
  if (!firstMatch) return null;

  let firstNum = parseInt(firstMatch[1]!, 10);
  if (negative) firstNum = -firstNum;
  tokens.push(String(firstNum));
  remaining = remaining.slice(firstMatch[1]!.length);

  // Parse subsequent operator + number pairs
  while (remaining.length > 0) {
    const opMatch = OPERATOR_RE.exec(remaining);
    if (opMatch?.index !== 0) return null;

    const op = opMatch[1]!;
    remaining = remaining.slice(opMatch[0].length);

    // Handle negative number after operator (e.g., "3 + -2")
    let numNeg = false;
    if (remaining.startsWith('-')) {
      numNeg = true;
      remaining = remaining.slice(1).trimStart();
    }

    const numMatch = /^(\d+)/.exec(remaining);
    if (!numMatch) return null;

    let num = parseInt(numMatch[1]!, 10);
    if (numNeg) num = -num;

    ops.push(op);
    tokens.push(String(num));
    remaining = remaining.slice(numMatch[1]!.length).trimStart();
  }

  // Need at least one number
  if (tokens.length === 0) return null;

  // Evaluate left-to-right
  let result = parseInt(tokens[0]!, 10);

  for (let i = 0; i < ops.length; i++) {
    const operand = parseInt(tokens[i + 1]!, 10);
    switch (ops[i]) {
      case '+':
        result = result + operand;
        break;
      case '-':
        result = result - operand;
        break;
      case '*':
        result = result * operand;
        break;
      case '/':
        if (operand === 0) return null;
        result = Math.trunc(result / operand);
        break;
      case '%':
        if (operand === 0) return null;
        result = result % operand;
        break;
      default:
        return null;
    }
  }

  return result;
}
