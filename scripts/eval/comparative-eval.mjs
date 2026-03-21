#!/usr/bin/env node
/**
 * comparative-eval.mjs — Plugin vs Vanilla Claude comparative evaluation.
 *
 * 35 hypotheses testing structural enforcement mechanisms (gate stop-hooks,
 * auto-execution, variable capture, control-flow loops, phased prompts,
 * diff gates, gate+retry combinations, while/until loops, conditional
 * branching with variable capture, gaslighting+loop combos, inverted gates,
 * triple gates, diagnostic routing, let-prompt capture, lint_fail gate,
 * custom gate commands, context management via selective variable injection,
 * long-horizon value preservation over many execution steps)
 * that vanilla Claude cannot replicate.
 *
 * Quick mode (7 tests): H3, H4, H6, H7, H10, H11, H12 — no gate loops
 * Full mode (35 tests): all hypotheses
 *
 * Usage:
 *   node scripts/eval/comparative-eval.mjs                   # all 35 hypotheses
 *   node scripts/eval/comparative-eval.mjs --quick            # fast subset (7 tests)
 *   node scripts/eval/comparative-eval.mjs --repeat 3         # 3 iterations for reliability
 *   node scripts/eval/comparative-eval.mjs --quick --repeat 3 # combined
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
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
    } catch (err) {
      if (i < retries - 1) await sleep(1000);
      else console.warn(`  [warn] failed to clean up ${dir}: ${err.message}`);
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

async function safeRead(filePath) {
  try {
    return (await readFile(filePath, 'utf-8')).trim();
  } catch {
    return '';
  }
}

function safeReadSync(filePath) {
  try {
    return readFileSync(filePath, 'utf-8').trim();
  } catch {
    return '';
  }
}

/**
 * Run a JS code snippet as a temp file to avoid Windows cmd.exe shell quoting issues
 * with `node -e "..."`. Returns 0 on success, 1 on failure.
 */
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
      // Best-effort cleanup — file may already be deleted by withTempDir
    }
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
        'Each step depends on the previous one.',
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
        'Run them in order.',
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

// ── H17: diff_nonempty Gate ──────────────────────────────────────────
// calculator.js has swapped implementations (add subtracts, subtract adds).
// Vanilla is asked to "review" and write observations. Plugin is asked to
// fix anything wrong, with a `done when: diff_nonempty` gate that forces
// actual file modifications. Expected: PLUGIN WINS — vanilla may advise
// without editing.

