// rpncalc — frontier-only baseline. Reverse Polish Notation evaluator.
// Pre-committed; written before any local routing.

export function isNumber(token) {
  return /^-?\d+(\.\d+)?$/.test(token);
}

export function isOperator(token) {
  return token === '+' || token === '-' || token === '*' || token === '/';
}

export function safeNumber(s) {
  const n = Number(s);
  if (Number.isNaN(n)) throw new Error(`not a number: ${s}`);
  return n;
}

export function applyOperator(op, a, b) {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      if (b === 0) throw new Error('division by zero');
      return a / b;
    default:
      throw new Error(`unknown operator: ${op}`);
  }
}

export function tokenizeRpn(expr) {
  return String(expr)
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

export function formatResult(n) {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(6).replace(/\.?0+$/, '');
}

export function evaluate(tokens) {
  const stack = [];
  for (const t of tokens) {
    if (isNumber(t)) {
      stack.push(safeNumber(t));
    } else if (isOperator(t)) {
      if (stack.length < 2) throw new Error('stack underflow');
      const b = stack.pop();
      const a = stack.pop();
      stack.push(applyOperator(t, a, b));
    } else {
      throw new Error(`unknown token: ${t}`);
    }
  }
  if (stack.length !== 1)
    throw new Error(`malformed expression: ${stack.length} values left on stack`);
  return stack[0];
}

export function calculate(expr) {
  const tokens = tokenizeRpn(expr);
  if (tokens.length === 0) throw new Error('empty expression');
  const result = evaluate(tokens);
  return formatResult(result);
}
