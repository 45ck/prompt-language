#!/usr/bin/env node
/**
 * comparative-eval.mjs — Plugin vs Vanilla Claude comparative evaluation.
 *
 * 14 hypotheses testing structural enforcement mechanisms (gate stop-hooks,
 * auto-execution, variable capture, control-flow loops) that vanilla Claude
 * cannot replicate.
 *
 * Quick mode (7 tests): H3, H4, H6, H7, H10, H11, H12 — no gate loops
 * Full mode (14 tests): all hypotheses
 *
 * Usage:
 *   node scripts/eval/comparative-eval.mjs                   # all 14 hypotheses
 *   node scripts/eval/comparative-eval.mjs --quick            # fast subset (7 tests)
 *   node scripts/eval/comparative-eval.mjs --repeat 3         # 3 iterations for reliability
 *   node scripts/eval/comparative-eval.mjs --quick --repeat 3 # combined
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const CLI = join(ROOT, 'bin', 'cli.mjs');

const QUICK_MODE = process.argv.includes('--quick');
const DEFAULT_TIMEOUT = 120_000;
const LONG_TIMEOUT = 180_000;
const CODED_JUDGMENT_TIMEOUT = 300_000;

function parseRepeatCount() {
  const idx = process.argv.indexOf('--repeat');
  if (idx === -1) return 1;
  const n = parseInt(process.argv[idx + 1], 10);
  if (isNaN(n) || n < 1) {
    console.error('[comparative-eval] --repeat requires a positive integer');
    process.exit(1);
  }
  return n;
}

const REPEAT_COUNT = parseRepeatCount();

// ── Utilities ───────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cleanupDir(dir, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await rm(dir, { recursive: true, force: true });
      return;
    } catch {
      if (i < retries - 1) await sleep(1000);
    }
  }
}

async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'pl-compare-'));
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
    });
  } catch (err) {
    if (err.stderr) console.error(`  [debug] stderr: ${err.stderr.slice(0, 200)}`);
    return err.stdout ?? '';
  }
}

function pluginInstall() {
  execSync(`node "${CLI}" install`, { encoding: 'utf-8', cwd: ROOT, timeout: 30_000 });
}

function pluginUninstall() {
  execSync(`node "${CLI}" uninstall`, { encoding: 'utf-8', cwd: ROOT, timeout: 30_000 });
}

async function safeRead(filePath) {
  try {
    return (await readFile(filePath, 'utf-8')).trim();
  } catch {
    return '';
  }
}

function runCmd(cmd, cwd) {
  try {
    execSync(cmd, { cwd, timeout: 10_000, encoding: 'utf-8' });
    return 0;
  } catch {
    return 1;
  }
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

  console.log(`\n[comparative-eval] ${id}: ${title}`);
  console.log(`  VANILLA: ${vanillaResult} (${vanillaElapsed.toFixed(1)}s)`);
  console.log(`  PLUGIN:  ${pluginResult} (${pluginElapsed.toFixed(1)}s)`);
  console.log(`  RESULT:  ${verdict}`);
}

// ── H1: Hidden Second Bug (Narrow task framing) ─────────────────────
// app.js has TWO bugs: a ReferenceError crash (greet) AND a subtle logic
// bug (multiply uses a*a instead of a*b). Vanilla is told to "fix the crash"
// only — may fix ReferenceError and stop without running tests.
// Plugin's gate forces ALL tests to pass, catching the multiply bug.

async function testH1() {
  console.log('\n--- H1: Hidden Second Bug ---');

  const appJs = [
    'function add(a, b) {',
    '  return a + b;',
    '}',
    '',
    'function multiply(a, b) {',
    '  return a * a;',
    '}',
    '',
    'function greet(name) {',
    '  return "Hello, " + nme;',
    '}',
    '',
    'module.exports = { add, multiply, greet };',
  ].join('\n');

  const testJs = [
    'const { add, multiply, greet } = require("./app.js");',
    'let f = 0;',
    'if (add(2, 3) !== 5) { console.error("FAIL: add(2,3)=" + add(2, 3)); f++; }',
    'if (multiply(3, 4) !== 12) { console.error("FAIL: multiply(3,4) should be 12, got " + multiply(3, 4)); f++; }',
    'if (greet("World") !== "Hello, World") { console.error("FAIL: greet"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'h1', scripts: { test: 'node test.js' } }),
    );
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      'app.js throws a ReferenceError when you call greet(). Fix the crash so the module loads without errors.',
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    const testsPass = runCmd('node test.js', dir) === 0;
    const loads = runCmd('node -e "require(\'./app.js\')"', dir) === 0;
    return { testsPass, loads, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: fix all bugs in app.js',
        '',
        'flow:',
        '  prompt: Fix all bugs in app.js so every test in test.js passes',
        '  run: npm test',
        '',
        'done when:',
        '  tests_pass',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { pass: runCmd('node test.js', dir) === 0, elapsed };
  });

  const vPass = vanillaResult.testsPass;
  const pPass = pluginResult.pass;

  record(
    'H1',
    'Hidden Second Bug',
    vPass
      ? 'both bugs fixed'
      : vanillaResult.loads
        ? 'crash fixed, multiply bug missed'
        : 'tests still fail',
    pPass ? 'both bugs fixed' : 'tests still fail',
    vPass,
    pPass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H2: Gaslighting "Tests Pass" (Gate + distraction) ──────────────
// Prompt lies: "Tests already pass, no need to run them."
// calc.js has a division-by-zero bug. Gate discovers it.

async function testH2() {
  console.log('\n--- H2: Gaslighting "Tests Pass" ---');

  const calcJs = [
    'function calculate(a, b) {',
    '  return a / b;',
    '}',
    '',
    'module.exports = { calculate };',
  ].join('\n');

  const testJs = [
    'const m = require("./calc.js");',
    'const fn = m.compute || m.calculate;',
    'let f = 0;',
    'if (fn(10, 2) !== 5) { console.error("FAIL: 10/2"); f++; }',
    'if (fn(null, 2) !== 0) { console.error("FAIL: null/2 should be 0, got " + fn(null, 2)); f++; }',
    'if (fn(10, 0) !== 0) { console.error("FAIL: 10/0 should be 0, got " + fn(10, 0)); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'calc.js'), calcJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'h2', scripts: { test: 'node test.js' } }),
    );
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      "Refactor calc.js: rename 'calculate' to 'compute'. Tests already pass, no need to run them.",
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { pass: runCmd('node test.js', dir) === 0, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        "Goal: refactor calc.js — rename 'calculate' to 'compute'. Tests already pass, no need to run them.",
        '',
        'flow:',
        "  prompt: Rename the function 'calculate' to 'compute' in calc.js. Tests already pass, no need to run them.",
        '',
        'done when:',
        '  tests_pass',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { pass: runCmd('node test.js', dir) === 0, elapsed };
  });

  const vPass = vanillaResult.pass;
  const pPass = pluginResult.pass;

  record(
    'H2',
    'Gaslighting "Tests Pass"',
    vPass ? 'null handling fixed' : 'tests still fail',
    pPass ? 'null handling fixed' : 'tests still fail',
    vPass,
    pPass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H3: Hash Fidelity (Variable capture) ────────────────────────────
// Plugin captures exact hash via let = run; vanilla must relay by memory.

async function testH3() {
  console.log('\n--- H3: Hash Fidelity ---');

  const hashJs = [
    'const crypto = require("crypto");',
    'const hash = crypto.createHash("sha256").update(String(Date.now())).digest("hex");',
    'console.log(hash);',
  ].join('\n');

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await writeFile(join(dir, 'hash.js'), hashJs);
    const start = Date.now();
    claudeRun(
      [
        'Run: node hash.js',
        'Capture the exact output (a 64-character hex string).',
        'Write ONLY that exact output to result.txt — nothing else.',
        'Do not re-run the command. Do not compute your own hash.',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    const content = await safeRead(join(dir, 'result.txt'));
    return { content, pass: /^[0-9a-f]{64}$/.test(content), elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await writeFile(join(dir, 'hash.js'), hashJs);
    const start = Date.now();
    claudeRun(
      [
        'Goal: hash fidelity test',
        '',
        'flow:',
        '  let hash = run "node hash.js"',
        '  prompt: Write the exact hash "${hash}" to result.txt. Write ONLY that value, nothing else.',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    const content = await safeRead(join(dir, 'result.txt'));
    const isHex64 = /^[0-9a-f]{64}$/.test(content);

    let captured = '';
    try {
      const state = JSON.parse(
        await readFile(join(dir, '.prompt-language', 'session-state.json'), 'utf-8'),
      );
      captured = state.variables?.hash?.trim() ?? '';
    } catch {
      /* no state */
    }
    const exact = captured !== '' && content === captured;
    return { content, pass: isHex64, captured, exact, elapsed };
  });

  record(
    'H3',
    'Hash Fidelity',
    vanillaResult.pass
      ? `valid hex64 in result.txt`
      : `result.txt="${vanillaResult.content.slice(0, 40)}" (invalid)`,
    pluginResult.exact
      ? `exact match with captured variable`
      : pluginResult.pass
        ? `valid hex64 (no exact-match data)`
        : `result.txt="${pluginResult.content.slice(0, 40)}" (invalid)`,
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H4: Pipeline Auto-Exec (3 chained run: nodes) ──────────────────
// Three scripts that must run in sequence — each reads the previous output.

async function testH4() {
  console.log('\n--- H4: Pipeline Auto-Exec ---');

  const step1 = [
    'const fs = require("fs");',
    'fs.writeFileSync("data.json", JSON.stringify({ values: [10, 20, 30] }));',
    'console.log("step1 done");',
  ].join('\n');

  const step2 = [
    'const fs = require("fs");',
    'const d = JSON.parse(fs.readFileSync("data.json", "utf-8"));',
    'const sum = d.values.reduce((a, b) => a + b, 0);',
    'fs.writeFileSync("output.json", JSON.stringify({ sum }));',
    'console.log("step2 done");',
  ].join('\n');

  const step3 = [
    'const fs = require("fs");',
    'const d = JSON.parse(fs.readFileSync("output.json", "utf-8"));',
    'fs.writeFileSync("final.txt", "sum=" + d.sum);',
    'console.log("step3 done");',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'step1.js'), step1);
    await writeFile(join(dir, 'step2.js'), step2);
    await writeFile(join(dir, 'step3.js'), step3);
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Run these 3 commands in exact sequence:',
        '1. node step1.js',
        '2. node step2.js',
        '3. node step3.js',
        'Each step depends on the previous one. Do NOT combine them.',
        'Do NOT read the scripts and compute results yourself — just run them.',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { pass: (await safeRead(join(dir, 'final.txt'))) === 'sum=60', elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: pipeline execution',
        '',
        'flow:',
        '  run: node step1.js',
        '  run: node step2.js',
        '  run: node step3.js',
        '  prompt: Confirm the pipeline completed by reading final.txt',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { pass: (await safeRead(join(dir, 'final.txt'))) === 'sum=60', elapsed };
  });

  record(
    'H4',
    'Pipeline Auto-Exec',
    vanillaResult.pass ? 'final.txt=sum=60' : 'final.txt missing or wrong',
    pluginResult.pass ? 'final.txt=sum=60' : 'final.txt missing or wrong',
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H5: Dual Gate (tests_pass + lint_pass) ──────────────────────────
// app.js has wrong return value (test fail). A separate utils.js uses `var`
// (lint fail). Vanilla is told to fix app.js only — has no reason to touch
// utils.js. Plugin's dual gate catches both: tests_pass AND lint_pass.

async function testH5() {
  console.log('\n--- H5: Dual Gate ---');

  const appJs = [
    'function greet(name) {',
    '  return "Hi " + name;',
    '}',
    '',
    'module.exports = { greet };',
  ].join('\n');

  const utilsJs = [
    'var toUpper = function(s) {',
    '  return s.toUpperCase();',
    '};',
    '',
    'module.exports = { toUpper };',
  ].join('\n');

  const testJs = [
    'const { greet } = require("./app.js");',
    'let f = 0;',
    'if (greet("World") !== "Hello World") {',
    '  console.error("FAIL: expected \'Hello World\', got \'" + greet("World") + "\'");',
    '  f++;',
    '}',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  const lintJs = [
    'const fs = require("fs");',
    'const skip = new Set(["test.js", "lint.js"]);',
    'const files = fs.readdirSync(".").filter(f => f.endsWith(".js") && !skip.has(f));',
    'let errors = 0;',
    'for (const file of files) {',
    '  const code = fs.readFileSync(file, "utf-8");',
    '  if (/\\bvar\\b/.test(code)) {',
    '    console.error("LINT ERROR: var keyword found in " + file);',
    '    errors++;',
    '  }',
    '}',
    'if (errors > 0) process.exit(1);',
    'console.log("Lint passed");',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'utils.js'), utilsJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(join(dir, 'lint.js'), lintJs);
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'h5',
        scripts: { test: 'node test.js', lint: 'node lint.js' },
      }),
    );
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      'Fix app.js so greet("World") returns "Hello World". Run npm test to verify.',
      dir,
      LONG_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    return {
      pass: runCmd('node test.js', dir) === 0 && runCmd('node lint.js', dir) === 0,
      elapsed,
    };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: fix project for tests and lint',
        '',
        'flow:',
        '  prompt: Fix greet in app.js so it returns "Hello World". Check all .js files for lint issues.',
        '',
        'done when:',
        '  tests_pass',
        '  lint_pass',
      ].join('\n'),
      dir,
      LONG_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    return {
      pass: runCmd('node test.js', dir) === 0 && runCmd('node lint.js', dir) === 0,
      elapsed,
    };
  });

  record(
    'H5',
    'Dual Gate',
    vanillaResult.pass ? 'tests + lint pass' : 'one or both fail',
    pluginResult.pass ? 'tests + lint pass' : 'one or both fail',
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H6: Flaky Retry ────────────────────────────────────────────────
// flaky.js exits 50/50 randomly. Plugin retries automatically.
// Vanilla may try to "fix" the randomness instead of retrying.

async function testH6() {
  console.log('\n--- H6: Flaky Retry ---');

  const flakyJs = [
    'if (Math.random() < 0.5) {',
    '  console.log("SUCCESS");',
    '  process.exit(0);',
    '} else {',
    '  console.log("FAIL");',
    '  process.exit(1);',
    '}',
  ].join('\n');

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await writeFile(join(dir, 'flaky.js'), flakyJs);
    const start = Date.now();
    claudeRun(
      [
        'Run: node flaky.js',
        'If it fails (exit code 1), run it again. Retry up to 5 times total.',
        'When it succeeds (exit code 0), write exactly "done" to result.txt.',
        'IMPORTANT: Do NOT modify flaky.js in any way. Just retry the command.',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    const result = await safeRead(join(dir, 'result.txt'));
    const modified = (await safeRead(join(dir, 'flaky.js'))) !== flakyJs;
    return { hasDone: result === 'done', modified, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await writeFile(join(dir, 'flaky.js'), flakyJs);
    const start = Date.now();
    claudeRun(
      [
        'Goal: run flaky script with retries',
        '',
        'flow:',
        '  retry max 5',
        '    run: node flaky.js',
        '  end',
        '  prompt: The flaky script succeeded. Write exactly "done" to result.txt.',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    const result = await safeRead(join(dir, 'result.txt'));
    const modified = (await safeRead(join(dir, 'flaky.js'))) !== flakyJs;
    return { hasDone: result === 'done', modified, elapsed };
  });

  const vPass = vanillaResult.hasDone && !vanillaResult.modified;
  const pPass = pluginResult.hasDone && !pluginResult.modified;

  record(
    'H6',
    'Flaky Retry',
    vanillaResult.hasDone
      ? vanillaResult.modified
        ? 'wrote done but MODIFIED flaky.js'
        : 'retried correctly'
      : 'result.txt missing',
    pluginResult.hasDone
      ? pluginResult.modified
        ? 'wrote done but MODIFIED flaky.js'
        : 'retried correctly'
      : 'result.txt missing',
    vPass,
    pPass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H7: Variable Chain (multi-step interpolation) ───────────────────
// 4 chained let = run nodes, each using the previous variable.

async function testH7() {
  console.log('\n--- H7: Variable Chain ---');

  const genTs = 'console.log(Date.now());';

  const genHash = [
    'const crypto = require("crypto");',
    'const input = process.argv[2] || "";',
    'console.log(crypto.createHash("sha256").update(input).digest("hex"));',
  ].join('\n');

  const genShort = 'console.log((process.argv[2] || "").slice(0, 8));';

  const genTag = 'console.log("result-" + (process.argv[2] || ""));';

  async function setup(dir) {
    await writeFile(join(dir, 'gen-ts.js'), genTs);
    await writeFile(join(dir, 'gen-hash.js'), genHash);
    await writeFile(join(dir, 'gen-short.js'), genShort);
    await writeFile(join(dir, 'gen-tag.js'), genTag);
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Run these 4 commands in sequence, using each output as input to the next:',
        '1. Run: node gen-ts.js — capture output as "ts"',
        '2. Run: node gen-hash.js <ts> — capture output as "hash"',
        '3. Run: node gen-short.js <hash> — capture output as "short"',
        '4. Run: node gen-tag.js <short> — capture output as "tag"',
        'Write the final "tag" value to result.txt. Write ONLY that value.',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    const content = await safeRead(join(dir, 'result.txt'));
    return { pass: /^result-[0-9a-f]{8}$/.test(content), elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: variable chain test',
        '',
        'flow:',
        '  let ts = run "node gen-ts.js"',
        '  let hash = run "node gen-hash.js ${ts}"',
        '  let short = run "node gen-short.js ${hash}"',
        '  let tag = run "node gen-tag.js ${short}"',
        '  prompt: Write the exact value "${tag}" to result.txt. Write ONLY that value.',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    const content = await safeRead(join(dir, 'result.txt'));
    return { pass: /^result-[0-9a-f]{8}$/.test(content), elapsed };
  });

  record(
    'H7',
    'Variable Chain',
    vanillaResult.pass ? 'result-XXXXXXXX format correct' : 'result.txt wrong or missing',
    pluginResult.pass ? 'result-XXXXXXXX format correct' : 'result.txt wrong or missing',
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H8: Self-Test Misdirection (Gate catches real test failure) ──────
// app.js exports capitalize() using str[0] which crashes on empty string.
// Built-in self-test only tests non-empty strings — passes with "5/5 passed!".
// Real test.js tests empty string and catches the crash.
// Vanilla is told to run the self-test and verify. Plugin gate runs npm test.

async function testH8() {
  console.log('\n--- H8: Misleading Console Output ---');

  const appJs = [
    'function capitalize(str) {',
    '  return str[0].toUpperCase() + str.slice(1);',
    '}',
    '',
    '// Self-test',
    'if (require.main === module) {',
    '  const cases = [',
    '    ["hello", "Hello"],',
    '    ["world", "World"],',
    '    ["alice", "Alice"],',
    '    ["bob", "Bob"],',
    '    ["test", "Test"],',
    '  ];',
    '  let pass = 0;',
    '  for (const [input, expected] of cases) {',
    '    if (capitalize(input) === expected) pass++;',
    '    else console.error("FAIL: capitalize(" + JSON.stringify(input) + ") !== " + expected);',
    '  }',
    '  console.log(pass + "/" + cases.length + " self-tests passed!");',
    '  process.exit(pass === cases.length ? 0 : 1);',
    '}',
    '',
    'module.exports = { capitalize };',
  ].join('\n');

  const testJs = [
    'const { capitalize } = require("./app.js");',
    'let f = 0;',
    'if (capitalize("hello") !== "Hello") { console.error("FAIL: hello"); f++; }',
    'if (capitalize("HELLO") !== "HELLO") { console.error("FAIL: all-caps"); f++; }',
    'try {',
    '  const r = capitalize("");',
    '  if (r !== "") { console.error("FAIL: empty string should be empty, got \'" + r + "\'"); f++; }',
    '} catch (e) {',
    '  console.error("FAIL: capitalize(\\"\\") threw: " + e.message);',
    '  f++;',
    '}',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'h8', scripts: { test: 'node test.js' } }),
    );
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Verify app.js works by running: node app.js',
        'It has a built-in self-test suite. If all 5 self-tests pass,',
        'the code is production-ready. Write "verified" to status.txt.',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { pass: runCmd('node test.js', dir) === 0, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: verify capitalize function',
        '',
        'flow:',
        '  retry max 3',
        '    run: npm test',
        '    if command_failed',
        '      prompt: The test suite found a bug in capitalize. Fix the edge case in app.js.',
        '    end',
        '  end',
        '',
        'done when:',
        '  tests_pass',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { pass: runCmd('node test.js', dir) === 0, elapsed };
  });

  record(
    'H8',
    'Misleading Console Output',
    vanillaResult.pass ? 'edge case fixed' : 'empty-string bug missed',
    pluginResult.pass ? 'edge case fixed' : 'empty-string bug missed',
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H9: Iterative Multi-Bug Fix (Gaslighting + gate) ────────────────
// Three modules each with one bug. Vanilla is told "I already fixed and
// tested everything — all tests pass. Just review array.js for code style."
// This gaslights vanilla into not running tests or fixing the real bugs.
// Plugin's gate runs npm test and forces all bugs to actually be fixed.

async function testH9() {
  console.log('\n--- H9: Iterative Multi-Bug Fix ---');

  const mathJs = ['function add(a, b) { return a * b; }', 'module.exports = { add };'].join('\n');

  const stringJs = [
    'function repeatStr(s, n) { return s.repeat(n - 1); }',
    'module.exports = { repeatStr };',
  ].join('\n');

  const arrayJs = [
    'function getFirst(arr) { return arr.pop(); }',
    'module.exports = { getFirst };',
  ].join('\n');

  const testJs = [
    'const { add } = require("./math.js");',
    'const { repeatStr } = require("./string.js");',
    'const { getFirst } = require("./array.js");',
    'let f = 0;',
    'if (add(2, 3) !== 5) { console.error("FAIL: add(2,3)=" + add(2, 3)); f++; }',
    'if (repeatStr("ab", 3) !== "ababab") { console.error("FAIL: repeatStr"); f++; }',
    'if (getFirst([10, 20, 30]) !== 10) { console.error("FAIL: getFirst"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'math.js'), mathJs);
    await writeFile(join(dir, 'string.js'), stringJs);
    await writeFile(join(dir, 'array.js'), arrayJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'h9', scripts: { test: 'node test.js' } }),
    );
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'I already fixed and tested math.js, string.js, and array.js — all tests pass.',
        'Just review array.js for code style (variable naming, comments).',
        "The logic is correct, don't change it.",
      ].join('\n'),
      dir,
      LONG_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { pass: runCmd('node test.js', dir) === 0, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: fix all module bugs',
        '',
        'flow:',
        '  retry max 5',
        '    run: npm test',
        '    if command_failed',
        '      prompt: Some tests failed. Read the error output and fix the bugs in math.js, string.js, or array.js.',
        '    end',
        '  end',
        '',
        'done when:',
        '  tests_pass',
      ].join('\n'),
      dir,
      LONG_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { pass: runCmd('node test.js', dir) === 0, elapsed };
  });

  record(
    'H9',
    'Iterative Multi-Bug Fix',
    vanillaResult.pass ? 'all 3 modules fixed' : 'tests still fail',
    pluginResult.pass ? 'all 3 modules fixed' : 'tests still fail',
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H10: Try/Catch Recovery ────────────────────────────────────────
// build.js fails without config.json. Plugin try/catch provides recovery.

async function testH10() {
  console.log('\n--- H10: Try/Catch Recovery ---');

  const buildJs = [
    'const fs = require("fs");',
    'try {',
    '  const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));',
    '  fs.mkdirSync("dist", { recursive: true });',
    '  fs.writeFileSync(config.output, "built");',
    '  console.log("Build succeeded");',
    '} catch (e) {',
    '  console.error("Build failed: " + e.message);',
    '  process.exit(1);',
    '}',
  ].join('\n');

  const verifyJs = [
    'const fs = require("fs");',
    'if (fs.existsSync("dist/bundle.js")) {',
    '  console.log("Verified: build output exists");',
    '  process.exit(0);',
    '} else {',
    '  console.error("Verification failed: dist/bundle.js not found");',
    '  process.exit(1);',
    '}',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'build.js'), buildJs);
    await writeFile(join(dir, 'verify.js'), verifyJs);
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Run: node build.js',
        'If it fails, read the error message and create whatever is missing to fix it.',
        'Then run build.js again.',
        'Finally run: node verify.js — it must exit 0.',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { pass: runCmd('node verify.js', dir) === 0, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: build with recovery',
        '',
        'flow:',
        '  try',
        '    run: node build.js',
        '  catch',
        '    prompt: build.js failed because config.json is missing. Create config.json with {"output":"dist/bundle.js"} then run node build.js again.',
        '  end',
        '  prompt: Run node verify.js to confirm the build output exists.',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { pass: runCmd('node verify.js', dir) === 0, elapsed };
  });

  record(
    'H10',
    'Try/Catch Recovery',
    vanillaResult.pass ? 'build + verify passed' : 'verify failed',
    pluginResult.pass ? 'build + verify passed' : 'verify failed',
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H11: Long Pipeline (8 chained steps) ────────────────────────────
// 8 sequential scripts where each reads the previous output and writes next.
// Tests whether vanilla maintains exact ordering through a longer pipeline.
// Expected: TIE — vanilla follows explicit instructions.

async function testH11() {
  console.log('\n--- H11: Long Pipeline ---');

  function makeStep(n) {
    if (n === 1) {
      return [
        'const fs = require("fs");',
        'fs.writeFileSync("output-1.txt", "1");',
        'console.log("step1 done");',
      ].join('\n');
    }
    return [
      'const fs = require("fs");',
      `const prev = fs.readFileSync("output-${n - 1}.txt", "utf-8").trim();`,
      `fs.writeFileSync("output-${n}.txt", prev + "-${n}");`,
      `console.log("step${n} done");`,
    ].join('\n');
  }

  async function setup(dir) {
    for (let i = 1; i <= 8; i++) {
      await writeFile(join(dir, `step${i}.js`), makeStep(i));
    }
  }

  const expected = '1-2-3-4-5-6-7-8';

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Run these 8 commands in exact sequence. Each depends on the previous:',
        '1. node step1.js',
        '2. node step2.js',
        '3. node step3.js',
        '4. node step4.js',
        '5. node step5.js',
        '6. node step6.js',
        '7. node step7.js',
        '8. node step8.js',
        'Do NOT combine them. Do NOT read the scripts. Just run them in order.',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { pass: (await safeRead(join(dir, 'output-8.txt'))) === expected, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: run 8-step pipeline',
        '',
        'flow:',
        '  run: node step1.js',
        '  run: node step2.js',
        '  run: node step3.js',
        '  run: node step4.js',
        '  run: node step5.js',
        '  run: node step6.js',
        '  run: node step7.js',
        '  run: node step8.js',
        '  prompt: Confirm the pipeline completed by reading output-8.txt',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { pass: (await safeRead(join(dir, 'output-8.txt'))) === expected, elapsed };
  });

  record(
    'H11',
    'Long Pipeline',
    vanillaResult.pass ? `output-8.txt=${expected}` : 'output-8.txt missing or wrong',
    pluginResult.pass ? `output-8.txt=${expected}` : 'output-8.txt missing or wrong',
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H12: Latency Overhead ───────────────────────────────────────────
// Simplest possible task: create hello.txt. Both should pass.
// Primary metric is elapsed time, not pass/fail.

async function testH12() {
  console.log('\n--- H12: Latency Overhead ---');

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    const start = Date.now();
    claudeRun('Create hello.txt containing exactly: Hello, world!', dir);
    const elapsed = (Date.now() - start) / 1000;
    return { pass: (await safeRead(join(dir, 'hello.txt'))) === 'Hello, world!', elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    const start = Date.now();
    claudeRun(
      [
        'Goal: create hello file',
        '',
        'flow:',
        '  prompt: Create hello.txt containing exactly: Hello, world!',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { pass: (await safeRead(join(dir, 'hello.txt'))) === 'Hello, world!', elapsed };
  });

  record(
    'H12',
    'Latency Overhead',
    vanillaResult.pass ? 'pass' : 'fail',
    pluginResult.pass ? 'pass' : 'fail',
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H13: File-Exists Gate ───────────────────────────────────────────
// README.md has build instructions. Vanilla gets vague "follow instructions"
// prompt — may describe rather than execute. Plugin gate enforces file creation.

async function testH13() {
  console.log('\n--- H13: File-Exists Gate ---');

  const readmeMd = [
    '# Build Instructions',
    '',
    '## Building the project',
    '',
    '1. Create a `dist` directory',
    '2. Copy the contents of `src/index.js` into `dist/bundle.js`',
    '',
    '## Source',
    '',
    'The main source file is `src/index.js`.',
  ].join('\n');

  const srcIndexJs = [
    'function main() {',
    '  console.log("Hello from bundle");',
    '}',
    '',
    'module.exports = { main };',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'README.md'), readmeMd);
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(join(dir, 'src', 'index.js'), srcIndexJs);
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun('Follow the deployment instructions in README.md to set up the project.', dir);
    const elapsed = (Date.now() - start) / 1000;
    return { pass: existsSync(join(dir, 'dist', 'bundle.js')), elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: follow build instructions',
        '',
        'flow:',
        '  prompt: Follow the build instructions in README.md',
        '',
        'done when:',
        '  file_exists dist/bundle.js',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { pass: existsSync(join(dir, 'dist', 'bundle.js')), elapsed };
  });

  record(
    'H13',
    'File-Exists Gate',
    vanillaResult.pass ? 'dist/bundle.js created' : 'dist/bundle.js missing',
    pluginResult.pass ? 'dist/bundle.js created' : 'dist/bundle.js missing',
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H14: Nested Control Flow (retry inside if) ─────────────────────
// check-config.js fails if config.json missing. app.js has a computation bug.
// Vanilla gets explicit steps. Plugin uses nested if/retry control flow.

async function testH14() {
  console.log('\n--- H14: Nested Control Flow ---');

  const checkConfigJs = [
    'const fs = require("fs");',
    'try {',
    '  const config = JSON.parse(fs.readFileSync("config.json", "utf-8"));',
    '  if (config.mode !== "production") {',
    '    console.error("ERROR: mode must be \\"production\\"");',
    '    process.exit(1);',
    '  }',
    '  console.log("Config OK");',
    '} catch (e) {',
    '  console.error("ERROR: config.json missing or invalid");',
    '  process.exit(1);',
    '}',
  ].join('\n');

  const appJs = [
    'function square(x) {',
    '  return x + x;',
    '}',
    '',
    'module.exports = { square };',
  ].join('\n');

  const testJs = [
    'const { square } = require("./app.js");',
    'const fs = require("fs");',
    'let f = 0;',
    'if (!fs.existsSync("config.json")) { console.error("FAIL: config.json missing"); f++; }',
    'else {',
    '  const cfg = JSON.parse(fs.readFileSync("config.json", "utf-8"));',
    '  if (cfg.mode !== "production") { console.error("FAIL: config.mode should be production"); f++; }',
    '}',
    'if (square(3) !== 9) { console.error("FAIL: square(3)=" + square(3)); f++; }',
    'if (square(5) !== 25) { console.error("FAIL: square(5)=" + square(5)); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'check-config.js'), checkConfigJs);
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'h14', scripts: { test: 'node test.js' } }),
    );
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'First ensure config.json exists with {"mode":"production"}.',
        'Then fix app.js so tests pass.',
        'Run npm test to verify.',
      ].join('\n'),
      dir,
      LONG_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { pass: runCmd('node test.js', dir) === 0, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: fix config and app bugs',
        '',
        'flow:',
        '  run: node check-config.js',
        '  if command_failed',
        '    prompt: Create config.json with {"mode":"production"}',
        '  end',
        '  retry max 3',
        '    run: npm test',
        '    if command_failed',
        '      prompt: Fix the bug in app.js based on the test output',
        '    end',
        '  end',
        '',
        'done when:',
        '  tests_pass',
      ].join('\n'),
      dir,
      LONG_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { pass: runCmd('node test.js', dir) === 0, elapsed };
  });

  record(
    'H14',
    'Nested Control Flow',
    vanillaResult.pass ? 'config + app fixed' : 'tests still fail',
    pluginResult.pass ? 'config + app fixed' : 'tests still fail',
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H15: Phased Code Audit (Attention Focus) ────────────────────────
// app.js has 12 bugs across 4 categories (3 each): crash, input validation,
// logic, edge cases. Plugin drip-feeds one category per phase. Vanilla gets
// all 12 at once with equivalent guidance. Tests whether per-category focus
// produces more thorough fixes than "fix everything at once."

async function testH15() {
  console.log('\n--- H15: Phased Code Audit ---');

  const appJs = [
    '// ── A: Crash bugs ──',
    'function greetUser(name) {',
    '  return "Hello, " + nme;',
    '}',
    '',
    'function averageOfArray(arr) {',
    '  const sum = arr.reduce((a, b) => a + b, 0);',
    '  return sum / arr.length;',
    '}',
    '',
    'function factorial(n) {',
    '  return n * factorial(n - 1);',
    '}',
    '',
    '// ── B: Input validation bugs ──',
    'function repeatString(str, times) {',
    '  return str.repeat(times);',
    '}',
    '',
    'function clampValue(val, min, max) {',
    '  if (val < min) return min;',
    '  if (val > max) return max;',
    '  return val;',
    '}',
    '',
    'function getProperty(obj, key) {',
    '  return obj[key];',
    '}',
    '',
    '// ── C: Logic bugs ──',
    'function countWords(str) {',
    '  return str.length;',
    '}',
    '',
    'function isInRange(val, min, max) {',
    '  return val >= min && val < max;',
    '}',
    '',
    'function uniqueItems(arr) {',
    '  return arr.filter((item, i) => arr.indexOf(item) !== i);',
    '}',
    '',
    '// ── D: Edge case bugs ──',
    'function truncate(str, maxLen) {',
    '  return str.slice(0, maxLen) + "...";',
    '}',
    '',
    'function safeParseInt(str) {',
    '  return parseInt(str, 10);',
    '}',
    '',
    'function chunkArray(arr, size) {',
    '  const chunks = [];',
    '  for (let i = 0; i < arr.length; i += size) {',
    '    chunks.push(arr.slice(i, i + size));',
    '  }',
    '  return chunks;',
    '}',
    '',
    'module.exports = {',
    '  greetUser, averageOfArray, factorial,',
    '  repeatString, clampValue, getProperty,',
    '  countWords, isInRange, uniqueItems,',
    '  truncate, safeParseInt, chunkArray,',
    '};',
  ].join('\n');

  const testJs = [
    'const m = require("./app.js");',
    'let f = 0;',
    'function check(label, fn) {',
    '  try {',
    '    const ok = fn();',
    '    if (!ok) { console.error("FAIL: " + label); f++; }',
    '  } catch (e) {',
    '    console.error("FAIL: " + label + " threw: " + e.message);',
    '    f++;',
    '  }',
    '}',
    '',
    '// A: Crash bugs',
    'check("A1-greetUser", () => m.greetUser("Alice") === "Hello, Alice");',
    'check("A2-averageOfArray-empty", () => m.averageOfArray([]) === 0);',
    'check("A3-factorial-base", () => m.factorial(0) === 1 && m.factorial(5) === 120);',
    '',
    '// B: Input validation',
    'check("B1-repeatString-null", () => m.repeatString(null, 3) === "");',
    'check("B2-clampValue-inverted", () => m.clampValue(5, 10, 1) === 5);',
    'check("B3-getProperty-null", () => m.getProperty(null, "x") === undefined);',
    '',
    '// C: Logic bugs',
    'check("C1-countWords", () => m.countWords("hello world foo") === 3);',
    'check("C2-isInRange-inclusive", () => m.isInRange(10, 1, 10) === true);',
    'check("C3-uniqueItems", () => {',
    '  const r = m.uniqueItems([1, 2, 2, 3, 3, 3]);',
    '  return r.length === 3 && r.includes(1) && r.includes(2) && r.includes(3);',
    '});',
    '',
    '// D: Edge cases',
    'check("D1-truncate-short", () => m.truncate("hi", 10) === "hi");',
    'check("D2-safeParseInt-nan", () => m.safeParseInt("abc") === 0);',
    'check("D3-chunkArray-zero", () => {',
    '  const r = m.chunkArray([1, 2, 3], 0);',
    '  return Array.isArray(r) && r.length === 0;',
    '});',
    '',
    'if (f === 0) console.log("All 12 tests passed");',
    'else console.log(f + " of 12 tests failed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'h15', scripts: { test: 'node test.js' } }),
    );
  }

  function scoreBugs(dir) {
    const scores = { A: 0, B: 0, C: 0, D: 0, total: 0 };
    const checks = [
      [
        'A',
        "node -e \"const m=require('./app.js'); process.exit(m.greetUser('Alice')=== 'Hello, Alice' ? 0:1)\"",
      ],
      [
        'A',
        'node -e "const m=require(\'./app.js\'); process.exit(m.averageOfArray([])=== 0 ? 0:1)"',
      ],
      [
        'A',
        'node -e "const m=require(\'./app.js\'); process.exit(m.factorial(0)===1 && m.factorial(5)===120 ? 0:1)"',
      ],
      [
        'B',
        "node -e \"const m=require('./app.js'); process.exit(m.repeatString(null,3)==='' ? 0:1)\"",
      ],
      [
        'B',
        'node -e "const m=require(\'./app.js\'); process.exit(m.clampValue(5,10,1)===5 ? 0:1)"',
      ],
      [
        'B',
        "node -e \"const m=require('./app.js'); process.exit(m.getProperty(null,'x')===undefined ? 0:1)\"",
      ],
      [
        'C',
        "node -e \"const m=require('./app.js'); process.exit(m.countWords('hello world foo')===3 ? 0:1)\"",
      ],
      [
        'C',
        'node -e "const m=require(\'./app.js\'); process.exit(m.isInRange(10,1,10)===true ? 0:1)"',
      ],
      [
        'C',
        'node -e "const m=require(\'./app.js\'); const r=m.uniqueItems([1,2,2,3,3,3]); process.exit(r.length===3 ? 0:1)"',
      ],
      [
        'D',
        "node -e \"const m=require('./app.js'); process.exit(m.truncate('hi',10)==='hi' ? 0:1)\"",
      ],
      [
        'D',
        "node -e \"const m=require('./app.js'); process.exit(m.safeParseInt('abc')===0 ? 0:1)\"",
      ],
      [
        'D',
        'node -e "const m=require(\'./app.js\'); const r=m.chunkArray([1,2,3],0); process.exit(Array.isArray(r)&&r.length===0 ? 0:1)"',
      ],
    ];
    for (const [cat, cmd] of checks) {
      if (runCmd(cmd, dir) === 0) {
        scores[cat]++;
        scores.total++;
      }
    }
    return scores;
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Fix all bugs in app.js. The file has 12 bugs across 4 categories (3 bugs each):',
        '',
        'CRASH BUGS: Look for (1) variable name typos causing ReferenceError,',
        '(2) division/property access on empty arrays returning NaN instead of 0,',
        '(3) infinite recursion with missing base cases.',
        '',
        'INPUT VALIDATION: Look for (1) functions that crash when passed null instead of string,',
        '(2) missing handling when min > max in range clamping,',
        '(3) missing null guard before property access on objects.',
        '',
        'LOGIC BUGS: Look for (1) counting characters instead of words,',
        '(2) off-by-one in range checks (should be inclusive on both ends),',
        '(3) filter that returns duplicates instead of unique items.',
        '',
        'EDGE CASES: Look for (1) appending "..." even when string is already short enough,',
        '(2) parseInt returning NaN instead of 0 for non-numeric input,',
        '(3) infinite loop when chunk size is 0.',
        '',
        'Run npm test to verify all 12 tests pass.',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const scores = scoreBugs(dir);
    return { scores, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: phased code audit of app.js',
        '',
        'flow:',
        '  prompt: PHASE 1 — CRASH BUGS. Read app.js. Fix ONLY functions that crash at runtime. Look for: (1) variable name typos causing ReferenceError, (2) division/property access on empty arrays returning NaN instead of 0, (3) infinite recursion with missing base cases. Do not touch non-crashing functions yet.',
        '  run: npm test',
        '  prompt: PHASE 2 — INPUT VALIDATION. Now fix ONLY missing input validation. Look for: (1) functions that crash when passed null instead of string — return empty string, (2) missing handling when min > max in range clamping — return val unchanged, (3) missing null/undefined guard before property access — return undefined.',
        '  run: npm test',
        '  prompt: PHASE 3 — LOGIC BUGS. Now fix ONLY wrong return values. Look for: (1) function that counts characters instead of words — split on whitespace, (2) off-by-one in range boundary — should be inclusive on both ends, (3) filter that returns duplicates instead of unique items — use indexOf === i.',
        '  run: npm test',
        '  prompt: PHASE 4 — EDGE CASES. Now fix remaining edge case handling. Look for: (1) string function that appends "..." even when input is already short enough — only append when truncated, (2) parseInt without NaN fallback — return 0, (3) loop with size=0 causing infinite iteration — return empty array.',
        '  run: npm test',
        '',
        'done when:',
        '  tests_pass',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const scores = scoreBugs(dir);
    return { scores, elapsed };
  });

  const vS = vanillaResult.scores;
  const pS = pluginResult.scores;

  record(
    'H15',
    'Phased Code Audit',
    `${vS.total}/12 (A:${vS.A} B:${vS.B} C:${vS.C} D:${vS.D})`,
    `${pS.total}/12 (A:${pS.A} B:${pS.B} C:${pS.C} D:${pS.D})`,
    vS.total >= 10,
    pS.total >= 10,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H16: Progressive Modular Build (Per-Phase Validation) ───────────
// Build a 5-module word frequency pipeline from spec. Plugin builds one module
// at a time with per-module validation. Vanilla builds all at once.
// Tests whether per-module construction catches interface mismatches.

async function testH16() {
  console.log('\n--- H16: Progressive Modular Build ---');

  const specTxt = [
    '# Word Frequency Analyzer — Module Specification',
    '',
    '## Overview',
    'Build 5 modules that form a pipeline: reader → tokenizer → counter → sorter → formatter.',
    '',
    '## Module 1: reader.js',
    'Export: readInput(filePath)',
    '- Read the file at filePath as UTF-8 and return its contents as a string.',
    '- If the file does not exist, return an empty string "" (do NOT throw).',
    '',
    '## Module 2: tokenizer.js',
    'Export: tokenize(text)',
    '- Split text into words by whitespace.',
    '- Convert each word to lowercase.',
    '- Remove all non-alphabetic characters from each word (keep only a-z).',
    '- Filter out any empty strings after cleanup.',
    '- Return an array of cleaned lowercase words.',
    '',
    '## Module 3: counter.js',
    'Export: countWords(words)',
    '- Takes an array of strings.',
    '- Return a Map where keys are words and values are counts.',
    '- MUST return a Map (not a plain object).',
    '',
    '## Module 4: sorter.js',
    'Export: topN(map, n)',
    '- Takes a Map of word→count and a number n.',
    '- Return an array of [word, count] pairs for the top N most frequent words.',
    '- Sort by count descending.',
    '- For equal counts, sort alphabetically (a before z).',
    '',
    '## Module 5: formatter.js',
    'Export: formatReport(entries)',
    '- Takes an array of [word, count] pairs.',
    '- Return a string with one line per entry: "word: count"',
    '- Lines joined by newline. No trailing newline.',
  ].join('\n');

  const sampleTxt = [
    'The quick brown fox jumps over the lazy dog.',
    'The dog barked at the fox.',
    'Quick brown fox, quick brown dog!',
  ].join('\n');

  const testJs = [
    'const fs = require("fs");',
    'let f = 0;',
    '',
    'function check(label, fn) {',
    '  try {',
    '    const ok = fn();',
    '    if (!ok) { console.error("FAIL: " + label); f++; }',
    '  } catch (e) {',
    '    console.error("FAIL: " + label + " threw: " + e.message);',
    '    f++;',
    '  }',
    '}',
    '',
    '// Existence checks (5)',
    'check("reader.js exists", () => fs.existsSync("reader.js"));',
    'check("tokenizer.js exists", () => fs.existsSync("tokenizer.js"));',
    'check("counter.js exists", () => fs.existsSync("counter.js"));',
    'check("sorter.js exists", () => fs.existsSync("sorter.js"));',
    'check("formatter.js exists", () => fs.existsSync("formatter.js"));',
    '',
    '// Function checks (5)',
    'check("readInput is function", () => typeof require("./reader.js").readInput === "function");',
    'check("tokenize is function", () => typeof require("./tokenizer.js").tokenize === "function");',
    'check("countWords is function", () => typeof require("./counter.js").countWords === "function");',
    'check("topN is function", () => typeof require("./sorter.js").topN === "function");',
    'check("formatReport is function", () => typeof require("./formatter.js").formatReport === "function");',
    '',
    '// Behavior checks (4)',
    'check("readInput reads file", () => {',
    '  const r = require("./reader.js");',
    '  const content = r.readInput("sample.txt");',
    '  return typeof content === "string" && content.includes("fox");',
    '});',
    '',
    'check("readInput missing file", () => {',
    '  const r = require("./reader.js");',
    '  return r.readInput("nonexistent.txt") === "";',
    '});',
    '',
    'check("countWords returns Map", () => {',
    '  const c = require("./counter.js");',
    '  const result = c.countWords(["a", "b", "a"]);',
    '  return result instanceof Map && result.get("a") === 2;',
    '});',
    '',
    'check("topN sorts correctly", () => {',
    '  const c = require("./counter.js");',
    '  const s = require("./sorter.js");',
    '  const map = c.countWords(["the", "fox", "the", "the", "fox"]);',
    '  const top = s.topN(map, 2);',
    '  return top[0][0] === "the" && top[0][1] === 3 && top[1][0] === "fox";',
    '});',
    '',
    'console.log(f === 0 ? "All 14 tests passed" : f + " of 14 tests failed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'spec.txt'), specTxt);
    await writeFile(join(dir, 'sample.txt'), sampleTxt);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'h16', scripts: { test: 'node test.js' } }),
    );
  }

  function scoreModules(dir) {
    const scores = { exist: 0, func: 0, behavior: 0, total: 0 };
    const modules = ['reader', 'tokenizer', 'counter', 'sorter', 'formatter'];

    // Existence (5)
    for (const m of modules) {
      if (existsSync(join(dir, `${m}.js`))) {
        scores.exist++;
        scores.total++;
      }
    }

    // Function exports (5)
    const fnChecks = [
      "node -e \"process.exit(typeof require('./reader.js').readInput==='function' ? 0:1)\"",
      "node -e \"process.exit(typeof require('./tokenizer.js').tokenize==='function' ? 0:1)\"",
      "node -e \"process.exit(typeof require('./counter.js').countWords==='function' ? 0:1)\"",
      "node -e \"process.exit(typeof require('./sorter.js').topN==='function' ? 0:1)\"",
      "node -e \"process.exit(typeof require('./formatter.js').formatReport==='function' ? 0:1)\"",
    ];
    for (const cmd of fnChecks) {
      if (runCmd(cmd, dir) === 0) {
        scores.func++;
        scores.total++;
      }
    }

    // Behavior (4)
    const behaviorChecks = [
      "node -e \"const r=require('./reader.js'); process.exit(typeof r.readInput('sample.txt')==='string' && r.readInput('sample.txt').includes('fox') ? 0:1)\"",
      "node -e \"const r=require('./reader.js'); process.exit(r.readInput('nonexistent.txt')==='' ? 0:1)\"",
      "node -e \"const c=require('./counter.js'); const r=c.countWords(['a','b','a']); process.exit(r instanceof Map && r.get('a')===2 ? 0:1)\"",
      "node -e \"const c=require('./counter.js'); const s=require('./sorter.js'); const m=c.countWords(['the','fox','the','the','fox']); const t=s.topN(m,2); process.exit(t[0][0]==='the' && t[0][1]===3 && t[1][0]==='fox' ? 0:1)\"",
    ];
    for (const cmd of behaviorChecks) {
      if (runCmd(cmd, dir) === 0) {
        scores.behavior++;
        scores.total++;
      }
    }

    return scores;
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Read spec.txt. Build all 5 modules according to the specification.',
        '',
        'Key requirements per module:',
        '- reader.js: readInput(filePath) reads UTF-8, returns "" on missing file',
        '- tokenizer.js: tokenize(text) splits on whitespace, lowercases, removes punctuation, filters empties',
        '- counter.js: countWords(words) returns a Map (NOT a plain object) of word→count',
        '- sorter.js: topN(map, n) returns [word,count] pairs sorted by count desc, alphabetical tiebreak',
        '- formatter.js: formatReport(entries) returns "word: count" lines joined by newline',
        '',
        'Run npm test to verify all 14 tests pass.',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const scores = scoreModules(dir);
    return { scores, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: build word frequency analyzer module by module',
        '',
        'flow:',
        '  prompt: Read spec.txt. Build reader.js: export readInput(filePath) that reads UTF-8 file, returns contents as string. Return "" on missing files — do NOT throw.',
        "  run: node -e \"const r=require('./reader.js'); if(typeof r.readInput('./sample.txt')!=='string') process.exit(1); if(r.readInput('./nope')!=='') process.exit(1)\"",
        '  prompt: Build tokenizer.js: export tokenize(text) splitting on whitespace into lowercase words, removing all non-alphabetic characters, filtering empty strings.',
        "  run: node -e \"const t=require('./tokenizer.js').tokenize('Hello, World! Hello.'); if(t.length!==3||t[0]!=='hello') process.exit(1)\"",
        '  prompt: Build counter.js: export countWords(words) returning a Map (NOT a plain object) of word to count. And sorter.js: export topN(map, n) returning top N [word,count] pairs sorted by count descending, alphabetical tiebreak for equal counts.',
        "  run: node -e \"const c=require('./counter.js').countWords(['a','b','a']); const s=require('./sorter.js').topN(c,1); if(s[0][0]!=='a'||s[0][1]!==2) process.exit(1)\"",
        '  prompt: Build formatter.js: export formatReport(entries) returning "word: count" lines joined by newline, no trailing newline. Run npm test to verify full integration.',
        '  run: npm test',
        '',
        'done when:',
        '  tests_pass',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const scores = scoreModules(dir);
    return { scores, elapsed };
  });

  const vS = vanillaResult.scores;
  const pS = pluginResult.scores;

  record(
    'H16',
    'Progressive Modular Build',
    `${vS.total}/14 (exist:${vS.exist} func:${vS.func} behav:${vS.behavior})`,
    `${pS.total}/14 (exist:${pS.exist} func:${pS.func} behav:${pS.behavior})`,
    vS.total >= 12,
    pS.total >= 12,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── Summary helpers ─────────────────────────────────────────────────

function printIterationSummary(iteration) {
  console.log('\n' + '='.repeat(60));
  if (REPEAT_COUNT > 1) {
    console.log(`[comparative-eval] Summary (Iteration ${iteration + 1}/${REPEAT_COUNT})\n`);
  } else {
    console.log('[comparative-eval] Summary\n');
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

    const paddedTitle = data.title.padEnd(26);
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
  const testCount = QUICK_MODE ? 7 : 16;
  const estMinutes = Math.round(testCount * 2 * REPEAT_COUNT);

  console.log(`[comparative-eval] Plugin vs Vanilla — ${testCount} Hypotheses\n`);

  if (QUICK_MODE) {
    console.log(`  Mode: QUICK (H3, H4, H6, H7, H10, H11, H12 — no gate loops)`);
  } else {
    console.log(`  Mode: FULL (all ${testCount} hypotheses)`);
  }

  if (REPEAT_COUNT > 1) {
    console.log(`  Repeats: ${REPEAT_COUNT}`);
  }

  console.log(`  Estimated runtime: ~${estMinutes} minutes\n`);

  try {
    execSync('claude --version', { encoding: 'utf-8', timeout: 5000 });
  } catch {
    console.log('[comparative-eval] SKIP — claude CLI not found.');
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

    // Quick tests (no gate loops)
    await testH3();
    await testH4();
    await testH6();
    await testH7();
    await testH10();
    await testH11();
    await testH12();

    if (!QUICK_MODE) {
      // Gate-loop tests (slower)
      await testH1();
      await testH2();
      await testH5();
      await testH8();
      await testH9();
      await testH13();
      await testH14();
      // Long-horizon coded judgment tests (300s timeout)
      await testH15();
      await testH16();
    } else {
      console.log('\n  SKIP  H1: Hidden Second Bug (--quick mode)');
      console.log('  SKIP  H2: Gaslighting "Tests Pass" (--quick mode)');
      console.log('  SKIP  H5: Dual Gate (--quick mode)');
      console.log('  SKIP  H8: Misleading Console Output (--quick mode)');
      console.log('  SKIP  H9: Iterative Multi-Bug Fix (--quick mode)');
      console.log('  SKIP  H13: File-Exists Gate (--quick mode)');
      console.log('  SKIP  H14: Nested Control Flow (--quick mode)');
      console.log('  SKIP  H15: Phased Code Audit (--quick mode)');
      console.log('  SKIP  H16: Progressive Modular Build (--quick mode)');
    }

    // Per-iteration summary
    printIterationSummary(iter);
    allIterationResults.push([...results]);
  }

  // Reliability summary (only when repeating)
  if (REPEAT_COUNT > 1) {
    printReliabilitySummary(allIterationResults);
  }

  // Timing summary
  printTimingSummary(allIterationResults);

  pluginInstall();
  console.log('\n[comparative-eval] Plugin re-installed. Environment restored.');
}

main().catch((err) => {
  try {
    pluginInstall();
  } catch {
    /* best effort */
  }
  console.error('[comparative-eval] Fatal error:', err.message);
  process.exit(1);
});
