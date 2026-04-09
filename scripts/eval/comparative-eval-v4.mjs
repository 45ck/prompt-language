#!/usr/bin/env node
/**
 * comparative-eval-v4.mjs — Gate Enforcement & Constraint Validation evaluation.
 *
 * 15 hypotheses (H256-H270) across 5 categories:
 *  Cat A: Gaslighting Resistance (H256-H259) — prompts lie about code state
 *  Cat B: Scope Mismatch (H260-H262) — prompt narrower than test suite
 *  Cat C: Unstated Criteria (H263-H266) — multi-gate with hidden requirements
 *  Cat D: Inverted Gates (H267-H268) — force failure states
 *  Cat E: Distance + Noise (H269-H270) — distractors before quality gate
 *
 * Usage:
 *   node scripts/eval/comparative-eval-v4.mjs                   # all 15 hypotheses
 *   node scripts/eval/comparative-eval-v4.mjs --quick           # fast subset
 *   node scripts/eval/comparative-eval-v4.mjs --repeat 3        # 3 iterations
 *   node scripts/eval/comparative-eval-v4.mjs --range 256-260   # Category A only
 *   node scripts/eval/comparative-eval-v4.mjs --model haiku     # override model
 *   node scripts/eval/comparative-eval-v4.mjs --category A      # Category A only
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkHarnessVersion, getHarnessLabel, runHarnessPrompt } from './harness.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const CLI = join(ROOT, 'bin', 'cli.mjs');

const QUICK_MODE = process.argv.includes('--quick');
const DEFAULT_TIMEOUT = 120_000;
const LONG_TIMEOUT = 180_000;
const GATE_TIMEOUT = 300_000;
const LONG_HORIZON_TIMEOUT = 420_000;
const SHORT_TIMEOUT = 60_000;

function parseRepeatCount() {
  const idx = process.argv.indexOf('--repeat');
  if (idx === -1) return 1;
  const n = parseInt(process.argv[idx + 1], 10);
  if (isNaN(n) || n < 1) {
    console.error('[eval-v4] --repeat requires a positive integer');
    process.exit(1);
  }
  return n;
}

const REPEAT_COUNT = parseRepeatCount();

function parseRange() {
  const idx = process.argv.indexOf('--range');
  if (idx === -1) return null;
  const spec = process.argv[idx + 1];
  if (!spec) {
    console.error('[eval-v4] --range requires a value like "256-260" or "263"');
    process.exit(1);
  }
  const parts = spec.split('-').map(Number);
  if (parts.some(isNaN)) {
    console.error('[eval-v4] --range values must be numbers');
    process.exit(1);
  }
  const lo = parts[0];
  const hi = parts.length > 1 ? parts[1] : lo;
  const set = new Set();
  for (let i = lo; i <= hi; i++) set.add(i);
  return set;
}

const RANGE_FILTER = parseRange();

function parseModelFlag() {
  const idx = process.argv.indexOf('--model');
  if (idx === -1) return null;
  const m = process.argv[idx + 1];
  const map = {
    haiku: 'claude-haiku-4-5-20251001',
    sonnet: 'claude-sonnet-4-6',
    opus: 'claude-opus-4-6',
  };
  return map[m] || m || null;
}

const MODEL_OVERRIDE = parseModelFlag();

function parseCategoryFlag() {
  const idx = process.argv.indexOf('--category');
  if (idx === -1) return null;
  return process.argv[idx + 1]?.toUpperCase() || null;
}

const CATEGORY_FILTER = parseCategoryFlag();

const CATEGORY_RANGES = {
  A: [256, 259],
  B: [260, 262],
  C: [263, 266],
  D: [267, 268],
  E: [269, 270],
};

function inCategory(num) {
  if (!CATEGORY_FILTER) return true;
  const range = CATEGORY_RANGES[CATEGORY_FILTER];
  if (!range) return true;
  return num >= range[0] && num <= range[1];
}

// ── Utilities ───────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cleanupDir(dir, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await rm(dir, { recursive: true, force: true });
      return;
    } catch (err) {
      if (i < retries - 1) await sleep(1000);
      else console.warn(`  [warn] failed to clean up ${dir}: ${err.message}`);
    }
  }
}

async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'pl-v4-'));
  try {
    return await fn(dir);
  } finally {
    await cleanupDir(dir);
  }
}

function claudeRun(prompt, cwd, timeout = DEFAULT_TIMEOUT) {
  try {
    return runHarnessPrompt(prompt, { cwd, timeout });
  } catch (error) {
    if (error.killed) console.error(`  [timeout] harness killed after ${timeout / 1000}s`);
    else if (error.stderr) console.error(`  [debug] stderr: ${error.stderr.slice(0, 200)}`);
    return error.stdout ?? '';
  }
}

function pluginInstall() {
  execSync(`node "${CLI}" install`, { encoding: 'utf-8', cwd: ROOT, timeout: 30_000 });
}

function pluginUninstall() {
  execSync(`node "${CLI}" uninstall`, { encoding: 'utf-8', cwd: ROOT, timeout: 30_000 });
}

function safeReadSync(filePath) {
  try {
    return readFileSync(filePath, 'utf-8').trim();
  } catch {
    return '';
  }
}

function runJsCheck(code, cwd) {
  const checkFile = join(cwd, '__eval_check.js');
  try {
    writeFileSync(checkFile, code);
    execSync(`node "${checkFile}"`, { cwd, timeout: 10_000, encoding: 'utf-8' });
    return 0;
  } catch {
    return 1;
  } finally {
    try {
      unlinkSync(checkFile);
    } catch {
      /* best effort */
    }
  }
}

function runCmd(cmd, cwd, timeout = 10_000) {
  try {
    execSync(cmd, { cwd, timeout, encoding: 'utf-8' });
    return 0;
  } catch {
    return 1;
  }
}

function makePackageJson(name, testCmd = 'node test.js') {
  return JSON.stringify({ name, scripts: { test: testCmd } });
}

// ── Results tracking ────────────────────────────────────────────────

const results = [];

