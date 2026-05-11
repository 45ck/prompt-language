// rpncalc skeleton — function bodies start as throw-stubs.
// Frontier-owned: calculate (orchestrator).

export function isNumber(token) {
  return /^-?\d+(\.\d+)?$/.test(token);
}

export function isOperator(token) {
  return token === '+' || token === '-' || token === '*' || token === '/';
}

export function safeNumber(s) {
  const num = Number(s);
  if (isNaN(num)) {
    throw new Error(`not a number: ${s}`);
  }
  return num;
}

export function applyOperator(op, a, b) {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '*') return a * b;
  if (op === '/') {
    if (b === 0) throw new Error('division by zero');
    return a / b;
  }
  throw new Error(`unknown operator: ${op}`);
}

export function tokenizeRpn(expr) {
  return String(expr)
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

export function formatResult(n) {
  if (Number.isInteger(n)) {
    return n.toString();
  }
  let result = n.toFixed(6);
  result = result.replace(/\.?0+$/, '');
  return result;
}

export function evaluate(tokens) {
  const stack = [];

  for (const token of tokens) {
    if (isNumber(token)) {
      stack.push(safeNumber(token));
    } else if (isOperator(token)) {
      if (stack.length < 2) {
        throw new Error('stack underflow');
      }
      const b = stack.pop();
      const a = stack.pop();
      stack.push(applyOperator(token, a, b));
    } else {
      throw new Error(`unknown token: ${token}`);
    }
  }

  if (stack.length !== 1) {
    throw new Error(`malformed expression: ${stack.length} values left on stack`);
  }

  return stack[0];
}

// FRONTIER-OWNED: orchestrator
export function calculate(expr) {
  const tokens = tokenizeRpn(expr);
  if (tokens.length === 0) throw new Error('empty expression');
  return formatResult(evaluate(tokens));
}
