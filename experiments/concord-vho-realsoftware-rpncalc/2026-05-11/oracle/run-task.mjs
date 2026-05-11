// Per-task oracle for rpncalc. Same pattern as tinymd's run-task.mjs
// but with task-specific test slices.

import { resolve } from 'node:path';

const taskId = process.argv[2];
const workspacePath = process.argv[3];
if (!taskId || !workspacePath) {
  console.error('usage: run-task.mjs <taskId> <workspacePath>');
  process.exit(2);
}

let mod;
try {
  const abs = resolve(process.cwd(), workspacePath);
  mod = await import(`file://${abs.replace(/\\/g, '/')}`);
} catch (e) {
  console.error(`import failed: ${e.message}`);
  process.exit(1);
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a && b && typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
      return true;
    }
    const ka = Object.keys(a),
      kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
    return true;
  }
  return false;
}

function runCases(fn, cases, eq = deepEqual) {
  let pass = 0;
  const failures = [];
  for (const [args, expected] of cases) {
    let actual;
    try {
      actual = fn(...args);
    } catch (e) {
      failures.push(`fn(${JSON.stringify(args)}) threw: ${e.message}`);
      continue;
    }
    if (eq(actual, expected)) pass++;
    else
      failures.push(
        `fn(${JSON.stringify(args)}) = ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`,
      );
  }
  return { passed: pass, total: cases.length, failures };
}

function runThrows(fn, cases) {
  let pass = 0;
  const failures = [];
  for (const [args, expectedMsgPart] of cases) {
    try {
      const r = fn(...args);
      failures.push(
        `fn(${JSON.stringify(args)}) returned ${JSON.stringify(r)} but should have thrown matching '${expectedMsgPart}'`,
      );
    } catch (e) {
      if (String(e.message).includes(expectedMsgPart)) pass++;
      else
        failures.push(
          `fn(${JSON.stringify(args)}) threw '${e.message}' but expected match '${expectedMsgPart}'`,
        );
    }
  }
  return { passed: pass, total: cases.length, failures };
}

const TASKS = {
  isNumber: () =>
    runCases(mod.isNumber, [
      [['0'], true],
      [['42'], true],
      [['-7'], true],
      [['3.14'], true],
      [['-0.5'], true],
      [['1.'], false],
      [['.5'], false],
      [['+1'], false],
      [['1e2'], false],
      [['abc'], false],
      [[''], false],
    ]),
  isOperator: () =>
    runCases(mod.isOperator, [
      [['+'], true],
      [['-'], true],
      [['*'], true],
      [['/'], true],
      [['%'], false],
      [['++'], false],
      [[''], false],
      [['1'], false],
      [['plus'], false],
    ]),
  safeNumber: () => {
    const ok = runCases(mod.safeNumber, [
      [['3'], 3],
      [['3.14'], 3.14],
      [['-7'], -7],
      [['0'], 0],
    ]);
    const throws = runThrows(mod.safeNumber, [
      [['abc'], 'not a number'],
      [['NaN'], 'not a number'],
    ]);
    return {
      passed: ok.passed + throws.passed,
      total: ok.total + throws.total,
      failures: [...ok.failures, ...throws.failures],
    };
  },
  applyOperator: () => {
    const ok = runCases(mod.applyOperator, [
      [['+', 2, 3], 5],
      [['-', 5, 3], 2],
      [['*', 4, 2], 8],
      [['/', 10, 2], 5],
      [['/', 1, 4], 0.25],
    ]);
    const throws = runThrows(mod.applyOperator, [
      [['/', 5, 0], 'division by zero'],
      [['%', 1, 1], 'unknown operator'],
    ]);
    return {
      passed: ok.passed + throws.passed,
      total: ok.total + throws.total,
      failures: [...ok.failures, ...throws.failures],
    };
  },
  tokenizeRpn: () =>
    runCases(mod.tokenizeRpn, [
      [['3 4 +'], ['3', '4', '+']],
      [['  3   4   +  '], ['3', '4', '+']],
      [['3'], ['3']],
      [[''], []],
      [['3\t4\n+'], ['3', '4', '+']],
    ]),
  formatResult: () =>
    runCases(mod.formatResult, [
      [[3], '3'],
      [[3.14], '3.14'],
      [[1 / 3], '0.333333'],
      [[0.5], '0.5'],
      [[-7], '-7'],
      [[-0.25], '-0.25'],
      [[0], '0'],
    ]),
  evaluate: () => {
    const ok = runCases(mod.evaluate, [
      [[['3', '4', '+']], 7],
      [[['10', '2', '/']], 5],
      [[['3', '4', '*', '2', '+']], 14],
      [[['1', '2', '+', '3', '4', '+', '*']], 21],
      [[['5']], 5],
    ]);
    const throws = runThrows(mod.evaluate, [
      [[['+']], 'stack underflow'],
      [[['3', '4']], 'malformed expression'],
      [[['3', '0', '/']], 'division by zero'],
      [[['3', 'foo', '+']], 'unknown token'],
    ]);
    return {
      passed: ok.passed + throws.passed,
      total: ok.total + throws.total,
      failures: [...ok.failures, ...throws.failures],
    };
  },
};

const tester = TASKS[taskId];
if (!tester) {
  console.error(`unknown task: ${taskId}`);
  process.exit(2);
}
const r = tester();
const status = {
  taskId,
  passed: r.passed,
  total: r.total,
  oraclePass: r.passed === r.total,
  failures: r.failures,
};
process.stdout.write(JSON.stringify(status));
process.exit(status.oraclePass ? 0 : 1);
