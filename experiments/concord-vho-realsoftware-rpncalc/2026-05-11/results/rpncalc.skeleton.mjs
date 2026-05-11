// rpncalc skeleton — function bodies start as throw-stubs.
// Frontier-owned: calculate (orchestrator).

export function isNumber(token) { throw new Error('NOT_IMPLEMENTED:isNumber'); }

export function isOperator(token) { throw new Error('NOT_IMPLEMENTED:isOperator'); }

export function safeNumber(s) { throw new Error('NOT_IMPLEMENTED:safeNumber'); }

export function applyOperator(op, a, b) { throw new Error('NOT_IMPLEMENTED:applyOperator'); }

export function tokenizeRpn(expr) { throw new Error('NOT_IMPLEMENTED:tokenizeRpn'); }

export function formatResult(n) { throw new Error('NOT_IMPLEMENTED:formatResult'); }

export function evaluate(tokens) { throw new Error('NOT_IMPLEMENTED:evaluate'); }

// FRONTIER-OWNED: orchestrator
export function calculate(expr) {
  const tokens = tokenizeRpn(expr);
  if (tokens.length === 0) throw new Error('empty expression');
  return formatResult(evaluate(tokens));
}
