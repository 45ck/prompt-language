function calculate(expression) {
  const tokens = tokenize(expression);
  return evaluate(tokens);
}

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    if (expr[i] === ' ') {
      i++;
      continue;
    }
    if ('+-*/'.includes(expr[i])) {
      tokens.push({ type: 'op', value: expr[i] });
      i++;
    } else if (/[0-9]/.test(expr[i])) {
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i++];
      }
      tokens.push({ type: 'num', value: parseFloat(num) });
    } else {
      throw new Error('Unknown character: ' + expr[i]);
    }
  }
  return tokens;
}

function evaluate(tokens) {
  if (tokens.length === 0) return 0;
  // Bug 1: doesn't handle operator precedence — evaluates left to right
  let result = tokens[0].value;
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i].value;
    const next = tokens[i + 1].value;
    switch (op) {
      case '+':
        result += next;
        break;
      case '-':
        result -= next;
        break;
      case '*':
        result *= next;
        break;
      // Bug 2: division by zero returns Infinity instead of throwing
      case '/':
        result /= next;
        break;
    }
  }
  return result;
}

module.exports = { calculate };
