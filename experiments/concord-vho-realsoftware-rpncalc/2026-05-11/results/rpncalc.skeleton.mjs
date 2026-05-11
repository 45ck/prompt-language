// rpncalc skeleton — function bodies start as throw-stubs.
// Frontier-owned: calculate (orchestrator).

export function isNumber(_token) {
  void _token;
  throw new Error('NOT_IMPLEMENTED:isNumber');
}

export function isOperator(_token) {
  void _token;
  throw new Error('NOT_IMPLEMENTED:isOperator');
}

export function safeNumber(_s) {
  void _s;
  throw new Error('NOT_IMPLEMENTED:safeNumber');
}

export function applyOperator(_op, _a, _b) {
  void _op;
  void _a;
  void _b;
  throw new Error('NOT_IMPLEMENTED:applyOperator');
}

export function tokenizeRpn(_expr) {
  void _expr;
  throw new Error('NOT_IMPLEMENTED:tokenizeRpn');
}

export function formatResult(_n) {
  void _n;
  throw new Error('NOT_IMPLEMENTED:formatResult');
}

export function evaluate(_tokens) {
  void _tokens;
  throw new Error('NOT_IMPLEMENTED:evaluate');
}

// FRONTIER-OWNED: orchestrator
export function calculate(expr) {
  const tokens = tokenizeRpn(expr);
  if (tokens.length === 0) throw new Error('empty expression');
  return formatResult(evaluate(tokens));
}
