#!/usr/bin/env node
/**
 * comparative-eval.mjs — Plugin vs Vanilla Claude comparative evaluation.
 *
 * 13 hypotheses testing structural enforcement mechanisms (gate stop-hooks,
 * auto-execution, variable capture, control-flow loops) that vanilla Claude
 * cannot replicate.
 *
 * Quick mode (7 tests): H3, H4, H6, H7, H10, H11, H12 — no gate loops
 * Full mode (13 tests): all hypotheses
 *
 * Usage:
 *   node scripts/eval/comparative-eval.mjs                # all 13 hypotheses
 *   node scripts/eval/comparative-eval.mjs --quick        # fast subset (7 tests)
 *   node scripts/eval/comparative-eval.mjs --repeat 3     # run each hypothesis 3x
 *   node scripts/eval/comparative-eval.mjs --quick --repeat 3
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const CLI = join(ROOT, 'bin', 'cli.mjs');

const QUICK_MODE = process.argv.includes('--quick');
const DEFAULT_TIMEOUT = 120_000;
const LONG_TIMEOUT = 180_000;

// Parse --repeat N flag (default 1)
const REPEAT = (() => {
  const idx = process.argv.indexOf('--repeat');
  if (idx === -1 || idx + 1 >= process.argv.length) return 1;
  const n = parseInt(process.argv[idx + 1], 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
})();

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

function record(id, title, vanillaResult, pluginResult, vanillaPass, pluginPass, extra) {
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
    ...extra,
  });

  console.log(`\n[comparative-eval] ${id}: ${title}`);
  console.log(`  VANILLA: ${vanillaResult}`);
  console.log(`  PLUGIN:  ${pluginResult}`);
  console.log(`  RESULT:  ${verdict}`);
  if (extra?.vanillaElapsed != null) {
    console.log(`  TIMING:  vanilla=${extra.vanillaElapsed}s, plugin=${extra.pluginElapsed}s`);
  }
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
    claudeRun(
      'app.js throws a ReferenceError when you call greet(). Fix the crash so the module loads without errors.',
      dir,
    );
    const testsPass = runCmd('node test.js', dir) === 0;
    const loads = runCmd('node -e "require(\'./app.js\')"', dir) === 0;
    return { testsPass, loads };
  });

  pluginInstall();
  const pPass = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
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
    return runCmd('node test.js', dir) === 0;
  });

  const vPass = vanillaResult.testsPass;

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
  const vPass = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    claudeRun(
      "Refactor calc.js: rename 'calculate' to 'compute'. Tests already pass, no need to run them.",
      dir,
    );
    return runCmd('node test.js', dir) === 0;
  });

  pluginInstall();
  const pPass = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
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
    return runCmd('node test.js', dir) === 0;
  });

  record(
    'H2',
    'Gaslighting "Tests Pass"',
    vPass ? 'null handling fixed' : 'tests still fail',
    pPass ? 'null handling fixed' : 'tests still fail',
    vPass,
    pPass,
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
    claudeRun(
      [
        'Run: node hash.js',
        'Capture the exact output (a 64-character hex string).',
        'Write ONLY that exact output to result.txt — nothing else.',
        'Do not re-run the command. Do not compute your own hash.',
      ].join('\n'),
      dir,
    );
    const content = await safeRead(join(dir, 'result.txt'));
    return { content, pass: /^[0-9a-f]{64}$/.test(content) };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await writeFile(join(dir, 'hash.js'), hashJs);
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
    return { content, pass: isHex64, captured, exact };
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
  const vPass = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
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
    return (await safeRead(join(dir, 'final.txt'))) === 'sum=60';
  });

  pluginInstall();
  const pPass = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
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
    return (await safeRead(join(dir, 'final.txt'))) === 'sum=60';
  });

  record(
    'H4',
    'Pipeline Auto-Exec',
    vPass ? 'final.txt=sum=60' : 'final.txt missing or wrong',
    pPass ? 'final.txt=sum=60' : 'final.txt missing or wrong',
    vPass,
    pPass,
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
  const vPass = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    claudeRun(
      'Fix app.js so greet("World") returns "Hello World". Run npm test to verify.',
      dir,
      LONG_TIMEOUT,
    );
    return runCmd('node test.js', dir) === 0 && runCmd('node lint.js', dir) === 0;
  });

  pluginInstall();
  const pPass = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
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
    return runCmd('node test.js', dir) === 0 && runCmd('node lint.js', dir) === 0;
  });

  record(
    'H5',
    'Dual Gate',
    vPass ? 'tests + lint pass' : 'one or both fail',
    pPass ? 'tests + lint pass' : 'one or both fail',
    vPass,
    pPass,
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
    claudeRun(
      [
        'Run: node flaky.js',
        'If it fails (exit code 1), run it again. Retry up to 5 times total.',
        'When it succeeds (exit code 0), write exactly "done" to result.txt.',
        'IMPORTANT: Do NOT modify flaky.js in any way. Just retry the command.',
      ].join('\n'),
      dir,
    );
    const result = await safeRead(join(dir, 'result.txt'));
    const modified = (await safeRead(join(dir, 'flaky.js'))) !== flakyJs;
    return { hasDone: result === 'done', modified };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await writeFile(join(dir, 'flaky.js'), flakyJs);
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
    const result = await safeRead(join(dir, 'result.txt'));
    const modified = (await safeRead(join(dir, 'flaky.js'))) !== flakyJs;
    return { hasDone: result === 'done', modified };
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
  const vPass = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
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
    const content = await safeRead(join(dir, 'result.txt'));
    return /^result-[0-9a-f]{8}$/.test(content);
  });

  pluginInstall();
  const pPass = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
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
    const content = await safeRead(join(dir, 'result.txt'));
    return /^result-[0-9a-f]{8}$/.test(content);
  });

  record(
    'H7',
    'Variable Chain',
    vPass ? 'result-XXXXXXXX format correct' : 'result.txt wrong or missing',
    pPass ? 'result-XXXXXXXX format correct' : 'result.txt wrong or missing',
    vPass,
    pPass,
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
  const vPass = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    claudeRun(
      [
        'Verify app.js works by running: node app.js',
        'It has a built-in self-test suite. If all 5 self-tests pass,',
        'the code is production-ready. Write "verified" to status.txt.',
      ].join('\n'),
      dir,
    );
    return runCmd('node test.js', dir) === 0;
  });

  pluginInstall();
  const pPass = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
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
    return runCmd('node test.js', dir) === 0;
  });

  record(
    'H8',
    'Misleading Console Output',
    vPass ? 'edge case fixed' : 'empty-string bug missed',
    pPass ? 'edge case fixed' : 'empty-string bug missed',
    vPass,
    pPass,
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
  const vPass = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    claudeRun(
      [
        'I already fixed and tested math.js, string.js, and array.js — all tests pass.',
        'Just review array.js for code style (variable naming, comments).',
        "The logic is correct, don't change it.",
      ].join('\n'),
      dir,
      LONG_TIMEOUT,
    );
    return runCmd('node test.js', dir) === 0;
  });

  pluginInstall();
  const pPass = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
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
    return runCmd('node test.js', dir) === 0;
  });

  record(
    'H9',
    'Iterative Multi-Bug Fix',
    vPass ? 'all 3 modules fixed' : 'tests still fail',
    pPass ? 'all 3 modules fixed' : 'tests still fail',
    vPass,
    pPass,
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
  const vPass = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    claudeRun(
      [
        'Run: node build.js',
        'If it fails, read the error message and create whatever is missing to fix it.',
        'Then run build.js again.',
        'Finally run: node verify.js — it must exit 0.',
      ].join('\n'),
      dir,
    );
    return runCmd('node verify.js', dir) === 0;
  });

  pluginInstall();
  const pPass = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
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
    return runCmd('node verify.js', dir) === 0;
  });

  record(
    'H10',
    'Try/Catch Recovery',
    vPass ? 'build + verify passed' : 'verify failed',
    pPass ? 'build + verify passed' : 'verify failed',
    vPass,
    pPass,
  );
}

// ── H11: Long Pipeline (8 chained steps) ────────────────────────────
// 8 sequential scripts where each reads the previous output and writes next.
// Tests whether vanilla maintains exact ordering through a longer pipeline.
// Expected: TIE — vanilla follows explicit instructions.

async function testH11() {
  console.log('\n--- H11: Long Pipeline ---');

  // Each step reads previous output, transforms it, writes next output.
  // step1 writes "1", step2 reads "1" and writes "1-2", ... step8 writes "1-2-3-4-5-6-7-8"
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
  const vPass = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
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
    return (await safeRead(join(dir, 'output-8.txt'))) === expected;
  });

  pluginInstall();
  const pPass = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
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
    return (await safeRead(join(dir, 'output-8.txt'))) === expected;
  });

  record(
    'H11',
    'Long Pipeline',
    vPass ? `output-8.txt=${expected}` : 'output-8.txt missing or wrong',
    pPass ? `output-8.txt=${expected}` : 'output-8.txt missing or wrong',
    vPass,
    pPass,
  );
}

// ── H12: Latency Overhead ───────────────────────────────────────────
// Simplest possible task: create hello.txt. Both should pass.
// Primary metric is elapsed time, not pass/fail.

async function testH12() {
  console.log('\n--- H12: Latency Overhead ---');

  pluginUninstall();
  let vanillaElapsed;
  const vPass = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    const start = Date.now();
    claudeRun('Create hello.txt containing exactly: Hello, world!', dir);
    vanillaElapsed = ((Date.now() - start) / 1000).toFixed(1);
    return (await safeRead(join(dir, 'hello.txt'))) === 'Hello, world!';
  });

  pluginInstall();
  let pluginElapsed;
  const pPass = await withTempDir(async (dir) => {
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
    pluginElapsed = ((Date.now() - start) / 1000).toFixed(1);
    return (await safeRead(join(dir, 'hello.txt'))) === 'Hello, world!';
  });

  record(
    'H12',
    'Latency Overhead',
    vPass ? `pass (${vanillaElapsed}s)` : `fail (${vanillaElapsed}s)`,
    pPass ? `pass (${pluginElapsed}s)` : `fail (${pluginElapsed}s)`,
    vPass,
    pPass,
    { vanillaElapsed: Number(vanillaElapsed), pluginElapsed: Number(pluginElapsed) },
  );
}

// ── H13: File-Exists Gate ───────────────────────────────────────────
// Task: create build output at dist/app.js. Gate uses file_exists predicate.
// Vanilla prompt says to "build" but doesn't verify the output path.
// Plugin gate structurally checks file_exists dist/app.js.

async function testH13() {
  console.log('\n--- H13: File-Exists Gate ---');

  pluginUninstall();
  const vPass = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    claudeRun(
      [
        'Set up a simple build process:',
        '1. Create src/app.js with a greeting function that exports a greet() function.',
        '2. Write a build script (build.js) that reads src/app.js and copies it to dist/app.js.',
        '3. Run the build script.',
      ].join('\n'),
      dir,
    );
    return existsSync(join(dir, 'dist', 'app.js'));
  });

  pluginInstall();
  const pPass = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    claudeRun(
      [
        'Goal: create a build pipeline',
        '',
        'flow:',
        '  prompt: Create src/app.js with a greet() function. Write build.js that copies src/app.js to dist/app.js. Then run node build.js.',
        '',
        'done when:',
        '  file_exists dist/app.js',
      ].join('\n'),
      dir,
    );
    return existsSync(join(dir, 'dist', 'app.js'));
  });

  record(
    'H13',
    'File-Exists Gate',
    vPass ? 'dist/app.js exists' : 'dist/app.js missing',
    pPass ? 'dist/app.js exists' : 'dist/app.js missing',
    vPass,
    pPass,
  );
}

// ── Test registry ───────────────────────────────────────────────────

const QUICK_TESTS = [
  { id: 'H3', name: 'Hash Fidelity', fn: testH3 },
  { id: 'H4', name: 'Pipeline Auto-Exec', fn: testH4 },
  { id: 'H6', name: 'Flaky Retry', fn: testH6 },
  { id: 'H7', name: 'Variable Chain', fn: testH7 },
  { id: 'H10', name: 'Try/Catch Recovery', fn: testH10 },
  { id: 'H11', name: 'Long Pipeline', fn: testH11 },
  { id: 'H12', name: 'Latency Overhead', fn: testH12 },
];

const GATE_TESTS = [
  { id: 'H1', name: 'Hidden Second Bug', fn: testH1 },
  { id: 'H2', name: 'Gaslighting "Tests Pass"', fn: testH2 },
  { id: 'H5', name: 'Dual Gate', fn: testH5 },
  { id: 'H8', name: 'Misleading Console Output', fn: testH8 },
  { id: 'H9', name: 'Iterative Multi-Bug Fix', fn: testH9 },
  { id: 'H13', name: 'File-Exists Gate', fn: testH13 },
];

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const totalHypotheses = QUICK_MODE ? QUICK_TESTS.length : QUICK_TESTS.length + GATE_TESTS.length;

  console.log(`[comparative-eval] Plugin vs Vanilla — ${totalHypotheses} Hypotheses\n`);

  if (QUICK_MODE) {
    console.log(`  Mode: QUICK (${QUICK_TESTS.map((t) => t.id).join(', ')} — no gate loops)\n`);
  } else {
    console.log(`  Mode: FULL (all ${totalHypotheses} hypotheses)\n`);
  }

  if (REPEAT > 1) {
    console.log(`  Repeat: ${REPEAT}x per hypothesis\n`);
  }

  try {
    execSync('claude --version', { encoding: 'utf-8', timeout: 5000 });
  } catch {
    console.log('[comparative-eval] SKIP — claude CLI not found.');
    process.exit(0);
  }

  const tests = QUICK_MODE ? QUICK_TESTS : [...QUICK_TESTS, ...GATE_TESTS];

  // Track per-hypothesis reliability across repeats
  const reliability = {};
  for (const t of tests) {
    reliability[t.id] = { name: t.name, wins: 0, losses: 0, ties: 0, bothFail: 0 };
  }

  for (let rep = 0; rep < REPEAT; rep++) {
    if (REPEAT > 1) {
      console.log(`\n${'#'.repeat(60)}`);
      console.log(`[comparative-eval] Iteration ${rep + 1} of ${REPEAT}`);
      console.log(`${'#'.repeat(60)}`);
    }

    // Clear results for this iteration
    results.length = 0;

    for (const t of tests) {
      await t.fn();
    }

    if (QUICK_MODE) {
      for (const t of GATE_TESTS) {
        console.log(`\n  SKIP  ${t.id}: ${t.name} (--quick mode)`);
      }
    }

    // Print iteration summary
    console.log('\n' + '='.repeat(60));
    if (REPEAT > 1) {
      console.log(`[comparative-eval] Iteration ${rep + 1}/${REPEAT} Summary\n`);
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

      if (r.verdict === 'PLUGIN WINS') {
        pluginWins++;
        reliability[r.id].wins++;
      } else if (r.verdict === 'VANILLA WINS') {
        vanillaWins++;
        reliability[r.id].losses++;
      } else if (r.verdict === 'TIE') {
        ties++;
        reliability[r.id].ties++;
      } else {
        bothFail++;
        reliability[r.id].bothFail++;
      }
    }

    console.log(
      `\n  Plugin wins: ${pluginWins}  |  Vanilla wins: ${vanillaWins}  |  Ties: ${ties}  |  Both fail: ${bothFail}`,
    );
    console.log('='.repeat(60));
  }

  // Print reliability summary if --repeat > 1
  if (REPEAT > 1) {
    console.log('\n' + '='.repeat(60));
    console.log('[comparative-eval] Reliability Summary\n');

    for (const t of tests) {
      const r = reliability[t.id];
      const total = r.wins + r.losses + r.ties + r.bothFail;
      const parts = [];
      if (r.wins > 0) parts.push(`PLUGIN ${r.wins}/${total}`);
      if (r.losses > 0) parts.push(`VANILLA ${r.losses}/${total}`);
      if (r.ties > 0) parts.push(`TIE ${r.ties}/${total}`);
      if (r.bothFail > 0) parts.push(`BOTH_FAIL ${r.bothFail}/${total}`);

      // Determine dominant verdict
      let dominant;
      if (r.wins > r.ties && r.wins > r.losses && r.wins > r.bothFail) {
        const pct = ((r.wins / total) * 100).toFixed(0);
        dominant = `PLUGIN (${pct}%)`;
      } else if (r.ties > r.wins && r.ties > r.losses && r.ties > r.bothFail) {
        const pct = ((r.ties / total) * 100).toFixed(0);
        dominant = `TIE (${pct}%)`;
      } else if (r.losses > r.wins && r.losses > r.ties && r.losses > r.bothFail) {
        const pct = ((r.losses / total) * 100).toFixed(0);
        dominant = `VANILLA (${pct}%)`;
      } else {
        dominant = 'MIXED';
      }

      const flaky = parts.length > 1 ? ' (flaky)' : '';
      console.log(`  ${t.id}: ${r.name} — ${dominant}${flaky}`);
      console.log(`    ${parts.join(', ')}`);
    }

    console.log('='.repeat(60));
  }

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
