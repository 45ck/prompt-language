#!/usr/bin/env node
/**
 * comparative-eval-v4.mjs — Gate Enforcement & Constraint Validation evaluation.
 *
 * 15 hypotheses (H256-H270) across 5 categories:
 *  Cat A: Gate Enforcement (H256-H260)
 *  Cat B: Multi-Language (H261-H262)
 *  Cat C: Reliability (H263-H264)
 *  Cat D: Real-World (H265-H268)
 *  Cat E: Constraint Enforcement (H269-H270)
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
  A: [256, 260],
  B: [261, 262],
  C: [263, 264],
  D: [265, 268],
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
  const env = { ...process.env };
  delete env.CLAUDECODE;
  try {
    return execSync('claude -p --dangerously-skip-permissions', {
      input: prompt,
      encoding: 'utf-8',
      cwd,
      timeout,
      env,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err) {
    if (err.killed) console.error(`  [timeout] claude -p killed after ${timeout / 1000}s`);
    else if (err.stderr) console.error(`  [debug] stderr: ${err.stderr.slice(0, 200)}`);
    return err.stdout ?? '';
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

// ── Category A: Gate Enforcement (H256-H260) ────────────────────────

async function testH256() {
  const appJs = [
    '// TODO: clean up this function',
    'function add(a, b) {',
    '  return a + b + 1; // bug: off-by-one',
    '}',
    '',
    'function subtract(a, b) {',
    '  // TODO: optimize later',
    '  return a - b;',
    '}',
    '',
    'module.exports = { add, subtract };',
  ].join('\n');
  const testJs = [
    'const { add, subtract } = require("./app");',
    'const assert = require("assert");',
    '',
    'assert.strictEqual(add(2, 3), 5, "add(2,3) should be 5");',
    'assert.strictEqual(add(0, 0), 0, "add(0,0) should be 0");',
    'assert.strictEqual(subtract(10, 3), 7, "subtract(10,3) should be 7");',
    'console.log("All tests passed");',
  ].join('\n');
  await runStandardTest('H256', 'Multi-gate: tests + no-TODO', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h256'));
    },
    vanillaPrompt:
      'Fix app.js so tests pass (run: node test.js) and remove all TODO comments from app.js.',
    pluginPrompt: buildPluginPrompt(
      'fix app and clean TODOs',
      [
        'prompt: Fix the bug in app.js so all tests pass. Also remove any TODO comments.',
        'run: node test.js',
      ],
      ['tests_pass', 'gate no_todos: ! grep -r "TODO" app.js'],
    ),
    score: (dir) => {
      const testsOk = runCmd('node test.js', dir) === 0;
      const content = safeReadSync(join(dir, 'app.js'));
      const noTodos = !content.includes('TODO');
      const pass = testsOk && noTodos;
      return {
        pass,
        detail: pass ? 'tests pass, no TODOs' : `tests:${testsOk} todos:${!noTodos}`,
      };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH257() {
  // 50-line verbose utils.js — Claude should refactor to < 30 lines
  const utilsJs = [
    'function formatName(first, last) {',
    '  // Check if first name is provided',
    '  if (first === undefined) {',
    '    first = "";',
    '  }',
    '  // Check if last name is provided',
    '  if (last === undefined) {',
    '    last = "";',
    '  }',
    '  // Trim whitespace from both',
    '  first = first.trim();',
    '  last = last.trim();',
    '  // Build the full name',
    '  var fullName = "";',
    '  if (first.length > 0 && last.length > 0) {',
    '    fullName = first + " " + last;',
    '  } else if (first.length > 0) {',
    '    fullName = first;',
    '  } else if (last.length > 0) {',
    '    fullName = last;',
    '  } else {',
    '    fullName = "Anonymous";',
    '  }',
    '  return fullName;',
    '}',
    '',
    'function parseAge(input) {',
    '  // Try to parse the input as a number',
    '  var result = parseInt(input, 10);',
    '  // Check if the parsing was successful',
    '  if (isNaN(result)) {',
    '    return -1;',
    '  }',
    '  // Check if age is negative',
    '  if (result < 0) {',
    '    return -1;',
    '  }',
    '  // Check if age is unreasonably large',
    '  if (result > 150) {',
    '    return -1;',
    '  }',
    '  return result;',
    '}',
    '',
    'function isValidEmail(email) {',
    '  if (email === undefined || email === null) {',
    '    return false;',
    '  }',
    '  if (typeof email !== "string") {',
    '    return false;',
    '  }',
    '  return email.includes("@") && email.includes(".");',
    '}',
    '',
    'module.exports = { formatName, parseAge, isValidEmail };',
  ].join('\n');
  const testJs = [
    'const { formatName, parseAge, isValidEmail } = require("./utils");',
    'const assert = require("assert");',
    '',
    'assert.strictEqual(formatName("John", "Doe"), "John Doe");',
    'assert.strictEqual(formatName("Alice", ""), "Alice");',
    'assert.strictEqual(formatName("", "Smith"), "Smith");',
    'assert.strictEqual(formatName("", ""), "Anonymous");',
    'assert.strictEqual(formatName(undefined, undefined), "Anonymous");',
    '',
    'assert.strictEqual(parseAge("25"), 25);',
    'assert.strictEqual(parseAge("abc"), -1);',
    'assert.strictEqual(parseAge("-5"), -1);',
    'assert.strictEqual(parseAge("200"), -1);',
    '',
    'assert.strictEqual(isValidEmail("a@b.c"), true);',
    'assert.strictEqual(isValidEmail("invalid"), false);',
    'assert.strictEqual(isValidEmail(null), false);',
    '',
    'console.log("All tests passed");',
  ].join('\n');
  await runStandardTest('H257', 'Custom gate: line count', {
    setup: async (dir) => {
      await writeFile(join(dir, 'utils.js'), utilsJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h257'));
    },
    vanillaPrompt:
      'Refactor utils.js to be under 30 lines while keeping all tests passing. Run: node test.js',
    pluginPrompt: buildPluginPrompt(
      'refactor utils.js to be concise',
      [
        'prompt: Refactor utils.js to be under 30 lines. Keep all tests passing.',
        'run: node test.js',
      ],
      ['tests_pass', 'gate small_file: test $(wc -l < utils.js) -lt 30'],
    ),
    score: (dir) => {
      const testsOk = runCmd('node test.js', dir) === 0;
      const content = safeReadSync(join(dir, 'utils.js'));
      const lineCount = content.split('\n').length;
      const small = lineCount < 30;
      const pass = testsOk && small;
      return {
        pass,
        detail: pass ? `tests pass, ${lineCount} lines` : `tests:${testsOk} lines:${lineCount}`,
      };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH258() {
  const appJs = [
    'function add(a, b) {',
    '  return a + b;',
    '}',
    '',
    'function multiply(a, b) {',
    '  return a + b; // bug: should be a * b',
    '}',
    '',
    'function divide(a, b) {',
    '  if (b === 0) return 0;',
    '  return a / b;',
    '}',
    '',
    'module.exports = { add, multiply, divide };',
  ].join('\n');
  const testJs = [
    'const { add, multiply, divide } = require("./app");',
    'const assert = require("assert");',
    '',
    'assert.strictEqual(add(2, 3), 5);',
    'assert.strictEqual(multiply(3, 4), 12);',
    'assert.strictEqual(multiply(0, 5), 0);',
    'assert.strictEqual(divide(10, 2), 5);',
    'console.log("All tests passed");',
  ].join('\n');
  await runStandardTest('H258', 'Gate on specific function', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h258'));
    },
    vanillaPrompt:
      'Fix only the multiply function in app.js so it returns the correct product. Run: node test.js',
    pluginPrompt: buildPluginPrompt(
      'fix the multiply function',
      ['prompt: Fix the multiply function in app.js so it correctly multiplies.'],
      [
        'gate multiply_works: node -e "const {multiply}=require(\'./app\'); if(multiply(3,4)!==12) process.exit(1)"',
      ],
    ),
    score: (dir) => {
      const pass =
        runCmd(
          'node -e "const {multiply}=require(\'./app\'); if(multiply(3,4)!==12) process.exit(1)"',
          dir,
        ) === 0;
      return { pass, detail: pass ? 'multiply(3,4)===12' : 'multiply broken' };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH259() {
  const authJs = [
    'function authenticate(user, pass) {',
    '  if (!user || !pass) return { ok: false, error: "missing credentials" };',
    '  if (user === "admin" && pass === "secret") {',
    '    return { ok: true, token: "tok_" + user };',
    '  }',
    '  return { ok: false, error: "invalid" };',
    '}',
    '',
    'function validateToken(token) {',
    '  // bug: should check prefix "tok_" not "token_"',
    '  if (!token || !token.startsWith("token_")) return false;',
    '  return true;',
    '}',
    '',
    'module.exports = { authenticate, validateToken };',
  ].join('\n');
  const apiJs = [
    'const { validateToken } = require("./auth");',
    '',
    'function getUser(token) {',
    '  if (!validateToken(token)) {',
    '    return { error: "unauthorized" };',
    '  }',
    '  return { name: "Admin", role: "admin" };',
    '}',
    '',
    'module.exports = { getUser };',
  ].join('\n');
  const testAuthJs = [
    'const { authenticate, validateToken } = require("./auth");',
    'const assert = require("assert");',
    '',
    'const result = authenticate("admin", "secret");',
    'assert.strictEqual(result.ok, true, "should authenticate admin");',
    'assert.ok(result.token, "should return a token");',
    '',
    'assert.strictEqual(validateToken(result.token), true, "should validate own token");',
    'assert.strictEqual(validateToken(null), false, "null should fail");',
    'assert.strictEqual(validateToken("random"), false, "random should fail");',
    '',
    'console.log("auth tests passed");',
  ].join('\n');
  const testApiJs = [
    'const { authenticate } = require("./auth");',
    'const { getUser } = require("./api");',
    'const assert = require("assert");',
    '',
    'const { token } = authenticate("admin", "secret");',
    'const user = getUser(token);',
    'assert.strictEqual(user.name, "Admin", "should return user");',
    'assert.strictEqual(user.error, undefined, "should not have error");',
    '',
    'const badUser = getUser("fake");',
    'assert.strictEqual(badUser.error, "unauthorized", "fake token should fail");',
    '',
    'console.log("api tests passed");',
  ].join('\n');
  await runStandardTest('H259', 'Multi-file gate', {
    setup: async (dir) => {
      await writeFile(join(dir, 'auth.js'), authJs);
      await writeFile(join(dir, 'api.js'), apiJs);
      await writeFile(join(dir, 'test-auth.js'), testAuthJs);
      await writeFile(join(dir, 'test-api.js'), testApiJs);
      await writeFile(
        join(dir, 'package.json'),
        makePackageJson('h259', 'node test-auth.js && node test-api.js'),
      );
    },
    vanillaPrompt: 'Fix the bugs so all tests pass. Run: node test-auth.js && node test-api.js',
    pluginPrompt: buildPluginPrompt(
      'fix bugs so all tests pass',
      [
        'prompt: Fix the bugs in auth.js so all tests pass.',
        'run: node test-auth.js',
        'run: node test-api.js',
      ],
      ['tests_pass'],
    ),
    score: (dir) => {
      const authOk = runCmd('node test-auth.js', dir) === 0;
      const apiOk = runCmd('node test-api.js', dir) === 0;
      const pass = authOk && apiOk;
      return {
        pass,
        detail: pass ? 'all tests pass' : `auth:${authOk} api:${apiOk}`,
      };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH260() {
  const appJs = [
    'function binarySearch(arr, target) {',
    '  let lo = 0;',
    '  let hi = arr.length; // bug: should be arr.length - 1',
    '  while (lo <= hi) {',
    '    const mid = Math.floor((lo + hi) / 2);',
    '    if (mid >= arr.length) return -1; // guard but still wrong',
    '    if (arr[mid] === target) return mid;',
    '    if (arr[mid] < target) {',
    '      lo = mid + 1;',
    '    } else {',
    '      hi = mid; // bug: should be mid - 1 (infinite loop risk)',
    '    }',
    '  }',
    '  return -1;',
    '}',
    '',
    'module.exports = { binarySearch };',
  ].join('\n');
  const testJs = [
    'const { binarySearch } = require("./app");',
    'const assert = require("assert");',
    '',
    '// Basic cases',
    'assert.strictEqual(binarySearch([1, 2, 3, 4, 5], 3), 2, "find middle");',
    'assert.strictEqual(binarySearch([1, 2, 3, 4, 5], 1), 0, "find first");',
    'assert.strictEqual(binarySearch([1, 2, 3, 4, 5], 5), 4, "find last");',
    '',
    '// Not found',
    'assert.strictEqual(binarySearch([1, 2, 3, 4, 5], 6), -1, "not found high");',
    'assert.strictEqual(binarySearch([1, 2, 3, 4, 5], 0), -1, "not found low");',
    '',
    '// Edge cases',
    'assert.strictEqual(binarySearch([], 1), -1, "empty array");',
    'assert.strictEqual(binarySearch([42], 42), 0, "single element found");',
    'assert.strictEqual(binarySearch([42], 99), -1, "single element not found");',
    '',
    '// Two-element array edge case',
    'assert.strictEqual(binarySearch([1, 3], 1), 0, "two-element find first");',
    'assert.strictEqual(binarySearch([1, 3], 3), 1, "two-element find second");',
    'assert.strictEqual(binarySearch([1, 3], 2), -1, "two-element not found");',
    '',
    'console.log("All tests passed");',
  ].join('\n');
  await runStandardTest('H260', 'Gate on hard bug (binary search)', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h260'));
    },
    vanillaPrompt:
      'Fix the binary search implementation in app.js so all tests pass. Run: node test.js',
    pluginPrompt: buildPluginPrompt(
      'fix binary search',
      [
        'retry max 3',
        '  run: node test.js',
        '  if command_failed',
        '    prompt: Fix the binary search bugs in app.js. The tests show what is wrong.',
        '  end',
        'end',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

// ── Category B: Multi-Language (H261-H262) ──────────────────────────

async function testH261() {
  const appPy = [
    'def greet(name):',
    '    """Return a greeting string."""',
    '    return "Hello " + name',
    '',
    'def factorial(n):',
    '    """Return n! for non-negative integers."""',
    '    if n == 0:',
    '        return 1',
    '    return n * factorial(n)  # bug: should be n-1',
    '',
    'def is_palindrome(s):',
    '    """Check if a string is a palindrome."""',
    '    s = s.lower()',
    '    return s == s[::-1]',
  ].join('\n');
  const testPy = [
    'from app import greet, factorial, is_palindrome',
    '',
    'def test_greet():',
    '    assert greet("World") == "Hello World"',
    '',
    'def test_factorial_zero():',
    '    assert factorial(0) == 1',
    '',
    'def test_factorial_five():',
    '    assert factorial(5) == 120',
    '',
    'def test_palindrome():',
    '    assert is_palindrome("racecar") == True',
    '    assert is_palindrome("hello") == False',
    '    assert is_palindrome("Madam") == True',
  ].join('\n');
  await runStandardTest('H261', 'Python pytest gate', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.py'), appPy);
      await writeFile(join(dir, 'test_app.py'), testPy);
    },
    vanillaPrompt: 'Fix app.py so that all pytest tests pass. Run: python -m pytest test_app.py -q',
    pluginPrompt: buildPluginPrompt(
      'fix Python app bug',
      ['prompt: Fix the bug in app.py so all tests pass.', 'run: python -m pytest test_app.py -q'],
      ['pytest_pass'],
    ),
    score: (dir) => {
      const pass = runCmd('python -m pytest test_app.py -q', dir, 15_000) === 0;
      return { pass, detail: pass ? 'pytest passes' : 'pytest fails' };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH262() {
  const deployShContent = [
    '#!/bin/bash',
    'APP_NAME="myapp"',
    'VERSION="1.0.0"',
    '',
    '# bug: uses wrong variable name ($NAME instead of $APP_NAME)',
    'echo "Deploying $NAME version $VERSION"',
    'echo "APP=$NAME" > deploy-output.txt',
    'echo "VER=$VERSION" >> deploy-output.txt',
  ].join('\n');
  const validateShContent = [
    '#!/bin/bash',
    'if [ ! -f deploy-output.txt ]; then',
    '  echo "FAIL: deploy-output.txt not found"',
    '  exit 1',
    'fi',
    '',
    'if ! grep -q "APP=myapp" deploy-output.txt; then',
    '  echo "FAIL: APP should be myapp"',
    '  exit 1',
    'fi',
    '',
    'if ! grep -q "VER=1.0.0" deploy-output.txt; then',
    '  echo "FAIL: VER should be 1.0.0"',
    '  exit 1',
    'fi',
    '',
    'echo "Validation passed"',
    'exit 0',
  ].join('\n');
  await runStandardTest('H262', 'Shell script validation gate', {
    setup: async (dir) => {
      await writeFile(join(dir, 'deploy.sh'), deployShContent);
      await writeFile(join(dir, 'validate.sh'), validateShContent);
    },
    vanillaPrompt:
      'Fix deploy.sh so that validate.sh passes. Run: bash deploy.sh && bash validate.sh',
    pluginPrompt: buildPluginPrompt(
      'fix deploy script',
      [
        'prompt: Fix the variable reference bug in deploy.sh so it uses the correct variable.',
        'run: bash deploy.sh',
      ],
      ['gate valid: bash validate.sh'],
    ),
    score: (dir) => {
      runCmd('bash deploy.sh', dir);
      const pass = runCmd('bash validate.sh', dir) === 0;
      return { pass, detail: pass ? 'validation passes' : 'validation fails' };
    },
    timeout: GATE_TIMEOUT,
  });
}

// ── Category C: Reliability (H263-H264) ─────────────────────────────

async function testH263() {
  // Two interacting bugs: fixing one exposes the other
  const appJs = [
    'function parseConfig(input) {',
    '  const parts = input.split(",");',
    '  const config = {};',
    '  for (const part of parts) {',
    '    const [key, value] = part.split("=");',
    '    config[key] = value;',
    '  }',
    '  return config;',
    '}',
    '',
    'function applyConfig(config) {',
    '  const port = parseInt(config.port, 10);',
    '  // bug 1: should check isNaN, not < 0',
    '  if (port < 0) throw new Error("Invalid port");',
    '  const host = config.host || "localhost";',
    '  // bug 2: returns wrong format — host:port should be string',
    '  return { url: host + port };  // missing colon separator',
    '}',
    '',
    'module.exports = { parseConfig, applyConfig };',
  ].join('\n');
  const testJs = [
    'const { parseConfig, applyConfig } = require("./app");',
    'const assert = require("assert");',
    '',
    '// Test basic parsing',
    'const cfg = parseConfig("host=example.com,port=3000");',
    'assert.strictEqual(cfg.host, "example.com");',
    'assert.strictEqual(cfg.port, "3000");',
    '',
    '// Test applyConfig produces correct URL',
    'const result = applyConfig(cfg);',
    'assert.strictEqual(result.url, "example.com:3000", "url should be host:port");',
    '',
    '// Test default host',
    'const cfg2 = parseConfig("port=8080");',
    'const result2 = applyConfig(cfg2);',
    'assert.strictEqual(result2.url, "localhost:8080");',
    '',
    '// Test invalid port',
    'const cfg3 = parseConfig("port=abc");',
    'assert.throws(() => applyConfig(cfg3), /Invalid port/);',
    '',
    'console.log("All tests passed");',
  ].join('\n');
  await runStandardTest('H263', 'Retry with diagnostic feedback', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h263'));
    },
    vanillaPrompt: 'Fix app.js so all tests pass. Run: node test.js',
    pluginPrompt: buildPluginPrompt(
      'fix interacting bugs',
      [
        'retry max 3',
        '  run: node test.js',
        '  if command_failed',
        '    prompt: Fix the remaining failures in app.js based on the test output.',
        '  end',
        'end',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH264() {
  const configJs = [
    'function loadConfig() {',
    '  // bug: invalid JSON (trailing comma)',
    '  const raw = \'{"host":"localhost","port":3000,}\';',
    '  return JSON.parse(raw);',
    '}',
    '',
    'module.exports = { loadConfig };',
  ].join('\n');
  const appJs = [
    'const { loadConfig } = require("./config");',
    '',
    'function startApp() {',
    '  const cfg = loadConfig();',
    '  return `Server at ${cfg.host}:${cfg.port}`;',
    '}',
    '',
    'module.exports = { startApp };',
  ].join('\n');
  const testJs = [
    'const { startApp } = require("./app");',
    'const assert = require("assert");',
    '',
    'const result = startApp();',
    'assert.strictEqual(result, "Server at localhost:3000");',
    'console.log("All tests passed");',
  ].join('\n');
  await runStandardTest('H264', 'Try/catch error recovery', {
    setup: async (dir) => {
      await writeFile(join(dir, 'config.js'), configJs);
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h264'));
    },
    vanillaPrompt: 'Fix config.js and app.js so tests pass. Run: node test.js',
    pluginPrompt: buildPluginPrompt(
      'fix config and app',
      [
        'try',
        '  run: node test.js',
        'catch',
        '  prompt: The test failed. Fix the JSON parsing issue in config.js.',
        'end',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

// ── Category D: Real-World (H265-H268) ─────────────────────────────

async function testH265() {
  const coreIndexJs = [
    'function sum(arr) {',
    '  let total = 0;',
    '  for (let i = 0; i <= arr.length; i++) { // bug: should be <',
    '    total += arr[i];',
    '  }',
    '  return total;',
    '}',
    '',
    'module.exports = { sum };',
  ].join('\n');
  const coreTestJs = [
    'const { sum } = require("./index");',
    'const assert = require("assert");',
    '',
    'assert.strictEqual(sum([1, 2, 3]), 6, "sum of [1,2,3]");',
    'assert.strictEqual(sum([]), 0, "sum of empty");',
    'assert.strictEqual(sum([10]), 10, "sum of single");',
    'console.log("core tests passed");',
  ].join('\n');
  const utilsIndexJs = [
    'function capitalize(str) {',
    '  return str.charAt(0).toUpperCase() + str.slice(1);',
    '}',
    '',
    'module.exports = { capitalize };',
  ].join('\n');
  const utilsTestJs = [
    'const { capitalize } = require("./index");',
    'const assert = require("assert");',
    '',
    'assert.strictEqual(capitalize("hello"), "Hello");',
    'console.log("utils tests passed");',
  ].join('\n');
  await runStandardTest('H265', 'Monorepo workspace gate', {
    setup: async (dir) => {
      await mkdir(join(dir, 'packages', 'core'), { recursive: true });
      await mkdir(join(dir, 'packages', 'utils'), { recursive: true });
      await writeFile(join(dir, 'packages', 'core', 'index.js'), coreIndexJs);
      await writeFile(join(dir, 'packages', 'core', 'test.js'), coreTestJs);
      await writeFile(join(dir, 'packages', 'utils', 'index.js'), utilsIndexJs);
      await writeFile(join(dir, 'packages', 'utils', 'test.js'), utilsTestJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h265'));
    },
    vanillaPrompt:
      'Fix the bug in packages/core/index.js so its tests pass. Run: node packages/core/test.js',
    pluginPrompt: buildPluginPrompt(
      'fix the core package bug',
      ['prompt: Fix the bug in packages/core/index.js so the core tests pass.'],
      ['gate core_tests: node packages/core/test.js'],
    ),
    score: (dir) => {
      const pass = runCmd('node packages/core/test.js', dir) === 0;
      return { pass, detail: pass ? 'core tests pass' : 'core tests fail' };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH266() {
  const appJs = [
    'function processItems(items) {',
    '  console.log("Processing items:", items);',
    '  const results = [];',
    '  for (const item of items) {',
    '    console.log("Processing:", item);',
    '    // bug: should push item.toUpperCase() not item.toLowerCase()',
    '    results.push(item.toLowerCase());',
    '    console.log("Result:", results[results.length - 1]);',
    '  }',
    '  console.log("Done processing");',
    '  return results;',
    '}',
    '',
    'module.exports = { processItems };',
  ].join('\n');
  const testJs = [
    'const { processItems } = require("./app");',
    'const assert = require("assert");',
    '',
    'const result = processItems(["hello", "world"]);',
    'assert.deepStrictEqual(result, ["HELLO", "WORLD"]);',
    'console.log("All tests passed");',
  ].join('\n');
  await runStandardTest('H266', 'No-console.log gate', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h266'));
    },
    vanillaPrompt:
      'Fix the bug in app.js and remove all console.log statements from app.js. Run: node test.js',
    pluginPrompt: buildPluginPrompt(
      'fix bug and remove debug logging',
      [
        'prompt: Fix the bug in app.js so tests pass. Also remove all console.log statements from app.js.',
        'run: node test.js',
      ],
      ['tests_pass', 'gate no_console: ! grep "console.log" app.js'],
    ),
    score: (dir) => {
      const testsOk = runCmd('node test.js', dir) === 0;
      const content = safeReadSync(join(dir, 'app.js'));
      const noConsole = !content.includes('console.log');
      const pass = testsOk && noConsole;
      return {
        pass,
        detail: pass ? 'tests pass, no console.log' : `tests:${testsOk} console.log:${!noConsole}`,
      };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH267() {
  const calculatorJs = [
    'function add(a, b) {',
    '  return a + b;',
    '}',
    '',
    'function subtract(a, b) {',
    '  return a - b;',
    '}',
    '',
    'module.exports = { add, subtract };',
  ].join('\n');
  const testJs = [
    'const calc = require("./calculator");',
    'const assert = require("assert");',
    '',
    '// Existing tests',
    'assert.strictEqual(calc.add(2, 3), 5);',
    'assert.strictEqual(calc.add(-1, 1), 0);',
    'assert.strictEqual(calc.subtract(10, 3), 7);',
    'assert.strictEqual(calc.subtract(0, 0), 0);',
    '',
    '// New test: multiply must exist and work',
    'assert.strictEqual(typeof calc.multiply, "function", "multiply must be a function");',
    'assert.strictEqual(calc.multiply(3, 4), 12);',
    'assert.strictEqual(calc.multiply(0, 5), 0);',
    'assert.strictEqual(calc.multiply(-2, 3), -6);',
    '',
    'console.log("All tests passed");',
  ].join('\n');
  await runStandardTest('H267', 'Feature addition + regression gate', {
    setup: async (dir) => {
      await writeFile(join(dir, 'calculator.js'), calculatorJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h267'));
    },
    vanillaPrompt:
      'Add a multiply function to calculator.js. Existing add and subtract must keep working. Run: node test.js',
    pluginPrompt: buildPluginPrompt(
      'add multiply function',
      [
        'prompt: Add a multiply(a, b) function to calculator.js that returns a * b. Export it. Do not break existing functions.',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH268() {
  const appJs = [
    'var http = require("http");',
    '',
    'var greet = function(name) {',
    '  var message = "Hello, " + name + "!";',
    '  return message;',
    '};',
    '',
    'var add = function(a, b) {',
    '  var result = a + b;',
    '  return result;',
    '};',
    '',
    'var getInfo = function(name, age) {',
    '  var info = name + " is " + age + " years old.";',
    '  return info;',
    '};',
    '',
    'module.exports = { greet: greet, add: add, getInfo: getInfo };',
  ].join('\n');
  const testJs = [
    'const { greet, add, getInfo } = require("./app");',
    'const assert = require("assert");',
    '',
    'assert.strictEqual(greet("World"), "Hello, World!");',
    'assert.strictEqual(add(2, 3), 5);',
    'assert.strictEqual(getInfo("Alice", 30), "Alice is 30 years old.");',
    'console.log("All tests passed");',
  ].join('\n');
  await runStandardTest('H268', 'Legacy modernization gate', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h268'));
    },
    vanillaPrompt:
      'Modernize app.js: replace var with const/let, use arrow functions, use template literals. Keep tests passing. Run: node test.js',
    pluginPrompt: buildPluginPrompt(
      'modernize legacy code',
      [
        'prompt: Modernize app.js to use const/let instead of var, arrow functions, and template literals. Keep all tests passing.',
        'run: node test.js',
      ],
      ['tests_pass', 'gate modern: ! grep "var " app.js'],
    ),
    score: (dir) => {
      const testsOk = runCmd('node test.js', dir) === 0;
      const content = safeReadSync(join(dir, 'app.js'));
      // Check for "var " but not inside strings or comments about var
      const noVar = !content.match(/\bvar\s/);
      const pass = testsOk && noVar;
      return {
        pass,
        detail: pass ? 'tests pass, no var' : `tests:${testsOk} var:${!noVar}`,
      };
    },
    timeout: GATE_TIMEOUT,
  });
}

// ── Category E: Constraint Enforcement (H269-H270) ─────────────────

async function testH269() {
  const generateJs = [
    'const fs = require("fs");',
    '',
    'function generate() {',
    '  // bug: outputs invalid JSON (missing closing brace, wrong comma placement)',
    '  const data = {',
    '    name: "report",',
    '    items: [',
    '      { id: 1, label: "first" },',
    '      { id: 2, label: "second" }',
    '    ],',
    '    meta: {',
    '      generated: true',
    '    }',
    '  };',
    '',
    '  // bug: manually constructing JSON string incorrectly',
    '  let json = "{";',
    '  json += \'"name": "\' + data.name + \'",\';',
    "  json += '\"count\": ' + data.items.length + ',';",
    '  json += \'"items": [\';',
    '  for (let i = 0; i < data.items.length; i++) {',
    '    json += \'{"id":\' + data.items[i].id + \', "label":"\' + data.items[i].label + \'"}\';',
    '    json += ","; // bug: trailing comma on last item',
    '  }',
    '  json += "],";',
    '  json += \'"valid": true\';',
    '  json += "}";',
    '',
    '  fs.writeFileSync("output.json", json);',
    '}',
    '',
    'generate();',
    'console.log("Generated output.json");',
  ].join('\n');
  const validateJs = [
    'const fs = require("fs");',
    '',
    'try {',
    '  const raw = fs.readFileSync("output.json", "utf-8");',
    '  const data = JSON.parse(raw);',
    '',
    '  // Schema checks',
    '  if (typeof data.name !== "string") throw new Error("name must be a string");',
    '  if (typeof data.count !== "number") throw new Error("count must be a number");',
    '  if (!Array.isArray(data.items)) throw new Error("items must be an array");',
    '  if (data.items.length !== data.count) throw new Error("count must match items length");',
    '',
    '  for (const item of data.items) {',
    '    if (typeof item.id !== "number") throw new Error("item.id must be a number");',
    '    if (typeof item.label !== "string") throw new Error("item.label must be a string");',
    '  }',
    '',
    '  if (data.valid !== true) throw new Error("valid must be true");',
    '',
    '  console.log("Validation passed");',
    '  process.exit(0);',
    '} catch (err) {',
    '  console.error("Validation failed:", err.message);',
    '  process.exit(1);',
    '}',
  ].join('\n');
  await runStandardTest('H269', 'Output format validation gate', {
    setup: async (dir) => {
      await writeFile(join(dir, 'generate.js'), generateJs);
      await writeFile(join(dir, 'validate.js'), validateJs);
      await writeFile(
        join(dir, 'package.json'),
        makePackageJson('h269', 'node generate.js && node validate.js'),
      );
    },
    vanillaPrompt:
      'Fix generate.js so it outputs valid JSON matching the schema in validate.js. Run: node generate.js && node validate.js',
    pluginPrompt: buildPluginPrompt(
      'fix JSON output generation',
      [
        'prompt: Fix generate.js so it outputs valid JSON that passes validation. Use JSON.stringify instead of manual string building.',
        'run: node generate.js',
      ],
      ['gate valid_output: node validate.js'],
    ),
    score: (dir) => {
      runCmd('node generate.js', dir);
      const pass = runCmd('node validate.js', dir) === 0;
      return { pass, detail: pass ? 'valid JSON output' : 'invalid JSON output' };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH270() {
  const dataJs = [
    'function doubleAll(arr) {',
    '  // bug: mutates input array instead of returning new one',
    '  for (let i = 0; i < arr.length; i++) {',
    '    arr[i] = arr[i] * 2;',
    '  }',
    '  return arr;',
    '}',
    '',
    'function filterPositive(arr) {',
    '  // bug: uses splice which mutates the original array',
    '  for (let i = arr.length - 1; i >= 0; i--) {',
    '    if (arr[i] < 0) {',
    '      arr.splice(i, 1);',
    '    }',
    '  }',
    '  return arr;',
    '}',
    '',
    'function addItem(arr, item) {',
    '  // bug: pushes to original array instead of creating copy',
    '  arr.push(item);',
    '  return arr;',
    '}',
    '',
    'module.exports = { doubleAll, filterPositive, addItem };',
  ].join('\n');
  const testJs = [
    'const { doubleAll, filterPositive, addItem } = require("./data");',
    'const assert = require("assert");',
    '',
    '// Test doubleAll is pure',
    'const input1 = [1, 2, 3];',
    'const result1 = doubleAll(input1);',
    'assert.deepStrictEqual(result1, [2, 4, 6], "doubleAll result");',
    'assert.deepStrictEqual(input1, [1, 2, 3], "doubleAll must not mutate input");',
    '',
    '// Test filterPositive is pure',
    'const input2 = [1, -2, 3, -4, 5];',
    'const result2 = filterPositive(input2);',
    'assert.deepStrictEqual(result2, [1, 3, 5], "filterPositive result");',
    'assert.deepStrictEqual(input2, [1, -2, 3, -4, 5], "filterPositive must not mutate input");',
    '',
    '// Test addItem is pure',
    'const input3 = [1, 2];',
    'const result3 = addItem(input3, 3);',
    'assert.deepStrictEqual(result3, [1, 2, 3], "addItem result");',
    'assert.deepStrictEqual(input3, [1, 2], "addItem must not mutate input");',
    '',
    'console.log("All tests passed");',
  ].join('\n');
  await runStandardTest('H270', 'No-mutation constraint', {
    setup: async (dir) => {
      await writeFile(join(dir, 'data.js'), dataJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h270'));
    },
    vanillaPrompt:
      'Fix data.js functions to be pure (no input mutation). Each function must return a new array without modifying the input. Run: node test.js',
    pluginPrompt: buildPluginPrompt(
      'make functions pure',
      [
        'prompt: Fix all functions in data.js to be pure. They must return new arrays without mutating the input arrays.',
        'run: node test.js',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
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
    [256, 260, 'Gate Enforcement'],
    [261, 262, 'Multi-Language'],
    [263, 264, 'Reliability'],
    [265, 268, 'Real-World'],
    [269, 270, 'Constraint Enforcement'],
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
    // Category A: Gate Enforcement
    [256, 'Multi-gate: tests + no-TODO', testH256, true],
    [257, 'Custom gate: line count', testH257, true],
    [258, 'Gate on specific function', testH258, true],
    [259, 'Multi-file gate', testH259, true],
    [260, 'Gate on hard bug (binary search)', testH260, false],
    // Category B: Multi-Language
    [261, 'Python pytest gate', testH261, false],
    [262, 'Shell script validation gate', testH262, true],
    // Category C: Reliability
    [263, 'Retry with diagnostic feedback', testH263, false],
    [264, 'Try/catch error recovery', testH264, true],
    // Category D: Real-World
    [265, 'Monorepo workspace gate', testH265, true],
    [266, 'No-console.log gate', testH266, true],
    [267, 'Feature addition + regression gate', testH267, true],
    [268, 'Legacy modernization gate', testH268, true],
    // Category E: Constraint Enforcement
    [269, 'Output format validation gate', testH269, true],
    [270, 'No-mutation constraint', testH270, true],
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
    execSync('claude --version', { encoding: 'utf-8', timeout: 5000 });
  } catch {
    console.log('[eval-v4] SKIP — claude CLI not found.');
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