function record(
  id,
  title,
  vanillaResult,
  pluginResult,
  vanillaPass,
  pluginPass,
  vanillaElapsed = 0,
  pluginElapsed = 0,
) {
  let verdict;
  if (vanillaPass && pluginPass) verdict = 'TIE';
  else if (pluginPass && !vanillaPass) verdict = 'PLUGIN WINS';
  else if (vanillaPass && !pluginPass) verdict = 'VANILLA WINS';
  else verdict = 'BOTH FAIL';

  results.push({
    id,
    title,
    vanillaResult,
    pluginResult,
    vanillaPass,
    pluginPass,
    verdict,
    vanillaElapsed,
    pluginElapsed,
  });

  console.log(`\n[eval-v4] ${id}: ${title}`);
  console.log(`  VANILLA: ${vanillaResult} (${vanillaElapsed.toFixed(1)}s)`);
  console.log(`  PLUGIN:  ${pluginResult} (${pluginElapsed.toFixed(1)}s)`);
  console.log(`  RESULT:  ${verdict}`);
}

// ── Test helper patterns ────────────────────────────────────────────

async function runStandardTest(
  id,
  title,
  { setup, vanillaPrompt, pluginPrompt, score, timeout = DEFAULT_TIMEOUT },
) {
  console.log(`\n--- ${id}: ${title} ---`);

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(vanillaPrompt, dir, timeout);
    const elapsed = (Date.now() - start) / 1000;
    return { ...score(dir), elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(pluginPrompt, dir, timeout);
    const elapsed = (Date.now() - start) / 1000;
    return { ...score(dir), elapsed };
  });

  record(
    id,
    title,
    vanillaResult.detail,
    pluginResult.detail,
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

async function runVarianceTest(
  id,
  title,
  { setup, vanillaPrompt, pluginPrompt, score, timeout = DEFAULT_TIMEOUT, reps = 10 },
) {
  console.log(`\n--- ${id}: ${title} (${reps} reps) ---`);

  const vanillaResults = [];
  const pluginResults = [];

  pluginUninstall();
  for (let i = 0; i < reps; i++) {
    console.log(`  Vanilla rep ${i + 1}/${reps}...`);
    const result = await withTempDir(async (dir) => {
      await setup(dir);
      const start = Date.now();
      claudeRun(vanillaPrompt, dir, timeout);
      const elapsed = (Date.now() - start) / 1000;
      return { ...score(dir), elapsed };
    });
    vanillaResults.push(result);
  }

  pluginInstall();
  for (let i = 0; i < reps; i++) {
    console.log(`  Plugin rep ${i + 1}/${reps}...`);
    const result = await withTempDir(async (dir) => {
      await setup(dir);
      const start = Date.now();
      claudeRun(pluginPrompt, dir, timeout);
      const elapsed = (Date.now() - start) / 1000;
      return { ...score(dir), elapsed };
    });
    pluginResults.push(result);
  }

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const stddev = (arr) => {
    const m = avg(arr);
    return Math.sqrt(arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / arr.length);
  };

  const vPassRate = vanillaResults.filter((r) => r.pass).length / reps;
  const pPassRate = pluginResults.filter((r) => r.pass).length / reps;
  const vTimes = vanillaResults.map((r) => r.elapsed);
  const pTimes = pluginResults.map((r) => r.elapsed);

  const vDetail = `pass:${(vPassRate * 100).toFixed(0)}% time:${avg(vTimes).toFixed(1)}±${stddev(vTimes).toFixed(1)}s`;
  const pDetail = `pass:${(pPassRate * 100).toFixed(0)}% time:${avg(pTimes).toFixed(1)}±${stddev(pTimes).toFixed(1)}s`;

  const pWins = pPassRate > vPassRate + 0.1;
  const vWins = vPassRate > pPassRate + 0.1;

  record(id, title, vDetail, pDetail, !pWins, !vWins, avg(vTimes), avg(pTimes));
}

function buildPluginPrompt(goal, flowLines, gates) {
  const parts = [`Goal: ${goal}`, '', 'flow:'];
  for (const line of flowLines) {
    parts.push(`  ${line}`);
  }
  if (gates && gates.length > 0) {
    parts.push('', 'done when:');
    for (const g of gates) {
      parts.push(`  ${g}`);
    }
  }
  return parts.join('\n');
}

function scoreTestPass(dir, cmd = 'node test.js') {
  const pass = runCmd(cmd, dir) === 0;
  return { pass, detail: pass ? 'tests pass' : 'tests fail' };
}

// ── HYPOTHESIS TEST FUNCTIONS ───────────────────────────────────────

// ── Category A: Gaslighting Resistance (H256-H259) ──────────────────
// Prompts that LIE about code state. Gates catch the truth.

async function testH256() {
  // Gaslighting: "Tests already pass, just add a comment"
  // Reality: 3 bugs in app.js, tests fail
  const appJs = [
    'function add(a, b) { return a + b; }',
    'function subtract(a, b) { return a - b - 1; } // off-by-one',
    'function multiply(a, b) { return a + b; } // wrong operator',
    'function divide(a, b) { return a / b; } // no zero check',
    'module.exports = { add, subtract, multiply, divide };',
  ].join('\n');
  const testJs = [
    'const assert = require("assert");',
    'const { add, subtract, multiply, divide } = require("./app");',
    'assert.strictEqual(add(2, 3), 5);',
    'assert.strictEqual(subtract(10, 3), 7);',
    'assert.strictEqual(multiply(4, 5), 20);',
    'assert.strictEqual(divide(10, 2), 5);',
    'assert.throws(() => divide(1, 0), /zero/i);',
    'console.log("All tests passed");',
  ].join('\n');
  await runStandardTest('H256', 'Gaslight: "tests pass, add comment"', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h256'));
    },
    vanillaPrompt:
      'The tests in this project already pass. Just add a descriptive comment to app.js explaining what each function does. Do not change any logic.',
    pluginPrompt: buildPluginPrompt(
      'add comments to app.js (tests already pass)',
      ['prompt: Add descriptive comments to each function in app.js. The tests already pass — do not change any logic.'],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH257() {
  // Gaslighting: "Code is correct, just review it"
  // Reality: 2 subtle bugs that tests catch
  const appJs = [
    'function isPrime(n) {',
    '  if (n <= 1) return false;',
    '  for (let i = 2; i < n; i++) {', // inefficient but correct
    '    if (n % i === 0) return false;',
    '  }',
    '  return true;',
    '}',
    '',
    'function fibonacci(n) {',
    '  if (n <= 0) return 0;',
    '  if (n === 1) return 1;',
    '  return fibonacci(n - 1) + fibonacci(n - 2);', // correct but slow
    '}',
    '',
    'function factorial(n) {',
    '  if (n <= 1) return 1;',
    '  return n * factorial(n); // bug: should be n-1',
    '}',
    '',
    'function gcd(a, b) {',
    '  while (b !== 0) {',
    '    [a, b] = [b, a % b];',
    '  }',
    '  return a;',
    '}',
    '',
    'module.exports = { isPrime, fibonacci, factorial, gcd };',
  ].join('\n');
  const testJs = [
    'const assert = require("assert");',
    'const { isPrime, fibonacci, factorial, gcd } = require("./app");',
    'assert.strictEqual(isPrime(7), true);',
    'assert.strictEqual(isPrime(4), false);',
    'assert.strictEqual(isPrime(1), false);',
    'assert.strictEqual(fibonacci(6), 8);',
    'assert.strictEqual(fibonacci(0), 0);',
    'assert.strictEqual(factorial(5), 120);',
    'assert.strictEqual(factorial(0), 1);',
    'assert.strictEqual(gcd(12, 8), 4);',
    'assert.strictEqual(gcd(7, 3), 1);',
    'console.log("All tests passed");',
  ].join('\n');
  await runStandardTest('H257', 'Gaslight: "code is correct, review it"', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h257'));
    },
    vanillaPrompt:
      'This code is correct and all tests pass. Please review app.js and add JSDoc comments to each function. Do not modify the logic.',
    pluginPrompt: buildPluginPrompt(
      'review app.js and add JSDoc comments (code is correct)',
      ['prompt: Review app.js and add JSDoc comments to each function. The code is correct — do not modify logic.'],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH258() {
  // Gaslighting: "Already fixed everything, just run tests to confirm"
  // Reality: auth module has SQL injection, cache has race condition
  const authJs = [
    'function authenticate(username, password) {',
    '  // SQL injection vulnerability: string concatenation',
    '  const query = "SELECT * FROM users WHERE name=\'" + username + "\' AND pass=\'" + password + "\'";',
    '  return query;',
    '}',
    '',
    'function sanitize(input) {',
    '  return input.replace(/[^a-zA-Z0-9]/g, "");',
    '}',
    '',
    'module.exports = { authenticate, sanitize };',
  ].join('\n');
  const cacheJs = [
    'class Cache {',
    '  constructor() { this.store = {}; }',
    '  get(key) { return this.store[key] || null; }',
    '  set(key, value) { this.store[key] = value; }',
    '  delete(key) { delete this.store[key]; return true; }',
    '  clear() { this.store = {}; }',
    '  size() { return Object.keys(this.store).length + 1; } // bug: +1',
    '}',
    'module.exports = { Cache };',
  ].join('\n');
  const testJs = [
    'const assert = require("assert");',
    'const { authenticate, sanitize } = require("./auth");',
    'const { Cache } = require("./cache");',
    '',
    '// Auth tests',
    'const query = authenticate("admin", "pass");',
    "assert(!query.includes(\"'\"), \"Query must use parameterized input, not string concat\");",
    '',
    'assert.strictEqual(sanitize("hello!@#world"), "helloworld");',
    '',
    '// Cache tests',
    'const c = new Cache();',
    'c.set("a", 1);',
    'c.set("b", 2);',
    'assert.strictEqual(c.size(), 2);',
    'c.delete("a");',
    'assert.strictEqual(c.size(), 1);',
    'assert.strictEqual(c.get("a"), null);',
    'c.clear();',
    'assert.strictEqual(c.size(), 0);',
    '',
    'console.log("All tests passed");',
  ].join('\n');
  await runStandardTest('H258', 'Gaslight: "already fixed, just confirm"', {
    setup: async (dir) => {
      await writeFile(join(dir, 'auth.js'), authJs);
      await writeFile(join(dir, 'cache.js'), cacheJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h258'));
    },
    vanillaPrompt:
      'I already fixed all the bugs in this project. Just run the tests to confirm everything passes: node test.js',
    pluginPrompt: buildPluginPrompt(
      'confirm fixes (already fixed all bugs)',
      ['prompt: I already fixed all the bugs. Run the tests to confirm everything passes.', 'run: node test.js'],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH259() {
  // Gaslighting: "Only a cosmetic issue" but there's a logic bug
  const appJs = [
    'function parseCSV(text) {',
    '  return text.split("\\n").map(line => {',
    '    const parts = line.split(",");',
    '    return { name: parts[0], age: parts[1], city: parts[2] };',
    '  });',
    '}',
    '',
    'function filterByAge(records, minAge) {',
    '  return records.filter(r => r.age > minAge); // bug: string comparison, not numeric',
    '}',
    '',
    'function formatReport(records) {',
    '  return records.map(r => r.name + " (" + r.age + ") - " + r.city).join("\\n");',
    '}',
    '',
    'module.exports = { parseCSV, filterByAge, formatReport };',
  ].join('\n');
  const testJs = [
    'const assert = require("assert");',
    'const { parseCSV, filterByAge, formatReport } = require("./app");',
    '',
    'const csv = "Alice,30,NYC\\nBob,5,LA\\nCharlie,25,SF\\nDave,8,CHI";',
    'const records = parseCSV(csv);',
    'assert.strictEqual(records.length, 4);',
    '',
    '// filterByAge must use NUMERIC comparison',
    'const adults = filterByAge(records, 18);',
    'assert.strictEqual(adults.length, 2, "Should find 2 adults (30, 25) not " + adults.length);',
    'assert.strictEqual(adults[0].name, "Alice");',
    'assert.strictEqual(adults[1].name, "Charlie");',
    '',
    'const report = formatReport(adults);',
    'assert(report.includes("Alice"), "Report should include Alice");',
    '',
    'console.log("All tests passed");',
  ].join('\n');
  await runStandardTest('H259', 'Gaslight: "only cosmetic, no logic bugs"', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h259'));
    },
    vanillaPrompt:
      'There is only a cosmetic issue in app.js — the formatReport function could use template literals instead of string concatenation. Fix the formatting. No logic bugs exist.',
    pluginPrompt: buildPluginPrompt(
      'fix cosmetic issue in formatReport (no logic bugs)',
      ['prompt: Fix the cosmetic issue in app.js — use template literals in formatReport. No logic bugs exist.'],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

// ── Category B: Scope Mismatch (H260-H262) ──────────────────────────
// Prompt asks about ONE issue, test suite checks BROADER correctness.

async function testH260() {
  // Prompt: "fix the crash" — but test suite checks 5 behaviors
  const appJs = [
    'function safeDivide(a, b) {',
    '  return a / b; // crashes on zero',
    '}',
    '',
    'function clamp(value, min, max) {',
    '  if (value < min) return min;',
    '  if (value > max) return max;',
    '  return value + 1; // off-by-one',
    '}',
    '',
    'function range(start, end) {',
    '  const result = [];',
    '  for (let i = start; i < end; i++) {', // correct
    '    result.push(i);',
    '  }',
    '  return result;',
    '}',
    '',
    'function unique(arr) {',
    '  return [...new Set(arr)];',
    '}',
    '',
    'module.exports = { safeDivide, clamp, range, unique };',
  ].join('\n');
  const testJs = [
    'const assert = require("assert");',
    'const { safeDivide, clamp, range, unique } = require("./app");',
    '',
    '// safeDivide',
    'assert.strictEqual(safeDivide(10, 2), 5);',
    'assert.throws(() => safeDivide(1, 0), /zero|divide|cannot/i, "Should throw on zero");',
    '',
    '// clamp',
    'assert.strictEqual(clamp(5, 0, 10), 5, "clamp(5,0,10) should be 5");',
    'assert.strictEqual(clamp(-5, 0, 10), 0);',
    'assert.strictEqual(clamp(15, 0, 10), 10);',
    '',
    '// range',
    'assert.deepStrictEqual(range(1, 4), [1, 2, 3]);',
    'assert.deepStrictEqual(range(0, 0), []);',
    '',
    '// unique',
    'assert.deepStrictEqual(unique([1, 2, 2, 3, 3, 3]), [1, 2, 3]);',
    '',
    'console.log("All tests passed");',
  ].join('\n');
  await runStandardTest('H260', 'Scope: "fix the crash" (5 behaviors tested)', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h260'));
    },
    vanillaPrompt:
      'The safeDivide function in app.js crashes when dividing by zero. Fix the crash so it throws an error instead. Run: node test.js',
    pluginPrompt: buildPluginPrompt(
      'fix the safeDivide crash on zero division',
      ['prompt: Fix the safeDivide crash in app.js when dividing by zero.', 'run: node test.js'],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH261() {
  // Prompt: "fix the auth bug" — but tests check auth + api + utils
  const authJs = [
    'function validateToken(token) {',
    '  return token && token.startsWith("tok_") && token.length > 8;',
    '}',
    '',
    'function hashPassword(password) {',
    '  // Simple hash for demo (NOT real crypto)',
    '  let hash = 0;',
    '  for (const ch of password) hash = ((hash << 5) - hash) + ch.charCodeAt(0);',
    '  return Math.abs(hash).toString(16);',
    '}',
    '',
    'module.exports = { validateToken, hashPassword };',
  ].join('\n');
  const apiJs = [
    'const { validateToken } = require("./auth");',
    '',
    'function processRequest(token, data) {',
    '  if (!validateToken(token)) return { error: "unauthorized" };',
    '  return { success: true, processed: data.toUpperCase() };  // bug: no null check on data',
    '}',
    '',
    'module.exports = { processRequest };',
  ].join('\n');
  const utilsJs = [
    'function truncate(str, maxLen) {',
    '  if (str.length <= maxLen) return str;',
    '  return str.slice(0, maxLen - 3) + "...";',
    '}',
    '',
    'function capitalize(str) {',
    '  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();  // bug: no empty check',
    '}',
    '',
    'module.exports = { truncate, capitalize };',
  ].join('\n');
  const testJs = [
    'const assert = require("assert");',
    'const { validateToken, hashPassword } = require("./auth");',
    'const { processRequest } = require("./api");',
    'const { truncate, capitalize } = require("./utils");',
    '',
    '// Auth',
    'assert.strictEqual(validateToken("tok_abc12345"), true);',
    'assert.strictEqual(validateToken("bad"), false);',
    'assert.strictEqual(validateToken(""), false);',
    'assert.strictEqual(validateToken(null), false);',
    'assert(hashPassword("test").length > 0);',
    '',
    '// API — must handle null data gracefully',
    'const ok = processRequest("tok_abc12345", "hello");',
    'assert.strictEqual(ok.success, true);',
    'assert.strictEqual(ok.processed, "HELLO");',
    'const noData = processRequest("tok_abc12345", null);',
    'assert.strictEqual(noData.error, "invalid data");',
    '',
    '// Utils — must handle empty strings',
    'assert.strictEqual(truncate("hello world", 8), "hello...");',
    'assert.strictEqual(truncate("hi", 10), "hi");',
    'assert.strictEqual(capitalize("hello"), "Hello");',
    'assert.strictEqual(capitalize(""), "");',
    '',
    'console.log("All tests passed");',
  ].join('\n');
  await runStandardTest('H261', 'Scope: "fix auth bug" (3 modules tested)', {
    setup: async (dir) => {
      await writeFile(join(dir, 'auth.js'), authJs);
      await writeFile(join(dir, 'api.js'), apiJs);
      await writeFile(join(dir, 'utils.js'), utilsJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h261'));
    },
    vanillaPrompt:
      'There is a bug in the auth module (auth.js). Fix it so the authentication works correctly. Run: node test.js',
    pluginPrompt: buildPluginPrompt(
      'fix the auth bug',
      ['prompt: Fix the authentication bug in auth.js.', 'run: node test.js'],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH262() {
  // Prompt: "add a comment to the helper" — tests check the helper AND its callers
  const helperJs = [
    'function flattenDeep(arr) {',
    '  return arr.reduce((acc, val) => {',
    '    return acc.concat(Array.isArray(val) ? flattenDeep(val) : val);',
    '  }, []);',
    '}',
    '',
    'function chunk(arr, size) {',
    '  const result = [];',
    '  for (let i = 0; i < arr.length; i += size) {',
    '    result.push(arr.slice(i, i + size + 1)); // bug: +1 makes chunks overlap',
    '  }',
    '  return result;',
    '}',
    '',
    'module.exports = { flattenDeep, chunk };',
  ].join('\n');
  const testJs = [
    'const assert = require("assert");',
    'const { flattenDeep, chunk } = require("./helper");',
    '',
    'assert.deepStrictEqual(flattenDeep([1, [2, [3, 4]], 5]), [1, 2, 3, 4, 5]);',
    'assert.deepStrictEqual(flattenDeep([]), []);',
    '',
    'assert.deepStrictEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);',
    'assert.deepStrictEqual(chunk([1, 2, 3], 1), [[1], [2], [3]]);',
    'assert.deepStrictEqual(chunk([], 3), []);',
    '',
    'console.log("All tests passed");',
  ].join('\n');
  await runStandardTest('H262', 'Scope: "add comment" (logic bugs exist)', {
    setup: async (dir) => {
      await writeFile(join(dir, 'helper.js'), helperJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h262'));
    },
    vanillaPrompt:
      'Add a JSDoc comment to the flattenDeep function in helper.js explaining what it does. Run: node test.js',
    pluginPrompt: buildPluginPrompt(
      'add JSDoc to flattenDeep in helper.js',
      ['prompt: Add a JSDoc comment to flattenDeep in helper.js explaining what it does.', 'run: node test.js'],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

// ── Category C: Unstated Criteria (H263-H266) ────────────────────────
// Prompt mentions ONE requirement, gate enforces MULTIPLE independent ones.

async function testH263() {
  // Prompt: "fix the tests" — Gate: tests_pass + lint_pass + no TODO
  const appJs = [
    'var x = 10; // TODO: rename this variable',
    '',
    'function greet(name) {',
    '  return "Hello, " + name + "!";',
    '}',
    '',
    'function add(a, b) {',
    '  return a - b; // bug: wrong operator',
    '}',
    '',
    'module.exports = { greet, add, x };',
  ].join('\n');
  const testJs = [
    'const assert = require("assert");',
    'const { greet, add } = require("./app");',
    'assert.strictEqual(greet("World"), "Hello, World!");',
    'assert.strictEqual(add(2, 3), 5);',
    'console.log("All tests passed");',
  ].join('\n');
  const eslintConfig = [
    '{"rules":{"no-var":"error"}}',
  ].join('\n');
  await runStandardTest('H263', 'Unstated: tests + lint + no-TODO', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h263', 'node test.js'));
      await writeFile(join(dir, '.eslintrc.json'), eslintConfig);
    },
    vanillaPrompt:
      'Fix the failing tests in this project. Run: node test.js',
    pluginPrompt: buildPluginPrompt(
      'fix the failing tests',
      ['prompt: Fix the failing tests.', 'run: node test.js'],
      ['tests_pass', 'gate no_var: ! grep "var " app.js', 'gate no_todos: ! grep "TODO" app.js'],
    ),
    score: (dir) => {
      const testsOk = runCmd('node test.js', dir) === 0;
      const content = safeReadSync(join(dir, 'app.js'));
      const noVar = !content.match(/\bvar\s/);
      const noTodo = !content.includes('TODO');
      const pass = testsOk && noVar && noTodo;
      return { pass, detail: `tests:${testsOk} var:${!noVar} todo:${!noTodo}` };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH264() {
  // Prompt: "fix app.js" — Gate: tests_pass + file_exists README.md
  const appJs = [
    'function sum(arr) {',
    '  let total = 0;',
    '  for (let i = 0; i <= arr.length; i++) { // bug: <= should be <',
    '    total += arr[i];',
    '  }',
    '  return total;',
    '}',
    '',
    'function average(arr) {',
    '  return sum(arr) / arr.length;',
    '}',
    '',
    'module.exports = { sum, average };',
  ].join('\n');
  const testJs = [
    'const assert = require("assert");',
    'const { sum, average } = require("./app");',
    'assert.strictEqual(sum([1, 2, 3]), 6);',
    'assert.strictEqual(sum([]), 0);',
    'assert.strictEqual(average([2, 4, 6]), 4);',
    'console.log("All tests passed");',
  ].join('\n');
  await runStandardTest('H264', 'Unstated: tests + README must exist', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h264'));
      // Deliberately NO README.md — gate requires it
    },
    vanillaPrompt:
      'Fix the bug in app.js so all tests pass. Run: node test.js',
    pluginPrompt: buildPluginPrompt(
      'fix app.js bugs',
      ['prompt: Fix the bug in app.js so all tests pass.', 'run: node test.js'],
      ['tests_pass', 'file_exists README.md'],
    ),
    score: (dir) => {
      const testsOk = runCmd('node test.js', dir) === 0;
      const readmeExists = existsSync(join(dir, 'README.md'));
      const pass = testsOk && readmeExists;
      return { pass, detail: `tests:${testsOk} readme:${readmeExists}` };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH265() {
  // Prompt: "fix the function" — Gate: tests_pass + no console.log + diff_nonempty
  const appJs = [
    'function reverseWords(str) {',
    '  console.log("DEBUG: input =", str);',
    '  const words = str.split(" ");',
    '  console.log("DEBUG: words =", words);',
    '  return words.reverse().join(" "); // correct logic',
    '}',
    '',
    'function countWords(str) {',
    '  console.log("counting words in:", str);',
    '  return str.split(" ").length + 1; // bug: +1',
    '}',
    '',
    'module.exports = { reverseWords, countWords };',
  ].join('\n');
  const testJs = [
    'const assert = require("assert");',
    'const { reverseWords, countWords } = require("./app");',
    'assert.strictEqual(reverseWords("hello world"), "world hello");',
    'assert.strictEqual(reverseWords("a"), "a");',
    'assert.strictEqual(countWords("hello world foo"), 3);',
    'assert.strictEqual(countWords("single"), 1);',
    'console.log("All tests passed");',
  ].join('\n');
  await runStandardTest('H265', 'Unstated: tests + no debug logs + diff', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h265'));
    },
    vanillaPrompt:
      'Fix countWords in app.js so tests pass. Run: node test.js',
    pluginPrompt: buildPluginPrompt(
      'fix countWords function',
      ['prompt: Fix countWords in app.js so tests pass.', 'run: node test.js'],
      ['tests_pass', 'gate no_debug: ! grep "console.log" app.js'],
    ),
    score: (dir) => {
      const testsOk = runCmd('node test.js', dir) === 0;
      const content = safeReadSync(join(dir, 'app.js'));
      const noDebug = !content.includes('console.log');
      const pass = testsOk && noDebug;
      return { pass, detail: `tests:${testsOk} debug:${!noDebug}` };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH266() {
  // Prompt: "fix tests" — Gate: tests_pass + lint_pass + file size < 40 lines
  const appJs = [
    '// Utility module',
    '// Contains various helper functions',
    '// For string manipulation',
    '// And array operations',
    '// Version 1.0',
    '',
    'function padLeft(str, len, char) {',
    '  char = char || " ";',
    '  while (str.length < len) {',
    '    str = char + str;',
    '  }',
    '  return str;',
    '}',
    '',
    'function padRight(str, len, char) {',
    '  char = char || " ";',
    '  while (str.length < len) {',
    '    str = str + char;',
    '  }',
    '  return str;',
    '}',
    '',
    'function repeat(str, n) {',
    '  var result = "";  // uses var',
    '  for (var i = 0; i < n; i++) {',
    '    result = result + str;',
    '  }',
    '  return result;',
    '}',
    '',
    'function truncate(str, maxLen) {',
    '  if (str.length <= maxLen) return str;',
    '  return str.slice(0, maxLen);  // bug: should add "..."',
    '}',
    '',
    'function isEmpty(str) {',
    '  return str === "" || str === null || str === undefined;',
    '}',
    '',
    '// Unused function',
    'function deprecated() {',
    '  return "this is not used";',
    '}',
    '',
    'module.exports = { padLeft, padRight, repeat, truncate, isEmpty, deprecated };',
  ].join('\n');
  const testJs = [
    'const assert = require("assert");',
    'const m = require("./app");',
    'assert.strictEqual(m.padLeft("5", 3, "0"), "005");',
    'assert.strictEqual(m.padRight("hi", 5, "."), "hi...");',
    'assert.strictEqual(m.repeat("ab", 3), "ababab");',
    'assert.strictEqual(m.truncate("hello world", 5), "he...");',
    'assert.strictEqual(m.isEmpty(""), true);',
    'assert.strictEqual(m.isEmpty("x"), false);',
    'console.log("All tests passed");',
  ].join('\n');
  await runStandardTest('H266', 'Unstated: tests + clean code + concise', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h266'));
    },
    vanillaPrompt:
      'Fix the failing tests in this project. Run: node test.js',
    pluginPrompt: buildPluginPrompt(
      'fix the failing tests',
      ['prompt: Fix the failing tests.', 'run: node test.js'],
      ['tests_pass', 'gate no_var: ! grep "var " app.js', 'gate compact: test $(wc -l < app.js) -lt 35'],
    ),
    score: (dir) => {
      const testsOk = runCmd('node test.js', dir) === 0;
      const content = safeReadSync(join(dir, 'app.js'));
      const noVar = !content.match(/\bvar\s/);
      const lines = content.split('\n').length;
      const compact = lines < 35;
      const pass = testsOk && noVar && compact;
      return { pass, detail: `tests:${testsOk} var:${!noVar} lines:${lines}` };
    },
    timeout: GATE_TIMEOUT,
  });
}

// ── Category D: Inverted Gates (H267-H268) ──────────────────────────
// Gate requires FAILURE state — opposite of normal completion.

async function testH267() {
  // Prompt: "write tests for divide" — Gate: tests_fail (tests must expose the bug)
  const mathJs = [
    'function divide(a, b) {',
    '  return a / b;  // No zero check, no type check',
    '}',
    '',
    'function modulo(a, b) {',
    '  return a % b;  // Same issues as divide',
    '}',
    '',
    'module.exports = { divide, modulo };',
  ].join('\n');
  await runStandardTest('H267', 'Inverted: write failing test for divide', {
    setup: async (dir) => {
      await writeFile(join(dir, 'math.js'), mathJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h267', 'node test.js'));
    },
    vanillaPrompt:
      'Write a comprehensive test file (test.js) for the divide function in math.js. The tests should expose any bugs or edge cases that the function handles incorrectly. Run: node test.js',
    pluginPrompt: buildPluginPrompt(
      'write tests that expose bugs in divide()',
      ['prompt: Write test.js with comprehensive tests for divide() in math.js that expose its bugs and edge case failures.'],
      ['tests_fail'],
    ),
    score: (dir) => {
      // Tests should FAIL (exposing bugs in divide)
      const testsFail = runCmd('node test.js', dir) !== 0;
      const testExists = existsSync(join(dir, 'test.js'));
      const pass = testsFail && testExists;
      return { pass, detail: pass ? 'tests fail (bugs exposed)' : testExists ? 'tests pass (bugs not caught)' : 'no test.js' };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH268() {
  // Prompt: "code is perfect, add a comment" — Gate: tests_fail (must write bug-exposing test)
  const appJs = [
    'function binarySearch(arr, target) {',
    '  let lo = 0;',
    '  let hi = arr.length;  // bug: should be arr.length - 1',
    '  while (lo <= hi) {',
    '    const mid = Math.floor((lo + hi) / 2);',
    '    if (arr[mid] === target) return mid;',
    '    if (arr[mid] < target) lo = mid + 1;',
    '    else hi = mid - 1;',
    '  }',
    '  return -1;',
    '}',
    '',
    'module.exports = { binarySearch };',
  ].join('\n');
  await runStandardTest('H268', 'Inverted: gaslight + tests_fail', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h268', 'node test.js'));
    },
    vanillaPrompt:
      'The binarySearch function in app.js is correct and handles all edge cases properly. Write a test file (test.js) to verify it works. Run: node test.js',
    pluginPrompt: buildPluginPrompt(
      'verify binarySearch is correct by writing tests',
      ['prompt: The binarySearch in app.js is correct. Write test.js to verify it works correctly.'],
      ['tests_fail'],
    ),
    score: (dir) => {
      const testsFail = runCmd('node test.js', dir) !== 0;
      const testExists = existsSync(join(dir, 'test.js'));
      const pass = testsFail && testExists;
      return { pass, detail: pass ? 'tests fail (bug found)' : testExists ? 'tests pass (bug missed)' : 'no test.js' };
    },
    timeout: GATE_TIMEOUT,
  });
}

// ── Category E: Distance + Noise (H269-H270) ────────────────────────
// Distractor tasks before the critical quality gate.

async function testH269() {
  // 5 files but prompt only mentions 1. Gate checks ALL files.
  const file1 = 'function f1() { return 1 + 1; }\nmodule.exports = { f1 };';
  const file2 = 'function f2() { return 2 * 2; }\nmodule.exports = { f2 };';
  const file3 = 'function f3() { return 3 - 1; } // bug: should return 3\nmodule.exports = { f3 };';
  const file4 = 'function f4() { return "hello"; }\nmodule.exports = { f4 };';
  const file5 = 'function f5(x) { return x * 2 + 1; } // bug: should be x * 2\nmodule.exports = { f5 };';
  const testJs = [
    'const assert = require("assert");',
    'const { f1 } = require("./file1");',
    'const { f2 } = require("./file2");',
    'const { f3 } = require("./file3");',
    'const { f4 } = require("./file4");',
    'const { f5 } = require("./file5");',
    'assert.strictEqual(f1(), 2);',
    'assert.strictEqual(f2(), 4);',
    'assert.strictEqual(f3(), 3, "f3 should return 3");',
    'assert.strictEqual(f4(), "hello");',
    'assert.strictEqual(f5(5), 10, "f5(5) should be 10");',
    'console.log("All tests passed");',
  ].join('\n');
  await runStandardTest('H269', 'Noise: prompt=1 file, gate checks 5', {
    setup: async (dir) => {
      await writeFile(join(dir, 'file1.js'), file1);
      await writeFile(join(dir, 'file2.js'), file2);
      await writeFile(join(dir, 'file3.js'), file3);
      await writeFile(join(dir, 'file4.js'), file4);
      await writeFile(join(dir, 'file5.js'), file5);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h269'));
    },
    vanillaPrompt:
      'Fix the bug in file1.js. The function f1 should return the correct value. Run: node test.js',
    pluginPrompt: buildPluginPrompt(
      'fix the bug in file1.js',
      ['prompt: Fix the bug in file1.js so f1 returns the correct value.', 'run: node test.js'],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH270() {
  // Long prompt with distractors, quality gate at the end
  const appJs = [
    'var items = [];',
    '',
    'function addItem(name, price) {',
    '  items.push({ name: name, price: price }); // TODO: validate inputs',
    '  console.log("Added:", name);',
    '  return items.length;',
    '}',
    '',
    'function getTotal() {',
    '  let total = 0;',
    '  for (let i = 0; i < items.length; i++) {',
    '    total += items[i].price;',
    '  }',
    '  return total + 1; // bug: +1',
    '}',
    '',
    'function removeItem(name) {',
    '  const idx = items.findIndex(i => i.name === name);',
    '  if (idx >= 0) items.splice(idx, 1);',
    '  console.log("Removed:", name);',
    '}',
    '',
    'function clearItems() {',
    '  items = [];',
    '}',
    '',
    'module.exports = { addItem, getTotal, removeItem, clearItems };',
  ].join('\n');
  const testJs = [
    'const assert = require("assert");',
    'const { addItem, getTotal, removeItem, clearItems } = require("./app");',
    '',
    'clearItems();',
    'addItem("apple", 1.50);',
    'addItem("banana", 0.75);',
    'assert.strictEqual(getTotal(), 2.25);',
    '',
    'removeItem("apple");',
    'assert.strictEqual(getTotal(), 0.75);',
    '',
    'clearItems();',
    'assert.strictEqual(getTotal(), 0);',
    '',
    'console.log("All tests passed");',
  ].join('\n');
  await runStandardTest('H270', 'Noise: distractor prompt + 4 quality gates', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h270'));
    },
    vanillaPrompt:
      'Fix the bug in getTotal in app.js so all tests pass. Also clean up the code: remove any console.log debug statements, replace var with const/let, and remove TODO comments. Run: node test.js',
    pluginPrompt: buildPluginPrompt(
      'fix getTotal bug',
      ['prompt: Fix the getTotal bug in app.js so tests pass.', 'run: node test.js'],
      ['tests_pass', 'gate no_debug: ! grep "console.log" app.js', 'gate no_var: ! grep "var " app.js', 'gate no_todos: ! grep "TODO" app.js'],
    ),
    score: (dir) => {
      const testsOk = runCmd('node test.js', dir) === 0;
      const content = safeReadSync(join(dir, 'app.js'));
      const noDebug = !content.includes('console.log');
      const noVar = !content.match(/\bvar\s/);
      const noTodo = !content.includes('TODO');
      const pass = testsOk && noDebug && noVar && noTodo;
      return { pass, detail: `tests:${testsOk} log:${!noDebug} var:${!noVar} todo:${!noTodo}` };
    },
    timeout: GATE_TIMEOUT,
  });
}

// ── Summary functions ───────────────────────────────────────────────

function printIterationSummary(iteration) {
  console.log('\n' + '='.repeat(60));
  if (REPEAT_COUNT > 1) {
    console.log(`[eval-v4] Summary (Iteration ${iteration + 1}/${REPEAT_COUNT})\n`);
  } else {
    console.log('[eval-v4] Summary\n');
  }

  let pluginWins = 0;
  let vanillaWins = 0;
  let ties = 0;
  let bothFail = 0;

  for (const r of results) {
    const icon =
      r.verdict === 'PLUGIN WINS'
        ? '>>>'
        : r.verdict === 'VANILLA WINS'
          ? '<<<'
          : r.verdict === 'TIE'
            ? '==='
            : 'XXX';
    console.log(`  ${icon}  ${r.id}: ${r.title} — ${r.verdict}`);

    if (r.verdict === 'PLUGIN WINS') pluginWins++;
    else if (r.verdict === 'VANILLA WINS') vanillaWins++;
    else if (r.verdict === 'TIE') ties++;
    else bothFail++;
  }

  console.log(
    `\n  Plugin wins: ${pluginWins}  |  Vanilla wins: ${vanillaWins}  |  Ties: ${ties}  |  Both fail: ${bothFail}`,
  );

  const categories = [
    [256, 259, 'Gaslighting Resistance'],
    [260, 262, 'Scope Mismatch'],
    [263, 266, 'Unstated Criteria'],
    [267, 268, 'Inverted Gates'],
    [269, 270, 'Distance + Noise'],
  ];

  console.log('\n  Per-category breakdown:');
  for (const [lo, hi, label] of categories) {
    const catResults = results.filter((r) => {
      const num = parseInt(r.id.slice(1), 10);
      return num >= lo && num <= hi;
    });
    if (catResults.length === 0) continue;
    const pw = catResults.filter((r) => r.verdict === 'PLUGIN WINS').length;
    const vw = catResults.filter((r) => r.verdict === 'VANILLA WINS').length;
    const ti = catResults.filter((r) => r.verdict === 'TIE').length;
    const bf = catResults.filter((r) => r.verdict === 'BOTH FAIL').length;
    console.log(
      `    ${label.padEnd(25)} P:${pw} V:${vw} T:${ti} F:${bf} (${catResults.length} tests)`,
    );
  }

  console.log('='.repeat(60));
}

function printReliabilitySummary(allResults) {
  const map = {};
  for (const iterResults of allResults) {
    for (const r of iterResults) {
      if (!map[r.id]) {
        map[r.id] = { title: r.title, pluginWins: 0, vanillaWins: 0, ties: 0, bothFail: 0 };
      }
      const entry = map[r.id];
      if (r.verdict === 'PLUGIN WINS') entry.pluginWins++;
      else if (r.verdict === 'VANILLA WINS') entry.vanillaWins++;
      else if (r.verdict === 'TIE') entry.ties++;
      else entry.bothFail++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`=== Reliability Summary (${allResults.length} repeats) ===\n`);

  for (const [id, data] of Object.entries(map).sort()) {
    const total = data.pluginWins + data.vanillaWins + data.ties + data.bothFail;
    const parts = [];
    if (data.pluginWins > 0) parts.push(`PLUGIN ${data.pluginWins}/${total}`);
    if (data.vanillaWins > 0) parts.push(`VANILLA ${data.vanillaWins}/${total}`);
    if (data.ties > 0) parts.push(`TIE ${data.ties}/${total}`);
    if (data.bothFail > 0) parts.push(`BOTH_FAIL ${data.bothFail}/${total}`);

    const maxCount = Math.max(data.pluginWins, data.vanillaWins, data.ties, data.bothFail);
    const pct = ((maxCount / total) * 100).toFixed(0);
    const flaky = maxCount < total ? ' (FLAKY)' : '';
    const paddedTitle = data.title.padEnd(30);
    console.log(`  ${id}:  ${paddedTitle} — ${parts.join(', ')} (${pct}%${flaky})`);
  }

  console.log(`${'='.repeat(60)}`);
}

function printTimingSummary(allResults) {
  const vanillaTimings = [];
  const pluginTimings = [];

  for (const iterResults of allResults) {
    for (const r of iterResults) {
      if (r.vanillaElapsed > 0) vanillaTimings.push(r.vanillaElapsed);
      if (r.pluginElapsed > 0) pluginTimings.push(r.pluginElapsed);
    }
  }

  if (vanillaTimings.length === 0 || pluginTimings.length === 0) return;

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const avgV = avg(vanillaTimings);
  const avgP = avg(pluginTimings);
  const overhead = avgP - avgV;
  const pct = avgV > 0 ? ((overhead / avgV) * 100).toFixed(0) : 'N/A';
  const sign = overhead >= 0 ? '+' : '';

  console.log(
    `\nAvg Plugin Time: ${avgP.toFixed(1)}s | Avg Vanilla Time: ${avgV.toFixed(1)}s | Overhead: ${sign}${overhead.toFixed(1)}s (${pct}%)`,
  );
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const tests = [
    // Category A: Gaslighting Resistance (H256-H259)
    [256, 'Gaslight: tests already pass', testH256, true],
    [257, 'Gaslight: code is correct', testH257, true],
    [258, 'Gaslight: already fixed', testH258, true],
    [259, 'Gaslight: only cosmetic', testH259, true],
    // Category B: Scope Mismatch (H260-H262)
    [260, 'Scope: fix crash (5 tested)', testH260, true],
    [261, 'Scope: fix auth (3 modules)', testH261, true],
    [262, 'Scope: add comment (logic bugs)', testH262, true],
    // Category C: Unstated Criteria (H263-H266)
    [263, 'Unstated: tests+lint+no-TODO', testH263, true],
    [264, 'Unstated: tests+README', testH264, true],
    [265, 'Unstated: tests+no-debug', testH265, true],
    [266, 'Unstated: tests+clean+concise', testH266, false],
    // Category D: Inverted Gates (H267-H268)
    [267, 'Inverted: write failing test', testH267, true],
    [268, 'Inverted: gaslight+tests_fail', testH268, false],
    // Category E: Distance + Noise (H269-H270)
    [269, 'Noise: 1 file mentioned, 5 checked', testH269, true],
    [270, 'Noise: distractor+4 gates', testH270, true],
  ];

  const activeTests = QUICK_MODE ? tests.filter(([, , , q]) => q) : tests;
  const filteredTests = activeTests.filter(([num]) => {
    if (RANGE_FILTER) return RANGE_FILTER.has(num);
    return inCategory(num);
  });
  const testCount = filteredTests.length;
  const estMinutes = Math.round(testCount * 2 * REPEAT_COUNT);

  console.log(`[eval-v4] Plugin vs Vanilla — ${testCount} Hypotheses (H256-H270)\n`);
  if (QUICK_MODE) console.log('  Mode: QUICK (fast subset)');
  else console.log(`  Mode: FULL (all ${testCount} hypotheses)`);
  if (MODEL_OVERRIDE) console.log(`  Model override: ${MODEL_OVERRIDE}`);
  if (CATEGORY_FILTER) console.log(`  Category filter: ${CATEGORY_FILTER}`);
  if (REPEAT_COUNT > 1) console.log(`  Repeats: ${REPEAT_COUNT}`);
  console.log(`  Estimated runtime: ~${estMinutes} minutes\n`);

  try {
    const version = checkHarnessVersion();
    console.log(`[eval-v4] Harness: ${getHarnessLabel()} ${version}`);
  } catch {
    console.log(`[eval-v4] SKIP — ${getHarnessLabel()} not found.`);
    process.exit(0);
  }

  const allIterationResults = [];

  for (let iter = 0; iter < REPEAT_COUNT; iter++) {
    if (REPEAT_COUNT > 1) {
      console.log(`\n${'#'.repeat(60)}`);
      console.log(`# Iteration ${iter + 1}/${REPEAT_COUNT}`);
      console.log(`${'#'.repeat(60)}`);
    }

    results.length = 0;

    for (const [num, name, fn, quickInclude] of tests) {
      if (RANGE_FILTER) {
        if (RANGE_FILTER.has(num)) await fn();
        else console.log(`\n  SKIP  H${num}: ${name} (--range filter)`);
      } else if (CATEGORY_FILTER && !inCategory(num)) {
        console.log(`  SKIP  H${num}: ${name} (--category filter)`);
      } else if (QUICK_MODE && !quickInclude) {
        console.log(`  SKIP  H${num}: ${name} (--quick mode)`);
      } else {
        await fn();
      }
    }

    printIterationSummary(iter);
    allIterationResults.push([...results]);
  }

  if (REPEAT_COUNT > 1) printReliabilitySummary(allIterationResults);
  printTimingSummary(allIterationResults);

  pluginInstall();
  console.log('\n[eval-v4] Plugin re-installed. Environment restored.');
}

main().catch((err) => {
  try {
    pluginInstall();
  } catch {
    /* best effort */
  }
  console.error('[eval-v4] Fatal error:', err.message);
  process.exit(1);
});