async function testH17() {
  console.log('\n--- H17: diff_nonempty Gate ---');

  const calculatorJs = [
    'function add(a, b) {',
    '  return a - b;',
    '}',
    '',
    'function subtract(a, b) {',
    '  return a + b;',
    '}',
    '',
    'function multiply(a, b) {',
    '  return a * b;',
    '}',
    '',
    'module.exports = { add, subtract, multiply };',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'calculator.js'), calculatorJs);
    // Initialize git repo so diff_nonempty gate can check git diff
    execSync('git init && git add -A && git commit -m "init"', {
      cwd: dir,
      encoding: 'utf-8',
      timeout: 10_000,
    });
  }

  function checkChanged(dir) {
    const content = safeReadSync(join(dir, 'calculator.js'));
    // Pass if add now returns a+b or subtract now returns a-b
    return content !== calculatorJs && content.length > 0;
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Review calculator.js in this directory. The functions may have issues.',
        'Write your observations to review.txt.',
        'Note: add(2,3) should return 5 and subtract(5,3) should return 2.',
      ].join('\n'),
      dir,
      LONG_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const changed = checkChanged(dir);
    return { changed, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: fix calculator',
        '',
        'flow:',
        '  prompt: Review calculator.js — the math functions may have issues. Fix anything wrong so add(2,3) returns 5 and subtract(5,3) returns 2.',
        '',
        'done when:',
        '  diff_nonempty',
      ].join('\n'),
      dir,
      LONG_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const changed = checkChanged(dir);
    return { changed, elapsed };
  });

  record(
    'H17',
    'diff_nonempty Gate',
    vanillaResult.changed ? 'calculator.js modified' : 'no code changes',
    pluginResult.changed ? 'calculator.js modified' : 'no code changes',
    vanillaResult.changed,
    pluginResult.changed,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H18: Gate + Retry Combo ─────────────────────────────────────────
// app.js has 2 test-failing bugs. utils.js uses `var` (lint fail). Prompt
// only mentions fixing tests. Plugin combines `retry max 3` with dual gates
// `tests_pass` + `lint_pass`. Vanilla fixes tests but has no reason to lint.
// Expected: PLUGIN WINS — retry iterates on test failures, lint gate catches var.

async function testH18() {
  console.log('\n--- H18: Gate + Retry Combo ---');

  const appJs = [
    'function double(n) {',
    '  return n + n + 1;',
    '}',
    '',
    'function isEven(n) {',
    '  return n % 2 === 1;',
    '}',
    '',
    'module.exports = { double, isEven };',
  ].join('\n');

  const utilsJs = [
    'var helper = "active";',
    '',
    'function getHelper() {',
    '  return helper;',
    '}',
    '',
    'module.exports = { getHelper };',
  ].join('\n');

  const testJs = [
    'const { double, isEven } = require("./app.js");',
    'let f = 0;',
    'if (double(5) !== 10) { console.error("FAIL: double(5) should be 10, got " + double(5)); f++; }',
    'if (double(0) !== 0) { console.error("FAIL: double(0) should be 0, got " + double(0)); f++; }',
    'if (isEven(4) !== true) { console.error("FAIL: isEven(4) should be true"); f++; }',
    'if (isEven(3) !== false) { console.error("FAIL: isEven(3) should be false"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  const lintJs = [
    'const fs = require("fs");',
    'const files = ["app.js", "utils.js"];',
    'let errors = 0;',
    'for (const file of files) {',
    '  const content = fs.readFileSync(file, "utf-8");',
    '  const lines = content.split("\\n");',
    '  lines.forEach((line, i) => {',
    '    if (/^\\s*var\\s/.test(line)) {',
    '      console.error(`LINT ERROR: var keyword found in ${file}:${i + 1}`);',
    '      errors++;',
    '    }',
    '  });',
    '}',
    'process.exit(errors > 0 ? 1 : 0);',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'utils.js'), utilsJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(join(dir, 'lint.js'), lintJs);
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'h18',
        scripts: { test: 'node test.js', lint: 'node lint.js' },
      }),
    );
  }

  function checkPass(dir) {
    const testOk = runCmd('node test.js', dir) === 0;
    const lintOk = runCmd('node lint.js', dir) === 0;
    return { testOk, lintOk, both: testOk && lintOk };
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Fix the bugs in app.js so all tests pass.',
        'Run npm test to verify.',
        'double(5) should return 10 and isEven(4) should return true.',
      ].join('\n'),
      dir,
      LONG_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const scores = checkPass(dir);
    return { scores, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: fix all code issues',
        '',
        'flow:',
        '  retry max 3',
        '    run: npm test',
        '    if command_failed',
        '      prompt: Fix the failing test in app.js based on the error output.',
        '    end',
        '  end',
        '',
        'done when:',
        '  tests_pass',
        '  lint_pass',
      ].join('\n'),
      dir,
      LONG_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const scores = checkPass(dir);
    return { scores, elapsed };
  });

  const vS = vanillaResult.scores;
  const pS = pluginResult.scores;

  record(
    'H18',
    'Gate + Retry Combo',
    `tests:${vS.testOk ? 'pass' : 'fail'} lint:${vS.lintOk ? 'pass' : 'fail'}`,
    `tests:${pS.testOk ? 'pass' : 'fail'} lint:${pS.lintOk ? 'pass' : 'fail'}`,
    vS.both,
    pS.both,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H19: While-Loop Fix Cycle ───────────────────────────────────────
// app.js has 4 functions, each with one bug. test.js exits on FIRST failure
// so Claude must iterate: fix → test → fix → test. Plugin's while loop
// mechanically re-runs tests after each fix. Vanilla relies on judgment.
// Expected: PLUGIN WINS — mechanical loop enforces re-verification.

async function testH19() {
  console.log('\n--- H19: While-Loop Fix Cycle ---');

  const appJs = [
    'function add(a, b) { return a - b; }',
    'function capitalize(s) { return s.toLowerCase(); }',
    'function isEven(n) { return n % 2 === 1; }',
    'function reverse(s) { return s.split("").sort().join(""); }',
    '',
    'module.exports = { add, capitalize, isEven, reverse };',
  ].join('\n');

  const testJs = [
    'const m = require("./app.js");',
    'if (m.add(2, 3) !== 5) { console.error("FAIL: add(2,3) should be 5, got " + m.add(2, 3)); process.exit(1); }',
    'if (m.capitalize("hello") !== "Hello") { console.error("FAIL: capitalize(\\"hello\\") should be \\"Hello\\", got " + m.capitalize("hello")); process.exit(1); }',
    'if (m.isEven(4) !== true) { console.error("FAIL: isEven(4) should be true, got " + m.isEven(4)); process.exit(1); }',
    'if (m.reverse("abc") !== "cba") { console.error("FAIL: reverse(\\"abc\\") should be \\"cba\\", got " + m.reverse("abc")); process.exit(1); }',
    'console.log("All tests passed"); process.exit(0);',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'h19', scripts: { test: 'node test.js' } }),
    );
  }

  function score(dir) {
    let s = 0;
    const checks = [
      "const m = require('./app.js'); process.exit(m.add(2,3) === 5 ? 0 : 1)",
      "const m = require('./app.js'); process.exit(m.capitalize('hello') === 'Hello' ? 0 : 1)",
      "const m = require('./app.js'); process.exit(m.isEven(4) === true ? 0 : 1)",
      "const m = require('./app.js'); process.exit(m.reverse('abc') === 'cba' ? 0 : 1)",
    ];
    for (const check of checks) {
      if (runJsCheck(check, dir) === 0) s++;
    }
    return s;
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Fix all bugs in app.js. There are 4 functions with bugs.',
        'Run `npm test` after fixing — tests exit on first failure so you may need multiple fix-and-test cycles.',
        'add(2,3) should return 5, capitalize("hello") should return "Hello",',
        'isEven(4) should return true, reverse("abc") should return "cba".',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { score: s, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: fix all bugs via while-loop test cycle',
        '',
        'flow:',
        '  run: npm test',
        '  while command_failed max 5',
        '    prompt: A test failed. Read the error output from the last test run. Fix ONLY the specific function that failed. Do not guess — look at the test output.',
        '    run: npm test',
        '  end',
        '  prompt: All tests pass. Confirm by reading test output.',
        '',
        'done when:',
        '  tests_pass',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { score: s, elapsed };
  });

  const vPass = vanillaResult.score === 4;
  const pPass = pluginResult.score === 4;

  record(
    'H19',
    'While-Loop Fix Cycle',
    `${vanillaResult.score}/4 bugs fixed`,
    `${pluginResult.score}/4 bugs fixed`,
    vPass,
    pPass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H20: Conditional Branch + Variable Chain ────────────────────────
// server.js has a type coercion bug (reduce initializer is "") AND logic bugs.
// diagnose.js outputs "TYPE_ERROR" or "LOGIC_ERROR". Plugin uses
// `let diagnosis = run` to capture output, then `if command_failed` branches
// to route Claude to the right fix strategy. Vanilla gets equivalent info
// but must self-direct. Tests the variable→condition chain mechanism.

async function testH20() {
  console.log('\n--- H20: Conditional Branch + Variable Chain ---');

  const serverJs = [
    'function processOrder(order) {',
    '  const total = order.items.reduce((sum, item) => sum + item.price, "");',
    '  const discount = order.coupon ? total * 0.1 : 0;',
    '  const tax = total * 0.08;',
    '  return { total, discount, tax, final: total - discount + tax };',
    '}',
    'module.exports = { processOrder };',
  ].join('\n');

  const diagnoseJs = [
    'const { processOrder } = require("./server.js");',
    'const result = processOrder({ items: [{ price: 10 }, { price: 20 }], coupon: true });',
    'if (typeof result.total === "string") {',
    '  console.log("TYPE_ERROR");',
    '  process.exit(1);',
    '} else if (result.final !== 29.4) {',
    '  console.log("LOGIC_ERROR");',
    '  process.exit(1);',
    '} else {',
    '  console.log("OK");',
    '  process.exit(0);',
    '}',
  ].join('\n');

  const testJs = [
    'const { processOrder } = require("./server.js");',
    'let f = 0;',
    'const r1 = processOrder({ items: [{ price: 10 }, { price: 20 }], coupon: false });',
    'if (typeof r1.total !== "number") { console.error("FAIL: total should be number"); f++; }',
    'if (r1.total !== 30) { console.error("FAIL: total should be 30, got " + r1.total); f++; }',
    'if (r1.tax !== 2.4) { console.error("FAIL: tax should be 2.4, got " + r1.tax); f++; }',
    'const r2 = processOrder({ items: [{ price: 100 }], coupon: true });',
    'if (r2.discount !== 10) { console.error("FAIL: discount should be 10, got " + r2.discount); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'server.js'), serverJs);
    await writeFile(join(dir, 'diagnose.js'), diagnoseJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'h20', scripts: { test: 'node test.js' } }),
    );
  }

  function score(dir) {
    let s = 0;
    const checks = [
      "const m = require('./server.js'); const r = m.processOrder({items:[{price:10},{price:20}],coupon:false}); process.exit(typeof r.total === 'number' ? 0 : 1)",
      "const m = require('./server.js'); const r = m.processOrder({items:[{price:10},{price:20}],coupon:false}); process.exit(r.total === 30 ? 0 : 1)",
      "const m = require('./server.js'); const r = m.processOrder({items:[{price:10},{price:20}],coupon:false}); process.exit(r.tax === 2.4 ? 0 : 1)",
      "const m = require('./server.js'); const r = m.processOrder({items:[{price:100}],coupon:true}); process.exit(r.discount === 10 ? 0 : 1)",
    ];
    for (const check of checks) {
      if (runJsCheck(check, dir) === 0) s++;
    }
    return s;
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        "Run `node diagnose.js` to find what's wrong with server.js.",
        'Fix whatever the diagnosis says.',
        'Then run `npm test` to verify.',
        'Expected: total is a number, total=30 for two items (10+20),',
        'tax=2.4 (8% of 30), discount=10 (10% of 100).',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { score: s, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: diagnose and fix server.js',
        '',
        'flow:',
        '  let diagnosis = run "node diagnose.js"',
        '  if command_failed',
        '    prompt: diagnose.js found a problem. The diagnosis was: "${diagnosis}". If TYPE_ERROR, the reduce() initializer is wrong — it should be 0 not "". If LOGIC_ERROR, the discount/tax math is wrong. Fix server.js based on the specific diagnosis.',
        '    run: npm test',
        '    if command_failed',
        '      prompt: Tests still fail. Read the test output and fix remaining issues.',
        '      run: npm test',
        '    end',
        '  end',
        '  prompt: Confirm all tests pass.',
        '',
        'done when:',
        '  tests_pass',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { score: s, elapsed };
  });

  const vPass = vanillaResult.score === 4;
  const pPass = pluginResult.score === 4;

  record(
    'H20',
    'Conditional Branch + Variable Chain',
    `${vanillaResult.score}/4 checks pass`,
    `${pluginResult.score}/4 checks pass`,
    vPass,
    pPass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H21: Until-Loop Quality Gate ────────────────────────────────────
// utils.js has 3 subtle bugs (off-by-one pagination, rounding precision,
// clamp edge case). test.js has 9 assertions (3 per function). Plugin uses
// `until tests_pass max 5` with hints in the loop body. Vanilla gets the
// same hints upfront. Tests the mechanical until-loop with builtin predicate.
// Expected: PLUGIN WINS — until loop re-runs tests mechanically after fixes.

async function testH21() {
  console.log('\n--- H21: Until-Loop Quality Gate ---');

  const utilsJs = [
    'function paginate(items, page, perPage) {',
    '  const start = page * perPage;',
    '  return items.slice(start, start + perPage);',
    '}',
    '',
    'function formatPercent(value) {',
    '  return Math.round(value * 100) + "%";',
    '}',
    '',
    'function clamp(val, min, max) {',
    '  if (val < min) return min;',
    '  if (val > max) return max;',
    '  return val;',
    '}',
    '',
    'module.exports = { paginate, formatPercent, clamp };',
  ].join('\n');

  const testJs = [
    'const { paginate, formatPercent, clamp } = require("./utils.js");',
    'let f = 0;',
    '// paginate: 1-based pages',
    'const items = [1,2,3,4,5,6,7,8,9,10];',
    'const p1 = paginate(items, 1, 3);',
    'if (JSON.stringify(p1) !== "[1,2,3]") { console.error("FAIL: paginate(items,1,3) should be [1,2,3], got " + JSON.stringify(p1)); f++; }',
    'const p2 = paginate(items, 2, 3);',
    'if (JSON.stringify(p2) !== "[4,5,6]") { console.error("FAIL: paginate(items,2,3) should be [4,5,6], got " + JSON.stringify(p2)); f++; }',
    'const p4 = paginate(items, 4, 3);',
    'if (JSON.stringify(p4) !== "[10]") { console.error("FAIL: paginate(items,4,3) should be [10], got " + JSON.stringify(p4)); f++; }',
    '// formatPercent: one decimal place',
    'if (formatPercent(0.5) !== "50.0%") { console.error("FAIL: formatPercent(0.5) should be \\"50.0%\\", got " + formatPercent(0.5)); f++; }',
    'if (formatPercent(0.155) !== "15.5%") { console.error("FAIL: formatPercent(0.155) should be \\"15.5%\\", got " + formatPercent(0.155)); f++; }',
    'if (formatPercent(1) !== "100.0%") { console.error("FAIL: formatPercent(1) should be \\"100.0%\\", got " + formatPercent(1)); f++; }',
    '// clamp: handle min > max',
    'if (clamp(5, 1, 10) !== 5) { console.error("FAIL: clamp(5,1,10) should be 5, got " + clamp(5, 1, 10)); f++; }',
    'if (clamp(15, 1, 10) !== 10) { console.error("FAIL: clamp(15,1,10) should be 10, got " + clamp(15, 1, 10)); f++; }',
    'if (clamp(5, 10, 1) !== 5) { console.error("FAIL: clamp(5,10,1) should be 5 (min>max), got " + clamp(5, 10, 1)); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'utils.js'), utilsJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'h21', scripts: { test: 'node test.js' } }),
    );
  }

  function score(dir) {
    let s = 0;
    const checks = [
      // paginate
      "const m = require('./utils.js'); process.exit(JSON.stringify(m.paginate([1,2,3,4,5,6,7,8,9,10],1,3)) === '[1,2,3]' ? 0 : 1)",
      "const m = require('./utils.js'); process.exit(JSON.stringify(m.paginate([1,2,3,4,5,6,7,8,9,10],2,3)) === '[4,5,6]' ? 0 : 1)",
      "const m = require('./utils.js'); process.exit(JSON.stringify(m.paginate([1,2,3,4,5,6,7,8,9,10],4,3)) === '[10]' ? 0 : 1)",
      // formatPercent
      "const m = require('./utils.js'); process.exit(m.formatPercent(0.5) === '50.0%' ? 0 : 1)",
      "const m = require('./utils.js'); process.exit(m.formatPercent(0.155) === '15.5%' ? 0 : 1)",
      "const m = require('./utils.js'); process.exit(m.formatPercent(1) === '100.0%' ? 0 : 1)",
      // clamp
      "const m = require('./utils.js'); process.exit(m.clamp(5,1,10) === 5 ? 0 : 1)",
      "const m = require('./utils.js'); process.exit(m.clamp(15,1,10) === 10 ? 0 : 1)",
      "const m = require('./utils.js'); process.exit(m.clamp(5,10,1) === 5 ? 0 : 1)",
    ];
    for (const check of checks) {
      if (runJsCheck(check, dir) === 0) s++;
    }
    return s;
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Fix all bugs in utils.js. Run npm test. There are 3 functions with subtle bugs:',
        '- paginate: page numbering is 1-based, not 0-based',
        '- formatPercent: needs one decimal place (use toFixed(1))',
        '- clamp: must handle min > max by returning val',
        'Tests have 9 assertions (3 per function: normal, boundary, edge).',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { score: s, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: fix all utils.js bugs with escalating hints',
        '',
        'flow:',
        '  until tests_pass max 5',
        '    run: npm test',
        '    if command_failed',
        '      prompt: Tests failed. Read the EXACT error output carefully. Fix only the function(s) that failed. Common mistakes: (1) paginate page numbering is 1-based, (2) formatPercent needs one decimal place, (3) clamp must handle min > max by returning val.',
        '    end',
        '  end',
        '',
        'done when:',
        '  tests_pass',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { score: s, elapsed };
  });

  const vPass = vanillaResult.score === 9;
  const pPass = pluginResult.score === 9;

  record(
    'H21',
    'Until-Loop Quality Gate',
    `${vanillaResult.score}/9 assertions pass`,
    `${pluginResult.score}/9 assertions pass`,
    vPass,
    pPass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H22: Gaslighting + While Loop (4 hidden bugs, prompt mentions 1) ─
// app.js has 4 bugs across 4 functions. Vanilla is told "there's just one
// bug in greet(), the rest is fine." Plugin has a while loop that mechanically
// iterates through test failures. Gate blocks until ALL 4 are fixed.

async function testH22() {
  console.log('\n--- H22: Gaslighting + While Loop ---');

  const appJs = [
    'function greet(name) { return "Hello, " + nme; }',
    'function double(n) { return n + n + 1; }',
    'function isPositive(n) { return n > 1; }',
    'function repeat(s, n) { return s.repeat(n - 1); }',
    '',
    'module.exports = { greet, double, isPositive, repeat };',
  ].join('\n');

  const testJs = [
    'const m = require("./app.js");',
    'if (m.greet("World") !== "Hello, World") { console.error("FAIL: greet"); process.exit(1); }',
    'if (m.double(5) !== 10) { console.error("FAIL: double(5) should be 10, got " + m.double(5)); process.exit(1); }',
    'if (m.isPositive(1) !== true) { console.error("FAIL: isPositive(1) should be true"); process.exit(1); }',
    'if (m.repeat("ab", 3) !== "ababab") { console.error("FAIL: repeat(\'ab\',3) should be \'ababab\', got \'" + m.repeat("ab", 3) + "\'"); process.exit(1); }',
    'console.log("All tests passed"); process.exit(0);',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'h22', scripts: { test: 'node test.js' } }),
    );
  }

  function score(dir) {
    let s = 0;
    const checks = [
      "const m = require('./app.js'); process.exit(m.greet('World') === 'Hello, World' ? 0 : 1)",
      "const m = require('./app.js'); process.exit(m.double(5) === 10 ? 0 : 1)",
      "const m = require('./app.js'); process.exit(m.isPositive(1) === true ? 0 : 1)",
      "const m = require('./app.js'); process.exit(m.repeat('ab', 3) === 'ababab' ? 0 : 1)",
    ];
    for (const check of checks) {
      if (runJsCheck(check, dir) === 0) s++;
    }
    return s;
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      "Fix the ReferenceError in greet() in app.js. The other functions (double, isPositive, repeat) are correct — don't change them. Run npm test to verify your fix.",
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { score: s, elapsed };
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
        '  run: npm test',
        '  while command_failed max 5',
        '    prompt: A test failed. Read the error output carefully. Fix ONLY the failing function.',
        '    run: npm test',
        '  end',
        '',
        'done when:',
        '  tests_pass',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { score: s, elapsed };
  });

  const vPass = vanillaResult.score === 4;
  const pPass = pluginResult.score === 4;

  record(
    'H22',
    'Gaslighting + While Loop',
    `${vanillaResult.score}/4 functions fixed`,
    `${pluginResult.score}/4 functions fixed`,
    vPass,
    pPass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H23: Inverted Gate — Write a Failing Test ────────────────────────
// calculator.js has a division-by-zero bug. Goal: write a TEST that catches
// the bug (not fix it). Vanilla is told "code is fine, just add a positive
// test." Plugin uses `done when: tests_fail` — blocks until tests actually
// fail, forcing Claude to write a bug-exposing test.

async function testH23() {
  console.log('\n--- H23: Inverted Gate — Write Failing Test ---');

  const calcJs = [
    'function divide(a, b) { return a / b; }',
    'function multiply(a, b) { return a * b; }',
    'module.exports = { divide, multiply };',
  ].join('\n');

  const testJs = [
    'const { divide, multiply } = require("./calculator.js");',
    'let f = 0;',
    'if (divide(10, 2) !== 5) { console.error("FAIL: divide(10,2)"); f++; }',
    'if (multiply(3, 4) !== 12) { console.error("FAIL: multiply(3,4)"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'calculator.js'), calcJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'h23', scripts: { test: 'node test.js' } }),
    );
  }

  function score(dir) {
    const testContent = safeReadSync(join(dir, 'test.js'));
    const hasDivZeroTest = /divide\s*\([^,]+,\s*0\s*\)/.test(testContent);
    const testsFail = runCmd('node test.js', dir) === 1;
    const calcContent = safeReadSync(join(dir, 'calculator.js'));
    const calcUnchanged = calcContent.includes('return a / b');
    return {
      hasDivZeroTest,
      testsFail,
      calcUnchanged,
      pass: hasDivZeroTest && testsFail && calcUnchanged,
    };
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      'The calculator module is working correctly. Add one more test to test.js for completeness — test divide(20, 4) === 5. Run npm test to make sure everything still passes.',
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { ...s, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: write a test that catches the division-by-zero bug',
        '',
        'flow:',
        '  prompt: calculator.js has a bug — divide(10, 0) returns Infinity instead of 0 or throwing an error. Add a test to test.js that checks divide(a, 0) returns 0 (or throws). Do NOT fix calculator.js — only modify test.js.',
        '',
        'done when:',
        '  tests_fail',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { ...s, elapsed };
  });

  const vDesc = vanillaResult.pass
    ? 'div-zero test added, tests fail'
    : vanillaResult.hasDivZeroTest
      ? 'div-zero test added but tests still pass'
      : 'no div-zero test';
  const pDesc = pluginResult.pass
    ? 'div-zero test added, tests fail'
    : pluginResult.hasDivZeroTest
      ? 'div-zero test added but tests still pass'
      : 'no div-zero test';

  record(
    'H23',
    'Inverted Gate — Write Failing Test',
    vDesc,
    pDesc,
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H24: Triple Gate Enforcement ─────────────────────────────────────
// app.js has a test-failing bug. utils.js has a lint-failing `var`.
// No README.md exists. Vanilla is told "fix the test failure in app.js."
// Plugin has three gates: tests_pass + lint_pass + file_exists README.md.

async function testH24() {
  console.log('\n--- H24: Triple Gate Enforcement ---');

  const appJs = ['function square(n) { return n * n + 1; }', 'module.exports = { square };'].join(
    '\n',
  );

  const utilsJs = [
    'var config = { debug: false };',
    'function getConfig() { return config; }',
    'module.exports = { getConfig };',
  ].join('\n');

  const testJs = [
    'const { square } = require("./app.js");',
    'let f = 0;',
    'if (square(3) !== 9) { console.error("FAIL: square(3) should be 9, got " + square(3)); f++; }',
    'if (square(0) !== 0) { console.error("FAIL: square(0) should be 0, got " + square(0)); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  const lintJs = [
    'const fs = require("fs");',
    'let errors = 0;',
    'for (const file of ["app.js", "utils.js"]) {',
    '  const content = fs.readFileSync(file, "utf-8");',
    '  content.split("\\n").forEach((line, i) => {',
    '    if (/^\\s*var\\s/.test(line)) {',
    '      console.error(`LINT: var keyword in ${file}:${i + 1}`);',
    '      errors++;',
    '    }',
    '  });',
    '}',
    'process.exit(errors > 0 ? 1 : 0);',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'utils.js'), utilsJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(join(dir, 'lint.js'), lintJs);
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'h24',
        scripts: { test: 'node test.js', lint: 'node lint.js' },
      }),
    );
  }

  function score(dir) {
    const testsPass = runCmd('node test.js', dir) === 0;
    const lintPass = runCmd('node lint.js', dir) === 0;
    const readmeContent = safeReadSync(join(dir, 'README.md'));
    const readmeExists = readmeContent.length > 10;
    return {
      testsPass,
      lintPass,
      readmeExists,
      total: (testsPass ? 1 : 0) + (lintPass ? 1 : 0) + (readmeExists ? 1 : 0),
      pass: testsPass && lintPass && readmeExists,
    };
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      'Fix the test failure in app.js. Run npm test to verify. square(3) should return 9.',
      dir,
      LONG_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { ...s, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: fix all code quality issues',
        '',
        'flow:',
        '  prompt: Fix the test failure in app.js. square(3) should return 9.',
        '  run: npm test',
        '',
        'done when:',
        '  tests_pass',
        '  lint_pass',
        '  file_exists README.md',
      ].join('\n'),
      dir,
      LONG_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { ...s, elapsed };
  });

  const vDesc = `${vanillaResult.total}/3 (tests:${vanillaResult.testsPass ? 'Y' : 'N'} lint:${vanillaResult.lintPass ? 'Y' : 'N'} readme:${vanillaResult.readmeExists ? 'Y' : 'N'})`;
  const pDesc = `${pluginResult.total}/3 (tests:${pluginResult.testsPass ? 'Y' : 'N'} lint:${pluginResult.lintPass ? 'Y' : 'N'} readme:${pluginResult.readmeExists ? 'Y' : 'N'})`;

  record(
    'H24',
    'Triple Gate Enforcement',
    vDesc,
    pDesc,
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H25: Diagnostic Routing + Gaslighting ────────────────────────────
// app.js has 3 bugs: type coercion in formatPrice, logic error in
// applyDiscount, edge case in calculateTotal. Vanilla is told "just a
// formatting issue in formatPrice." Plugin uses `let diagnosis = run` to
// capture diagnose.js output, then `if command_failed` routes fixes.

async function testH25() {
  console.log('\n--- H25: Diagnostic Routing + Gaslighting ---');

  const appJs = [
    'function formatPrice(cents) {',
    '  const dollars = cents / 100;',
    '  return "$" + dollars.toFixed(2);',
    '}',
    'function applyDiscount(price, pct) {',
    '  return price - pct;',
    '}',
    'function calculateTotal(items) {',
    '  return items.reduce((sum, item) => sum + item.price);',
    '}',
    'module.exports = { formatPrice, applyDiscount, calculateTotal };',
  ].join('\n');

  const diagnoseJs = [
    'const { formatPrice, applyDiscount, calculateTotal } = require("./app.js");',
    'let typeErrors = 0, logicErrors = 0;',
    'try { if (formatPrice("1050") !== "$10.50") typeErrors++; } catch { typeErrors++; }',
    'try { if (applyDiscount(200, 10) !== 180) logicErrors++; } catch { logicErrors++; }',
    'try { calculateTotal([]); } catch { typeErrors++; }',
    'if (typeErrors > 0 && logicErrors > 0) { console.log("BOTH"); process.exit(1); }',
    'else if (typeErrors > 0) { console.log("TYPE_ERRORS"); process.exit(1); }',
    'else if (logicErrors > 0) { console.log("LOGIC_ERRORS"); process.exit(1); }',
    'else { console.log("ALL_CLEAR"); process.exit(0); }',
  ].join('\n');

  const testJs = [
    'const { formatPrice, applyDiscount, calculateTotal } = require("./app.js");',
    'let f = 0;',
    'if (formatPrice("1050") !== "$10.50") { console.error("FAIL: formatPrice(\'1050\')"); f++; }',
    'if (formatPrice(999) !== "$9.99") { console.error("FAIL: formatPrice(999)"); f++; }',
    'if (applyDiscount(200, 10) !== 180) { console.error("FAIL: applyDiscount(200,10)"); f++; }',
    'if (applyDiscount(50, 10) !== 45) { console.error("FAIL: applyDiscount(50,10)"); f++; }',
    'try { const r = calculateTotal([]); if (r !== 0) { console.error("FAIL: calculateTotal([])"); f++; } } catch (e) { console.error("FAIL: calculateTotal([]) threw"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'diagnose.js'), diagnoseJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'h25', scripts: { test: 'node test.js' } }),
    );
  }

  function score(dir) {
    let s = 0;
    const checks = [
      "const m = require('./app.js'); process.exit(m.formatPrice('1050') === '$10.50' ? 0 : 1)",
      "const m = require('./app.js'); process.exit(m.formatPrice(999) === '$9.99' ? 0 : 1)",
      "const m = require('./app.js'); process.exit(m.applyDiscount(200, 10) === 180 ? 0 : 1)",
      "const m = require('./app.js'); process.exit(m.applyDiscount(50, 10) === 45 ? 0 : 1)",
      "const m = require('./app.js'); try { process.exit(m.calculateTotal([]) === 0 ? 0 : 1); } catch { process.exit(1); }",
    ];
    for (const check of checks) {
      if (runJsCheck(check, dir) === 0) s++;
    }
    return s;
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      'The app has a small formatting issue in formatPrice — it should handle string inputs by converting them to numbers first. Fix that one issue. The discount and total functions are correct. Run npm test.',
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { score: s, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: diagnose and fix all app.js bugs',
        '',
        'flow:',
        '  let diagnosis = run "node diagnose.js"',
        '  if command_failed',
        '    prompt: diagnose.js found: "${diagnosis}". Fix ALL bugs: if TYPE_ERRORS/BOTH — formatPrice must Number() its input, calculateTotal needs reduce initializer 0. If LOGIC_ERRORS/BOTH — applyDiscount should use price * pct / 100, not price - pct.',
        '    run: npm test',
        '    if command_failed',
        '      prompt: Tests still fail. Read test output and fix remaining issues.',
        '      run: npm test',
        '    end',
        '  end',
        '',
        'done when:',
        '  tests_pass',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { score: s, elapsed };
  });

  const vPass = vanillaResult.score === 5;
  const pPass = pluginResult.score === 5;

  record(
    'H25',
    'Diagnostic Routing + Gaslighting',
    `${vanillaResult.score}/5 assertions pass`,
    `${pluginResult.score}/5 assertions pass`,
    vPass,
    pPass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H26: let-prompt Variable Capture + Gaslighting ──────────────────
// app.js has two bugs: a crash bug (mentioned to vanilla) and a hidden
// SQL injection via string concat. Plugin uses `let instructions = prompt`
// to capture a security audit instruction as context. Vanilla is told
// "fix the crash, the query logic is fine."

async function testH26() {
  console.log('\n--- H26: let-prompt Variable Capture + Gaslighting ---');

  const appJs = [
    'function getUser(db, id) {',
    '  if (!id) throw new Error("missing id");',
    '  return db.query("SELECT * FROM users WHERE id = " + id);',
    '}',
    'module.exports = { getUser };',
  ].join('\n');

  const testJs = [
    'const assert = require("assert");',
    'const db = { query(q) { return { sql: q }; } };',
    'const { getUser } = require("./app.js");',
    'let f = 0;',
    '// Test 1: null id should return null, not throw',
    'try { const r = getUser(db, null); if (r !== null) { console.error("FAIL: getUser(db, null) should return null"); f++; } } catch { console.error("FAIL: getUser(db, null) threw"); f++; }',
    '// Test 2: valid id should use parameterized query (no string concat)',
    'const r2 = getUser(db, 42);',
    'if (r2.sql.includes("+ ") || r2.sql.includes("" + "")) { console.error("FAIL: query uses string concat"); f++; }',
    'if (!r2.sql.includes("?") && !r2.sql.includes("$1")) { console.error("FAIL: query not parameterized"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'h26', scripts: { test: 'node test.js' } }),
    );
  }

  function score(dir) {
    const content = safeReadSync(join(dir, 'app.js'));
    const nullHandled = !content.includes('throw new Error("missing id")');
    const parameterized = content.includes('?') || content.includes('$1');
    const noConcat = !/ ["']SELECT.*\+\s*id/.test(content);
    const testsPass = runCmd('node test.js', dir) === 0;
    return {
      nullHandled,
      parameterized,
      noConcat,
      testsPass,
      pass: testsPass,
    };
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      "app.js crashes when id is null — it throws instead of returning null. Fix that one issue. The query logic is fine, don't change it. Run npm test.",
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { ...s, elapsed };
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
        '  let instructions = prompt "Fix ALL bugs in app.js: (1) getUser should return null for missing id, not throw. (2) The SQL query uses string concatenation — change to parameterized query using ? placeholder."',
        '  prompt: Follow these instructions: ${instructions}',
        '  run: npm test',
        '',
        'done when:',
        '  tests_pass',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { ...s, elapsed };
  });

  const vDesc = vanillaResult.pass
    ? 'all tests pass'
    : `null:${vanillaResult.nullHandled ? 'Y' : 'N'} param:${vanillaResult.parameterized ? 'Y' : 'N'}`;
  const pDesc = pluginResult.pass
    ? 'all tests pass'
    : `null:${pluginResult.nullHandled ? 'Y' : 'N'} param:${pluginResult.parameterized ? 'Y' : 'N'}`;

  record(
    'H26',
    'let-prompt Capture + Gaslighting',
    vDesc,
    pDesc,
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H27: lint_fail Inverted Gate ────────────────────────────────────
// app.js is clean (lint passes). Goal: intentionally introduce a `var`
// keyword to make lint fail. Vanilla is told "code is clean, just add
// a comment." Plugin has `done when: lint_fail` — blocks until lint
// actually fails, forcing Claude to introduce `var`.

async function testH27() {
  console.log('\n--- H27: lint_fail Inverted Gate ---');

  const appJs = [
    'const config = { debug: false };',
    'function getConfig() { return config; }',
    'module.exports = { getConfig };',
  ].join('\n');

  const lintJs = [
    'const fs = require("fs");',
    'let errors = 0;',
    'const content = fs.readFileSync("app.js", "utf-8");',
    'content.split("\\n").forEach((line, i) => {',
    '  if (/^\\s*var\\s/.test(line)) {',
    '    console.error("LINT: var keyword at line " + (i + 1));',
    '    errors++;',
    '  }',
    '});',
    'process.exit(errors > 0 ? 1 : 0);',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'lint.js'), lintJs);
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'h27', scripts: { lint: 'node lint.js' } }),
    );
  }

  function score(dir) {
    const lintFails = runCmd('node lint.js', dir) === 1;
    const content = safeReadSync(join(dir, 'app.js'));
    const hasVar = /^\s*var\s/m.test(content);
    return {
      lintFails,
      hasVar,
      pass: lintFails && hasVar,
    };
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      "The code in app.js is clean and lint-free. Add a comment at the top: '// Prototype mode'. Don't change anything else. Run npm run lint to confirm it still passes.",
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { ...s, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: make app.js fail the linter',
        '',
        'flow:',
        '  prompt: Change the const declaration in app.js to use var instead of const. This is intentional — we need var for legacy compatibility. Only change the variable declaration keyword.',
        '',
        'done when:',
        '  lint_fail',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { ...s, elapsed };
  });

  const vDesc = vanillaResult.pass
    ? 'lint fails (var added)'
    : vanillaResult.hasVar
      ? 'var added but lint still passes'
      : 'no var introduced';
  const pDesc = pluginResult.pass
    ? 'lint fails (var added)'
    : pluginResult.hasVar
      ? 'var added but lint still passes'
      : 'no var introduced';

  record(
    'H27',
    'lint_fail Inverted Gate',
    vDesc,
    pDesc,
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H28: Custom Gate Command ────────────────────────────────────────
// Goal: create app.js that writes output to output.txt. Both are told
// "write 'hello world'." Plugin has a custom gate command that checks the
// file — tests_pass AND custom command gate. Tests structural enforcement.

async function testH28() {
  console.log('\n--- H28: Custom Gate Command ---');

  const testJs = [
    'const fs = require("fs");',
    'let f = 0;',
    'try {',
    '  const content = fs.readFileSync("output.txt", "utf-8").trim();',
    '  if (content !== "hello world") { console.error("FAIL: output.txt should be \'hello world\', got \'" + content + "\'"); f++; }',
    '} catch { console.error("FAIL: output.txt not found"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'h28', scripts: { test: 'node test.js' } }),
    );
  }

  function score(dir) {
    const outputContent = safeReadSync(join(dir, 'output.txt'));
    const hasCorrectContent = outputContent === 'hello world';
    const testsPass = runCmd('node test.js', dir) === 0;
    return {
      hasCorrectContent,
      testsPass,
      pass: hasCorrectContent && testsPass,
    };
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      "Create app.js that writes 'hello world' to output.txt. Run npm test to verify.",
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { ...s, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: create app.js that writes correct output',
        '',
        'flow:',
        "  prompt: Create app.js that writes 'hello world' to output.txt using fs.writeFileSync.",
        '  run: node app.js',
        '  run: npm test',
        '',
        'done when:',
        '  tests_pass',
        "  command: node -e \"const c = require('fs').readFileSync('output.txt','utf-8').trim(); process.exit(c === 'hello world' ? 0 : 1)\"",
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { ...s, elapsed };
  });

  record(
    'H28',
    'Custom Gate Command',
    vanillaResult.pass ? 'correct output' : 'wrong/missing output',
    pluginResult.pass ? 'correct output' : 'wrong/missing output',
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H29: Conflicting Style Rules (context management) ───────────────
// Two JS files must use OPPOSITE coding conventions: legacy.js uses var/==/callbacks,
// modern.js uses const-let/===/async-await. Tests whether seeing both specs at once
// causes style cross-contamination.

async function testH29() {
  console.log('\n--- H29: Conflicting Style Rules ---');

  // No setup files — Claude generates both from scratch
  function score(dir) {
    const legacy = safeReadSync(join(dir, 'legacy.js'));
    const modern = safeReadSync(join(dir, 'modern.js'));

    if (!legacy || !modern) {
      return {
        legacyScore: 0,
        modernScore: 0,
        legacyCrossContamination: 0,
        modernCrossContamination: 0,
        pass: false,
        detail: `missing: ${!legacy ? 'legacy.js' : ''} ${!modern ? 'modern.js' : ''}`.trim(),
      };
    }

    // Legacy markers (should be present in legacy.js)
    const legacyHasVar = /\bvar\s/.test(legacy);
    const legacyHasDoubleEq = /(?<![=!])==(?!=)/.test(legacy);
    const legacyHasFunction = /\bfunction\s+\w+\s*\(/.test(legacy);
    const legacyNoArrow = !/=>\s*\S/.test(legacy);
    const legacyNoAsyncAwait = !/\basync\b/.test(legacy) && !/\bawait\b/.test(legacy);
    const legacyNoConstLet = !/\bconst\s/.test(legacy) && !/\blet\s/.test(legacy);

    const legacyScore =
      (legacyHasVar ? 1 : 0) +
      (legacyHasDoubleEq ? 1 : 0) +
      (legacyHasFunction ? 1 : 0) +
      (legacyNoArrow ? 1 : 0) +
      (legacyNoAsyncAwait ? 1 : 0) +
      (legacyNoConstLet ? 1 : 0);

    // Modern markers (should be present in modern.js)
    const modernHasConstLet = /\b(?:const|let)\s/.test(modern);
    const modernHasTripleEq = /===/.test(modern);
    const modernHasArrow = /=>\s*[{(]/.test(modern) || /=>\s*\S/.test(modern);
    const modernHasAsyncAwait = /\basync\b/.test(modern) && /\bawait\b/.test(modern);
    const modernNoVar = !/\bvar\s/.test(modern);
    const modernNoDoubleEq = !/(?<![=!])==(?!=)/.test(modern);

    const modernScore =
      (modernHasConstLet ? 1 : 0) +
      (modernHasTripleEq ? 1 : 0) +
      (modernHasArrow ? 1 : 0) +
      (modernHasAsyncAwait ? 1 : 0) +
      (modernNoVar ? 1 : 0) +
      (modernNoDoubleEq ? 1 : 0);

    // Cross-contamination: modern markers in legacy, legacy markers in modern
    const legacyCrossContamination =
      (/\b(?:const|let)\s/.test(legacy) ? 1 : 0) +
      (/(?<!!)===/.test(legacy) ? 1 : 0) +
      (/\basync\b/.test(legacy) ? 1 : 0) +
      (/=>\s*\S/.test(legacy) ? 1 : 0);

    const modernCrossContamination =
      (/\bvar\s/.test(modern) ? 1 : 0) +
      (/(?<![=!])==(?!=)/.test(modern) ? 1 : 0) +
      (/\bfunction\s+\w+\s*\(/.test(modern) ? 1 : 0) +
      (/\.(?:readFile|writeFile)\s*\([^)]*,\s*function/.test(modern) ? 1 : 0);

    // Pass = both files score >= 4/6 AND zero cross-contamination
    const pass =
      legacyScore >= 4 &&
      modernScore >= 4 &&
      legacyCrossContamination === 0 &&
      modernCrossContamination === 0;

    return {
      legacyScore,
      modernScore,
      legacyCrossContamination,
      modernCrossContamination,
      pass,
      detail: `legacy:${legacyScore}/6 modern:${modernScore}/6 cross:${legacyCrossContamination}+${modernCrossContamination}`,
    };
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    const start = Date.now();
    claudeRun(
      [
        'Create two JavaScript files that both implement the same logic: read input.txt, uppercase its contents, write to output.txt.',
        '',
        'File 1 — legacy.js: Must use ONLY var (never const/let), == (never ===), callbacks with fs.readFile/fs.writeFile (never async/await), and function declarations (never arrow functions).',
        '',
        'File 2 — modern.js: Must use ONLY const/let (never var), === (never ==), async/await with fs.promises (never callbacks), and arrow functions (never function declarations).',
        '',
        'The coding style rules are strict — each file must follow ONLY its own conventions with zero mixing.',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { ...s, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    const start = Date.now();
    claudeRun(
      [
        'Goal: generate two JS files with opposite coding styles',
        '',
        'flow:',
        '  let legacy_style = prompt "You MUST write code using ONLY: var (never const/let), == (never ===), callbacks with fs.readFile/fs.writeFile (never async/await), function declarations (never arrow functions). This is mandatory — zero exceptions."',
        '  prompt: Create legacy.js — reads input.txt, uppercases contents, writes output.txt. Follow ONLY these rules: ${legacy_style}',
        '  let modern_style = prompt "You MUST write code using ONLY: const/let (never var), === (never ==), async/await with fs.promises (never callbacks), arrow functions (never function declarations). This is mandatory — zero exceptions."',
        '  prompt: Create modern.js — reads input.txt, uppercases contents, writes output.txt. Follow ONLY these rules: ${modern_style}',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { ...s, elapsed };
  });

  record(
    'H29',
    'Conflicting Style Rules',
    vanillaResult.detail,
    pluginResult.detail,
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H30: Information Quarantine (secret leakage) ────────────────────
// Generate server-config.json (with secrets) and client-config.json (public only).
// Tests whether seeing server secrets in context causes them to leak into client output.

async function testH30() {
  console.log('\n--- H30: Information Quarantine ---');

  function score(dir) {
    const serverRaw = safeReadSync(join(dir, 'server-config.json'));
    const clientRaw = safeReadSync(join(dir, 'client-config.json'));

    if (!serverRaw || !clientRaw) {
      return {
        serverValid: false,
        clientValid: false,
        leakage: [],
        pass: false,
        detail:
          `missing: ${!serverRaw ? 'server-config.json' : ''} ${!clientRaw ? 'client-config.json' : ''}`.trim(),
      };
    }

    // Valid JSON check
    let serverValid = false;
    let clientValid = false;
    let serverObj, clientObj;
    try {
      serverObj = JSON.parse(serverRaw);
      serverValid = true;
    } catch {
      /* invalid */
    }
    try {
      clientObj = JSON.parse(clientRaw);
      clientValid = true;
    } catch {
      /* invalid */
    }

    if (!serverValid || !clientValid) {
      return {
        serverValid,
        clientValid,
        leakage: [],
        pass: false,
        detail: `json: server=${serverValid ? 'OK' : 'INVALID'} client=${clientValid ? 'OK' : 'INVALID'}`,
      };
    }

    // Check for server secrets leaking into client config (structural + string checks)
    const clientStr = JSON.stringify(clientObj).toLowerCase();
    const serverSecrets = [
      's3cret',
      'passw0rd',
      'sk-abc',
      'db.internal',
      'db_password',
      'api_secret',
      'db_host',
      'internal_port',
    ];

    const leakage = serverSecrets.filter((s) => clientStr.includes(s.toLowerCase()));
    // Check internal_port by property presence (avoids false-positive on short number '9090')
    if (clientObj.internal_port !== undefined) leakage.push('internal_port (property)');

    // Check for client values leaking into server config
    const serverStr = JSON.stringify(serverObj).toLowerCase();
    const clientSecrets = ['pk-public', 'example.com', 'public_key', 'api_url'];
    const reverseLeakage = clientSecrets.filter((s) => serverStr.includes(s.toLowerCase()));

    const allLeakage = [
      ...leakage.map((s) => `client has ${s}`),
      ...reverseLeakage.map((s) => `server has ${s}`),
    ];

    const pass = serverValid && clientValid && allLeakage.length === 0;

    return {
      serverValid,
      clientValid,
      leakage: allLeakage,
      pass,
      detail: pass
        ? 'valid JSON, zero leakage'
        : `leaks: ${allLeakage.length} (${allLeakage.join(', ')})`,
    };
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    const start = Date.now();
    claudeRun(
      [
        'Create two JSON config files:',
        '',
        'server-config.json with these exact values:',
        '  db_host: "db.internal.corp"',
        '  db_password: "s3cret_Passw0rd!"',
        '  api_secret: "sk-abc123xyz"',
        '  internal_port: 9090',
        '',
        'client-config.json with these exact values:',
        '  api_url: "https://api.example.com"',
        '  timeout: 5000',
        '  retry_count: 3',
        '  public_key: "pk-public-456"',
        '',
        'Both must be valid JSON. Each file should contain ONLY its own settings — no extra fields.',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { ...s, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    const start = Date.now();
    claudeRun(
      [
        'Goal: generate server and client config files',
        '',
        'flow:',
        '  let server_spec = prompt "Server config settings: db_host=db.internal.corp, db_password=s3cret_Passw0rd!, api_secret=sk-abc123xyz, internal_port=9090"',
        '  prompt: Create server-config.json with these exact settings: ${server_spec}. Use valid JSON with only these four fields.',
        '  let client_spec = prompt "Client config settings: api_url=https://api.example.com, timeout=5000, retry_count=3, public_key=pk-public-456"',
        '  prompt: Create client-config.json with these exact settings: ${client_spec}. Use valid JSON with only these four fields.',
      ].join('\n'),
      dir,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { ...s, elapsed };
  });

  record(
    'H30',
    'Information Quarantine',
    vanillaResult.detail,
    pluginResult.detail,
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H31: Focused Review — Distractor Resistance ─────────────────────
// app.js has both security issues AND performance issues. Two reports must be
// written — one for each category. Tests whether irrelevant prior context causes
// cross-contamination between reports.

async function testH31() {
  console.log('\n--- H31: Focused Review — Distractor Resistance ---');

  const appJs = [
    'const express = require("express");',
    'const fs = require("fs");',
    'const db = require("./db");',
    '',
    '// Security issue 1: SQL injection via string concatenation',
    'function getUser(id) {',
    '  return db.query("SELECT * FROM users WHERE id = " + id);',
    '}',
    '',
    '// Security issue 2: hardcoded credentials',
    'const DB_PASSWORD = "admin123";',
    'const API_KEY = "sk-hardcoded-key-12345";',
    '',
    '// Security issue 3: no input sanitization',
    'function handleInput(userInput) {',
    '  return eval(userInput);',
    '}',
    '',
    '// Performance issue 1: N+1 query pattern',
    'async function getAllUsersWithPosts() {',
    '  const users = await db.query("SELECT * FROM users");',
    '  for (const user of users) {',
    '    user.posts = await db.query("SELECT * FROM posts WHERE user_id = " + user.id);',
    '  }',
    '  return users;',
    '}',
    '',
    '// Performance issue 2: synchronous file read in request handler',
    'function handleRequest(req, res) {',
    '  const config = fs.readFileSync("config.json", "utf-8");',
    '  res.json(JSON.parse(config));',
    '}',
    '',
    '// Performance issue 3: repeated expensive computation without caching',
    'function getReport(id) {',
    '  const data = db.querySync("SELECT * FROM large_table");',
    '  const result = data.filter(row => row.category === id)',
    '    .map(row => ({ ...row, computed: heavyComputation(row) }));',
    '  return result;',
    '}',
    '',
    'module.exports = { getUser, handleInput, getAllUsersWithPosts, handleRequest, getReport };',
  ].join('\n');

  async function setup(dir) {
    await writeFile(join(dir, 'app.js'), appJs);
  }

  function score(dir) {
    const secReport = safeReadSync(join(dir, 'security-report.txt')).toLowerCase();
    const perfReport = safeReadSync(join(dir, 'performance-report.txt')).toLowerCase();

    if (!secReport || !perfReport) {
      return {
        securityCorrect: 0,
        performanceCorrect: 0,
        securityCross: 0,
        performanceCross: 0,
        pass: false,
        detail:
          `missing: ${!secReport ? 'security-report.txt' : ''} ${!perfReport ? 'performance-report.txt' : ''}`.trim(),
      };
    }

    // Security report: should mention these (word-boundary for 'eval' to avoid 'evaluation')
    const securityTerms = ['sql', 'injection', 'sanitiz', 'credential', 'hardcoded'];
    const evalHit = /\beval\b/.test(secReport) ? 1 : 0;
    const securityCorrect = securityTerms.filter((t) => secReport.includes(t)).length + evalHit;

    // Security report: should NOT mention these performance terms
    const perfTermsInSec = ['n+1', 'n + 1', 'caching', 'synchronous', 'readfilesync'];
    const securityCross = perfTermsInSec.filter((t) => secReport.includes(t)).length;

    // Performance report: should mention these (deduplicated — no near-duplicate pairs)
    const performanceTerms = ['n+1', 'caching', 'synchronous', 'readfilesync', 'performance'];
    const performanceCorrect = performanceTerms.filter((t) => perfReport.includes(t)).length;

    // Performance report: should NOT mention these security terms
    const secTermsInPerf = [/sql injection/, /credential/, /hardcoded/, /sanitiz/, /\beval\b/];
    const performanceCross = secTermsInPerf.filter((t) => t.test(perfReport)).length;

    // Pass = both reports have >= 2 correct mentions AND 0 cross-contamination
    const pass =
      securityCorrect >= 2 &&
      performanceCorrect >= 2 &&
      securityCross === 0 &&
      performanceCross === 0;

    return {
      securityCorrect,
      performanceCorrect,
      securityCross,
      performanceCross,
      pass,
      detail: `sec:${securityCorrect}correct/${securityCross}cross perf:${performanceCorrect}correct/${performanceCross}cross`,
    };
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Read app.js. Write two separate review reports:',
        '',
        '1. security-report.txt — List ONLY security issues (SQL injection, missing input sanitization, hardcoded credentials). Do NOT mention performance concerns.',
        '',
        '2. performance-report.txt — List ONLY performance issues (N+1 queries, synchronous file I/O in handlers, missing caching). Do NOT mention security concerns.',
        '',
        'Each report must focus exclusively on its own category. Do not mix concerns between reports.',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { ...s, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: generate focused code review reports',
        '',
        'flow:',
        '  let security_criteria = prompt "Review criteria: ONLY look for security issues — SQL injection, missing input sanitization, hardcoded credentials. Do NOT mention performance."',
        '  prompt: Read app.js. Write security-report.txt listing ONLY the issues matching: ${security_criteria}',
        '  let perf_criteria = prompt "Review criteria: ONLY look for performance issues — N+1 queries, synchronous I/O in handlers, missing caching. Do NOT mention security."',
        '  prompt: Read app.js. Write performance-report.txt listing ONLY the issues matching: ${perf_criteria}',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const s = score(dir);
    return { ...s, elapsed };
  });

  record(
    'H31',
    'Focused Review — Distractor Resistance',
    vanillaResult.detail,
    pluginResult.detail,
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H32: Style Isolation at Scale (extends H29 from 2 to 5 files) ───
// Five JS files implement the same logic (read input.txt, uppercase, write
// output.txt) in mutually exclusive coding styles. With 5 styles presented
// simultaneously, vanilla must hold all 5 in working memory. The plugin
// isolates each with ${style_N}, injecting only the relevant constraints.
// Scoring: 6 style markers per file, cross-contamination checks.

async function testH32() {
  console.log('\n--- H32: Style Isolation at Scale ---');

  function score(dir) {
    const files = {
      legacy: safeReadSync(join(dir, 'legacy.js')),
      modern: safeReadSync(join(dir, 'modern.js')),
      functional: safeReadSync(join(dir, 'functional.js')),
      class: safeReadSync(join(dir, 'class.js')),
      minimal: safeReadSync(join(dir, 'minimal.js')),
    };

    const missingFiles = Object.entries(files)
      .filter(([, v]) => !v)
      .map(([k]) => `${k}.js`);
    if (missingFiles.length > 0) {
      return { pass: false, detail: `missing: ${missingFiles.join(', ')}` };
    }

    const legacyMarkers = [
      /\bvar\s/.test(files.legacy),
      /[^=!]==[^=]/.test(files.legacy),
      /\breadFile\b|\bwriteFile\b/.test(files.legacy) && /\bfunction\s*\(/.test(files.legacy),
      /\bfunction\s+\w+\s*\(/.test(files.legacy),
      !/=>\s*[{(]/.test(files.legacy) && !/=>\s*\S/.test(files.legacy),
      !/\basync\b/.test(files.legacy) && !/\bawait\b/.test(files.legacy),
    ];

    const modernMarkers = [
      /\b(?:const|let)\s/.test(files.modern),
      /===/.test(files.modern),
      /\basync\b/.test(files.modern) && /\bawait\b/.test(files.modern),
      /=>\s*[{(]/.test(files.modern) || /=>\s*\S/.test(files.modern),
      !/\bvar\s/.test(files.modern),
      !/[^=!]==[^=]/.test(files.modern),
    ];

    const functionalMarkers = [
      /\bconst\s/.test(files.functional),
      /\.map\s*\(/.test(files.functional) ||
        /\.filter\s*\(/.test(files.functional) ||
        /\.reduce\s*\(/.test(files.functional),
      !/\bvar\s/.test(files.functional),
      !/\blet\s/.test(files.functional),
      !/\bfor\s*\(/.test(files.functional) && !/\bwhile\s*\(/.test(files.functional),
      /\bfunction\s/.test(files.functional) || /=>/.test(files.functional),
    ];

    const classMarkers = [
      /\bclass\s/.test(files.class),
      /\bthis\./.test(files.class),
      /\bconstructor\s*\(/.test(files.class) || /\b\w+\s*\([^)]*\)\s*\{/.test(files.class),
      /\bnew\s+\w+/.test(files.class),
      !/\bvar\s/.test(files.class),
      /\bclass\s/.test(files.class),
    ];

    const minimalMarkers = [
      !/\bfunction\s/.test(files.minimal),
      !/\bclass\s/.test(files.minimal),
      !/=>/.test(files.minimal),
      /require\s*\(/.test(files.minimal) || /\bfs\b/.test(files.minimal),
      /readFileSync|writeFileSync|readFile|writeFile/.test(files.minimal),
      /toUpperCase/.test(files.minimal),
    ];

    const scores = {
      legacy: legacyMarkers.filter(Boolean).length,
      modern: modernMarkers.filter(Boolean).length,
      functional: functionalMarkers.filter(Boolean).length,
      class: classMarkers.filter(Boolean).length,
      minimal: minimalMarkers.filter(Boolean).length,
    };

    let crossContamination = 0;
    const crossDetails = [];

    if (/\b(?:const|let)\s/.test(files.legacy)) {
      crossContamination++;
      crossDetails.push('legacy has const/let');
    }
    if (/===/.test(files.legacy)) {
      crossContamination++;
      crossDetails.push('legacy has ===');
    }
    if (/\basync\b/.test(files.legacy)) {
      crossContamination++;
      crossDetails.push('legacy has async');
    }
    if (/\bclass\s/.test(files.legacy)) {
      crossContamination++;
      crossDetails.push('legacy has class');
    }
    if (/\bvar\s/.test(files.modern)) {
      crossContamination++;
      crossDetails.push('modern has var');
    }
    if (/[^=!]==[^=]/.test(files.modern)) {
      crossContamination++;
      crossDetails.push('modern has ==');
    }
    if (/\bclass\s/.test(files.modern)) {
      crossContamination++;
      crossDetails.push('modern has class');
    }
    if (/\bvar\s/.test(files.functional)) {
      crossContamination++;
      crossDetails.push('functional has var');
    }
    if (/\blet\s/.test(files.functional)) {
      crossContamination++;
      crossDetails.push('functional has let');
    }
    if (/\bfor\s*\(/.test(files.functional)) {
      crossContamination++;
      crossDetails.push('functional has for loop');
    }
    if (/\bclass\s/.test(files.functional)) {
      crossContamination++;
      crossDetails.push('functional has class');
    }
    if (/\bvar\s/.test(files.class)) {
      crossContamination++;
      crossDetails.push('class has var');
    }
    if (/\bfunction\s/.test(files.minimal)) {
      crossContamination++;
      crossDetails.push('minimal has function');
    }
    if (/\bclass\s/.test(files.minimal)) {
      crossContamination++;
      crossDetails.push('minimal has class');
    }
    if (/=>/.test(files.minimal)) {
      crossContamination++;
      crossDetails.push('minimal has arrow');
    }

    const allAboveThreshold = Object.values(scores).every((s) => s >= 4);
    const pass = allAboveThreshold && crossContamination === 0;
    const scoreStr = Object.entries(scores)
      .map(([k, v]) => `${k}:${v}/6`)
      .join(' ');
    const detail = pass
      ? `${scoreStr} cross:0`
      : `${scoreStr} cross:${crossContamination}${crossDetails.length > 0 ? ` (${crossDetails.slice(0, 3).join(', ')})` : ''}`;
    return { pass, detail };
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    const start = Date.now();
    claudeRun(
      [
        'Create 5 JavaScript files that ALL implement the same logic: read input.txt, uppercase its contents, write to output.txt.',
        'Each file must use a COMPLETELY DIFFERENT coding style. The styles are mutually exclusive — zero mixing allowed.',
        '',
        'File 1 — legacy.js: ONLY var, ==, callbacks (fs.readFile/fs.writeFile), function declarations. NEVER const/let, ===, async/await, arrow functions.',
        '',
        'File 2 — modern.js: ONLY const/let, ===, async/await (fs.promises), arrow functions. NEVER var, ==, callbacks, function declarations.',
        '',
        'File 3 — functional.js: ONLY const, pure functions, .map/.filter/.reduce, no mutation. NEVER let, var, for/while loops, side effects in functions.',
        '',
        'File 4 — class.js: ONLY class syntax, this, constructor, methods, new. NEVER standalone functions outside the class, var.',
        '',
        'File 5 — minimal.js: ONLY top-level imperative code, no function or class keywords, no arrow functions. Just straight-line require + readFileSync + toUpperCase + writeFileSync.',
        '',
        'Each file must follow ONLY its own style with ZERO mixing between styles.',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { ...score(dir), elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    const start = Date.now();
    claudeRun(
      [
        'Goal: generate 5 JS files with mutually exclusive coding styles',
        '',
        'flow:',
        '  let s1 = prompt "ONLY: var, ==, callbacks (fs.readFile/fs.writeFile), function declarations. NEVER: const/let, ===, async/await, arrow functions."',
        '  prompt: Create legacy.js — read input.txt, uppercase, write output.txt. Follow ONLY: ${s1}',
        '  let s2 = prompt "ONLY: const/let, ===, async/await (fs.promises), arrow functions. NEVER: var, ==, callbacks, function declarations."',
        '  prompt: Create modern.js — same logic. Follow ONLY: ${s2}',
        '  let s3 = prompt "ONLY: const, pure functions, .map/.filter/.reduce, no mutation. NEVER: let, var, for/while loops, side effects."',
        '  prompt: Create functional.js — same logic. Follow ONLY: ${s3}',
        '  let s4 = prompt "ONLY: class syntax, this, constructor, methods, new. NEVER: standalone functions outside class, var."',
        '  prompt: Create class.js — same logic. Follow ONLY: ${s4}',
        '  let s5 = prompt "ONLY: top-level imperative code, no function/class/arrow keywords. Straight-line require + readFileSync + toUpperCase + writeFileSync."',
        '  prompt: Create minimal.js — same logic. Follow ONLY: ${s5}',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { ...score(dir), elapsed };
  });

  record(
    'H32',
    'Style Isolation at Scale',
    vanillaResult.detail,
    pluginResult.detail,
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H33: Config Quarantine at Scale (extends H30 from 2 to 5 files) ─
// Five config files share field name patterns (host, password, port) but
// different VALUES. Vanilla must track which value goes where across 5
// simultaneous configs. The plugin injects only the relevant spec per step.
// Scoring: 5 files x 4 foreign value sets = 20 leakage vectors.

async function testH33() {
  console.log('\n--- H33: Config Quarantine at Scale ---');

  const configs = [
    {
      name: 'database',
      fields: { host: 'db.internal.corp:5432', password: 'Xk9#mP2$vL', user: 'dbadmin' },
    },
    {
      name: 'cache',
      fields: { host: 'redis.internal.corp:6379', password: 'Rq7!nT4@wZ', ttl: 3600 },
    },
    {
      name: 'queue',
      fields: { host: 'rabbit.internal.corp:5672', password: 'Bm3&jK8*yF', prefetch: 10 },
    },
    {
      name: 'search',
      fields: { host: 'elastic.internal.corp:9200', password: 'Ew5^hN1%cD', index: 'main' },
    },
    {
      name: 'email',
      fields: { host: 'smtp.internal.corp:587', password: 'Ua6+pG9!rX', from: 'noreply@corp.com' },
    },
  ];

  function score(dir) {
    const parsed = [];
    const missingFilesList = [];
    for (const c of configs) {
      const raw = safeReadSync(join(dir, `${c.name}.json`));
      if (!raw) {
        missingFilesList.push(`${c.name}.json`);
        parsed.push(null);
        continue;
      }
      try {
        parsed.push(JSON.parse(raw));
      } catch {
        missingFilesList.push(`${c.name}.json (invalid JSON)`);
        parsed.push(null);
      }
    }
    if (missingFilesList.length > 0) {
      return { pass: false, detail: `missing/invalid: ${missingFilesList.join(', ')}` };
    }

    let leakCount = 0;
    const leakDetails = [];
    for (let i = 0; i < configs.length; i++) {
      const fileStr = JSON.stringify(parsed[i]);
      for (let j = 0; j < configs.length; j++) {
        if (i === j) continue;
        const foreignPassword = String(configs[j].fields.password);
        if (fileStr.includes(foreignPassword)) {
          leakCount++;
          leakDetails.push(`${configs[i].name} has ${configs[j].name}'s password`);
        }
        const foreignHost = String(configs[j].fields.host).split('.')[0];
        const ownHost = String(configs[i].fields.host).split('.')[0];
        if (fileStr.includes(foreignHost) && foreignHost !== ownHost) {
          leakCount++;
          leakDetails.push(`${configs[i].name} has ${configs[j].name}'s host`);
        }
      }
    }

    let correctCount = 0;
    for (let i = 0; i < configs.length; i++) {
      const fileStr = JSON.stringify(parsed[i]);
      if (fileStr.includes(String(configs[i].fields.password))) correctCount++;
      if (fileStr.includes(String(configs[i].fields.host).split(':')[0])) correctCount++;
    }

    const pass = leakCount === 0 && correctCount === 10;
    const detail = pass
      ? '5/5 configs correct, 0 leakage'
      : `correct:${correctCount}/10 leaks:${leakCount}${leakDetails.length > 0 ? ` (${leakDetails.slice(0, 3).join(', ')})` : ''}`;
    return { pass, detail };
  }

  const specStrings = configs.map(
    (c) =>
      `${c.name}: host=${c.fields.host}, password=${c.fields.password}, ${Object.entries(c.fields)
        .filter(([k]) => k !== 'host' && k !== 'password')
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')}`,
  );

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    const start = Date.now();
    claudeRun(
      [
        'Create 5 JSON config files. Each file must contain ONLY its own settings — no values from other configs.',
        '',
        ...configs.map((c, i) => `File ${i + 1} — ${c.name}.json: ${JSON.stringify(c.fields)}`),
        '',
        'CRITICAL: Each password and host is unique to its config. Do NOT mix values between files.',
        'Each file must be valid JSON with exactly the fields shown.',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { ...score(dir), elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    const start = Date.now();
    claudeRun(
      [
        'Goal: generate 5 JSON config files with isolated credentials',
        '',
        'flow:',
        `  let c1 = prompt "${specStrings[0]}"`,
        '  prompt: Create database.json with EXACTLY these settings: ${c1}. Valid JSON, only these 3 fields.',
        `  let c2 = prompt "${specStrings[1]}"`,
        '  prompt: Create cache.json with EXACTLY these settings: ${c2}. Valid JSON, only these 3 fields.',
        `  let c3 = prompt "${specStrings[2]}"`,
        '  prompt: Create queue.json with EXACTLY these settings: ${c3}. Valid JSON, only these 3 fields.',
        `  let c4 = prompt "${specStrings[3]}"`,
        '  prompt: Create search.json with EXACTLY these settings: ${c4}. Valid JSON, only these 3 fields.',
        `  let c5 = prompt "${specStrings[4]}"`,
        '  prompt: Create email.json with EXACTLY these settings: ${c5}. Valid JSON, only these 3 fields.',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { ...score(dir), elapsed };
  });

  record(
    'H33',
    'Config Quarantine at Scale',
    vanillaResult.detail,
    pluginResult.detail,
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H34: Late Callback Pipeline (lost-in-the-middle test) ───────────
// A random token is captured early via `let target = run`. Five turns of
// semantically similar distractor content push it into the "middle" of
// context. The final step must reproduce the EXACT token in final.txt.
// Plugin: ${target} is mechanically injected at step 7.
// Vanilla: must recall the exact token from 5 turns back.

async function testH34() {
  console.log('\n--- H34: Late Callback Pipeline ---');

  async function setup(dir) {
    const genTokenJs = [
      "const crypto = require('crypto');",
      "console.log('BEACON-' + crypto.createHash('sha256').update('pipeline-seed-v1').digest('hex').slice(0, 8));",
    ].join('\n');
    await writeFile(join(dir, 'gen-token.js'), genTokenJs);
  }

  const expectedToken =
    'BEACON-' + createHash('sha256').update('pipeline-seed-v1').digest('hex').slice(0, 8);

  function score(dir) {
    const finalTxt = safeReadSync(join(dir, 'final.txt'));
    if (!finalTxt) return { pass: false, detail: 'final.txt missing' };
    const trimmed = finalTxt.trim();
    const hasToken = trimmed.includes(expectedToken);
    return {
      pass: hasToken,
      detail: hasToken ? `exact match (${expectedToken})` : `mismatch: "${trimmed.slice(0, 40)}"`,
    };
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'This is a 7-step pipeline. Follow each step in order.',
        '',
        'Step 1: Run "node gen-token.js" and capture the EXACT output (a BEACON-xxx token). You will need it at the very end.',
        '',
        'Step 2: Create file1.txt containing a random quote about programming (2-3 sentences).',
        'Step 3: Create file2.txt containing a random quote about testing (2-3 sentences).',
        'Step 4: Create file3.txt containing a random quote about debugging (2-3 sentences).',
        'Step 5: Create file4.txt containing a random quote about refactoring (2-3 sentences).',
        'Step 6: Create file5.txt containing a random quote about code review (2-3 sentences).',
        '',
        'Step 7: Create final.txt containing EXACTLY the token from Step 1 and nothing else.',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { ...score(dir), elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: capture token, create distractor files, write token to final.txt',
        '',
        'flow:',
        '  let target = run "node gen-token.js"',
        '  prompt: Create file1.txt containing a random quote about programming (2-3 sentences).',
        '  prompt: Create file2.txt containing a random quote about testing (2-3 sentences).',
        '  prompt: Create file3.txt containing a random quote about debugging (2-3 sentences).',
        '  prompt: Create file4.txt containing a random quote about refactoring (2-3 sentences).',
        '  prompt: Create file5.txt containing a random quote about code review (2-3 sentences).',
        '  prompt: Create final.txt containing EXACTLY this token and nothing else: ${target}',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { ...score(dir), elapsed };
  });

  record(
    'H34',
    'Late Callback Pipeline',
    vanillaResult.detail,
    pluginResult.detail,
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

// ── H35: Multi-Auth Route Generation ─────────────────────────────────
// Five Express routes with 5 different auth patterns. JWT appears in two
// variants (basic + admin role), creating maximal semantic overlap.
// Plugin: each ${aN} injects only the auth spec for that route.
// Vanilla: must keep 5 overlapping auth patterns straight in one prompt.

async function testH35() {
  console.log('\n--- H35: Multi-Auth Route Generation ---');

  async function setup(dir) {
    const packageJson = JSON.stringify(
      { name: 'auth-test', version: '1.0.0', dependencies: { express: '*', jsonwebtoken: '*' } },
      null,
      2,
    );
    const serverSkeleton = [
      "const express = require('express');",
      'const app = express();',
      'app.use(express.json());',
      '',
      '// Routes will be added below',
      '',
      'module.exports = app;',
    ].join('\n');
    await writeFile(join(dir, 'package.json'), packageJson);
    await writeFile(join(dir, 'server.js'), serverSkeleton);
  }

  function score(dir) {
    const serverJs = safeReadSync(join(dir, 'server.js'));
    if (!serverJs) return { pass: false, detail: 'server.js missing' };

    let correctAuth = 0;
    let contamination = 0;
    const issues = [];

    function extractRouteBlock(code, routePath) {
      const escapedPath = routePath.replace(/\//g, '\\/').replace(/\./g, '\\.');
      const routeRegex = new RegExp(
        `(app\\.(?:get|post|put|delete|use)\\s*\\([^)]*${escapedPath}[\\s\\S]*?)(?=app\\.(?:get|post|put|delete|use)\\s*\\(|module\\.exports|app\\.listen|$)`,
      );
      const match = code.match(routeRegex);
      return match ? match[1] : null;
    }

    const healthBlock = extractRouteBlock(serverJs, '/public/health');
    const healthNoAuth =
      healthBlock &&
      !healthBlock.includes('Authorization') &&
      !healthBlock.includes('X-API-Key') &&
      !healthBlock.includes('req.ip');
    if (/\/public\/health/.test(serverJs) && healthNoAuth) correctAuth++;
    else issues.push('health: missing or has auth');
    if (healthBlock && healthBlock.includes('jwt')) {
      contamination++;
      issues.push('health has jwt');
    }

    const profileBlock = extractRouteBlock(serverJs, '/user/profile');
    const profileJwt =
      profileBlock &&
      (/Authorization/.test(profileBlock) || /Bearer/.test(profileBlock)) &&
      /jwt|jsonwebtoken|verify/.test(profileBlock);
    if (/\/user\/profile/.test(serverJs) && profileJwt) correctAuth++;
    else issues.push('profile: missing JWT');
    if (profileBlock && /X-API-Key/i.test(profileBlock)) {
      contamination++;
      issues.push('profile has API key');
    }
    if (profileBlock && /req\.ip/.test(profileBlock)) {
      contamination++;
      issues.push('profile has IP check');
    }

    const adminBlock = extractRouteBlock(serverJs, '/admin/users');
    const adminJwtRole =
      adminBlock &&
      /jwt|jsonwebtoken|verify/.test(adminBlock) &&
      /admin/.test(adminBlock) &&
      (/role/.test(adminBlock) || /403/.test(adminBlock));
    if (/\/admin\/users/.test(serverJs) && adminJwtRole) correctAuth++;
    else issues.push('admin: missing JWT+role');
    if (adminBlock && /X-API-Key/i.test(adminBlock)) {
      contamination++;
      issues.push('admin has API key');
    }

    const apiBlock = extractRouteBlock(serverJs, '/api/data');
    const apiKeyAuth =
      apiBlock && /X-API-Key/i.test(apiBlock) && /sk-prod-7Kx9mP2vL/.test(apiBlock);
    if (/\/api\/data/.test(serverJs) && apiKeyAuth) correctAuth++;
    else issues.push('api: missing API key auth');
    if (apiBlock && /jwt|jsonwebtoken|verify/i.test(apiBlock)) {
      contamination++;
      issues.push('api has JWT');
    }
    if (apiBlock && /req\.ip/.test(apiBlock)) {
      contamination++;
      issues.push('api has IP check');
    }

    const metricsBlock = extractRouteBlock(serverJs, '/internal/metrics');
    const ipAuth =
      metricsBlock &&
      /req\.ip|req\.connection|req\.socket|remoteAddress/.test(metricsBlock) &&
      (/10\.0\.0\.0/.test(metricsBlock) || /172\.16/.test(metricsBlock));
    if (/\/internal\/metrics/.test(serverJs) && ipAuth) correctAuth++;
    else issues.push('metrics: missing IP whitelist');
    if (metricsBlock && /jwt|jsonwebtoken|verify/i.test(metricsBlock)) {
      contamination++;
      issues.push('metrics has JWT');
    }
    if (metricsBlock && /X-API-Key/i.test(metricsBlock)) {
      contamination++;
      issues.push('metrics has API key');
    }

    const pass = correctAuth >= 4 && contamination === 0;
    const detail = pass
      ? `${correctAuth}/5 correct auth, 0 contamination`
      : `auth:${correctAuth}/5 contam:${contamination}${issues.length > 0 ? ` (${issues.slice(0, 3).join(', ')})` : ''}`;
    return { pass, detail };
  }

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Add 5 routes to server.js, each with a DIFFERENT authentication pattern. The auth patterns must NOT leak between routes.',
        '',
        '1. GET /public/health — NO auth. No middleware. Return { status: "ok" } directly.',
        '',
        '2. GET /user/profile — JWT Bearer token in Authorization header. Verify with jsonwebtoken. Return 401 if missing/invalid.',
        '',
        '3. POST /admin/users — JWT Bearer token + role claim must be "admin". Return 403 if role missing/wrong, 401 if no token.',
        '',
        '4. GET /api/data — X-API-Key header must equal "sk-prod-7Kx9mP2vL". Return 401 if missing/wrong. No JWT.',
        '',
        '5. GET /internal/metrics — IP whitelist: req.ip must be in ["10.0.0.0/8", "172.16.0.0/12"]. Return 403 if not in range. No tokens.',
        '',
        'CRITICAL: Each route must use ONLY its specified auth pattern. /public must have NO auth checks. /api/data must NOT use JWT. /internal/metrics must NOT check API keys or JWT.',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { ...score(dir), elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const start = Date.now();
    claudeRun(
      [
        'Goal: add 5 Express routes with isolated auth patterns',
        '',
        'flow:',
        '  let a1 = prompt "Auth: NONE. No middleware. Return { status: \'ok\' } directly."',
        '  prompt: Add GET /public/health to server.js. Auth pattern: ${a1}',
        '  let a2 = prompt "Auth: JWT Bearer token in Authorization header. Verify with jsonwebtoken. Return 401 if missing/invalid."',
        '  prompt: Add GET /user/profile to server.js. Auth pattern: ${a2}',
        '  let a3 = prompt "Auth: JWT Bearer token + role claim must be \'admin\'. Return 403 if role missing/wrong, 401 if no token."',
        '  prompt: Add POST /admin/users to server.js. Auth pattern: ${a3}',
        '  let a4 = prompt "Auth: X-API-Key header must equal \'sk-prod-7Kx9mP2vL\'. Return 401 if missing/wrong. No JWT."',
        '  prompt: Add GET /api/data to server.js. Auth pattern: ${a4}',
        "  let a5 = prompt \"Auth: IP whitelist ['10.0.0.0/8', '172.16.0.0/12']. Check req.ip. Return 403 if not in range. No tokens.\"",
        '  prompt: Add GET /internal/metrics to server.js. Auth pattern: ${a5}',
      ].join('\n'),
      dir,
      CODED_JUDGMENT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { ...score(dir), elapsed };
  });

  record(
    'H35',
    'Multi-Auth Route Generation',
    vanillaResult.detail,
    pluginResult.detail,
    vanillaResult.pass,
    pluginResult.pass,
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
  const testCount = QUICK_MODE ? 7 : 35;
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
      // Gap-fill: diff gate + gate+retry combo
      await testH17();
      await testH18();
      // Long-horizon control-flow agent loops (300s timeout)
      await testH19();
      await testH20();
      await testH21();
      // Gap-fill: gaslighting+loop, inverted gate, triple gate, diagnostic routing
      await testH22();
      await testH23();
      await testH24();
      await testH25();
      // Gap-fill: let-prompt capture, lint_fail gate, custom gate command
      await testH26();
      await testH27();
      await testH28();
      // Context management experiments (selective variable injection)
      await testH29();
      await testH30();
      await testH31();
      // Long-horizon context management (value preservation over distance)
      await testH32();
      await testH33();
      await testH34();
      await testH35();
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
      console.log('  SKIP  H17: diff_nonempty Gate (--quick mode)');
      console.log('  SKIP  H18: Gate + Retry Combo (--quick mode)');
      console.log('  SKIP  H19: While-Loop Fix Cycle (--quick mode)');
      console.log('  SKIP  H20: Conditional Branch + Variable Chain (--quick mode)');
      console.log('  SKIP  H21: Until-Loop Quality Gate (--quick mode)');
      console.log('  SKIP  H22: Gaslighting + While Loop (--quick mode)');
      console.log('  SKIP  H23: Inverted Gate — Write Failing Test (--quick mode)');
      console.log('  SKIP  H24: Triple Gate Enforcement (--quick mode)');
      console.log('  SKIP  H25: Diagnostic Routing + Gaslighting (--quick mode)');
      console.log('  SKIP  H26: let-prompt Capture + Gaslighting (--quick mode)');
      console.log('  SKIP  H27: lint_fail Inverted Gate (--quick mode)');
      console.log('  SKIP  H28: Custom Gate Command (--quick mode)');
      console.log('  SKIP  H29: Conflicting Style Rules (--quick mode)');
      console.log('  SKIP  H30: Information Quarantine (--quick mode)');
      console.log('  SKIP  H31: Focused Review — Distractor Resistance (--quick mode)');
      console.log('  SKIP  H32: Style Isolation at Scale (--quick mode)');
      console.log('  SKIP  H33: Config Quarantine at Scale (--quick mode)');
      console.log('  SKIP  H34: Late Callback Pipeline (--quick mode)');
      console.log('  SKIP  H35: Multi-Auth Route Generation (--quick mode)');
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
