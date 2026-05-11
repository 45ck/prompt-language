// Integration tests: full RPN evaluation end-to-end.

import { resolve } from 'node:path';

const implPath = process.argv[2];
if (!implPath) { console.error('usage: integration.test.mjs <pathToRpncalcMjs>'); process.exit(2); }

let calculate;
try {
  const mod = await import(`file://${resolve(process.cwd(), implPath).replace(/\\/g, '/')}`);
  calculate = mod.calculate;
} catch (e) { console.error(`import failed: ${e.message}`); process.exit(1); }

const cases = [
  // Simple arithmetic
  ['3 4 +', '7'],
  ['10 2 -', '8'],
  ['3 4 *', '12'],
  ['10 2 /', '5'],
  // Multiple operations
  ['3 4 + 2 *', '14'],
  ['1 2 + 3 4 + *', '21'],
  // Negative numbers
  ['-3 4 +', '1'],
  ['5 -2 *', '-10'],
  // Decimals
  ['1 3 /', '0.333333'],
  ['0.5 0.5 +', '1'],
  // Whitespace tolerance
  ['  3   4   +  ', '7'],
];

const errCases = [
  ['', 'empty expression'],
  ['3 0 /', 'division by zero'],
  ['+', 'stack underflow'],
  ['3 4', 'malformed expression'],
  ['3 4 abc', 'unknown token'],
];

let pass = 0;
const failures = [];
for (const [input, expected] of cases) {
  let actual;
  try { actual = calculate(input); }
  catch (e) { failures.push(`calculate(${JSON.stringify(input)}) threw: ${e.message}`); continue; }
  if (actual === expected) pass++;
  else failures.push(`calculate(${JSON.stringify(input)}) = ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`);
}
for (const [input, expectedMsgPart] of errCases) {
  try {
    const r = calculate(input);
    failures.push(`calculate(${JSON.stringify(input)}) returned ${JSON.stringify(r)} but should have thrown ${expectedMsgPart}`);
  } catch (e) {
    if (String(e.message).includes(expectedMsgPart)) pass++;
    else failures.push(`calculate(${JSON.stringify(input)}) threw '${e.message}' expected match '${expectedMsgPart}'`);
  }
}

const total = cases.length + errCases.length;
console.log(JSON.stringify({ implPath, passed: pass, total, oraclePass: pass === total }));
if (failures.length) console.error(failures.join('\n'));
process.exit(pass === total ? 0 : 1);
