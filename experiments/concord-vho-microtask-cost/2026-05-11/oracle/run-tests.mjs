// Oracle runner. Loads a single task implementation from a given path and
// runs the deterministic + seeded-random test suite against it.
// Exit code 0 on full pass, 1 on any failure. Stderr captures details.
//
// Usage: node oracle/run-tests.mjs <taskId> <implPath>

import { performance } from 'node:perf_hooks';

const taskId = process.argv[2];
const implPath = process.argv[3];
if (!taskId || !implPath) {
  console.error('usage: run-tests.mjs <taskId> <implPath>');
  process.exit(2);
}

// Seeded PRNG (mulberry32) for reproducible random tests
function rng(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (a instanceof Set && b instanceof Set) {
      if (a.size !== b.size) return false;
      for (const v of a) if (!b.has(v)) return false;
      return true;
    }
    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) return false;
      for (const [k, v] of a) if (!b.has(k) || !deepEqual(v, b.get(k))) return false;
      return true;
    }
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
      return true;
    }
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
    return true;
  }
  return false;
}

const SEED = 0xC0FFEE; // shared seed for reproducibility across arms
const r = rng(SEED);

const TASKS = {
  applyDiscountTier: (mod) => {
    const fn = mod.applyDiscountTier;
    const cases = [
      [[100, []], 100],
      [[100, [[200, 10]]], 100], // no tier applies
      [[200, [[100, 10]]], 180],
      [[500, [[100, 5], [300, 10], [500, 20]]], 400],
      [[299, [[100, 5], [300, 10], [500, 20]]], 299 * 0.95],
      [[0, [[0, 50]]], 0],
    ];
    for (let i = 0; i < 4; i++) {
      const tot = Math.floor(r() * 1000) + 1;
      const t1 = Math.floor(r() * 100);
      const p1 = Math.floor(r() * 50);
      const t2 = t1 + Math.floor(r() * 200) + 1;
      const p2 = p1 + Math.floor(r() * 30) + 1;
      const tiers = [[t1, p1], [t2, p2]];
      let pct = 0;
      for (const [m, p] of tiers) if (tot >= m) pct = p; else break;
      cases.push([[tot, tiers], tot * (1 - pct / 100)]);
    }
    return runCases(fn, cases, (a, b) => Math.abs(a - b) < 1e-9);
  },
  validateConfig: (mod) => {
    const fn = mod.validateConfig;
    const schema = {
      name: { type: 'string', required: true },
      age: { type: 'number' },
      active: { type: 'boolean', required: true },
    };
    const cases = [
      [[{ name: 'a', active: true }, schema], { len: 0 }],
      [[{ name: 'a', age: 5, active: true }, schema], { len: 0 }],
      [[{}, schema], { len: 2 }], // both required missing
      [[{ name: 5, active: true }, schema], { len: 1 }],
      [[{ name: 'a', active: 'yes' }, schema], { len: 1 }],
      [[{ name: 'a', active: true, extra: 'ignored' }, schema], { len: 0 }],
    ];
    let pass = 0;
    const failures = [];
    for (const [args, expected] of cases) {
      let actual;
      try { actual = fn(...args); } catch (e) { failures.push(`threw on ${JSON.stringify(args)}: ${e.message}`); continue; }
      if (!Array.isArray(actual)) { failures.push(`not array: ${JSON.stringify(actual)}`); continue; }
      if (actual.length === expected.len) pass++;
      else failures.push(`len mismatch on ${JSON.stringify(args[0])}: got ${actual.length} (${JSON.stringify(actual)}) expected ${expected.len}`);
    }
    return { passed: pass, total: cases.length, failures };
  },
  formatLogEntry: (mod) => {
    const fn = mod.formatLogEntry;
    const cases = [
      [[{ level: 'info', msg: 'started' }, { service: 'api', host: 'h1' }], '[INFO] api@h1: started'],
      [[{ level: 'error', msg: 'fail', fields: { code: 500, attempt: 2 } }, { service: 'web', host: 'h2' }], '[ERROR] web@h2: fail | code=500 attempt=2'],
      [[{ level: 'debug', msg: 'noop', fields: {} }, { service: 's', host: 'h' }], '[DEBUG] s@h: noop'],
      [[{ level: 'WARN', msg: 'lower' }, { service: 'x', host: 'y' }], '[WARN] x@y: lower'],
    ];
    return runCases(fn, cases);
  },
  mergeAcl: (mod) => {
    const fn = mod.mergeAcl;
    const cases = [
      [[[]], new Map()],
      [[[{ role: 'a', perms: ['x'] }]], new Map([['a', new Set(['x'])]])],
      [[[{ role: 'a', perms: ['x', 'y'] }, { role: 'a', perms: ['y', 'z'] }]], new Map([['a', new Set(['x', 'y', 'z'])]])],
      [[[{ role: 'a', perms: ['x'] }, { role: 'b', perms: ['y'] }]], new Map([['a', new Set(['x'])], ['b', new Set(['y'])]])],
    ];
    return runCases(fn, cases);
  },
  chunk: (mod) => {
    const fn = mod.chunk;
    const cases = [
      [[[1, 2, 3, 4, 5], 2], [[1, 2], [3, 4], [5]]],
      [[[], 3], []],
      [[[1, 2, 3], 0], []],
      [[[1, 2, 3, 4], 4], [[1, 2, 3, 4]]],
      [[[1, 2, 3, 4, 5], 10], [[1, 2, 3, 4, 5]]],
    ];
    for (let i = 0; i < 4; i++) {
      const len = Math.floor(r() * 12) + 1;
      const sz = Math.floor(r() * 4) + 1;
      const arr = Array.from({ length: len }, (_, i) => i);
      const expected = [];
      for (let j = 0; j < arr.length; j += sz) expected.push(arr.slice(j, j + sz));
      cases.push([[arr, sz], expected]);
    }
    return runCases(fn, cases);
  },
  slugify: (mod) => {
    const fn = mod.slugify;
    const cases = [
      [['Hello World'], 'hello-world'],
      [['  Already-Slug  '], 'already-slug'],
      [['Foo!@#Bar$%^Baz'], 'foo-bar-baz'],
      [['---'], ''],
      [[''], ''],
      [['Café résumé naïve'], 'caf-r-sum-na-ve'],
      [['CamelCaseInput'], 'camelcaseinput'],
    ];
    return runCases(fn, cases);
  },
  groupBy: (mod) => {
    const fn = mod.groupBy;
    const cases = [
      [[[], (x) => x], {}],
      [[[1, 2, 3, 4], (x) => (x % 2 === 0 ? 'even' : 'odd')], { odd: [1, 3], even: [2, 4] }],
      [[[{ k: 'a', v: 1 }, { k: 'b', v: 2 }, { k: 'a', v: 3 }], (x) => x.k], { a: [{ k: 'a', v: 1 }, { k: 'a', v: 3 }], b: [{ k: 'b', v: 2 }] }],
      [[[1], (x) => x], { 1: [1] }],
    ];
    return runCases(fn, cases);
  },
  parseQuery: (mod) => {
    const fn = mod.parseQuery;
    const cases = [
      [[''], {}],
      [['?'], {}],
      [['a=1'], { a: '1' }],
      [['?a=1&b=2'], { a: '1', b: '2' }],
      [['a=hello%20world'], { a: 'hello world' }],
      [['a=1&a=2'], { a: '2' }], // last-write-wins
      [['flag'], { flag: '' }],
      [['k%26=v%3D'], { 'k&': 'v=' }],
    ];
    return runCases(fn, cases);
  },
  partition: (mod) => {
    const fn = mod.partition;
    const cases = [
      [[[], (x) => x > 0], [[], []]],
      [[[1, -1, 2, -2, 3], (x) => x > 0], [[1, 2, 3], [-1, -2]]],
      [[[1, 2, 3], () => true], [[1, 2, 3], []]],
      [[[1, 2, 3], () => false], [[], [1, 2, 3]]],
    ];
    return runCases(fn, cases);
  },
  flatten: (mod) => {
    const fn = mod.flatten;
    const cases = [
      [[[]], []],
      [[[1, 2, 3]], [1, 2, 3]],
      [[[1, [2, 3], [4, [5, 6]]]], [1, 2, 3, 4, 5, 6]],
      [[[[[1]]]], [1]],
      [[[1, [], 2]], [1, 2]],
      [[['a', ['b', ['c']]]], ['a', 'b', 'c']],
    ];
    // Mutation check
    const input = [[1, [2]], 3];
    const snap = JSON.stringify(input);
    let mutationOk = true;
    try {
      fn(input);
      mutationOk = JSON.stringify(input) === snap;
    } catch {}
    if (!mutationOk) {
      return { passed: 0, total: cases.length + 1, failures: ['mutated input'] };
    }
    const r = runCases(fn, cases);
    r.passed += 1;
    r.total += 1;
    return r;
  },
};

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
    else failures.push(`fn(${JSON.stringify(args)}) = ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`);
  }
  return { passed: pass, total: cases.length, failures };
}

const tester = TASKS[taskId];
if (!tester) {
  console.error(`unknown task: ${taskId}`);
  process.exit(2);
}

import { resolve } from 'node:path';
let mod;
try {
  const abs = resolve(process.cwd(), implPath);
  mod = await import(`file://${abs.replace(/\\/g, '/')}`);
} catch (e) {
  console.error(`import failed: ${e.message}`);
  process.exit(1);
}

const t0 = performance.now();
const result = tester(mod);
const wallMs = performance.now() - t0;
const status = {
  taskId,
  implPath,
  passed: result.passed,
  total: result.total,
  oraclePass: result.passed === result.total,
  wallMs: Math.round(wallMs),
  failures: result.failures || [],
};
process.stdout.write(JSON.stringify(status));
process.exit(status.oraclePass ? 0 : 1);
