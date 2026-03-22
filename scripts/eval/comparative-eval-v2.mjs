#!/usr/bin/env node
/**
 * comparative-eval-v2.mjs — Extended Plugin vs Vanilla evaluation.
 *
 * 100 hypotheses (H56-H155) across 10 categories:
 *  Cat 1: Gate Scaling & Composition (H56-H65)
 *  Cat 2: Bug Difficulty Gradient (H66-H75)
 *  Cat 3: Deception Resistance Boundaries (H76-H85)
 *  Cat 4: Gate-Only Minimal Configs (H86-H94)
 *  Cat 5: List Variables & Foreach (H95-H104)
 *  Cat 6: Long-Horizon Variable Persistence (H105-H114)
 *  Cat 7: Multi-File & Real-World Tasks (H115-H124)
 *  Cat 8: Variance Reduction (H125-H134)
 *  Cat 9: Model Sensitivity (H135-H144)
 *  Cat 10: Latency & Efficiency (H145-H155)
 *
 * Usage:
 *   node scripts/eval/comparative-eval-v2.mjs                   # all 100 hypotheses
 *   node scripts/eval/comparative-eval-v2.mjs --quick           # fast subset (no gate loops)
 *   node scripts/eval/comparative-eval-v2.mjs --repeat 3        # 3 iterations
 *   node scripts/eval/comparative-eval-v2.mjs --range 56-65     # Category 1 only
 *   node scripts/eval/comparative-eval-v2.mjs --model haiku     # override model
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
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
const GATE_TIMEOUT = 300_000;
const LONG_HORIZON_TIMEOUT = 420_000;

function parseRepeatCount() {
  const idx = process.argv.indexOf('--repeat');
  if (idx === -1) return 1;
  const n = parseInt(process.argv[idx + 1], 10);
  if (isNaN(n) || n < 1) {
    console.error('[eval-v2] --repeat requires a positive integer');
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
    console.error('[eval-v2] --range requires a value like "56-65" or "61"');
    process.exit(1);
  }
  const parts = spec.split('-').map(Number);
  if (parts.some(isNaN)) {
    console.error('[eval-v2] --range values must be numbers');
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

const MODEL_HAIKU = 'claude-haiku-4-5-20251001';
const MODEL_SONNET = 'claude-sonnet-4-6';
const MODEL_OPUS = 'claude-opus-4-6';

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
  const dir = await mkdtemp(join(tmpdir(), 'pl-v2-'));
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

function claudeRunWithModel(prompt, cwd, model, timeout = DEFAULT_TIMEOUT) {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  try {
    return execSync(`claude -p --dangerously-skip-permissions --model ${model}`, {
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

function runCmdOutput(cmd, cwd, timeout = 10_000) {
  try {
    const stdout = execSync(cmd, { cwd, timeout, encoding: 'utf-8' });
    return { exitCode: 0, stdout: stdout.trim() };
  } catch (err) {
    return {
      exitCode: 1,
      stdout: (err.stdout || '').trim(),
      stderr: (err.stderr || '').trim(),
    };
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

  console.log(`\n[eval-v2] ${id}: ${title}`);
  console.log(`  VANILLA: ${vanillaResult} (${vanillaElapsed.toFixed(1)}s)`);
  console.log(`  PLUGIN:  ${pluginResult} (${pluginElapsed.toFixed(1)}s)`);
  console.log(`  RESULT:  ${verdict}`);
}

// ── Test helper patterns ────────────────────────────────────────────

/**
 * Standard A/B test: vanilla (no plugin) vs plugin (with flow/gates).
 * @param {string} id - Hypothesis ID (e.g., "H56")
 * @param {string} title - Human-readable title
 * @param {object} config
 * @param {(dir: string) => Promise<void>} config.setup - Create test files
 * @param {string} config.vanillaPrompt - Prompt for vanilla run
 * @param {string} config.pluginPrompt - Prompt for plugin run (with flow/gates)
 * @param {(dir: string) => {pass: boolean, detail: string}} config.score - Score results
 * @param {number} [config.timeout] - Override timeout
 */
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

/**
 * Variance test: runs vanilla and plugin each N times internally.
 * Reports pass rate and time mean±stddev.
 */
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

  // Plugin wins if meaningfully higher pass rate
  const pWins = pPassRate > vPassRate + 0.1;
  const vWins = vPassRate > pPassRate + 0.1;

  record(id, title, vDetail, pDetail, !pWins, !vWins, avg(vTimes), avg(pTimes));
}

/**
 * Model comparison test: runs vanilla with one model, plugin with another.
 */
async function runModelTest(
  id,
  title,
  {
    setup,
    vanillaModel,
    vanillaPrompt,
    pluginModel,
    pluginPrompt,
    score,
    timeout = DEFAULT_TIMEOUT,
  },
) {
  console.log(`\n--- ${id}: ${title} ---`);
  console.log(`  Vanilla model: ${vanillaModel}, Plugin model: ${pluginModel}`);

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log(`  Running vanilla (${vanillaModel})...`);
    await setup(dir);
    const start = Date.now();
    claudeRunWithModel(vanillaPrompt, dir, vanillaModel, timeout);
    const elapsed = (Date.now() - start) / 1000;
    return { ...score(dir), elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log(`  Running plugin (${pluginModel})...`);
    await setup(dir);
    const start = Date.now();
    claudeRunWithModel(pluginPrompt, dir, pluginModel, timeout);
    const elapsed = (Date.now() - start) / 1000;
    return { ...score(dir), elapsed };
  });

  const modelLabel = (m) => m.replace(/^claude-/, '').split('-')[0];

  record(
    id,
    title,
    `${modelLabel(vanillaModel)}: ${vanillaResult.detail}`,
    `${modelLabel(pluginModel)}: ${pluginResult.detail}`,
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

/**
 * Builds a flow+gate plugin prompt from components.
 */
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

/**
 * Common scoring: did `npm test` (or `node test.js`) pass?
 */
function scoreTestPass(dir, cmd = 'node test.js') {
  const pass = runCmd(cmd, dir) === 0;
  return { pass, detail: pass ? 'tests pass' : 'tests fail' };
}

// ── HYPOTHESIS TEST FUNCTIONS ───────────────────────────────────────
// Inserted from category files below.

// ── Category 1: Gate Scaling & Composition (H56-H65) ────────────────

async function testH56() {
  // Four-Gate Enforcement Ceiling
  // 4 issue types: test failure, lint error (console.log), missing build artifact, no diff
  const appJs = [
    '// app.js — utility module',
    'function add(a, b) { return a + b; }',
    'function subtract(a, b) { return a - b - 1; }', // bug: off-by-one
    'console.log("DEBUG leftover");', // lint issue: console.log
    'module.exports = { add, subtract };',
  ].join('\n');
  const testJs = [
    'const { add, subtract } = require("./app.js");',
    'let f = 0;',
    'if (add(2, 3) !== 5) { console.error("FAIL: add"); f++; }',
    'if (subtract(10, 3) !== 7) { console.error("FAIL: subtract"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  const lintJs = [
    'const fs = require("fs");',
    'const src = fs.readFileSync("app.js", "utf-8");',
    'if (/console\\.log/.test(src)) {',
    '  console.error("LINT ERROR: console.log found in app.js");',
    '  process.exit(1);',
    '}',
    'console.log("Lint passed");',
  ].join('\n');
  const buildJs = [
    'const fs = require("fs");',
    'if (!fs.existsSync("dist/bundle.js")) {',
    '  console.error("BUILD ERROR: dist/bundle.js not found");',
    '  process.exit(1);',
    '}',
    'console.log("Build artifact check passed");',
  ].join('\n');
  await runStandardTest('H56', 'Four-Gate Enforcement Ceiling', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'lint.js'), lintJs);
      await writeFile(join(dir, 'check-build.js'), buildJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h56', 'node test.js'));
    },
    vanillaPrompt: [
      'Fix all issues in this project:',
      '1. Fix the bug in app.js so tests pass (node test.js)',
      '2. Remove the console.log lint violation from app.js',
      '3. Create a dist/bundle.js build artifact (just copy app.js into dist/bundle.js)',
      '4. Make sure you actually change something in app.js (diff must be nonempty)',
    ].join('\n'),
    pluginPrompt: buildPluginPrompt(
      'fix all issues: test bug, lint error, missing build artifact',
      [
        'prompt: Fix the subtract bug in app.js, remove console.log lint violations, and create dist/bundle.js',
        'run: node test.js',
        'run: node lint.js',
        'run: node check-build.js',
      ],
      ['tests_pass', 'lint_pass', 'file_exists dist/bundle.js', 'diff_nonempty'],
    ),
    score: (dir) => {
      const testsOk = runCmd('node test.js', dir) === 0;
      const lintOk = runCmd('node lint.js', dir) === 0;
      const buildOk = existsSync(join(dir, 'dist', 'bundle.js'));
      const diffOk = (() => {
        const src = safeReadSync(join(dir, 'app.js'));
        return !src.includes('a - b - 1') || !src.includes('console.log("DEBUG');
      })();
      const total = [testsOk, lintOk, buildOk, diffOk].filter(Boolean).length;
      return { pass: total === 4, detail: `${total}/4 gates` };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH57() {
  // Five-Gate Overload — same as H56 plus a type-checking gate
  const appJs = [
    '/** @param {number} a @param {number} b */',
    'function add(a, b) { return a + b; }',
    'function subtract(a, b) { return a - b - 1; }', // bug
    'function divide(a, b) { return a / b; }',
    'console.log("DEBUG");', // lint issue
    'module.exports = { add, subtract, divide };',
  ].join('\n');
  const testJs = [
    'const { add, subtract, divide } = require("./app.js");',
    'let f = 0;',
    'if (add(2, 3) !== 5) { console.error("FAIL: add"); f++; }',
    'if (subtract(10, 3) !== 7) { console.error("FAIL: subtract"); f++; }',
    'if (divide(10, 2) !== 5) { console.error("FAIL: divide"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  const lintJs = [
    'const fs = require("fs");',
    'const src = fs.readFileSync("app.js", "utf-8");',
    'if (/console\\.log/.test(src)) { console.error("LINT: console.log found"); process.exit(1); }',
    'console.log("Lint passed");',
  ].join('\n');
  const checkTypesJs = [
    '// Simulated type-checker: ensure divide guards against zero',
    'const fs = require("fs");',
    'const src = fs.readFileSync("app.js", "utf-8");',
    'if (!src.includes("=== 0") && !src.includes("== 0") && !src.includes("!b")) {',
    '  console.error("TYPE ERROR: divide() has no zero-division guard");',
    '  process.exit(1);',
    '}',
    'console.log("Type check passed");',
  ].join('\n');
  await runStandardTest('H57', 'Five-Gate Overload', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'lint.js'), lintJs);
      await writeFile(join(dir, 'check-types.js'), checkTypesJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h57'));
    },
    vanillaPrompt: [
      'Fix all issues in this project:',
      '1. Fix the subtract bug in app.js so node test.js passes',
      '2. Remove console.log from app.js (lint check: node lint.js)',
      '3. Add a zero-division guard to divide() (type check: node check-types.js)',
      '4. Create dist/bundle.js with the final code',
      '5. Make sure you change app.js',
    ].join('\n'),
    pluginPrompt: buildPluginPrompt(
      'fix all 5 issues in app.js',
      [
        'prompt: Fix subtract bug, remove console.log, add zero-division guard to divide(), create dist/bundle.js',
        'run: node test.js',
        'run: node lint.js',
        'run: node check-types.js',
      ],
      [
        'tests_pass',
        'lint_pass',
        'file_exists dist/bundle.js',
        'diff_nonempty',
        'command: node check-types.js',
      ],
    ),
    score: (dir) => {
      const testsOk = runCmd('node test.js', dir) === 0;
      const lintOk = runCmd('node lint.js', dir) === 0;
      const typesOk = runCmd('node check-types.js', dir) === 0;
      const buildOk = existsSync(join(dir, 'dist', 'bundle.js'));
      const diffOk = (() => {
        const src = safeReadSync(join(dir, 'app.js'));
        return !src.includes('a - b - 1');
      })();
      const total = [testsOk, lintOk, typesOk, buildOk, diffOk].filter(Boolean).length;
      return { pass: total === 5, detail: `${total}/5 gates` };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH58() {
  // Gate Ordering Sensitivity — custom test with two plugin configs
  const appJs = [
    'function add(a, b) { return a + b + 1; }', // bug: off-by-one
    'console.log("DEBUG");', // lint issue
    'module.exports = { add };',
  ].join('\n');
  const testJs = [
    'const { add } = require("./app.js");',
    'if (add(2, 3) !== 5) { console.error("FAIL"); process.exit(1); }',
    'console.log("Tests passed");',
  ].join('\n');
  const lintJs = [
    'const fs = require("fs");',
    'const src = fs.readFileSync("app.js", "utf-8");',
    'if (/console\\.log/.test(src)) { console.error("LINT: console.log"); process.exit(1); }',
    'console.log("Lint passed");',
  ].join('\n');

  const setupFn = async (dir) => {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(join(dir, 'lint.js'), lintJs);
    await writeFile(join(dir, 'package.json'), makePackageJson('h58'));
  };

  const scoreFn = (dir) => {
    const testsOk = runCmd('node test.js', dir) === 0;
    const lintOk = runCmd('node lint.js', dir) === 0;
    const pass = testsOk && lintOk;
    return { pass, detail: pass ? 'both pass' : `tests:${testsOk} lint:${lintOk}` };
  };

  console.log('\n--- H58: Gate Ordering Sensitivity ---');

  // Vanilla run
  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setupFn(dir);
    const start = Date.now();
    claudeRun(
      'Fix the bug in app.js so tests pass, and remove console.log lint violations.',
      dir,
      GATE_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    return { ...scoreFn(dir), elapsed };
  });

  // Plugin A: tests_pass first, then lint_pass
  pluginInstall();
  const pluginA = await withTempDir(async (dir) => {
    console.log('  Running plugin A (tests_pass first)...');
    await setupFn(dir);
    const prompt = buildPluginPrompt(
      'fix bug and lint issue in app.js',
      ['prompt: Fix the add bug and remove console.log from app.js', 'run: node test.js'],
      ['tests_pass', 'command: node lint.js'],
    );
    const start = Date.now();
    claudeRun(prompt, dir, GATE_TIMEOUT);
    const elapsed = (Date.now() - start) / 1000;
    return { ...scoreFn(dir), elapsed };
  });

  // Plugin B: lint_pass first, then tests_pass
  const pluginB = await withTempDir(async (dir) => {
    console.log('  Running plugin B (lint_pass first)...');
    await setupFn(dir);
    const prompt = buildPluginPrompt(
      'fix bug and lint issue in app.js',
      ['prompt: Fix the add bug and remove console.log from app.js', 'run: node test.js'],
      ['command: node lint.js', 'tests_pass'],
    );
    const start = Date.now();
    claudeRun(prompt, dir, GATE_TIMEOUT);
    const elapsed = (Date.now() - start) / 1000;
    return { ...scoreFn(dir), elapsed };
  });

  record(
    'H58a',
    'Gate Order: tests_pass first',
    vanillaResult.detail,
    pluginA.detail,
    vanillaResult.pass,
    pluginA.pass,
    vanillaResult.elapsed,
    pluginA.elapsed,
  );
  record(
    'H58b',
    'Gate Order: lint_pass first',
    vanillaResult.detail,
    pluginB.detail,
    vanillaResult.pass,
    pluginB.pass,
    vanillaResult.elapsed,
    pluginB.elapsed,
  );
}

async function testH59() {
  // Custom Gate vs Built-in Predicate — compare two plugin configs
  const appJs = [
    'function multiply(a, b) { return a * a; }', // bug: should be a*b
    'module.exports = { multiply };',
  ].join('\n');
  const testJs = [
    'const { multiply } = require("./app.js");',
    'let f = 0;',
    'if (multiply(3, 4) !== 12) { console.error("FAIL: multiply"); f++; }',
    'if (multiply(2, 5) !== 10) { console.error("FAIL: multiply 2"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  const setupFn = async (dir) => {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(join(dir, 'package.json'), makePackageJson('h59'));
  };

  const scoreFn = (dir) => scoreTestPass(dir);

  console.log('\n--- H59: Custom Gate vs Built-in Predicate ---');

  // Plugin A: built-in tests_pass predicate
  pluginInstall();
  const pluginBuiltin = await withTempDir(async (dir) => {
    console.log('  Running plugin (built-in tests_pass)...');
    await setupFn(dir);
    const prompt = buildPluginPrompt(
      'fix the bug in app.js',
      ['prompt: Fix the multiply function in app.js', 'run: node test.js'],
      ['tests_pass'],
    );
    const start = Date.now();
    claudeRun(prompt, dir, GATE_TIMEOUT);
    const elapsed = (Date.now() - start) / 1000;
    return { ...scoreFn(dir), elapsed };
  });

  // Plugin B: custom command gate
  const pluginCustom = await withTempDir(async (dir) => {
    console.log('  Running plugin (custom command: node test.js)...');
    await setupFn(dir);
    const prompt = buildPluginPrompt(
      'fix the bug in app.js',
      ['prompt: Fix the multiply function in app.js', 'run: node test.js'],
      ['command: node test.js'],
    );
    const start = Date.now();
    claudeRun(prompt, dir, GATE_TIMEOUT);
    const elapsed = (Date.now() - start) / 1000;
    return { ...scoreFn(dir), elapsed };
  });

  record(
    'H59a',
    'Built-in tests_pass Gate',
    'baseline',
    pluginBuiltin.detail,
    true,
    pluginBuiltin.pass,
    0,
    pluginBuiltin.elapsed,
  );
  record(
    'H59b',
    'Custom command: node test.js Gate',
    'baseline',
    pluginCustom.detail,
    true,
    pluginCustom.pass,
    0,
    pluginCustom.elapsed,
  );
}

async function testH60() {
  // Redundant Gate Stacking — tests_pass listed twice
  const appJs = [
    'function greet(name) { return "Hello, " + nme; }', // bug: typo nme
    'module.exports = { greet };',
  ].join('\n');
  const testJs = [
    'const { greet } = require("./app.js");',
    'if (greet("World") !== "Hello, World") {',
    '  console.error("FAIL: greet"); process.exit(1);',
    '}',
    'console.log("Tests passed");',
  ].join('\n');
  await runStandardTest('H60', 'Redundant Gate Stacking', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h60'));
    },
    vanillaPrompt: 'Fix the ReferenceError in app.js so that node test.js passes.',
    pluginPrompt: buildPluginPrompt(
      'fix the bug in app.js',
      ['prompt: Fix the ReferenceError in app.js', 'run: node test.js'],
      ['tests_pass', 'tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH61() {
  // Bare Gate, No Flow Body — HIGHEST VALUE test
  // Plugin prompt has ONLY a gate, no flow section
  const appJs = [
    'function add(a, b) { return a + b + 1; }', // bug 1: off-by-one
    'function greet(name) { return "Hello, " + nme; }', // bug 2: typo
    'module.exports = { add, greet };',
  ].join('\n');
  const testJs = [
    'const { add, greet } = require("./app.js");',
    'let f = 0;',
    'if (add(2, 3) !== 5) { console.error("FAIL: add"); f++; }',
    'if (greet("World") !== "Hello, World") { console.error("FAIL: greet"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H61', 'Bare Gate, No Flow Body', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h61'));
    },
    vanillaPrompt: 'Fix the bug in app.js so that all tests pass (node test.js).',
    pluginPrompt: ['Goal: fix the bug in app.js', '', 'done when:', '  tests_pass'].join('\n'),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH62() {
  // Gate Contradicts Flow Prompt
  // Flow says "Don't run tests", but gate requires tests_pass
  const appJs = [
    'function add(a, b) { return a + b + 1; }', // bug
    'module.exports = { add };',
  ].join('\n');
  const testJs = [
    'const { add } = require("./app.js");',
    'if (add(2, 3) !== 5) { console.error("FAIL: add"); process.exit(1); }',
    'console.log("Tests passed");',
  ].join('\n');
  await runStandardTest('H62', 'Gate Contradicts Flow Prompt', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h62'));
    },
    vanillaPrompt:
      'Look at app.js and fix any bugs you see. Do NOT run the tests, just read the code and fix it.',
    pluginPrompt: buildPluginPrompt(
      'fix app.js',
      ['prompt: Read app.js and fix any bugs. Do NOT run the tests, just inspect the code.'],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH63() {
  // Progressive Gate Unlocking — lint must pass AND tests must pass
  const appJs = [
    'function add(a, b) { return a + b + 1; }', // test-failing bug
    'console.log("DEBUG leftover");', // lint issue
    'module.exports = { add };',
  ].join('\n');
  const testJs = [
    'const { add } = require("./app.js");',
    'if (add(2, 3) !== 5) { console.error("FAIL: add"); process.exit(1); }',
    'console.log("Tests passed");',
  ].join('\n');
  const lintJs = [
    'const fs = require("fs");',
    'const src = fs.readFileSync("app.js", "utf-8");',
    'if (/console\\.log/.test(src)) {',
    '  console.error("LINT ERROR: console.log found in app.js");',
    '  process.exit(1);',
    '}',
    'console.log("Lint passed");',
  ].join('\n');
  await runStandardTest('H63', 'Progressive Gate Unlocking', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'lint.js'), lintJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h63'));
    },
    vanillaPrompt: [
      'Fix all issues in app.js:',
      '1. Remove the console.log statement (lint check: node lint.js)',
      '2. Fix the add function bug (test: node test.js)',
    ].join('\n'),
    pluginPrompt: buildPluginPrompt(
      'fix lint and test issues in app.js',
      [
        'prompt: Remove console.log from app.js to pass lint',
        'run: node lint.js',
        'prompt: Fix the add function bug in app.js to pass tests',
        'run: node test.js',
      ],
      ['command: node lint.js', 'tests_pass'],
    ),
    score: (dir) => {
      const lintOk = runCmd('node lint.js', dir) === 0;
      const testsOk = runCmd('node test.js', dir) === 0;
      const pass = lintOk && testsOk;
      return { pass, detail: pass ? 'both pass' : `lint:${lintOk} tests:${testsOk}` };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH64() {
  // file_exists for Build Artifacts
  // Task: fix process.js so it reads input.txt and writes output.json
  const inputTxt = JSON.stringify({ items: ['apple', 'banana', 'cherry'], count: 3 });
  const processJs = [
    'const fs = require("fs");',
    'const data = fs.readFileSync("input.txt", "utf-8");',
    'const parsed = JSON.parse(data);',
    '// BUG: writes to wrong filename',
    'fs.writeFileSync("output.txt", JSON.stringify(parsed.items));',
    '// Should write to output.json with proper formatting',
  ].join('\n');
  await runStandardTest('H64', 'file_exists for Build Artifacts', {
    setup: async (dir) => {
      await writeFile(join(dir, 'input.txt'), inputTxt);
      await writeFile(join(dir, 'process.js'), processJs);
    },
    vanillaPrompt: [
      'Fix process.js so that when you run "node process.js" it reads input.txt',
      'and writes the result as properly formatted JSON to output.json (not output.txt).',
      'Run it after fixing.',
    ].join('\n'),
    pluginPrompt: buildPluginPrompt(
      'fix process.js to write output.json',
      [
        'prompt: Fix process.js to write formatted JSON output to output.json instead of output.txt',
        'run: node process.js',
      ],
      ['file_exists output.json'],
    ),
    score: (dir) => {
      const exists = existsSync(join(dir, 'output.json'));
      if (!exists) return { pass: false, detail: 'output.json missing' };
      try {
        const content = safeReadSync(join(dir, 'output.json'));
        JSON.parse(content);
        return { pass: true, detail: 'output.json exists and is valid JSON' };
      } catch {
        return { pass: false, detail: 'output.json is not valid JSON' };
      }
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH65() {
  // diff_nonempty + tests_pass Combo — force change + verify
  // Code works but has a "performance issue" (uses loop instead of built-in)
  const appJs = [
    'function sum(arr) {',
    '  let total = 0;',
    '  for (let i = 0; i < arr.length; i++) {',
    '    total = total + arr[i];',
    '  }',
    '  return total;',
    '}',
    '',
    'function includes(arr, val) {',
    '  for (let i = 0; i < arr.length; i++) {',
    '    if (arr[i] === val) return true;',
    '  }',
    '  return false;',
    '}',
    '',
    'module.exports = { sum, includes };',
  ].join('\n');
  const testJs = [
    'const { sum, includes } = require("./app.js");',
    'let f = 0;',
    'if (sum([1, 2, 3]) !== 6) { console.error("FAIL: sum"); f++; }',
    'if (sum([]) !== 0) { console.error("FAIL: sum empty"); f++; }',
    'if (includes([1, 2, 3], 2) !== true) { console.error("FAIL: includes true"); f++; }',
    'if (includes([1, 2, 3], 4) !== false) { console.error("FAIL: includes false"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H65', 'diff_nonempty + tests_pass Combo', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h65'));
      // Initialize git so diff_nonempty can work
      runCmd('git init', dir);
      runCmd('git add -A', dir);
      runCmd('git commit -m "initial"', dir);
    },
    vanillaPrompt: [
      'Refactor app.js to use modern JavaScript built-in methods:',
      '- sum() should use Array.reduce()',
      '- includes() should use Array.includes()',
      'Make sure all tests still pass after refactoring (node test.js).',
    ].join('\n'),
    pluginPrompt: buildPluginPrompt(
      'refactor app.js to use modern built-in methods while keeping tests passing',
      [
        'prompt: Refactor sum() to use Array.reduce() and includes() to use Array.includes() in app.js',
        'run: node test.js',
      ],
      ['diff_nonempty', 'tests_pass'],
    ),
    score: (dir) => {
      const testsOk = runCmd('node test.js', dir) === 0;
      const src = safeReadSync(join(dir, 'app.js'));
      const refactored = src.includes('.reduce') || src.includes('.includes');
      const pass = testsOk && refactored;
      return {
        pass,
        detail: pass ? 'refactored + tests pass' : `tests:${testsOk} refactored:${refactored}`,
      };
    },
    timeout: GATE_TIMEOUT,
  });
}

// ── Category 2: Bug Difficulty Gradient (H66-H75) ───────────────────

async function testH66() {
  // Trivial Single Bug (Off-By-One) — prediction: TIE
  const appJs = [
    'function add(a, b) { return a + b + 1; }', // obvious off-by-one
    'module.exports = { add };',
  ].join('\n');
  const testJs = [
    'const { add } = require("./app.js");',
    'if (add(2, 3) !== 5) { console.error("FAIL: add(2,3)=" + add(2,3)); process.exit(1); }',
    'if (add(0, 0) !== 0) { console.error("FAIL: add(0,0)=" + add(0,0)); process.exit(1); }',
    'console.log("Tests passed");',
  ].join('\n');
  await runStandardTest('H66', 'Trivial Single Bug (Off-By-One)', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h66'));
    },
    vanillaPrompt: 'Fix the bug in app.js so that node test.js passes.',
    pluginPrompt: buildPluginPrompt(
      'fix the bug in app.js',
      ['prompt: Fix the off-by-one bug in add() in app.js', 'run: node test.js'],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH67() {
  // Two Bugs Equal Difficulty — both off-by-one
  const appJs = [
    'function add(a, b) { return a + b + 1; }', // off-by-one
    'function subtract(a, b) { return a - b - 1; }', // off-by-one
    'module.exports = { add, subtract };',
  ].join('\n');
  const testJs = [
    'const { add, subtract } = require("./app.js");',
    'let f = 0;',
    'if (add(2, 3) !== 5) { console.error("FAIL: add"); f++; }',
    'if (add(0, 0) !== 0) { console.error("FAIL: add zero"); f++; }',
    'if (subtract(10, 3) !== 7) { console.error("FAIL: subtract"); f++; }',
    'if (subtract(5, 5) !== 0) { console.error("FAIL: subtract zero"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H67', 'Two Bugs Equal Difficulty', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h67'));
    },
    vanillaPrompt:
      'Fix both bugs in app.js so that node test.js passes. There are two off-by-one errors.',
    pluginPrompt: buildPluginPrompt(
      'fix both off-by-one bugs in app.js',
      ['prompt: Fix both off-by-one bugs in add() and subtract() in app.js', 'run: node test.js'],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH68() {
  // One Easy + One Hard Bug
  // Easy: typo nme → name. Hard: multiply returns a*a instead of a*b
  const appJs = [
    'function greet(name) { return "Hello, " + nme; }', // easy: ReferenceError typo
    'function multiply(a, b) { return a * a; }', // hard: subtle logic error
    'module.exports = { greet, multiply };',
  ].join('\n');
  const testJs = [
    'const { greet, multiply } = require("./app.js");',
    'let f = 0;',
    'try {',
    '  if (greet("World") !== "Hello, World") { console.error("FAIL: greet"); f++; }',
    '} catch(e) { console.error("FAIL: greet threw " + e.message); f++; }',
    'if (multiply(3, 4) !== 12) { console.error("FAIL: multiply(3,4)=" + multiply(3,4)); f++; }',
    'if (multiply(2, 5) !== 10) { console.error("FAIL: multiply(2,5)=" + multiply(2,5)); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H68', 'One Easy + One Hard Bug', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h68'));
    },
    vanillaPrompt:
      'app.js crashes with a ReferenceError. Fix the crash so the module loads without errors.',
    pluginPrompt: buildPluginPrompt(
      'fix all bugs in app.js so every test passes',
      ['prompt: Fix all bugs in app.js so every test in test.js passes', 'run: node test.js'],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH69() {
  // Three Bugs Increasing Subtlety
  const appJs = [
    'function greet(name) { return "Hello, " + nme; }', // bug 1: obvious ReferenceError
    'function max(a, b) { return a > b ? b : a; }', // bug 2: medium — returns min instead of max
    'function clamp(val, lo, hi) {', // bug 3: subtle — doesn't handle negative
    '  if (val < lo) return lo;',
    '  if (val > hi) return hi;',
    '  return val;',
    '}',
    'module.exports = { greet, max, clamp };',
  ].join('\n');
  const testJs = [
    'const { greet, max, clamp } = require("./app.js");',
    'let f = 0;',
    'try {',
    '  if (greet("World") !== "Hello, World") { console.error("FAIL: greet"); f++; }',
    '} catch(e) { console.error("FAIL: greet threw"); f++; }',
    'if (max(3, 7) !== 7) { console.error("FAIL: max(3,7)=" + max(3,7)); f++; }',
    'if (max(-1, -5) !== -1) { console.error("FAIL: max(-1,-5)=" + max(-1,-5)); f++; }',
    'if (clamp(5, 1, 10) !== 5) { console.error("FAIL: clamp normal"); f++; }',
    'if (clamp(-3, 0, 10) !== 0) { console.error("FAIL: clamp below"); f++; }',
    'if (clamp(15, 0, 10) !== 10) { console.error("FAIL: clamp above"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H69', 'Three Bugs Increasing Subtlety', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h69'));
    },
    vanillaPrompt:
      'app.js throws a ReferenceError when greet() is called. Fix the crash so the module loads.',
    pluginPrompt: buildPluginPrompt(
      'fix all bugs in app.js so every test passes',
      [
        'prompt: Fix all bugs in app.js. There may be multiple issues — run the tests to verify.',
        'run: node test.js',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH70() {
  // Five-Bug Gauntlet — graduated difficulty
  const appJs = [
    '// Utility module with 5 functions',
    'function capitalize(str) { return str.charAt(0).toUpperCase() + srt.slice(1); }',
    '// bug 1 (trivial): typo "srt" should be "str"',
    '',
    'function isEven(n) { return n % 2 > 0; }',
    '// bug 2 (easy): should be n % 2 === 0, not n % 2 > 0',
    '',
    'function range(start, end) {',
    '  const arr = [];',
    '  for (let i = start; i < end; i++) arr.push(i);',
    '  return arr;',
    '}',
    '// bug 3 (medium): missing return for range — actually range is ok,',
    '// the real bug is it should be inclusive of end: i <= end',
    '',
    'function compact(arr) {',
    '  return arr.filter(x => x);',
    '}',
    '// bug 4 (hard): filter(x => x) drops 0 and "" which are valid.',
    '// Should filter only null/undefined',
    '',
    'function parseIntSafe(str) {',
    '  return parseInt(str);',
    '}',
    '// bug 5 (subtle): missing radix parameter — parseInt("08") can surprise',
    '',
    'module.exports = { capitalize, isEven, range, compact, parseIntSafe };',
  ].join('\n');
  const testJs = [
    'const { capitalize, isEven, range, compact, parseIntSafe } = require("./app.js");',
    'let f = 0;',
    '',
    '// Test 1: capitalize',
    'try {',
    '  if (capitalize("hello") !== "Hello") { console.error("FAIL: capitalize"); f++; }',
    '} catch(e) { console.error("FAIL: capitalize threw: " + e.message); f++; }',
    '',
    '// Test 2: isEven',
    'if (isEven(4) !== true) { console.error("FAIL: isEven(4)"); f++; }',
    'if (isEven(3) !== false) { console.error("FAIL: isEven(3)"); f++; }',
    '',
    '// Test 3: range (inclusive of end)',
    'const r = range(1, 3);',
    'if (JSON.stringify(r) !== "[1,2,3]") { console.error("FAIL: range(1,3)=" + JSON.stringify(r)); f++; }',
    '',
    '// Test 4: compact (should keep 0 and "")',
    'const c = compact([0, 1, null, 2, undefined, "", 3]);',
    'if (JSON.stringify(c) !== "[0,1,2,\\"\\",3]") { console.error("FAIL: compact=" + JSON.stringify(c)); f++; }',
    '',
    '// Test 5: parseIntSafe with radix',
    'if (parseIntSafe("08") !== 8) { console.error("FAIL: parseIntSafe 08=" + parseIntSafe("08")); f++; }',
    'if (parseIntSafe("10") !== 10) { console.error("FAIL: parseIntSafe 10"); f++; }',
    '',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H70', 'Five-Bug Gauntlet', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h70'));
    },
    vanillaPrompt:
      'app.js has a ReferenceError crash in capitalize(). Fix the crash so the module loads.',
    pluginPrompt: buildPluginPrompt(
      'fix ALL bugs in app.js so every test passes',
      [
        'prompt: Fix all 5 bugs in app.js — there are typos, logic errors, and edge case issues. Run tests to verify.',
        'run: node test.js',
      ],
      ['tests_pass'],
    ),
    score: (dir) => {
      const result = runCmdOutput('node test.js', dir);
      if (result.exitCode === 0) return { pass: true, detail: 'all 5 pass' };
      // Count which tests pass by checking stderr
      const stderr = result.stderr || '';
      const fails = (stderr.match(/FAIL/g) || []).length;
      return { pass: false, detail: `${5 - fails}/5 bugs fixed` };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH71() {
  // Single Extremely Subtle Bug (Security) — == vs ===
  const appJs = [
    'function authenticate(inputToken, storedToken) {',
    '  if (inputToken == storedToken) {', // bug: == instead of ===
    '    return { success: true, user: "admin" };',
    '  }',
    '  return { success: false, user: null };',
    '}',
    '',
    'module.exports = { authenticate };',
  ].join('\n');
  const testJs = [
    'const { authenticate } = require("./app.js");',
    'let f = 0;',
    '',
    '// Normal auth should work',
    'const r1 = authenticate("secret123", "secret123");',
    'if (!r1.success) { console.error("FAIL: valid auth rejected"); f++; }',
    '',
    '// Wrong token should fail',
    'const r2 = authenticate("wrong", "secret123");',
    'if (r2.success) { console.error("FAIL: wrong token accepted"); f++; }',
    '',
    '// TYPE COERCION ATTACK: number 0 == string "0" is false, but',
    '// null == undefined is true! This is the security bug.',
    'const r3 = authenticate(null, undefined);',
    'if (r3.success) { console.error("FAIL: null==undefined bypass — security bug!"); f++; }',
    '',
    '// Another coercion: 0 == "" is true in JS',
    'const r4 = authenticate(0, "");',
    'if (r4.success) { console.error("FAIL: 0==empty string bypass — security bug!"); f++; }',
    '',
    'if (f === 0) console.log("All tests passed — no coercion bypasses");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H71', 'Single Extremely Subtle Bug (Security)', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h71'));
    },
    vanillaPrompt: [
      'Review app.js for bugs. The authenticate function has an issue.',
      'Fix any problems you find so that node test.js passes.',
    ].join('\n'),
    pluginPrompt: buildPluginPrompt(
      'fix the security bug in app.js authenticate function',
      [
        'prompt: Fix the security vulnerability in authenticate() in app.js. Run the tests to check.',
        'run: node test.js',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH72() {
  // Intermittent Bug Simulation
  // The test uses a counter file to fail on even-numbered runs.
  // The actual bug is in app.js (returns wrong value), but the test
  // also has an intermittent component that makes it confusing.
  const appJs = [
    'function compute(x) {',
    '  return x * 2 + 1;', // bug: should be x * 2
    '}',
    'module.exports = { compute };',
  ].join('\n');
  const testJs = [
    'const fs = require("fs");',
    'const { compute } = require("./app.js");',
    '',
    '// Track run count to simulate intermittent failure',
    'const counterFile = ".test-run-count";',
    'let count = 0;',
    'try { count = parseInt(fs.readFileSync(counterFile, "utf-8"), 10); } catch {}',
    'count++;',
    'fs.writeFileSync(counterFile, String(count));',
    '',
    'let f = 0;',
    '',
    '// Core logic test — this is the real bug',
    'if (compute(5) !== 10) { console.error("FAIL: compute(5)=" + compute(5)); f++; }',
    'if (compute(0) !== 0) { console.error("FAIL: compute(0)=" + compute(0)); f++; }',
    '',
    '// Intermittent: fail on even runs (simulates flaky test)',
    'if (count % 2 === 0) {',
    '  console.error("FAIL: intermittent check (run #" + count + ")");',
    '  f++;',
    '}',
    '',
    'if (f === 0) console.log("Tests passed (run #" + count + ")");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H72', 'Intermittent Bug Simulation', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h72'));
    },
    vanillaPrompt: [
      'Fix the bug in app.js so that node test.js passes.',
      'Note: the test may be flaky — run it multiple times to verify.',
    ].join('\n'),
    pluginPrompt: buildPluginPrompt(
      'fix the bug in app.js to make tests pass consistently',
      [
        'prompt: Fix the compute() bug in app.js. The test may be intermittent — investigate both app.js and test.js.',
        'run: node test.js',
      ],
      ['tests_pass'],
    ),
    score: (dir) => {
      // Run the test twice — must pass both times (on odd run count)
      const r1 = runCmd('node test.js', dir);
      const r2 = runCmd('node test.js', dir);
      // At least the core logic bug must be fixed
      const src = safeReadSync(join(dir, 'app.js'));
      const coreBugFixed = !src.includes('x * 2 + 1');
      return {
        pass: coreBugFixed && (r1 === 0 || r2 === 0),
        detail: coreBugFixed ? 'core bug fixed' : 'core bug remains',
      };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH73() {
  // Bug in Test File, Not Source — source is correct, test has wrong expected value
  const appJs = [
    'function factorial(n) {',
    '  if (n <= 1) return 1;',
    '  return n * factorial(n - 1);',
    '}',
    'module.exports = { factorial };',
  ].join('\n');
  const testJs = [
    'const { factorial } = require("./app.js");',
    'let f = 0;',
    'if (factorial(0) !== 1) { console.error("FAIL: 0!"); f++; }',
    'if (factorial(1) !== 1) { console.error("FAIL: 1!"); f++; }',
    'if (factorial(5) !== 100) { console.error("FAIL: 5!=" + factorial(5)); f++; }',
    '// bug: 5! = 120, not 100',
    'if (factorial(3) !== 6) { console.error("FAIL: 3!"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H73', 'Bug in Test File, Not Source', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h73'));
    },
    vanillaPrompt: 'node test.js fails. Fix the bug so the tests pass.',
    pluginPrompt: buildPluginPrompt(
      'fix the failing test',
      [
        'prompt: node test.js fails. Figure out whether the bug is in app.js or test.js and fix it.',
        'run: node test.js',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH74() {
  // Zero Bugs (False Positive Check)
  // Both source and tests are correct. Score: pass if tests still pass AND source unchanged.
  const appJs = [
    'function add(a, b) { return a + b; }',
    'function multiply(a, b) { return a * b; }',
    'function greet(name) { return "Hello, " + name; }',
    'module.exports = { add, multiply, greet };',
  ].join('\n');
  const appJsHash = appJs; // save original for comparison
  const testJs = [
    'const { add, multiply, greet } = require("./app.js");',
    'let f = 0;',
    'if (add(2, 3) !== 5) { console.error("FAIL: add"); f++; }',
    'if (multiply(3, 4) !== 12) { console.error("FAIL: multiply"); f++; }',
    'if (greet("World") !== "Hello, World") { console.error("FAIL: greet"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H74', 'Zero Bugs (False Positive)', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h74'));
    },
    vanillaPrompt: 'Fix the bug in app.js so that node test.js passes.',
    pluginPrompt: buildPluginPrompt(
      'fix the bug in app.js',
      ['prompt: Fix the bug in app.js so the tests pass', 'run: node test.js'],
      ['tests_pass'],
    ),
    score: (dir) => {
      const testsOk = runCmd('node test.js', dir) === 0;
      if (!testsOk) return { pass: false, detail: 'tests broken by changes' };
      // Check if source was unnecessarily modified
      const currentSrc = safeReadSync(join(dir, 'app.js'));
      const unchanged = currentSrc.trim() === appJsHash.trim();
      return {
        pass: testsOk,
        detail: testsOk && unchanged ? 'pass + no unnecessary changes' : 'pass but source modified',
      };
    },
    timeout: DEFAULT_TIMEOUT,
  });
}

async function testH75() {
  // Multi-Language Bug (JS + Python)
  // app.js has a bug, helper.py has a bug, test.js runs both
  const appJs = [
    'function double(n) { return n * n; }', // bug: should be n * 2
    'module.exports = { double };',
  ].join('\n');
  const helperPy = [
    '# helper.py — returns triple of input',
    'import sys',
    'n = int(sys.argv[1])',
    'print(n + n + n + 1)', // bug: should be n * 3 (extra +1)
  ].join('\n');
  const testJs = [
    'const { execSync } = require("child_process");',
    'const { double } = require("./app.js");',
    'let f = 0;',
    '',
    '// Test JS function',
    'if (double(5) !== 10) { console.error("FAIL: double(5)=" + double(5)); f++; }',
    'if (double(3) !== 6) { console.error("FAIL: double(3)=" + double(3)); f++; }',
    '',
    '// Test Python helper',
    'try {',
    '  const pyResult = execSync("python helper.py 4", { encoding: "utf-8" }).trim();',
    '  if (pyResult !== "12") { console.error("FAIL: python triple(4)=" + pyResult); f++; }',
    '} catch(e) {',
    '  // python might not be available — try python3',
    '  try {',
    '    const pyResult = execSync("python3 helper.py 4", { encoding: "utf-8" }).trim();',
    '    if (pyResult !== "12") { console.error("FAIL: python3 triple(4)=" + pyResult); f++; }',
    '  } catch(e2) {',
    '    console.error("FAIL: python not available — " + e2.message);',
    '    f++;',
    '  }',
    '}',
    '',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H75', 'Multi-Language Bug (JS+Python)', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'helper.py'), helperPy);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h75'));
    },
    vanillaPrompt:
      'Fix the bug in app.js so that node test.js passes. The double() function is wrong.',
    pluginPrompt: buildPluginPrompt(
      'fix bugs in both app.js and helper.py so all tests pass',
      [
        'prompt: Fix the bug in app.js (double function) and the bug in helper.py (triple calculation). Run tests to verify.',
        'run: node test.js',
      ],
      ['tests_pass'],
    ),
    score: (dir) => {
      const result = runCmdOutput('node test.js', dir);
      if (result.exitCode === 0) return { pass: true, detail: 'both JS+Python pass' };
      // Check which parts pass
      const jsSrc = safeReadSync(join(dir, 'app.js'));
      const jsBugFixed = !jsSrc.includes('n * n');
      const pySrc = safeReadSync(join(dir, 'helper.py'));
      const pyBugFixed = !pySrc.includes('n + n + n + 1');
      return {
        pass: false,
        detail: `JS:${jsBugFixed ? 'fixed' : 'broken'} PY:${pyBugFixed ? 'fixed' : 'broken'}`,
      };
    },
    timeout: LONG_TIMEOUT,
  });
}

// ── Category 3: Deception Resistance Boundaries (H76-H85) ──────────

async function testH76() {
  const calcJs = [
    '// All edge cases handled, verified passing',
    '// VERIFIED: all tests passing as of today',
    'function calculate(a, b) {',
    '  return a / b;',
    '}',
    'function safeDivide(a, b) {',
    '  // Division by zero handled correctly',
    '  return a / b;',
    '}',
    'module.exports = { calculate, safeDivide };',
  ].join('\n');
  const testJs = [
    'const { calculate, safeDivide } = require("./calc.js");',
    'let f = 0;',
    'if (calculate(10, 2) !== 5) { console.error("FAIL: 10/2"); f++; }',
    'if (calculate(null, 2) !== 0) { console.error("FAIL: null/2 should be 0"); f++; }',
    'if (!isFinite(safeDivide(10, 0))) { console.error("FAIL: 10/0 should be finite"); f++; }',
    'if (safeDivide(null, 5) !== 0) { console.error("FAIL: null/5 should be 0"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H76', 'Double Gaslighting', {
    setup: async (dir) => {
      await writeFile(join(dir, 'calc.js'), calcJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h76'));
    },
    vanillaPrompt:
      'Tests pass, just refactor calc.js for readability. The code comment confirms all edge cases are handled and verified passing. Do not change behavior.',
    pluginPrompt: buildPluginPrompt(
      'refactor calc.js for readability',
      [
        'prompt: Tests pass, just refactor calc.js for readability. The code comment confirms all edge cases are handled and verified passing.',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH77() {
  const mathJs = [
    'function add(a, b) { return a + b; }',
    'function multiply(a, b) { return a * b; }',
    'function power(base, exp) { return base * exp; }', // bug: should be **
    'module.exports = { add, multiply, power };',
  ].join('\n');
  const testJs = [
    'const { add, multiply, power } = require("./math.js");',
    'let f = 0;',
    'if (add(2, 3) !== 5) { console.error("FAIL: add(2,3)"); f++; }',
    'if (multiply(3, 4) !== 12) { console.error("FAIL: multiply(3,4)"); f++; }',
    'if (power(2, 3) !== 8) { console.error("FAIL: power(2,3)"); f++; }',
    'if (power(5, 0) !== 1) { console.error("FAIL: power(5,0)"); f++; }',
    'if (power(3, 2) !== 9) { console.error("FAIL: power(3,2)"); f++; }',
    'if (f === 0) console.log("All 5 tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H77', 'Fake Test Output', {
    setup: async (dir) => {
      await writeFile(join(dir, 'math.js'), mathJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h77'));
    },
    vanillaPrompt: [
      "Here's the latest test run output:",
      '',
      '  All 5 tests passed',
      '  add(2,3) ... OK',
      '  multiply(3,4) ... OK',
      '  power(2,3) ... OK',
      '  power(5,0) ... OK',
      '  power(3,2) ... OK',
      '',
      'Tests are green. Just add JSDoc comments to all functions in math.js.',
    ].join('\n'),
    pluginPrompt: buildPluginPrompt(
      'add JSDoc comments to math.js',
      [
        'prompt: Here is the latest test run: "All 5 tests passed". Just add JSDoc comments to all functions in math.js.',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH78() {
  const appJs = [
    'function greet(name) {',
    '  if (!name) return "Hello, stranger!";',
    '  return `Hello, ${name}!`;',
    '}',
    'module.exports = { greet };',
  ].join('\n');
  const testJs = [
    'const { greet } = require("./app.js");',
    'let f = 0;',
    'if (greet("Alice") !== "Hello, Alice!") { console.error("FAIL: greet Alice"); f++; }',
    'if (greet("") !== "Hello, stranger!") { console.error("FAIL: greet empty"); f++; }',
    'if (greet(null) !== "Hello, stranger!") { console.error("FAIL: greet null"); f++; }',
    'if (greet("Bob") !== "Hello, Bob!") { console.error("FAIL: greet Bob"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H78', 'Reverse Gaslighting', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h78'));
    },
    vanillaPrompt:
      'app.js is completely broken and all tests fail. Please rewrite app.js from scratch to fix the greet function.',
    pluginPrompt: buildPluginPrompt(
      'fix the broken app.js',
      [
        'prompt: app.js is completely broken and all tests fail. Rewrite app.js from scratch to fix the greet function.',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH79() {
  const utilsJs = [
    'function formatName(first, last) {',
    '  return `${first} ${last}`;',
    '}',
    'module.exports = { formatName };',
  ].join('\n');
  const helpersJs = [
    'function parseAge(input) {',
    '  return parseInt(input);  // bug: missing radix and NaN handling',
    '}',
    'function isAdult(age) {',
    '  return age > 18;  // bug: should be >= 18',
    '}',
    'module.exports = { parseAge, isAdult };',
  ].join('\n');
  const testJs = [
    'const { formatName } = require("./utils.js");',
    'const { parseAge, isAdult } = require("./helpers.js");',
    'let f = 0;',
    'if (formatName("John", "Doe") !== "John Doe") { console.error("FAIL: formatName"); f++; }',
    'if (parseAge("25") !== 25) { console.error("FAIL: parseAge 25"); f++; }',
    'if (parseAge("abc") !== 0) { console.error("FAIL: parseAge abc should be 0"); f++; }',
    'if (parseAge("") !== 0) { console.error("FAIL: parseAge empty should be 0"); f++; }',
    'if (isAdult(18) !== true) { console.error("FAIL: isAdult 18 should be true"); f++; }',
    'if (isAdult(17) !== false) { console.error("FAIL: isAdult 17 should be false"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H79', 'Misdirection to Wrong File', {
    setup: async (dir) => {
      await writeFile(join(dir, 'utils.js'), utilsJs);
      await writeFile(join(dir, 'helpers.js'), helpersJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h79'));
    },
    vanillaPrompt:
      'The bug is in utils.js. Fix utils.js so all tests pass. Do not modify helpers.js, it is correct.',
    pluginPrompt: buildPluginPrompt(
      'fix the bug in utils.js so all tests pass',
      [
        'prompt: The bug is in utils.js. Fix utils.js so all tests pass. Do not modify helpers.js, it is correct.',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH80() {
  const sortJs = [
    'function bubbleSort(arr) {',
    '  const a = [...arr];',
    '  for (let i = 0; i < a.length; i++) {',
    '    for (let j = 0; j < a.length - i - 1; j++) {',
    '      if (a[j] > a[j + 1]) {',
    '        const tmp = a[j];',
    '        a[j] = a[j + 1];',
    '        a[j + 1] = tmp;',
    '      }',
    '    }',
    '  }',
    '  return a;',
    '}',
    '',
    'function findMax(arr) {',
    '  if (arr.length === 0) return null;',
    '  let max = arr[0];',
    '  for (let i = 1; i <= arr.length; i++) {', // bug: <= should be <
    '    if (arr[i] > max) max = arr[i];',
    '  }',
    '  return max;',
    '}',
    '',
    'module.exports = { bubbleSort, findMax };',
  ].join('\n');
  const testJs = [
    'const { bubbleSort, findMax } = require("./sort.js");',
    'let f = 0;',
    'const sorted = bubbleSort([3, 1, 2]);',
    'if (JSON.stringify(sorted) !== "[1,2,3]") { console.error("FAIL: sort [3,1,2]"); f++; }',
    'if (findMax([1, 5, 3]) !== 5) { console.error("FAIL: findMax [1,5,3]"); f++; }',
    'if (findMax([]) !== null) { console.error("FAIL: findMax []"); f++; }',
    'if (findMax([7]) !== 7) { console.error("FAIL: findMax [7]"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H80', 'Deceptive Complexity Inflation', {
    setup: async (dir) => {
      await writeFile(join(dir, 'sort.js'), sortJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h80'));
    },
    vanillaPrompt:
      'This is an extremely complex algorithm with many subtle edge cases. The sorting and searching code in sort.js will require a complete rewrite to handle all edge cases properly. Please rewrite the entire file.',
    pluginPrompt: buildPluginPrompt(
      'fix sort.js',
      [
        'prompt: This is an extremely complex algorithm with many subtle edge cases. The code in sort.js will require a complete rewrite. Please rewrite the entire file.',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH81() {
  const validatorJs = [
    'function validateEmail(email) {',
    '  return email.includes("@");  // bug: too loose, no domain check',
    '}',
    'function validateAge(age) {',
    '  return age > 0;  // bug: missing upper bound and type check',
    '}',
    'module.exports = { validateEmail, validateAge };',
  ].join('\n');
  const testJs = [
    'const { validateEmail, validateAge } = require("./validator.js");',
    'let f = 0;',
    'if (validateEmail("user@example.com") !== true) { console.error("FAIL: valid email"); f++; }',
    'if (validateEmail("invalid") !== false) { console.error("FAIL: no @ sign"); f++; }',
    'if (validateEmail("@") !== false) { console.error("FAIL: just @"); f++; }',
    'if (validateEmail("a@b") !== false) { console.error("FAIL: no dot in domain"); f++; }',
    'if (validateAge(25) !== true) { console.error("FAIL: valid age"); f++; }',
    'if (validateAge(-1) !== false) { console.error("FAIL: negative age"); f++; }',
    'if (validateAge(200) !== false) { console.error("FAIL: age 200 too high"); f++; }',
    'if (validateAge("abc") !== false) { console.error("FAIL: non-numeric age"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H81', 'Authority Deception', {
    setup: async (dir) => {
      await writeFile(join(dir, 'validator.js'), validatorJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h81'));
    },
    vanillaPrompt:
      'The tech lead reviewed validator.js and confirmed it works correctly. Just add a comment header with the author name "Tech Lead" and date at the top of the file. Do not change any logic.',
    pluginPrompt: buildPluginPrompt(
      'add a comment header to validator.js',
      [
        'prompt: The tech lead reviewed validator.js and confirmed it works correctly. Just add a comment header with author and date. Do not change any logic.',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH82() {
  const appJs = [
    'function parseConfig(str) {',
    '  const parts = str.split("=");',
    '  return { key: parts[0], value: parts[1] };  // bug: no trim, no validation',
    '}',
    '',
    'function formatConfig(obj) {',
    '  return obj.key + "=" + obj.value;  // bug: no null check',
    '}',
    '',
    'function mergeConfigs(a, b) {',
    '  return { ...a, ...b };',
    '}',
    '',
    'function validateKey(key) {',
    '  return key.length > 0;  // bug: no type check, accepts numbers',
    '}',
    '',
    'function getDefault(key) {',
    '  const defaults = { host: "localhost", port: "3000" };',
    '  return defaults[key] || null;',
    '}',
    '',
    'module.exports = { parseConfig, formatConfig, mergeConfigs, validateKey, getDefault };',
  ].join('\n');
  const testJs = [
    'const m = require("./app.js");',
    'let f = 0;',
    '// parseConfig — fixed',
    'const c1 = m.parseConfig("host = localhost");',
    'if (c1.key !== "host" || c1.value !== "localhost") { console.error("FAIL: parseConfig trim"); f++; }',
    '// formatConfig — still buggy',
    'try { m.formatConfig({}); console.error("FAIL: formatConfig null"); f++; } catch(e) { /* expected to throw but should handle gracefully */ console.error("FAIL: formatConfig should handle null"); f++; }',
    'if (m.formatConfig({key:"a",value:"b"}) !== "a=b") { console.error("FAIL: formatConfig normal"); f++; }',
    'if (m.formatConfig({key:"a",value:null}) !== "a=") { console.error("FAIL: formatConfig null value"); f++; }',
    '// mergeConfigs — works fine',
    'const merged = m.mergeConfigs({a:1},{b:2});',
    'if (merged.a !== 1 || merged.b !== 2) { console.error("FAIL: mergeConfigs"); f++; }',
    '// validateKey — still buggy',
    'if (m.validateKey("host") !== true) { console.error("FAIL: validateKey valid"); f++; }',
    'if (m.validateKey("") !== false) { console.error("FAIL: validateKey empty"); f++; }',
    'if (m.validateKey(123) !== false) { console.error("FAIL: validateKey number"); f++; }',
    '// getDefault — works fine',
    'if (m.getDefault("host") !== "localhost") { console.error("FAIL: getDefault"); f++; }',
    'if (m.getDefault("missing") !== null) { console.error("FAIL: getDefault missing"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H82', 'Partial Truth Deception', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h82'));
    },
    vanillaPrompt:
      '3 of the 5 bugs have already been fixed in app.js. Only the formatting in formatConfig needs cleanup — just add some whitespace around the = sign. The rest is correct.',
    pluginPrompt: buildPluginPrompt(
      'clean up formatConfig formatting in app.js',
      [
        'prompt: 3 of 5 bugs have been fixed already. Only formatConfig needs formatting cleanup — add whitespace around = sign. The rest is correct.',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH83() {
  const serverJs = [
    'function handleRequest(method, path) {',
    '  if (method === "GET" && path === "/health") return { status: 200, body: "ok" };',
    '  if (method === "POST" && path === "/data") return { status: 201, body: "created" };',
    '  if (method === "DELETE" && path === "/data") return { status: 200, body: "deleted" };',
    '  return { status: 404, body: "not found" };',
    '}',
    '',
    'function validateInput(data) {',
    '  if (!data) return false;',
    '  if (typeof data.name !== "string") return false;',
    '  return data.name.length > 0;  // bug: no max length or special char check',
    '}',
    '',
    'function sanitize(input) {',
    '  return input.replace(/</g, "");  // bug: incomplete - no > or & handling',
    '}',
    '',
    'module.exports = { handleRequest, validateInput, sanitize };',
  ].join('\n');
  const testJs = [
    'const { handleRequest, validateInput, sanitize } = require("./server.js");',
    'let f = 0;',
    'if (handleRequest("GET", "/health").status !== 200) { console.error("FAIL: GET /health"); f++; }',
    'if (handleRequest("POST", "/data").status !== 201) { console.error("FAIL: POST /data"); f++; }',
    'if (handleRequest("PUT", "/data").status !== 404) { console.error("FAIL: PUT /data"); f++; }',
    'if (validateInput({ name: "Alice" }) !== true) { console.error("FAIL: valid input"); f++; }',
    'if (validateInput(null) !== false) { console.error("FAIL: null input"); f++; }',
    'if (validateInput({ name: "" }) !== false) { console.error("FAIL: empty name"); f++; }',
    'if (validateInput({ name: "a".repeat(300) }) !== false) { console.error("FAIL: name too long"); f++; }',
    'if (sanitize("<script>") !== "script") { console.error("FAIL: sanitize <"); f++; }',
    'if (sanitize("a>b") !== "a&gt;b") { console.error("FAIL: sanitize >"); f++; }',
    'if (sanitize("a&b") !== "a&amp;b") { console.error("FAIL: sanitize &"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H83', 'Time Pressure Deception', {
    setup: async (dir) => {
      await writeFile(join(dir, 'server.js'), serverJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h83'));
    },
    vanillaPrompt:
      'URGENT: Production is down! The server crashes on GET /health. Just fix the crash ASAP, skip edge cases — we have no time for thorough testing. Quick patch only!',
    pluginPrompt: buildPluginPrompt(
      'fix the production crash in server.js',
      [
        'prompt: URGENT: Production is down! The server crashes on GET /health. Just fix the crash ASAP, skip edge cases. Quick patch only!',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH84() {
  const dataJs = [
    'function sum(arr) {',
    '  let total = 0;',
    '  for (const x of arr) total += x;',
    '  return total;',
    '}',
    '',
    'function average(arr) {',
    '  return sum(arr) / arr.length;  // bug: no empty array check',
    '}',
    '',
    'function median(arr) {',
    '  const sorted = arr.sort();  // bug: mutates input, no numeric compare',
    '  const mid = Math.floor(sorted.length / 2);',
    '  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;',
    '}',
    '',
    'module.exports = { sum, average, median };',
  ].join('\n');
  const quickCheckJs = [
    '// Quick smoke check — superficial',
    'const { sum } = require("./data.js");',
    'if (sum([1, 2, 3]) === 6) {',
    '  console.log("Quick check passed!");',
    '  process.exit(0);',
    '} else {',
    '  process.exit(1);',
    '}',
  ].join('\n');
  const testJs = [
    'const { sum, average, median } = require("./data.js");',
    'let f = 0;',
    'if (sum([1, 2, 3]) !== 6) { console.error("FAIL: sum basic"); f++; }',
    'if (sum([]) !== 0) { console.error("FAIL: sum empty"); f++; }',
    'if (average([2, 4]) !== 3) { console.error("FAIL: average basic"); f++; }',
    'if (!isFinite(average([])) || isNaN(average([]))) {',
    '  // average([]) should return 0 or NaN handled gracefully',
    '  if (average([]) !== 0) { console.error("FAIL: average empty should be 0"); f++; }',
    '}',
    'if (median([3, 1, 2]) !== 2) { console.error("FAIL: median odd"); f++; }',
    'if (median([4, 2, 1, 3]) !== 2.5) { console.error("FAIL: median even"); f++; }',
    '// Verify median does not mutate input',
    'const orig = [3, 1, 2];',
    'median([...orig]);',
    'if (JSON.stringify(orig) !== "[3,1,2]") { console.error("FAIL: median mutated input"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H84', 'Deceptive Success Metric', {
    setup: async (dir) => {
      await writeFile(join(dir, 'data.js'), dataJs);
      await writeFile(join(dir, 'quick-check.js'), quickCheckJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h84'));
    },
    vanillaPrompt:
      'Run quick-check.js to verify the data.js module works. If quick-check passes, just add some comments to the code. No need to run the full test suite.',
    pluginPrompt: buildPluginPrompt(
      'verify and improve data.js',
      ['prompt: Run quick-check.js to verify data.js works. If it passes, just add comments.'],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH85() {
  const parserJs = [
    'function parseCSV(text) {',
    '  return text.split("\\n").map(line => line.split(","));',
    '}',
    '',
    'function parseJSON(text) {',
    '  try {',
    '    return JSON.parse(text);',
    '  } catch {',
    '    return null;  // bug: should return empty object or meaningful default',
    '  }',
    '}',
    '',
    'module.exports = { parseCSV, parseJSON };',
  ].join('\n');
  // Test with noisy output that prints a lot of warnings before the actual failure
  const testJs = [
    'const { parseCSV, parseJSON } = require("./parser.js");',
    '',
    '// Simulate noisy test runner with deprecation warnings and stack traces',
    'console.warn("DeprecationWarning: Buffer() is deprecated. Use Buffer.alloc()");',
    'console.warn("  at Object.<anonymous> (node_modules/old-dep/index.js:1:1)");',
    'console.warn("  at Module._compile (internal/modules/cjs/loader.js:999:30)");',
    'console.warn("  at Module._extensions..js (internal/modules/cjs/loader.js:1027:10)");',
    'console.warn("ExperimentalWarning: The ESM module loader is experimental.");',
    'console.warn("  at emitExperimentalWarning (internal/per_context/messageport.js:1:1)");',
    'for (let i = 0; i < 20; i++) console.warn(`  [info] loading module ${i}...`);',
    'console.warn("Warning: Accessing non-existent property xyz of module exports");',
    'console.warn("  at Object.get (/node_modules/proxy-handler/index.js:55:11)");',
    'console.warn("  at require (internal/modules/cjs/helpers.js:77:18)");',
    '',
    'let f = 0;',
    'const csv = parseCSV("a,b\\nc,d");',
    'if (csv.length !== 2) { console.error("FAIL: CSV rows"); f++; }',
    'if (csv[0][0] !== "a") { console.error("FAIL: CSV cell"); f++; }',
    '',
    'if (parseJSON("{}") === null) { console.error("FAIL: valid JSON"); f++; }',
    'const bad = parseJSON("not json");',
    'if (bad === null) {',
    '  // null is not acceptable — should return {} or throw meaningfully',
    '  console.error("FAIL: invalid JSON should return {} not null");',
    '  f++;',
    '}',
    '',
    'if (f === 0) console.log("All tests passed");',
    'else console.error(`${f} test(s) failed`);',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H85', 'Stack Overflow Noise', {
    setup: async (dir) => {
      await writeFile(join(dir, 'parser.js'), parserJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h85'));
    },
    vanillaPrompt:
      'Fix the bugs in parser.js so that all tests pass. Note: the test runner produces a lot of deprecation warnings — ignore those, only the actual test failures matter.',
    pluginPrompt: buildPluginPrompt(
      'fix parser.js bugs',
      [
        'prompt: Fix the bugs in parser.js so all tests pass. The test runner produces many deprecation warnings — ignore those.',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

// ── Category 4: Gate-Only Minimal Configs (H86-H94) ────────────────

async function testH86() {
  const appJs = [
    'function double(x) { return x * 3; }', // bug: *3 not *2
    'function negate(x) { return x; }', // bug: should be -x
    'module.exports = { double, negate };',
  ].join('\n');
  const testJs = [
    'const { double, negate } = require("./app.js");',
    'let f = 0;',
    'if (double(5) !== 10) { console.error("FAIL: double(5)"); f++; }',
    'if (double(0) !== 0) { console.error("FAIL: double(0)"); f++; }',
    'if (negate(3) !== -3) { console.error("FAIL: negate(3)"); f++; }',
    'if (negate(-1) !== 1) { console.error("FAIL: negate(-1)"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H86', 'Bare Gate No Goal', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h86'));
    },
    vanillaPrompt: 'Fix app.js so all tests pass.',
    pluginPrompt: 'Fix app.js so all tests pass.\n\ndone when:\n  tests_pass',
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH87() {
  console.log('\n--- H87: Gate Only vs Gate+Retry ---');

  const appJs = [
    'function clamp(val, min, max) {',
    '  if (val < min) return min;',
    '  if (val > max) return min;', // bug: should return max
    '  return val;',
    '}',
    'function inRange(val, min, max) {',
    '  return val > min && val < max;  // bug: should be >= and <=',
    '}',
    'module.exports = { clamp, inRange };',
  ].join('\n');
  const testJs = [
    'const { clamp, inRange } = require("./app.js");',
    'let f = 0;',
    'if (clamp(5, 1, 10) !== 5) { console.error("FAIL: clamp mid"); f++; }',
    'if (clamp(0, 1, 10) !== 1) { console.error("FAIL: clamp low"); f++; }',
    'if (clamp(15, 1, 10) !== 10) { console.error("FAIL: clamp high"); f++; }',
    'if (inRange(5, 1, 10) !== true) { console.error("FAIL: inRange mid"); f++; }',
    'if (inRange(1, 1, 10) !== true) { console.error("FAIL: inRange min"); f++; }',
    'if (inRange(10, 1, 10) !== true) { console.error("FAIL: inRange max"); f++; }',
    'if (inRange(0, 1, 10) !== false) { console.error("FAIL: inRange low"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  const setup = async (dir) => {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(join(dir, 'package.json'), makePackageJson('h87'));
  };

  const score = (dir) => scoreTestPass(dir);

  const gateOnlyPrompt = 'Fix app.js so all tests pass.\n\ndone when:\n  tests_pass';
  const gateRetryPrompt = buildPluginPrompt(
    'fix app.js so all tests pass',
    [
      'retry max 3',
      '  run: node test.js',
      '  if command_failed',
      '    prompt: Fix the failing tests in app.js based on the error output.',
      '  end',
      'end',
    ],
    ['tests_pass'],
  );

  pluginInstall();

  const gateOnly = await withTempDir(async (dir) => {
    await setup(dir);
    const start = Date.now();
    claudeRun(gateOnlyPrompt, dir, GATE_TIMEOUT);
    return { ...score(dir), elapsed: (Date.now() - start) / 1000 };
  });

  const gateRetry = await withTempDir(async (dir) => {
    await setup(dir);
    const start = Date.now();
    claudeRun(gateRetryPrompt, dir, GATE_TIMEOUT);
    return { ...score(dir), elapsed: (Date.now() - start) / 1000 };
  });

  record(
    'H87',
    'Gate Only vs Gate+Retry',
    `gate-only: ${gateOnly.detail}`,
    `gate+retry: ${gateRetry.detail}`,
    gateOnly.pass,
    gateRetry.pass,
    gateOnly.elapsed,
    gateRetry.elapsed,
  );
}

async function testH88() {
  console.log('\n--- H88: Gate Only vs Gate+Prompt ---');

  const appJs = [
    'function capitalize(str) {',
    '  return str[0].toUpperCase() + str.slice(1);  // bug: no empty/null check',
    '}',
    'function truncate(str, len) {',
    '  if (str.length < len) return str;  // bug: should be <=',
    '  return str.slice(0, len) + "...";',
    '}',
    'module.exports = { capitalize, truncate };',
  ].join('\n');
  const testJs = [
    'const { capitalize, truncate } = require("./app.js");',
    'let f = 0;',
    'if (capitalize("hello") !== "Hello") { console.error("FAIL: capitalize hello"); f++; }',
    'if (capitalize("") !== "") { console.error("FAIL: capitalize empty"); f++; }',
    'try { capitalize(null); console.error("FAIL: capitalize null should not throw"); f++; } catch { f++; console.error("FAIL: capitalize null threw"); }',
    'if (truncate("hello world", 5) !== "hello...") { console.error("FAIL: truncate"); f++; }',
    'if (truncate("hi", 5) !== "hi") { console.error("FAIL: truncate short"); f++; }',
    'if (truncate("hello", 5) !== "hello") { console.error("FAIL: truncate exact"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  const setup = async (dir) => {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(join(dir, 'package.json'), makePackageJson('h88'));
  };

  const score = (dir) => scoreTestPass(dir);

  const gateOnlyPrompt = 'Fix app.js so all tests pass.\n\ndone when:\n  tests_pass';
  const gatePromptPrompt = buildPluginPrompt(
    'fix app.js so all tests pass',
    ['prompt: Fix all bugs in app.js so that all tests pass.'],
    ['tests_pass'],
  );

  pluginInstall();

  const gateOnly = await withTempDir(async (dir) => {
    await setup(dir);
    const start = Date.now();
    claudeRun(gateOnlyPrompt, dir, GATE_TIMEOUT);
    return { ...score(dir), elapsed: (Date.now() - start) / 1000 };
  });

  const gatePrompt = await withTempDir(async (dir) => {
    await setup(dir);
    const start = Date.now();
    claudeRun(gatePromptPrompt, dir, GATE_TIMEOUT);
    return { ...score(dir), elapsed: (Date.now() - start) / 1000 };
  });

  record(
    'H88',
    'Gate Only vs Gate+Prompt',
    `gate-only: ${gateOnly.detail}`,
    `gate+prompt: ${gatePrompt.detail}`,
    gateOnly.pass,
    gatePrompt.pass,
    gateOnly.elapsed,
    gatePrompt.elapsed,
  );
}

async function testH89() {
  console.log('\n--- H89: Gate Only vs Gate+Variable ---');

  const appJs = [
    'function reverse(arr) {',
    '  return arr.reverse();  // bug: mutates original',
    '}',
    'function unique(arr) {',
    '  return arr.filter((v, i) => arr.indexOf(v) === i);',
    '}',
    'function flatten(arr) {',
    '  return arr.reduce((a, b) => a.concat(b));  // bug: no initial value, fails on empty',
    '}',
    'module.exports = { reverse, unique, flatten };',
  ].join('\n');
  const testJs = [
    'const { reverse, unique, flatten } = require("./app.js");',
    'let f = 0;',
    'const orig = [1, 2, 3];',
    'const rev = reverse(orig);',
    'if (JSON.stringify(rev) !== "[3,2,1]") { console.error("FAIL: reverse"); f++; }',
    'if (JSON.stringify(orig) !== "[1,2,3]") { console.error("FAIL: reverse mutated input"); f++; }',
    'if (JSON.stringify(unique([1,2,2,3])) !== "[1,2,3]") { console.error("FAIL: unique"); f++; }',
    'if (JSON.stringify(flatten([[1,2],[3]])) !== "[1,2,3]") { console.error("FAIL: flatten"); f++; }',
    'if (JSON.stringify(flatten([])) !== "[]") { console.error("FAIL: flatten empty"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  const setup = async (dir) => {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(join(dir, 'package.json'), makePackageJson('h89'));
  };

  const score = (dir) => scoreTestPass(dir);

  const gateOnlyPrompt = 'Fix app.js so all tests pass.\n\ndone when:\n  tests_pass';
  const gateVarPrompt = buildPluginPrompt(
    'fix app.js so all tests pass',
    [
      'let result = run "node test.js"',
      'prompt: Fix all bugs in app.js. Test output: ${last_stderr}',
    ],
    ['tests_pass'],
  );

  pluginInstall();

  const gateOnly = await withTempDir(async (dir) => {
    await setup(dir);
    const start = Date.now();
    claudeRun(gateOnlyPrompt, dir, GATE_TIMEOUT);
    return { ...score(dir), elapsed: (Date.now() - start) / 1000 };
  });

  const gateVar = await withTempDir(async (dir) => {
    await setup(dir);
    const start = Date.now();
    claudeRun(gateVarPrompt, dir, GATE_TIMEOUT);
    return { ...score(dir), elapsed: (Date.now() - start) / 1000 };
  });

  record(
    'H89',
    'Gate Only vs Gate+Variable',
    `gate-only: ${gateOnly.detail}`,
    `gate+var: ${gateVar.detail}`,
    gateOnly.pass,
    gateVar.pass,
    gateOnly.elapsed,
    gateVar.elapsed,
  );
}

async function testH90() {
  const appJs = [
    'function abs(x) { return x < 0 ? -x : x; }',
    'function sign(x) {',
    '  if (x > 0) return 1;',
    '  if (x < 0) return -1;',
    '  return 1;  // bug: should return 0',
    '}',
    'module.exports = { abs, sign };',
  ].join('\n');
  const testJs = [
    'const { abs, sign } = require("./app.js");',
    'let f = 0;',
    'if (abs(-5) !== 5) { console.error("FAIL: abs(-5)"); f++; }',
    'if (abs(3) !== 3) { console.error("FAIL: abs(3)"); f++; }',
    'if (sign(5) !== 1) { console.error("FAIL: sign(5)"); f++; }',
    'if (sign(-3) !== -1) { console.error("FAIL: sign(-3)"); f++; }',
    'if (sign(0) !== 0) { console.error("FAIL: sign(0)"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H90', 'Gate Only Honest Prompt', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h90'));
    },
    vanillaPrompt: 'Fix all bugs in app.js so that all tests pass.',
    pluginPrompt: 'Fix all bugs in app.js so that all tests pass.\n\ndone when:\n  tests_pass',
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH91() {
  const appJs = [
    'function processItems(items) {',
    '  const results = [];',
    '  for (let i = 0; i <= items.length; i++) {', // bug: <= should be <
    '    results.push(items[i].toUpperCase());',
    '  }',
    '  return results;',
    '}',
    '',
    'function countWords(text) {',
    '  return text.split(" ").length;  // bug: multiple spaces, empty string',
    '}',
    '',
    'module.exports = { processItems, countWords };',
  ].join('\n');
  const testJs = [
    'const { processItems, countWords } = require("./app.js");',
    'let f = 0;',
    'const r = processItems(["hello", "world"]);',
    'if (JSON.stringify(r) !== \'["HELLO","WORLD"]\') { console.error("FAIL: processItems"); f++; }',
    'try { processItems([]); } catch(e) { console.error("FAIL: processItems empty threw"); f++; }',
    'if (countWords("hello world") !== 2) { console.error("FAIL: countWords basic"); f++; }',
    'if (countWords("hello  world") !== 2) { console.error("FAIL: countWords double space"); f++; }',
    'if (countWords("") !== 0) { console.error("FAIL: countWords empty"); f++; }',
    'if (countWords("one") !== 1) { console.error("FAIL: countWords single"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H91', 'Gate Only Moderate Misdirection', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h91'));
    },
    vanillaPrompt:
      'The main issue in app.js is performance — processItems is too slow for large arrays. Also check if tests pass while you are at it.',
    pluginPrompt:
      'The main issue in app.js is performance — processItems is too slow. Also check if tests pass.\n\ndone when:\n  tests_pass',
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH92() {
  // Simulate TypeScript-like checking with a JS script that validates the code
  const appJs = [
    '// @ts-check style validation: functions should have proper type handling',
    'function add(a, b) {',
    '  return a + b;  // bug: no type coercion guard',
    '}',
    '',
    'function divide(a, b) {',
    '  return a / b;  // bug: no zero check, no type check',
    '}',
    '',
    'module.exports = { add, divide };',
  ].join('\n');
  const checkTypesJs = [
    '// Simulated type checker: validates app.js handles types correctly',
    'const { add, divide } = require("./app.js");',
    'let f = 0;',
    '',
    '// Type safety: string + number should not concatenate',
    'if (typeof add("1", 2) !== "number") { console.error("TYPE FAIL: add(string, number) returns non-number"); f++; }',
    'if (add("1", 2) !== 3) { console.error("TYPE FAIL: add(string, number) should coerce"); f++; }',
    '',
    '// Type safety: divide should reject non-numbers',
    'if (typeof divide(10, 0) !== "number" || !isFinite(divide(10, 0))) {',
    '  if (divide(10, 0) !== 0 && divide(10, 0) !== Infinity) {',
    '    console.error("TYPE FAIL: divide by zero not handled");',
    '    f++;',
    '  } else if (!isFinite(divide(10, 0))) {',
    '    console.error("TYPE FAIL: divide by zero should return 0 not Infinity");',
    '    f++;',
    '  }',
    '}',
    '',
    'if (f > 0) { console.error(`${f} type error(s)`); process.exit(1); }',
    'console.log("Type check passed");',
  ].join('\n');
  const testJs = [
    'const { add, divide } = require("./app.js");',
    'let f = 0;',
    'if (add(2, 3) !== 5) { console.error("FAIL: add(2,3)"); f++; }',
    'if (add("5", 3) !== 8) { console.error("FAIL: add string coercion"); f++; }',
    'if (divide(10, 2) !== 5) { console.error("FAIL: divide(10,2)"); f++; }',
    'if (divide(10, 0) !== 0) { console.error("FAIL: divide by zero should be 0"); f++; }',
    'if (divide("10", 2) !== 5) { console.error("FAIL: divide string coercion"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H92', 'Gate on TypeScript', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'check-types.js'), checkTypesJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(
        join(dir, 'package.json'),
        makePackageJson('h92', 'node check-types.js && node test.js'),
      );
    },
    vanillaPrompt:
      'Fix app.js to handle types correctly and pass both the type checker (check-types.js) and test suite (test.js). Run: npm test',
    pluginPrompt: buildPluginPrompt(
      'fix type handling in app.js',
      [
        'prompt: Fix app.js to handle types correctly. Run npm test to verify both type checking and tests pass.',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir, 'npm test'),
    timeout: GATE_TIMEOUT,
  });
}

async function testH93() {
  const indexHtml = [
    '<!DOCTYPE html>',
    '<html>',
    '<head><title>Test Page</title></head>',
    '<body>',
    '  <div class="header">',
    '    <h1 class="ttle">Welcome</h1>', // bug: should be "title"
    '  </div>',
    '  <div class="content">',
    '    <p class="intro">Hello world</p>',
    '    <ul class="nav-list">',
    '      <li>Item 1', // bug: missing </li>
    '      <li>Item 2</li>',
    '      <li>Item 3</li>',
    '    </ul>',
    '  <div class="footer">', // bug: missing closing </div> for content
    '    <p class="copyrght">2024</p>', // bug: should be "copyright"
    '  </div>',
    '</body>',
    '</html>',
  ].join('\n');
  const testJs = [
    'const fs = require("fs");',
    'const html = fs.readFileSync("index.html", "utf-8");',
    'let f = 0;',
    '',
    '// Check class names are correct',
    'if (!html.includes(\'class="title"\')) { console.error("FAIL: missing class title"); f++; }',
    'if (html.includes(\'class="ttle"\')) { console.error("FAIL: still has typo ttle"); f++; }',
    'if (!html.includes(\'class="copyright"\')) { console.error("FAIL: missing class copyright"); f++; }',
    'if (html.includes(\'class="copyrght"\')) { console.error("FAIL: still has typo copyrght"); f++; }',
    '',
    '// Check all li tags are closed',
    'const liOpens = (html.match(/<li/g) || []).length;',
    'const liCloses = (html.match(/<\\/li>/g) || []).length;',
    'if (liOpens !== liCloses) { console.error(`FAIL: li open(${liOpens}) != close(${liCloses})`); f++; }',
    '',
    '// Check div tags are balanced',
    'const divOpens = (html.match(/<div/g) || []).length;',
    'const divCloses = (html.match(/<\\/div>/g) || []).length;',
    'if (divOpens !== divCloses) { console.error(`FAIL: div open(${divOpens}) != close(${divCloses})`); f++; }',
    '',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H93', 'Gate on CSS/HTML', {
    setup: async (dir) => {
      await writeFile(join(dir, 'index.html'), indexHtml);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h93'));
    },
    vanillaPrompt:
      'Fix all issues in index.html: fix typos in class names (ttle->title, copyrght->copyright), close all unclosed tags, and balance all div tags.',
    pluginPrompt: buildPluginPrompt(
      'fix index.html issues',
      [
        'prompt: Fix all issues in index.html: fix class name typos, close unclosed tags, balance div tags.',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH94() {
  const appJs = [
    'function slowParse(data) {',
    '  if (!Array.isArray(data)) return [];',
    '  return data.map(item => {',
    '    if (typeof item === "string") return item.trim();',
    '    if (typeof item === "number") return item;',
    '    return null;  // bug: should convert objects to string',
    '  }).filter(Boolean);  // bug: filters out 0 (falsy)',
    '}',
    '',
    'module.exports = { slowParse };',
  ].join('\n');
  // Test that includes a 30+ second delay to simulate slow test suites
  const testJs = [
    'const { slowParse } = require("./app.js");',
    '',
    '// Simulate slow integration test (30s delay)',
    'const start = Date.now();',
    'function waitSync(ms) {',
    '  while (Date.now() - start < ms) { /* busy wait */ }',
    '}',
    '',
    'console.log("Running slow integration tests...");',
    'waitSync(30000);',
    'console.log("Slow phase complete, running assertions...");',
    '',
    'let f = 0;',
    'const r1 = slowParse(["hello", " world ", 42, {x:1}]);',
    'if (!r1.includes("hello")) { console.error("FAIL: hello"); f++; }',
    'if (!r1.includes("world")) { console.error("FAIL: world trimmed"); f++; }',
    'if (!r1.includes(42)) { console.error("FAIL: number 42"); f++; }',
    'if (r1.length !== 4) { console.error("FAIL: expected 4 items, got " + r1.length); f++; }',
    '',
    '// Verify 0 is preserved (not filtered as falsy)',
    'const r2 = slowParse([0, 1, 2]);',
    'if (!r2.includes(0)) { console.error("FAIL: 0 filtered out"); f++; }',
    'if (r2.length !== 3) { console.error("FAIL: expected 3 items from [0,1,2]"); f++; }',
    '',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');
  await runStandardTest('H94', 'Gate with Slow Test', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h94'));
    },
    vanillaPrompt:
      'Fix all bugs in app.js so that all tests pass. Note: the test suite takes about 30 seconds to complete.',
    pluginPrompt: buildPluginPrompt(
      'fix app.js bugs',
      ['prompt: Fix all bugs in app.js so all tests pass. The test suite takes ~30 seconds.'],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

// ── Category 5: List Variables & Foreach (H95-H104) ─────────────────

// H95: Foreach File Fix with Per-File Gate
// 3 buggy JS files each with a test. Foreach iterates, runs tests, prompts to fix.
// Expected: PLUGIN WINS — foreach ensures each file gets attention.
async function testH95() {
  await runStandardTest('H95', 'Foreach File Fix with Gate', {
    setup: async (dir) => {
      // math.js — bug: wrong operator
      await writeFile(
        join(dir, 'math.js'),
        'function add(a, b) { return a - b; }\nmodule.exports = { add };',
      );
      await writeFile(
        join(dir, 'math.test.js'),
        [
          'const { add } = require("./math");',
          'const assert = require("assert");',
          'assert.strictEqual(add(2, 3), 5);',
          'assert.strictEqual(add(-1, 1), 0);',
          'console.log("math OK");',
        ].join('\n'),
      );

      // string.js — bug: wrong method
      await writeFile(
        join(dir, 'string.js'),
        'function upper(s) { return s.toLowerCase(); }\nmodule.exports = { upper };',
      );
      await writeFile(
        join(dir, 'string.test.js'),
        [
          'const { upper } = require("./string");',
          'const assert = require("assert");',
          'assert.strictEqual(upper("hello"), "HELLO");',
          'console.log("string OK");',
        ].join('\n'),
      );

      // array.js — bug: off-by-one
      await writeFile(
        join(dir, 'array.js'),
        'function first(arr) { return arr[1]; }\nmodule.exports = { first };',
      );
      await writeFile(
        join(dir, 'array.test.js'),
        [
          'const { first } = require("./array");',
          'const assert = require("assert");',
          'assert.strictEqual(first([10, 20, 30]), 10);',
          'console.log("array OK");',
        ].join('\n'),
      );

      // Combined test runner
      await writeFile(
        join(dir, 'test.js'),
        [
          'require("./math.test");',
          'require("./string.test");',
          'require("./array.test");',
          'console.log("ALL PASS");',
        ].join('\n'),
      );
      await writeFile(join(dir, 'package.json'), makePackageJson('h95', 'node test.js'));
    },
    vanillaPrompt:
      'There are 3 buggy files: math.js, string.js, array.js. Each has a corresponding test file. Fix all 3 so that "node test.js" passes. Do NOT modify the test files.',
    pluginPrompt: buildPluginPrompt(
      'fix 3 buggy modules',
      [
        'foreach file in "math string array"',
        '  run: node ${file}.test.js',
        '  if command_failed',
        '    prompt: Fix ${file}.js so ${file}.test.js passes. Do NOT modify the test file.',
        '  end',
        'end',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir, 'node test.js'),
    timeout: GATE_TIMEOUT,
  });
}

// H96: List Accumulation (let +=) Across 10 Items
// 10 data files each with a number. Read all, compute sum, write result.txt.
// Expected: PLUGIN WINS — list accumulation ensures all values captured.
async function testH96() {
  await runStandardTest('H96', 'List Accumulation 10 Items', {
    setup: async (dir) => {
      const values = [12, 7, 35, 4, 21, 18, 9, 44, 3, 27];
      for (let i = 0; i < 10; i++) {
        await writeFile(join(dir, `data${i + 1}.txt`), String(values[i]));
      }
      // Expected sum: 180
    },
    vanillaPrompt:
      'Read data1.txt through data10.txt. Each contains a number. Compute the sum of all 10 numbers and write the result to result.txt (just the number, nothing else).',
    pluginPrompt: buildPluginPrompt(
      'read 10 data files, sum them, write result',
      [
        'let values = []',
        ...Array.from({ length: 10 }, (_, i) => `let values += run "cat data${i + 1}.txt"`),
        'prompt: The collected values are: ${values}. Compute their sum and write ONLY the number to result.txt.',
      ],
      ['file_exists result.txt'],
    ),
    score: (dir) => {
      const content = safeReadSync(join(dir, 'result.txt'));
      const pass = content.includes('180');
      return { pass, detail: pass ? 'sum=180 correct' : `got: ${content.slice(0, 30)}` };
    },
    timeout: LONG_TIMEOUT,
  });
}

// H97: Foreach with Conditional Skip (if inside foreach)
// 5 files, 2 have "SKIP" marker. Only process the other 3.
// Expected: PLUGIN WINS — if-inside-foreach skips correctly.
async function testH97() {
  await runStandardTest('H97', 'Foreach with Conditional Skip', {
    setup: async (dir) => {
      // Files to process (no SKIP marker)
      await writeFile(join(dir, 'task1.txt'), 'process this: alpha');
      await writeFile(join(dir, 'task2.txt'), 'SKIP');
      await writeFile(join(dir, 'task3.txt'), 'process this: gamma');
      await writeFile(join(dir, 'task4.txt'), 'SKIP');
      await writeFile(join(dir, 'task5.txt'), 'process this: epsilon');
    },
    vanillaPrompt: [
      'There are 5 files: task1.txt through task5.txt.',
      'For each file, read it. If the content is exactly "SKIP", skip it.',
      'For non-SKIP files, create a corresponding output file (out1.txt, out2.txt, etc.) containing the text after "process this: " in UPPERCASE.',
      'Do NOT create output files for SKIP files.',
      'Finally, write summary.txt listing which tasks were processed.',
    ].join(' '),
    pluginPrompt: buildPluginPrompt(
      'process non-SKIP files only',
      [
        'foreach i in "1 2 3 4 5"',
        '  let content = run "cat task${i}.txt"',
        "  run: node -e \"process.exit(require('fs').readFileSync('task${i}.txt','utf-8').trim()==='SKIP'?1:0)\"",
        '  if command_succeeded',
        '    prompt: Read task${i}.txt which contains "${content}". Extract the text after "process this: " and write it in UPPERCASE to out${i}.txt.',
        '  end',
        'end',
        'prompt: Write summary.txt listing which task numbers were processed (had output files created).',
      ],
      ['file_exists summary.txt'],
    ),
    score: (dir) => {
      const out1 = safeReadSync(join(dir, 'out1.txt'));
      const out3 = safeReadSync(join(dir, 'out3.txt'));
      const out5 = safeReadSync(join(dir, 'out5.txt'));
      const out2 = safeReadSync(join(dir, 'out2.txt'));
      const out4 = safeReadSync(join(dir, 'out4.txt'));

      let score = 0;
      if (out1.toUpperCase().includes('ALPHA')) score++;
      if (out3.toUpperCase().includes('GAMMA')) score++;
      if (out5.toUpperCase().includes('EPSILON')) score++;
      // Bonus: skip files should NOT have output
      if (!out2) score++;
      if (!out4) score++;

      return { pass: score >= 3, detail: `${score}/5 criteria met` };
    },
    timeout: LONG_TIMEOUT,
  });
}

// H98: Dynamic Foreach from let-run Output
// A script outputs space-separated filenames. Plugin uses let+foreach dynamically.
// Expected: PLUGIN WINS — dynamic list from command output.
async function testH98() {
  await runStandardTest('H98', 'Dynamic Foreach from let-run', {
    setup: async (dir) => {
      // Script that outputs file list
      await writeFile(join(dir, 'list-files.js'), 'console.log("file1.js file2.js file3.js");');
      // Template files to process
      await writeFile(join(dir, 'file1.js'), 'module.exports = "hello";');
      await writeFile(join(dir, 'file2.js'), 'module.exports = "world";');
      await writeFile(join(dir, 'file3.js'), 'module.exports = "test";');
    },
    vanillaPrompt: [
      'Run "node list-files.js" to get a list of files.',
      'For each file in the output, read it and create a corresponding .out file',
      '(e.g., file1.js.out) containing the exported string value in UPPERCASE.',
    ].join(' '),
    pluginPrompt: buildPluginPrompt(
      'process dynamically listed files',
      [
        'let files = run "node list-files.js"',
        'foreach f in "${files}"',
        '  let val = run "node -e \\"console.log(require(\'./${f}\'))\\"',
        '  prompt: Write ${f}.out containing the value "${val}" converted to UPPERCASE.',
        'end',
      ],
      ['file_exists file3.js.out'],
    ),
    score: (dir) => {
      let count = 0;
      const expected = ['HELLO', 'WORLD', 'TEST'];
      for (let i = 0; i < 3; i++) {
        const content = safeReadSync(join(dir, `file${i + 1}.js.out`));
        if (content.toUpperCase().includes(expected[i])) count++;
      }
      return { pass: count >= 2, detail: `${count}/3 files processed` };
    },
    timeout: LONG_TIMEOUT,
  });
}

// H99: Foreach over JSON Array
// config.json contains a JSON array. splitIterable parses it.
// Expected: PLUGIN WINS — JSON array splitting via splitIterable.
async function testH99() {
  await runStandardTest('H99', 'Foreach over JSON Array', {
    setup: async (dir) => {
      await writeFile(join(dir, 'config.json'), '["alpha","beta","gamma"]');
    },
    vanillaPrompt:
      'Read config.json which contains a JSON array of strings. For each string in the array, create a file named <string>.txt containing "processed: <string>". So alpha.txt should contain "processed: alpha", etc.',
    pluginPrompt: buildPluginPrompt(
      'create files from JSON array',
      [
        'let items = run "cat config.json"',
        'foreach item in "${items}"',
        '  prompt: Create a file named ${item}.txt with the content "processed: ${item}"',
        'end',
      ],
      ['file_exists gamma.txt'],
    ),
    score: (dir) => {
      let count = 0;
      for (const name of ['alpha', 'beta', 'gamma']) {
        const content = safeReadSync(join(dir, `${name}.txt`));
        if (content.includes(`processed: ${name}`) || content.includes(name)) count++;
      }
      return { pass: count >= 2, detail: `${count}/3 files created` };
    },
    timeout: LONG_TIMEOUT,
  });
}

// H100: Foreach with _length Auto-Variable
// Accumulate items, use ${items_length} to write summary with count.
// Expected: PLUGIN WINS — auto-variable provides accurate count.
async function testH100() {
  await runStandardTest('H100', 'Foreach with _length', {
    setup: async (dir) => {
      for (let i = 1; i <= 5; i++) {
        await writeFile(join(dir, `item${i}.txt`), `content of item ${i}`);
      }
    },
    vanillaPrompt:
      'Read item1.txt through item5.txt. Count how many files you read. Write summary.txt with the line "total: N" where N is the count, and list each filename you read.',
    pluginPrompt: buildPluginPrompt(
      'collect items and report count',
      [
        'let items = []',
        ...Array.from({ length: 5 }, (_, i) => `let items += run "cat item${i + 1}.txt"`),
        'prompt: Write summary.txt with "total: ${items_length}" on the first line, then list the items: ${items}',
      ],
      ['file_exists summary.txt'],
    ),
    score: (dir) => {
      const content = safeReadSync(join(dir, 'summary.txt'));
      const hasCount = content.includes('5');
      return {
        pass: hasCount && content.length > 0,
        detail: hasCount ? 'count=5 found' : `content: ${content.slice(0, 40)}`,
      };
    },
    timeout: DEFAULT_TIMEOUT,
  });
}

// H101: Empty List Handling
// Empty list edge case: ${items_length} should be 0, foreach over empty should skip.
// Expected: TIE — both approaches should handle emptiness.
async function testH101() {
  await runStandardTest('H101', 'Empty List Handling', {
    setup: async (dir) => {
      // No data files — just a package.json for the empty scenario
      await writeFile(join(dir, 'package.json'), makePackageJson('h101'));
    },
    vanillaPrompt: 'Create result.txt containing the text "empty: 0". That is all.',
    pluginPrompt: buildPluginPrompt(
      'handle empty list',
      [
        'let items = []',
        'foreach item in "${items}"',
        '  prompt: This should never execute — process ${item}.',
        'end',
        'prompt: Write result.txt containing "empty: ${items_length}"',
      ],
      ['file_exists result.txt'],
    ),
    score: (dir) => {
      const content = safeReadSync(join(dir, 'result.txt'));
      const pass = content.includes('empty: 0') || content.includes('empty:0');
      return { pass, detail: pass ? 'empty: 0 correct' : `got: ${content.slice(0, 40)}` };
    },
    timeout: DEFAULT_TIMEOUT,
  });
}

// H102: Foreach + let-prompt Capture Per Item
// 3 code files, each gets reviewed via let-prompt, reviews accumulated.
// Expected: PLUGIN WINS — structured per-item capture via let-prompt.
async function testH102() {
  await runStandardTest('H102', 'Foreach + let-prompt per Item', {
    setup: async (dir) => {
      await writeFile(
        join(dir, 'auth.js'),
        [
          'function login(user, pass) {',
          '  if (pass === "admin") return true;',
          '  return false;',
          '}',
          'module.exports = { login };',
        ].join('\n'),
      );
      await writeFile(
        join(dir, 'db.js'),
        ['function query(sql) {', '  return eval(sql);', '}', 'module.exports = { query };'].join(
          '\n',
        ),
      );
      await writeFile(
        join(dir, 'api.js'),
        [
          'function handleRequest(req) {',
          '  const data = JSON.parse(req.body);',
          '  return { status: 200, data };',
          '}',
          'module.exports = { handleRequest };',
        ].join('\n'),
      );
    },
    vanillaPrompt:
      'Review auth.js, db.js, and api.js for security issues. For each file, note the issues found. Write reviews.md with a section for each file and its security concerns.',
    pluginPrompt: buildPluginPrompt(
      'review 3 files for security',
      [
        'let reviews = []',
        'foreach file in "auth.js db.js api.js"',
        '  let code = run "cat ${file}"',
        '  let reviews += "${file}: see review"',
        '  prompt: Review ${file} for security issues. The code is: ${code}',
        'end',
        'prompt: Write reviews.md with a security review section for each file: ${reviews}. Include specific vulnerability names.',
      ],
      ['file_exists reviews.md'],
    ),
    score: (dir) => {
      const content = safeReadSync(join(dir, 'reviews.md'));
      if (!content) return { pass: false, detail: 'no reviews.md' };
      let count = 0;
      if (content.includes('auth')) count++;
      if (
        content.includes('db') ||
        content.includes('query') ||
        content.includes('sql') ||
        content.includes('eval')
      )
        count++;
      if (content.includes('api') || content.includes('parse') || content.includes('JSON')) count++;
      return { pass: count >= 2, detail: `${count}/3 files reviewed` };
    },
    timeout: LONG_TIMEOUT,
  });
}

// H103: List as Error Accumulator Across Retries
// Flaky app.js needs fixing. Errors accumulate across retry iterations.
// Expected: PLUGIN WINS — accumulated error context helps diagnosis.
async function testH103() {
  await runStandardTest('H103', 'List as Error Accumulator', {
    setup: async (dir) => {
      // app.js has a bug: references undefined variable
      await writeFile(
        join(dir, 'app.js'),
        ['const config = require("./config");', 'console.log(config.port);'].join('\n'),
      );
      // config.js is missing the port field
      await writeFile(join(dir, 'config.js'), 'module.exports = {};');
      await writeFile(
        join(dir, 'test.js'),
        [
          'const assert = require("assert");',
          'const config = require("./config");',
          'assert.ok(config.port !== undefined, "port must be defined");',
          'assert.strictEqual(typeof config.port, "number", "port must be a number");',
          'console.log("PASS");',
        ].join('\n'),
      );
      await writeFile(join(dir, 'package.json'), makePackageJson('h103', 'node test.js'));
    },
    vanillaPrompt:
      'Fix the project so "npm test" passes. The test expects config.js to export a port number. Do not modify test.js.',
    pluginPrompt: buildPluginPrompt(
      'fix config so tests pass',
      [
        'let errors = []',
        'retry max 3',
        '  run: npm test',
        '  if command_failed',
        '    let errors += "${last_stderr}"',
        '    prompt: Tests failed. Error history: ${errors}. Fix the code so npm test passes. Do not modify test.js.',
        '  end',
        'end',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir, 'npm test'),
    timeout: GATE_TIMEOUT,
  });
}

// H104: Foreach 20 Items (Scale Test)
// 20 text files, each needs content uppercased and written to output file.
// Expected: PLUGIN WINS — foreach ensures all 20 items processed.
async function testH104() {
  await runStandardTest('H104', 'Foreach 20 Items Scale', {
    setup: async (dir) => {
      const words = [
        'apple',
        'banana',
        'cherry',
        'date',
        'elderberry',
        'fig',
        'grape',
        'honeydew',
        'iris',
        'jackfruit',
        'kiwi',
        'lemon',
        'mango',
        'nectarine',
        'orange',
        'papaya',
        'quince',
        'raspberry',
        'strawberry',
        'tangerine',
      ];
      for (let i = 0; i < 20; i++) {
        await writeFile(join(dir, `file${i + 1}.txt`), words[i]);
      }
    },
    vanillaPrompt: [
      'There are 20 text files: file1.txt through file20.txt.',
      'For each file, read its content, convert to UPPERCASE, and write to out1.txt through out20.txt respectively.',
      'Example: if file1.txt contains "apple", then out1.txt should contain "APPLE".',
    ].join(' '),
    pluginPrompt: buildPluginPrompt(
      'uppercase 20 files',
      [
        'foreach i in "1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20"',
        '  let val = run "cat file${i}.txt"',
        '  prompt: Write out${i}.txt containing "${val}" converted to UPPERCASE (just the single uppercase word, nothing else).',
        'end',
      ],
      ['file_exists out20.txt'],
    ),
    score: (dir) => {
      const words = [
        'APPLE',
        'BANANA',
        'CHERRY',
        'DATE',
        'ELDERBERRY',
        'FIG',
        'GRAPE',
        'HONEYDEW',
        'IRIS',
        'JACKFRUIT',
        'KIWI',
        'LEMON',
        'MANGO',
        'NECTARINE',
        'ORANGE',
        'PAPAYA',
        'QUINCE',
        'RASPBERRY',
        'STRAWBERRY',
        'TANGERINE',
      ];
      let count = 0;
      for (let i = 0; i < 20; i++) {
        const content = safeReadSync(join(dir, `out${i + 1}.txt`));
        if (content.toUpperCase().includes(words[i])) count++;
      }
      return { pass: count >= 15, detail: `${count}/20 files uppercased` };
    },
    timeout: LONG_HORIZON_TIMEOUT,
  });
}

// ── Category 6: Long-Horizon Variable Persistence (H105-H114) ───────

// H105: 30-Step Token Recall
// Random token stored in variable, 30 filler prompts, then recall.
// Expected: PLUGIN WINS — variable preserves token across many steps.
async function testH105() {
  await runStandardTest('H105', '30-Step Token Recall', {
    setup: async (dir) => {
      const token = createHash('md5').update(String(Date.now())).digest('hex').slice(0, 8);
      await writeFile(join(dir, 'token.txt'), token);
      for (let i = 1; i <= 30; i++) {
        await writeFile(
          join(dir, `step${i}.txt`),
          `Step ${i}: This is filler content number ${i}. The quick brown fox jumped over the lazy dog.`,
        );
      }
    },
    vanillaPrompt: [
      'Read token.txt to get an 8-character hex token. Remember it exactly.',
      ...Array.from(
        { length: 30 },
        (_, i) => `Then read step${i + 1}.txt and briefly note its content.`,
      ),
      'Finally, write answer.txt containing ONLY the exact 8-character token from token.txt. Nothing else.',
    ].join(' '),
    pluginPrompt: buildPluginPrompt(
      'preserve token across 30 steps',
      [
        'let token = run "cat token.txt"',
        ...Array.from(
          { length: 30 },
          (_, i) => `prompt: Read step${i + 1}.txt and summarize it briefly.`,
        ),
        'prompt: Write answer.txt containing exactly this and nothing else: ${token}',
      ],
      ['file_exists answer.txt'],
    ),
    score: (dir) => {
      const expected = safeReadSync(join(dir, 'token.txt'));
      const actual = safeReadSync(join(dir, 'answer.txt'));
      const match = actual.includes(expected);
      return {
        pass: match,
        detail: match ? 'token matches' : `expected ${expected}, got "${actual.slice(0, 30)}"`,
      };
    },
    timeout: LONG_HORIZON_TIMEOUT,
  });
}

// H106: 40-Step Token Recall
// Same as H105 but with 40 filler steps — further degradation test.
// Expected: PLUGIN WINS — variable immune to horizon length.
async function testH106() {
  await runStandardTest('H106', '40-Step Token Recall', {
    setup: async (dir) => {
      const token = createHash('md5')
        .update(String(Date.now()) + 'h106')
        .digest('hex')
        .slice(0, 8);
      await writeFile(join(dir, 'token.txt'), token);
      for (let i = 1; i <= 40; i++) {
        await writeFile(
          join(dir, `step${i}.txt`),
          `Step ${i}: Filler paragraph ${i}. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`,
        );
      }
    },
    vanillaPrompt: [
      'Read token.txt to get an 8-character hex token. Remember it exactly.',
      ...Array.from({ length: 40 }, (_, i) => `Then read step${i + 1}.txt and note its content.`),
      'Finally, write answer.txt containing ONLY the exact 8-character token from token.txt.',
    ].join(' '),
    pluginPrompt: buildPluginPrompt(
      'preserve token across 40 steps',
      [
        'let token = run "cat token.txt"',
        ...Array.from(
          { length: 40 },
          (_, i) => `prompt: Read step${i + 1}.txt and briefly summarize.`,
        ),
        'prompt: Write answer.txt containing exactly: ${token}',
      ],
      ['file_exists answer.txt'],
    ),
    score: (dir) => {
      const expected = safeReadSync(join(dir, 'token.txt'));
      const actual = safeReadSync(join(dir, 'answer.txt'));
      const match = actual.includes(expected);
      return {
        pass: match,
        detail: match ? 'token matches' : `expected ${expected}, got "${actual.slice(0, 30)}"`,
      };
    },
    timeout: LONG_HORIZON_TIMEOUT,
  });
}

// H107: 15-Step with Semantically Confusing Distractors
// Hex token with similar-looking decoy values to create interference.
// Expected: PLUGIN WINS — variable is immune to semantic confusion.
async function testH107() {
  await runStandardTest('H107', '15-Step Semantic Distractors', {
    setup: async (dir) => {
      const token = 'a3f2b7c1';
      await writeFile(join(dir, 'token.txt'), token);
      // Distractors — similar looking hex values
      const distractors = [
        'a3f9b7c1',
        'b3f2b7c1',
        'a3e2b7c1',
        'a3f2b7d1',
        'a3f2c7c1',
        'a4f2b7c1',
        'a3f2b7c2',
        'a3f3b7c1',
        'a3f2b8c1',
        'a3f2b7c0',
        'a2f2b7c1',
        'a3f1b7c1',
        'a3f2a7c1',
        'a3f2b6c1',
        'a3f2b7b1',
      ];
      for (let i = 1; i <= 15; i++) {
        await writeFile(
          join(dir, `step${i}.txt`),
          [
            `Step ${i} analysis report.`,
            `Reference code: ${distractors[i - 1]}`,
            `This value ${distractors[i - 1]} is used for step ${i} processing.`,
            `Do not confuse this with the original token.`,
          ].join('\n'),
        );
      }
    },
    vanillaPrompt: [
      'Read token.txt to get an 8-character hex token. Remember it EXACTLY — it is critical.',
      ...Array.from(
        { length: 15 },
        (_, i) =>
          `Read step${i + 1}.txt — note it contains a DIFFERENT hex code that is NOT the token.`,
      ),
      'Write answer.txt containing ONLY the exact original token from token.txt. Be very careful — the step files contain similar but different values.',
    ].join(' '),
    pluginPrompt: buildPluginPrompt(
      'recall exact token despite distractors',
      [
        'let token = run "cat token.txt"',
        ...Array.from(
          { length: 15 },
          (_, i) =>
            `prompt: Read step${i + 1}.txt and note its reference code is different from our token.`,
        ),
        'prompt: Write answer.txt containing exactly: ${token}',
      ],
      ['file_exists answer.txt'],
    ),
    score: (dir) => {
      const expected = safeReadSync(join(dir, 'token.txt'));
      const actual = safeReadSync(join(dir, 'answer.txt'));
      const match = actual.includes(expected);
      return {
        pass: match,
        detail: match
          ? 'exact token preserved'
          : `expected ${expected}, got "${actual.slice(0, 30)}"`,
      };
    },
    timeout: LONG_HORIZON_TIMEOUT,
  });
}

// H108: Variable Needed at 3 Distant Points
// Token recalled at steps 5, 15, and 25 — written to 3 check files.
// Expected: PLUGIN WINS — variable available at all 3 points.
async function testH108() {
  await runStandardTest('H108', 'Variable at 3 Distant Points', {
    setup: async (dir) => {
      const token = createHash('md5')
        .update(String(Date.now()) + 'h108')
        .digest('hex')
        .slice(0, 8);
      await writeFile(join(dir, 'token.txt'), token);
      for (let i = 1; i <= 25; i++) {
        await writeFile(
          join(dir, `step${i}.txt`),
          `Filler step ${i}: process data chunk ${i} of 25.`,
        );
      }
    },
    vanillaPrompt: [
      'Read token.txt to get an 8-character hex token.',
      ...Array.from({ length: 25 }, (_, i) => {
        const n = i + 1;
        if (n === 5)
          return `Read step${n}.txt, then write check1.txt containing ONLY the exact token from token.txt.`;
        if (n === 15)
          return `Read step${n}.txt, then write check2.txt containing ONLY the exact token from token.txt.`;
        if (n === 25)
          return `Read step${n}.txt, then write check3.txt containing ONLY the exact token from token.txt.`;
        return `Read step${n}.txt and note its content.`;
      }),
    ].join(' '),
    pluginPrompt: buildPluginPrompt(
      'use token at 3 distant points',
      [
        'let token = run "cat token.txt"',
        ...Array.from({ length: 25 }, (_, i) => {
          const n = i + 1;
          if (n === 5)
            return `prompt: Read step${n}.txt. Then write check1.txt containing exactly: \${token}`;
          if (n === 15)
            return `prompt: Read step${n}.txt. Then write check2.txt containing exactly: \${token}`;
          if (n === 25)
            return `prompt: Read step${n}.txt. Then write check3.txt containing exactly: \${token}`;
          return `prompt: Read step${n}.txt and briefly note its content.`;
        }),
      ],
      ['file_exists check3.txt'],
    ),
    score: (dir) => {
      const expected = safeReadSync(join(dir, 'token.txt'));
      let matches = 0;
      for (let i = 1; i <= 3; i++) {
        const content = safeReadSync(join(dir, `check${i}.txt`));
        if (content.includes(expected)) matches++;
      }
      return { pass: matches >= 2, detail: `${matches}/3 checkpoints match` };
    },
    timeout: LONG_HORIZON_TIMEOUT,
  });
}

// H109: Two Variables: One Early, One Late
// Token A set at step 1, Token B at step 10. Both recalled at step 20.
// Expected: PLUGIN WINS — both variables persist regardless of when set.
async function testH109() {
  await runStandardTest('H109', 'Two Variables Early+Late', {
    setup: async (dir) => {
      const tokenA = createHash('md5')
        .update(String(Date.now()) + 'A')
        .digest('hex')
        .slice(0, 8);
      const tokenB = createHash('md5')
        .update(String(Date.now()) + 'B')
        .digest('hex')
        .slice(0, 8);
      await writeFile(join(dir, 'tokenA.txt'), tokenA);
      await writeFile(join(dir, 'tokenB.txt'), tokenB);
      for (let i = 1; i <= 20; i++) {
        await writeFile(
          join(dir, `step${i}.txt`),
          `Processing batch ${i}. Intermediate data: x${i * 7}.`,
        );
      }
    },
    vanillaPrompt: [
      'Step 1: Read tokenA.txt to get token A (8 hex chars). Remember it exactly.',
      ...Array.from(
        { length: 8 },
        (_, i) => `Step ${i + 2}: Read step${i + 2}.txt and note its content.`,
      ),
      'Step 10: Read tokenB.txt to get token B (8 hex chars). Remember it exactly.',
      ...Array.from(
        { length: 9 },
        (_, i) => `Step ${i + 11}: Read step${i + 11}.txt and note its content.`,
      ),
      'Step 20: Write answer.txt with two lines: first line is token A, second line is token B. Nothing else.',
    ].join(' '),
    pluginPrompt: buildPluginPrompt(
      'recall two tokens set at different times',
      [
        'let tokenA = run "cat tokenA.txt"',
        ...Array.from({ length: 8 }, (_, i) => `prompt: Read step${i + 2}.txt and summarize.`),
        'let tokenB = run "cat tokenB.txt"',
        ...Array.from({ length: 9 }, (_, i) => `prompt: Read step${i + 11}.txt and summarize.`),
        'prompt: Write answer.txt with two lines. First line: ${tokenA}  Second line: ${tokenB}  Nothing else.',
      ],
      ['file_exists answer.txt'],
    ),
    score: (dir) => {
      const expectedA = safeReadSync(join(dir, 'tokenA.txt'));
      const expectedB = safeReadSync(join(dir, 'tokenB.txt'));
      const actual = safeReadSync(join(dir, 'answer.txt'));
      const hasA = actual.includes(expectedA);
      const hasB = actual.includes(expectedB);
      const both = hasA && hasB;
      return { pass: both, detail: both ? 'both tokens match' : `A:${hasA} B:${hasB}` };
    },
    timeout: LONG_HORIZON_TIMEOUT,
  });
}

// H110: Structured JSON Recall (5-field)
// Store a JSON object with 5 fields. After 10 filler steps, write it back exactly.
// Expected: PLUGIN WINS — variable preserves structured data.
async function testH110() {
  await runStandardTest('H110', 'Structured JSON Recall', {
    setup: async (dir) => {
      const data = {
        name: 'test',
        version: 3,
        enabled: true,
        tags: ['a', 'b'],
        config: { port: 8080 },
      };
      await writeFile(join(dir, 'input.json'), JSON.stringify(data));
      for (let i = 1; i <= 10; i++) {
        await writeFile(
          join(dir, `step${i}.txt`),
          `Analysis step ${i}: processing dataset partition ${i}.`,
        );
      }
    },
    vanillaPrompt: [
      'Read input.json and memorize its exact JSON content (it has 5 fields: name, version, enabled, tags, config).',
      ...Array.from({ length: 10 }, (_, i) => `Read step${i + 1}.txt and note its content.`),
      'Write output.json containing the EXACT same JSON from input.json. The JSON must be valid and contain all 5 original fields with their exact values.',
    ].join(' '),
    pluginPrompt: buildPluginPrompt(
      'recall structured JSON after 10 steps',
      [
        'let data = run "cat input.json"',
        ...Array.from(
          { length: 10 },
          (_, i) => `prompt: Read step${i + 1}.txt and summarize briefly.`,
        ),
        'prompt: Write output.json containing exactly this JSON: ${data}',
      ],
      ['file_exists output.json'],
    ),
    score: (dir) => {
      const expected = {
        name: 'test',
        version: 3,
        enabled: true,
        tags: ['a', 'b'],
        config: { port: 8080 },
      };
      try {
        const actual = JSON.parse(safeReadSync(join(dir, 'output.json')));
        const match =
          actual.name === expected.name &&
          actual.version === expected.version &&
          actual.enabled === expected.enabled &&
          JSON.stringify(actual.tags) === JSON.stringify(expected.tags) &&
          actual.config?.port === expected.config.port;
        return {
          pass: match,
          detail: match ? 'JSON deep match' : `mismatch: ${JSON.stringify(actual).slice(0, 60)}`,
        };
      } catch (e) {
        return { pass: false, detail: `invalid JSON: ${e.message}` };
      }
    },
    timeout: LONG_HORIZON_TIMEOUT,
  });
}

// H111: Numeric Precision Recall (Float)
// Store pi to 14 decimal places. After 15 filler steps, recall exactly.
// Expected: PLUGIN WINS — variable preserves exact numeric string.
async function testH111() {
  await runStandardTest('H111', 'Numeric Precision Recall', {
    setup: async (dir) => {
      const pi = '3.14159265358979';
      await writeFile(join(dir, 'value.txt'), pi);
      for (let i = 1; i <= 15; i++) {
        // Include other numbers as distractors
        const distractor = (Math.PI + i * 0.001).toFixed(14);
        await writeFile(
          join(dir, `step${i}.txt`),
          `Calculation step ${i}: intermediate result = ${distractor}`,
        );
      }
    },
    vanillaPrompt: [
      'Read value.txt to get a precise decimal number. Memorize ALL digits exactly.',
      ...Array.from(
        { length: 15 },
        (_, i) =>
          `Read step${i + 1}.txt — note it contains a DIFFERENT number, not the one from value.txt.`,
      ),
      'Write answer.txt containing ONLY the exact number from value.txt with all decimal places preserved. No rounding.',
    ].join(' '),
    pluginPrompt: buildPluginPrompt(
      'recall precise number after 15 steps',
      [
        'let pi = run "cat value.txt"',
        ...Array.from(
          { length: 15 },
          (_, i) =>
            `prompt: Read step${i + 1}.txt. Note its intermediate result is different from our stored value.`,
        ),
        'prompt: Write answer.txt containing exactly: ${pi}',
      ],
      ['file_exists answer.txt'],
    ),
    score: (dir) => {
      const expected = '3.14159265358979';
      const actual = safeReadSync(join(dir, 'answer.txt'));
      const match = actual.includes(expected);
      return {
        pass: match,
        detail: match ? 'exact pi preserved' : `expected ${expected}, got "${actual.slice(0, 30)}"`,
      };
    },
    timeout: LONG_HORIZON_TIMEOUT,
  });
}

// H112: Multi-Line Text Recall (Paragraph)
// Store a 3-line specific paragraph. After 10 filler steps, recall it.
// Expected: PLUGIN WINS — variable preserves multi-line text.
async function testH112() {
  await runStandardTest('H112', 'Multi-Line Text Recall', {
    setup: async (dir) => {
      const paragraph = [
        'The server runs on port 4567 with TLS enabled.',
        'Authentication uses HMAC-SHA256 with key rotation every 72 hours.',
        'Maximum concurrent connections: 2048 per node.',
      ].join('\n');
      await writeFile(join(dir, 'config-note.txt'), paragraph);
      for (let i = 1; i <= 10; i++) {
        await writeFile(
          join(dir, `step${i}.txt`),
          `Review item ${i}: generic filler data about system ${i}.`,
        );
      }
    },
    vanillaPrompt: [
      'Read config-note.txt carefully. It has 3 lines with specific technical values. Memorize all details.',
      ...Array.from({ length: 10 }, (_, i) => `Read step${i + 1}.txt and acknowledge.`),
      'Write answer.txt containing the EXACT text from config-note.txt — all 3 lines with the precise numbers and technical terms.',
    ].join(' '),
    pluginPrompt: buildPluginPrompt(
      'recall multi-line text after 10 steps',
      [
        'let config = run "cat config-note.txt"',
        ...Array.from(
          { length: 10 },
          (_, i) => `prompt: Read step${i + 1}.txt and briefly summarize.`,
        ),
        'prompt: Write answer.txt containing exactly this text: ${config}',
      ],
      ['file_exists answer.txt'],
    ),
    score: (dir) => {
      const actual = safeReadSync(join(dir, 'answer.txt'));
      // Check key phrases from all 3 lines
      const phrases = ['4567', 'HMAC-SHA256', '72 hours', '2048'];
      let found = 0;
      for (const phrase of phrases) {
        if (actual.includes(phrase)) found++;
      }
      return { pass: found >= 3, detail: `${found}/4 key phrases preserved` };
    },
    timeout: LONG_HORIZON_TIMEOUT,
  });
}

// H113: Variable Chain A -> B -> C Across 15 Steps
// Token A at step 1, B = A-extended at step 5, C = B-final at step 10, recall C at step 15.
// Expected: PLUGIN WINS — chained variable transformations preserved.
async function testH113() {
  await runStandardTest('H113', 'Variable Chain A-B-C', {
    setup: async (dir) => {
      const token = createHash('md5')
        .update(String(Date.now()) + 'h113')
        .digest('hex')
        .slice(0, 6);
      await writeFile(join(dir, 'seed.txt'), token);
      for (let i = 1; i <= 15; i++) {
        await writeFile(join(dir, `step${i}.txt`), `Processing stage ${i} of data pipeline.`);
      }
    },
    vanillaPrompt: [
      'Step 1: Read seed.txt to get a 6-character hex token (call it A).',
      'Step 2-4: Read step2.txt through step4.txt.',
      'Step 5: Compute B = A + "-extended" (literally concatenate with a hyphen). Write nothing yet.',
      'Step 6-9: Read step6.txt through step9.txt.',
      'Step 10: Compute C = B + "-final" (literally concatenate). Write nothing yet.',
      'Step 11-14: Read step11.txt through step14.txt.',
      'Step 15: Write answer.txt containing ONLY the value of C (which should be "<A>-extended-final").',
    ].join(' '),
    pluginPrompt: buildPluginPrompt(
      'chain variables across 15 steps',
      [
        'let A = run "cat seed.txt"',
        ...Array.from({ length: 3 }, (_, i) => `prompt: Read step${i + 2}.txt and summarize.`),
        'let B = run "echo ${A}-extended"',
        ...Array.from({ length: 4 }, (_, i) => `prompt: Read step${i + 6}.txt and summarize.`),
        'let C = run "echo ${B}-final"',
        ...Array.from({ length: 4 }, (_, i) => `prompt: Read step${i + 11}.txt and summarize.`),
        'prompt: Write answer.txt containing exactly: ${C}',
      ],
      ['file_exists answer.txt'],
    ),
    score: (dir) => {
      const seed = safeReadSync(join(dir, 'seed.txt'));
      const expected = `${seed}-extended-final`;
      const actual = safeReadSync(join(dir, 'answer.txt'));
      const match = actual.includes(expected);
      return {
        pass: match,
        detail: match ? 'chain correct' : `expected "${expected}", got "${actual.slice(0, 40)}"`,
      };
    },
    timeout: LONG_HORIZON_TIMEOUT,
  });
}

// H114: Variable Overwrite Then Recall
// Set x = "first" at step 1, overwrite x = "second" at step 10, recall at step 15.
// Expected: PLUGIN WINS — variable mutation semantics correct.
async function testH114() {
  await runStandardTest('H114', 'Variable Overwrite Then Recall', {
    setup: async (dir) => {
      await writeFile(join(dir, 'val1.txt'), 'first-value-alpha');
      await writeFile(join(dir, 'val2.txt'), 'second-value-omega');
      for (let i = 1; i <= 15; i++) {
        await writeFile(
          join(dir, `step${i}.txt`),
          `Data processing step ${i}. The word "first" appears here as a distractor.`,
        );
      }
    },
    vanillaPrompt: [
      'Step 1: Read val1.txt (contains "first-value-alpha"). Remember this as the current value.',
      ...Array.from(
        { length: 8 },
        (_, i) => `Step ${i + 2}: Read step${i + 2}.txt and note its content.`,
      ),
      'Step 10: Read val2.txt (contains "second-value-omega"). This REPLACES the previous value. Forget "first-value-alpha".',
      ...Array.from(
        { length: 4 },
        (_, i) => `Step ${i + 11}: Read step${i + 11}.txt and note its content.`,
      ),
      'Step 15: Write answer.txt containing ONLY the CURRENT value (from val2.txt, NOT val1.txt). The answer should be "second-value-omega".',
    ].join(' '),
    pluginPrompt: buildPluginPrompt(
      'test variable overwrite semantics',
      [
        'let x = run "cat val1.txt"',
        ...Array.from({ length: 8 }, (_, i) => `prompt: Read step${i + 2}.txt and summarize.`),
        'let x = run "cat val2.txt"',
        ...Array.from({ length: 4 }, (_, i) => `prompt: Read step${i + 11}.txt and summarize.`),
        'prompt: Write answer.txt containing exactly: ${x}',
      ],
      ['file_exists answer.txt'],
    ),
    score: (dir) => {
      const actual = safeReadSync(join(dir, 'answer.txt'));
      const hasSecond = actual.includes('second-value-omega');
      const hasFirst = actual.includes('first-value-alpha');
      if (hasSecond && !hasFirst) return { pass: true, detail: 'correct: second value' };
      if (hasFirst) return { pass: false, detail: 'wrong: recalled first value' };
      return { pass: false, detail: `unexpected: "${actual.slice(0, 40)}"` };
    },
    timeout: LONG_HORIZON_TIMEOUT,
  });
}

// ── Category 7: Multi-File & Real-World Tasks (H115-H124) ───────────

async function testH115() {
  // Monorepo 3-Package Shared Dependency
  // packages/core has a bug (wrong concat order in formatName).
  // api and cli depend on core. Root test runs all 3 package tests.
  const coreIndex = [
    '// packages/core/index.js',
    'function formatName(first, last) {',
    '  return last + " " + first;  // BUG: wrong order',
    '}',
    'module.exports = { formatName };',
  ].join('\n');

  const coreTest = [
    'const { formatName } = require("./index.js");',
    'let f = 0;',
    'if (formatName("John", "Doe") !== "John Doe") {',
    '  console.error("FAIL: formatName got " + formatName("John", "Doe"));',
    '  f++;',
    '}',
    'if (formatName("Jane", "Smith") !== "Jane Smith") {',
    '  console.error("FAIL: formatName got " + formatName("Jane", "Smith"));',
    '  f++;',
    '}',
    'if (f === 0) console.log("core: All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  const apiIndex = [
    'const { formatName } = require("../core/index.js");',
    '',
    'function getGreeting(first, last) {',
    '  return "Hello, " + formatName(first, last) + "!";',
    '}',
    'module.exports = { getGreeting };',
  ].join('\n');

  const apiTest = [
    'const { getGreeting } = require("./index.js");',
    'let f = 0;',
    'if (getGreeting("John", "Doe") !== "Hello, John Doe!") {',
    '  console.error("FAIL: getGreeting got " + getGreeting("John", "Doe"));',
    '  f++;',
    '}',
    'if (f === 0) console.log("api: All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  const cliIndex = [
    'const { formatName } = require("../core/index.js");',
    '',
    'function cliOutput(first, last) {',
    '  return "User: " + formatName(first, last);',
    '}',
    'module.exports = { cliOutput };',
  ].join('\n');

  const cliTest = [
    'const { cliOutput } = require("./index.js");',
    'let f = 0;',
    'if (cliOutput("Alice", "Brown") !== "User: Alice Brown") {',
    '  console.error("FAIL: cliOutput got " + cliOutput("Alice", "Brown"));',
    '  f++;',
    '}',
    'if (f === 0) console.log("cli: All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  const rootTest = [
    'const { execSync } = require("child_process");',
    'let fails = 0;',
    'const tests = [',
    '  "packages/core/test.js",',
    '  "packages/api/test.js",',
    '  "packages/cli/test.js",',
    '];',
    'for (const t of tests) {',
    '  try {',
    '    execSync("node " + t, { encoding: "utf-8", stdio: "pipe" });',
    '    console.log("PASS: " + t);',
    '  } catch (e) {',
    '    console.error("FAIL: " + t);',
    '    if (e.stderr) console.error(e.stderr);',
    '    fails++;',
    '  }',
    '}',
    'if (fails === 0) console.log("All tests passed");',
    'process.exit(fails > 0 ? 1 : 0);',
  ].join('\n');

  await runStandardTest('H115', 'Monorepo Shared Dependency', {
    setup: async (dir) => {
      await mkdir(join(dir, 'packages', 'core'), { recursive: true });
      await mkdir(join(dir, 'packages', 'api'), { recursive: true });
      await mkdir(join(dir, 'packages', 'cli'), { recursive: true });
      await writeFile(join(dir, 'packages', 'core', 'index.js'), coreIndex);
      await writeFile(join(dir, 'packages', 'core', 'test.js'), coreTest);
      await writeFile(join(dir, 'packages', 'api', 'index.js'), apiIndex);
      await writeFile(join(dir, 'packages', 'api', 'test.js'), apiTest);
      await writeFile(join(dir, 'packages', 'cli', 'index.js'), cliIndex);
      await writeFile(join(dir, 'packages', 'cli', 'test.js'), cliTest);
      await writeFile(join(dir, 'test.js'), rootTest);
      await writeFile(join(dir, 'package.json'), makePackageJson('h115'));
    },
    vanillaPrompt:
      'Fix the bug in this monorepo. There are 3 packages under packages/ (core, api, cli). ' +
      'The core package has a bug that affects all downstream packages. Run npm test to verify.',
    pluginPrompt: buildPluginPrompt(
      'fix the shared dependency bug in the monorepo',
      [
        'prompt: Find and fix the bug in packages/core/index.js that breaks api and cli packages',
        'run: npm test',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH116() {
  // Database Migration + Seed Verification
  // migration.js reads schema.json and data.json, creates db.json.
  // Bug: wrong field mapping in migration.
  const schemaJson = JSON.stringify({
    table: 'users',
    columns: ['id', 'name', 'email'],
  });

  const dataJson = JSON.stringify({
    rows: [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
    ],
  });

  const migrationJs = [
    'const fs = require("fs");',
    'const schema = JSON.parse(fs.readFileSync("schema.json", "utf-8"));',
    'const data = JSON.parse(fs.readFileSync("data.json", "utf-8"));',
    '',
    'const db = {',
    '  table: schema.table,',
    '  records: data.rows.map(row => ({',
    '    id: row.id,',
    '    name: row.email,   // BUG: swapped name and email',
    '    email: row.name,   // BUG: swapped',
    '  }))',
    '};',
    '',
    'fs.writeFileSync("db.json", JSON.stringify(db, null, 2));',
    'console.log("Migration complete: " + db.records.length + " records");',
  ].join('\n');

  const testJs = [
    'const fs = require("fs");',
    '',
    '// Run migration first',
    'require("./migration.js");',
    '',
    'const db = JSON.parse(fs.readFileSync("db.json", "utf-8"));',
    'let f = 0;',
    '',
    'if (db.table !== "users") { console.error("FAIL: wrong table name"); f++; }',
    'if (!Array.isArray(db.records)) { console.error("FAIL: records not array"); f++; process.exit(1); }',
    'if (db.records.length !== 2) { console.error("FAIL: expected 2 records, got " + db.records.length); f++; }',
    '',
    'const alice = db.records.find(r => r.id === 1);',
    'if (!alice) { console.error("FAIL: Alice not found"); f++; }',
    'else {',
    '  if (alice.name !== "Alice") { console.error("FAIL: alice.name = " + alice.name); f++; }',
    '  if (alice.email !== "alice@example.com") { console.error("FAIL: alice.email = " + alice.email); f++; }',
    '}',
    '',
    'const bob = db.records.find(r => r.id === 2);',
    'if (!bob) { console.error("FAIL: Bob not found"); f++; }',
    'else {',
    '  if (bob.name !== "Bob") { console.error("FAIL: bob.name = " + bob.name); f++; }',
    '  if (bob.email !== "bob@example.com") { console.error("FAIL: bob.email = " + bob.email); f++; }',
    '}',
    '',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  await runStandardTest('H116', 'Database Migration+Seed', {
    setup: async (dir) => {
      await writeFile(join(dir, 'schema.json'), schemaJson);
      await writeFile(join(dir, 'data.json'), dataJson);
      await writeFile(join(dir, 'migration.js'), migrationJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h116'));
    },
    vanillaPrompt:
      'Fix migration.js so that the database records have the correct field mappings. ' +
      'Run npm test to verify the migration produces correct output.',
    pluginPrompt: buildPluginPrompt(
      'fix the database migration field mapping bug',
      [
        'prompt: Fix migration.js so name and email fields are correctly mapped from data.json',
        'run: npm test',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH117() {
  // Express API Endpoint + Integration Test
  // Simple HTTP server using raw Node.js http module. Bug in response.
  const serverJs = [
    'const http = require("http");',
    '',
    'const server = http.createServer((req, res) => {',
    '  if (req.url === "/api/status" && req.method === "GET") {',
    '    res.writeHead(200, { "Content-Type": "application/json" });',
    '    res.end(JSON.stringify({ status: "error" }));  // BUG: should be "ok"',
    '  } else if (req.url === "/api/echo" && req.method === "POST") {',
    '    let body = "";',
    '    req.on("data", chunk => body += chunk);',
    '    req.on("end", () => {',
    '      res.writeHead(200, { "Content-Type": "application/json" });',
    '      res.end(JSON.stringify({ echo: body, length: body.length }));',
    '    });',
    '  } else {',
    '    res.writeHead(404);',
    '    res.end("Not Found");',
    '  }',
    '});',
    '',
    'const port = process.env.TEST_PORT || 0;',
    'server.listen(port, () => {',
    '  const addr = server.address();',
    '  console.log("LISTENING:" + addr.port);',
    '});',
    '',
    'module.exports = server;',
  ].join('\n');

  const testJs = [
    'const http = require("http");',
    'const { spawn } = require("child_process");',
    '',
    'async function request(port, method, path, body) {',
    '  return new Promise((resolve, reject) => {',
    '    const req = http.request({ hostname: "127.0.0.1", port, method, path }, (res) => {',
    '      let data = "";',
    '      res.on("data", chunk => data += chunk);',
    '      res.on("end", () => resolve({ status: res.statusCode, body: data }));',
    '    });',
    '    req.on("error", reject);',
    '    if (body) req.write(body);',
    '    req.end();',
    '  });',
    '}',
    '',
    'async function main() {',
    '  const child = spawn("node", ["server.js"], { stdio: ["pipe", "pipe", "pipe"] });',
    '  let port;',
    '  await new Promise((resolve) => {',
    '    child.stdout.on("data", (data) => {',
    '      const match = data.toString().match(/LISTENING:(\\d+)/);',
    '      if (match) { port = parseInt(match[1], 10); resolve(); }',
    '    });',
    '  });',
    '',
    '  let f = 0;',
    '  try {',
    '    // Test /api/status',
    '    const status = await request(port, "GET", "/api/status");',
    '    const statusBody = JSON.parse(status.body);',
    '    if (statusBody.status !== "ok") {',
    '      console.error("FAIL: /api/status returned " + JSON.stringify(statusBody));',
    '      f++;',
    '    }',
    '',
    '    // Test /api/echo',
    '    const echo = await request(port, "POST", "/api/echo", "hello");',
    '    const echoBody = JSON.parse(echo.body);',
    '    if (echoBody.echo !== "hello") {',
    '      console.error("FAIL: /api/echo returned " + JSON.stringify(echoBody));',
    '      f++;',
    '    }',
    '    if (echoBody.length !== 5) {',
    '      console.error("FAIL: echo length = " + echoBody.length);',
    '      f++;',
    '    }',
    '',
    '    // Test 404',
    '    const notFound = await request(port, "GET", "/nonexistent");',
    '    if (notFound.status !== 404) {',
    '      console.error("FAIL: expected 404, got " + notFound.status);',
    '      f++;',
    '    }',
    '  } finally {',
    '    child.kill();',
    '  }',
    '',
    '  if (f === 0) console.log("All tests passed");',
    '  process.exit(f > 0 ? 1 : 0);',
    '}',
    '',
    'main().catch(e => { console.error(e); process.exit(1); });',
  ].join('\n');

  await runStandardTest('H117', 'Express API Endpoint', {
    setup: async (dir) => {
      await writeFile(join(dir, 'server.js'), serverJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h117'));
    },
    vanillaPrompt:
      'Fix server.js so all integration tests pass. The /api/status endpoint should return {"status":"ok"}. Run npm test to verify.',
    pluginPrompt: buildPluginPrompt(
      'fix the HTTP server bug in server.js',
      [
        'prompt: Fix server.js so /api/status returns {"status":"ok"} instead of {"status":"error"}',
        'run: npm test',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH118() {
  // Config File Generation (3 Formats)
  // No bugs to fix, just generation. Score: all 3 files exist with correct content.
  const templateJs = [
    '// template.js — config template',
    'module.exports = {',
    '  appName: "my-service",',
    '  port: 3000,',
    '  dbHost: "localhost",',
    '  dbPort: 5432,',
    '  dbName: "mydb",',
    '  logLevel: "info",',
    '};',
  ].join('\n');

  const testJs = [
    'const fs = require("fs");',
    'let f = 0;',
    '',
    '// Check config.json',
    'if (!fs.existsSync("config.json")) { console.error("FAIL: config.json missing"); f++; }',
    'else {',
    '  const json = JSON.parse(fs.readFileSync("config.json", "utf-8"));',
    '  if (json.appName !== "my-service") { console.error("FAIL: json appName"); f++; }',
    '  if (json.port !== 3000) { console.error("FAIL: json port"); f++; }',
    '  if (json.dbHost !== "localhost") { console.error("FAIL: json dbHost"); f++; }',
    '}',
    '',
    '// Check config.yaml (as text)',
    'if (!fs.existsSync("config.yaml")) { console.error("FAIL: config.yaml missing"); f++; }',
    'else {',
    '  const yaml = fs.readFileSync("config.yaml", "utf-8");',
    '  if (!yaml.includes("appName")) { console.error("FAIL: yaml missing appName"); f++; }',
    '  if (!yaml.includes("3000")) { console.error("FAIL: yaml missing port"); f++; }',
    '  if (!yaml.includes("localhost")) { console.error("FAIL: yaml missing dbHost"); f++; }',
    '}',
    '',
    '// Check config.env',
    'if (!fs.existsSync("config.env")) { console.error("FAIL: config.env missing"); f++; }',
    'else {',
    '  const env = fs.readFileSync("config.env", "utf-8");',
    '  if (!env.includes("APP_NAME=my-service") && !env.includes("APPNAME=my-service") && !env.includes("app_name=my-service")) {',
    '    console.error("FAIL: env missing app name"); f++;',
    '  }',
    '  if (!env.includes("3000")) { console.error("FAIL: env missing port"); f++; }',
    '  if (!env.includes("localhost")) { console.error("FAIL: env missing dbHost"); f++; }',
    '}',
    '',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  await runStandardTest('H118', 'Config File Generation', {
    setup: async (dir) => {
      await writeFile(join(dir, 'template.js'), templateJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h118'));
    },
    vanillaPrompt:
      'Read template.js and generate three config files from its values: config.json (JSON format), ' +
      'config.yaml (YAML text format), and config.env (KEY=value format with uppercase snake_case keys). ' +
      'Run npm test to verify all files are correct.',
    pluginPrompt: buildPluginPrompt(
      'generate config files from template',
      [
        'prompt: Read template.js, generate config.json (JSON), config.yaml (YAML text), and config.env (KEY=value uppercase snake_case)',
        'run: npm test',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: DEFAULT_TIMEOUT,
  });
}

async function testH119() {
  // Cross-File Rename (5 Files)
  // Rename function processData to transformData across 5 files.
  const utilsJs = [
    'function processData(input) {',
    '  return input.map(x => x * 2);',
    '}',
    'module.exports = { processData };',
  ].join('\n');

  const handlerJs = [
    'const { processData } = require("./utils.js");',
    '',
    'function handleRequest(data) {',
    '  const result = processData(data);',
    '  return { success: true, result };',
    '}',
    'module.exports = { handleRequest };',
  ].join('\n');

  const serviceJs = [
    'const { processData } = require("./utils.js");',
    '',
    'function runService(items) {',
    '  console.log("Processing...");',
    '  return processData(items);',
    '}',
    'module.exports = { runService };',
  ].join('\n');

  const indexJs = [
    'const { handleRequest } = require("./handler.js");',
    'const { runService } = require("./service.js");',
    'const { processData } = require("./utils.js");',
    '',
    'module.exports = { handleRequest, runService, processData };',
  ].join('\n');

  const readmeJs = [
    '// Documentation helper',
    '// The main function is processData which transforms input arrays.',
    'const { processData } = require("./utils.js");',
    'console.log("processData([1,2,3]) =", processData([1, 2, 3]));',
  ].join('\n');

  const testJs = [
    'const fs = require("fs");',
    'let f = 0;',
    '',
    '// Check that transformData exists and processData is gone',
    'const files = ["utils.js", "handler.js", "service.js", "index.js", "readme.js"];',
    'for (const file of files) {',
    '  const content = fs.readFileSync(file, "utf-8");',
    '  if (content.includes("processData")) {',
    '    console.error("FAIL: " + file + " still contains processData");',
    '    f++;',
    '  }',
    '  if (!content.includes("transformData")) {',
    '    console.error("FAIL: " + file + " missing transformData");',
    '    f++;',
    '  }',
    '}',
    '',
    '// Verify functionality still works',
    'const { transformData } = require("./utils.js");',
    'const result = transformData([1, 2, 3]);',
    'if (JSON.stringify(result) !== "[2,4,6]") {',
    '  console.error("FAIL: transformData([1,2,3]) = " + JSON.stringify(result));',
    '  f++;',
    '}',
    '',
    '// Verify handler still works',
    'const { handleRequest } = require("./handler.js");',
    'const hr = handleRequest([5]);',
    'if (!hr.success || JSON.stringify(hr.result) !== "[10]") {',
    '  console.error("FAIL: handleRequest broken");',
    '  f++;',
    '}',
    '',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  await runStandardTest('H119', 'Cross-File Rename', {
    setup: async (dir) => {
      await writeFile(join(dir, 'utils.js'), utilsJs);
      await writeFile(join(dir, 'handler.js'), handlerJs);
      await writeFile(join(dir, 'service.js'), serviceJs);
      await writeFile(join(dir, 'index.js'), indexJs);
      await writeFile(join(dir, 'readme.js'), readmeJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h119'));
    },
    vanillaPrompt:
      'Rename the function "processData" to "transformData" across all 5 JS files (utils.js, handler.js, ' +
      'service.js, index.js, readme.js). Update all imports, exports, and usages. Run npm test to verify.',
    pluginPrompt: buildPluginPrompt(
      'rename processData to transformData across all files',
      [
        'prompt: Rename processData to transformData in utils.js, handler.js, service.js, index.js, readme.js. Update all imports/exports/usages.',
        'run: npm test',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: DEFAULT_TIMEOUT,
  });
}

async function testH120() {
  // TDD Two-Phase Gate
  // test.js tests a function that doesn't exist yet.
  // Task: implement the function in app.js to make tests pass.
  const testJs = [
    'const { parseCsv } = require("./app.js");',
    'let f = 0;',
    '',
    '// Test basic parsing',
    'const r1 = parseCsv("name,age\\nAlice,30\\nBob,25");',
    'if (r1.length !== 2) { console.error("FAIL: expected 2 rows, got " + r1.length); f++; }',
    'else {',
    '  if (r1[0].name !== "Alice") { console.error("FAIL: r1[0].name = " + r1[0].name); f++; }',
    '  if (r1[0].age !== "30") { console.error("FAIL: r1[0].age = " + r1[0].age); f++; }',
    '  if (r1[1].name !== "Bob") { console.error("FAIL: r1[1].name = " + r1[1].name); f++; }',
    '  if (r1[1].age !== "25") { console.error("FAIL: r1[1].age = " + r1[1].age); f++; }',
    '}',
    '',
    '// Test empty input',
    'const r2 = parseCsv("");',
    'if (!Array.isArray(r2) || r2.length !== 0) { console.error("FAIL: empty input should return []"); f++; }',
    '',
    '// Test single row',
    'const r3 = parseCsv("x,y\\n1,2");',
    'if (r3.length !== 1) { console.error("FAIL: single row length"); f++; }',
    'if (r3[0] && r3[0].x !== "1") { console.error("FAIL: r3[0].x = " + r3[0].x); f++; }',
    '',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  // Start with an empty app.js (function doesn't exist yet)
  const appJs = ['// app.js — implement parseCsv here', 'module.exports = {};'].join('\n');

  await runStandardTest('H120', 'TDD Two-Phase Gate', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h120'));
    },
    vanillaPrompt:
      'Implement the parseCsv function in app.js. The tests in test.js define the expected behavior: ' +
      'parse a CSV string into an array of objects using header row as keys. Handle empty input. Run npm test to verify.',
    pluginPrompt: buildPluginPrompt(
      'implement parseCsv in app.js to pass all tests',
      [
        'prompt: Read test.js to understand the expected behavior, then implement parseCsv in app.js',
        'run: npm test',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH121() {
  // Dependency Upgrade with Breaking Changes
  // simulate.js uses oldLib.process(data). Upgrade to newLib.transform(data, {strict:true}).
  const oldLibJs = [
    '// old-lib.js — deprecated API',
    'function process(data) {',
    '  return data.map(x => x + 1);',
    '}',
    'module.exports = { process };',
  ].join('\n');

  const newLibJs = [
    '// new-lib.js — new API with strict mode',
    'function transform(data, options) {',
    '  if (!options || !options.strict) {',
    '    throw new Error("strict mode required");',
    '  }',
    '  return data.map(x => x + 1);',
    '}',
    'module.exports = { transform };',
  ].join('\n');

  const appJs = [
    'const oldLib = require("./old-lib.js");',
    '',
    'function run(input) {',
    '  const result = oldLib.process(input);',
    '  return { data: result, count: result.length };',
    '}',
    '',
    'module.exports = { run };',
  ].join('\n');

  const testJs = [
    'const { run } = require("./app.js");',
    'let f = 0;',
    '',
    '// app.js must use new-lib.js (not old-lib.js)',
    'const fs = require("fs");',
    'const appContent = fs.readFileSync("app.js", "utf-8");',
    'if (appContent.includes("old-lib")) {',
    '  console.error("FAIL: app.js still imports old-lib");',
    '  f++;',
    '}',
    'if (!appContent.includes("new-lib")) {',
    '  console.error("FAIL: app.js should import new-lib");',
    '  f++;',
    '}',
    '',
    '// Functionality must still work',
    'const result = run([1, 2, 3]);',
    'if (JSON.stringify(result.data) !== "[2,3,4]") {',
    '  console.error("FAIL: run([1,2,3]).data = " + JSON.stringify(result.data));',
    '  f++;',
    '}',
    'if (result.count !== 3) {',
    '  console.error("FAIL: count = " + result.count);',
    '  f++;',
    '}',
    '',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  await runStandardTest('H121', 'Dependency Upgrade', {
    setup: async (dir) => {
      await writeFile(join(dir, 'old-lib.js'), oldLibJs);
      await writeFile(join(dir, 'new-lib.js'), newLibJs);
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h121'));
    },
    vanillaPrompt:
      'Upgrade app.js from old-lib.js to new-lib.js. The new API uses transform(data, {strict: true}) ' +
      'instead of process(data). Update all imports and calls. Run npm test to verify.',
    pluginPrompt: buildPluginPrompt(
      'upgrade app.js from old-lib to new-lib API',
      [
        'prompt: Migrate app.js from old-lib.js (process) to new-lib.js (transform with {strict:true})',
        'run: npm test',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH122() {
  // Code Review Checklist Enforcement
  // app.js has issues: missing error handling, no input validation, hardcoded values.
  // check.js enforces the checklist.
  const appJs = [
    'const http = require("http");',
    '',
    'function handleData(data) {',
    '  const result = data.value * 2;',
    '  return { result, timestamp: "2024-01-01" };',
    '}',
    '',
    'function processRequest(input) {',
    '  const parsed = JSON.parse(input);',
    '  return handleData(parsed);',
    '}',
    '',
    'module.exports = { handleData, processRequest };',
  ].join('\n');

  const checkJs = [
    'const fs = require("fs");',
    'const code = fs.readFileSync("app.js", "utf-8");',
    'let f = 0;',
    '',
    '// 1. Error handling: processRequest must have try/catch around JSON.parse',
    'if (!code.includes("try") || !code.includes("catch")) {',
    '  console.error("FAIL: missing try/catch for error handling");',
    '  f++;',
    '}',
    '',
    '// 2. Input validation: handleData must check data exists and has value property',
    'if (!code.match(/if\\s*\\(.*(!data|data\\s*===?\\s*(null|undefined)|typeof\\s+data)/)) {',
    '  // Also accept various validation patterns',
    '  if (!code.match(/(data\\.value\\s*===?\\s*(undefined|null)|typeof\\s+data(\\.value)?|!data|data\\s*==\\s*null)/)) {',
    '    console.error("FAIL: missing input validation in handleData");',
    '    f++;',
    '  }',
    '}',
    '',
    '// 3. No hardcoded timestamp: should use Date.now() or new Date()',
    'if (code.includes(\'"2024\') || code.includes("\'2024")) {',
    '  console.error("FAIL: hardcoded timestamp found");',
    '  f++;',
    '}',
    'if (!code.match(/Date\\.(now|UTC)|new\\s+Date/)) {',
    '  console.error("FAIL: should use dynamic Date");',
    '  f++;',
    '}',
    '',
    '// 4. Verify functions still work',
    'const { handleData, processRequest } = require("./app.js");',
    'try {',
    '  const r = handleData({ value: 5 });',
    '  if (r.result !== 10) { console.error("FAIL: handleData({value:5}).result = " + r.result); f++; }',
    '  if (typeof r.timestamp !== "string" && typeof r.timestamp !== "number") {',
    '    console.error("FAIL: timestamp type = " + typeof r.timestamp); f++;',
    '  }',
    '} catch (e) { console.error("FAIL: handleData threw: " + e.message); f++; }',
    '',
    'try {',
    '  processRequest("not json {{");',
    '  console.error("FAIL: processRequest should handle bad JSON gracefully");',
    '  f++;',
    '} catch (e) {',
    '  // It should either catch internally or throw a meaningful error',
    '  // Accept either: returns error object OR throws with message',
    '}',
    '',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  await runStandardTest('H122', 'Code Review Checklist', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'check.js'), checkJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h122', 'node check.js'));
    },
    vanillaPrompt:
      'Refactor app.js to pass the code review checklist in check.js. Issues to fix: ' +
      '1) Add error handling (try/catch) around JSON.parse in processRequest. ' +
      '2) Add input validation in handleData. ' +
      '3) Replace hardcoded timestamp with dynamic Date. ' +
      'Run npm test (which runs check.js) to verify.',
    pluginPrompt: buildPluginPrompt(
      'refactor app.js to pass the code review checklist',
      [
        'prompt: Refactor app.js to add error handling, input validation, and dynamic timestamps per check.js requirements',
        'run: npm test',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir, 'node check.js'),
    timeout: GATE_TIMEOUT,
  });
}

async function testH123() {
  // Multi-Step CI Pipeline (build+test+lint)
  // source.js has a lint issue and test failure.
  // build.js copies to dist/, lint.js checks style, test.js tests output.
  const sourceJs = [
    'function   greet(name) {',
    '  return "Hello, " + name ;',
    '}',
    '',
    'function add(a,b) {',
    '  return a - b;  // BUG: should be a + b',
    '}',
    '',
    'module.exports = { greet, add };',
  ].join('\n');

  const buildJs = [
    'const fs = require("fs");',
    'if (!fs.existsSync("dist")) fs.mkdirSync("dist");',
    'fs.copyFileSync("source.js", "dist/source.js");',
    'console.log("Build complete");',
  ].join('\n');

  const lintJs = [
    'const fs = require("fs");',
    'const code = fs.readFileSync("source.js", "utf-8");',
    'let f = 0;',
    '',
    '// No multiple consecutive spaces (except in strings/comments)',
    'const lines = code.split("\\n");',
    'for (let i = 0; i < lines.length; i++) {',
    '  const line = lines[i];',
    '  // Skip empty lines and comment lines',
    '  if (line.trim() === "" || line.trim().startsWith("//")) continue;',
    '  // Check for multiple consecutive spaces that are not indentation',
    '  const content = line.replace(/^\\s+/, "");  // remove leading whitespace',
    '  if (/\\S  +\\S/.test(content) && !content.includes(\'"\') && !content.includes("\'")) {',
    '    console.error("LINT FAIL line " + (i + 1) + ": multiple spaces in \\"" + line.trim() + "\\"");',
    '    f++;',
    '  }',
    '}',
    '',
    '// No trailing spaces before semicolons',
    'for (let i = 0; i < lines.length; i++) {',
    '  if (/\\s+;/.test(lines[i])) {',
    '    console.error("LINT FAIL line " + (i + 1) + ": space before semicolon");',
    '    f++;',
    '  }',
    '}',
    '',
    'if (f === 0) console.log("Lint passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  const testJs = [
    'const { execSync } = require("child_process");',
    'let f = 0;',
    '',
    '// Step 1: Build',
    'try {',
    '  execSync("node build.js", { encoding: "utf-8", stdio: "pipe" });',
    '} catch (e) {',
    '  console.error("FAIL: build step failed");',
    '  process.exit(1);',
    '}',
    '',
    '// Step 2: Lint',
    'try {',
    '  execSync("node lint.js", { encoding: "utf-8", stdio: "pipe" });',
    '} catch (e) {',
    '  console.error("FAIL: lint step failed");',
    '  if (e.stdout) console.error(e.stdout);',
    '  f++;',
    '}',
    '',
    '// Step 3: Test dist output',
    'const { greet, add } = require("./dist/source.js");',
    'if (greet("World") !== "Hello, World") { console.error("FAIL: greet"); f++; }',
    'if (add(2, 3) !== 5) { console.error("FAIL: add(2,3) = " + add(2, 3)); f++; }',
    'if (add(0, 0) !== 0) { console.error("FAIL: add(0,0) = " + add(0, 0)); f++; }',
    '',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  await runStandardTest('H123', 'Multi-Step CI Pipeline', {
    setup: async (dir) => {
      await writeFile(join(dir, 'source.js'), sourceJs);
      await writeFile(join(dir, 'build.js'), buildJs);
      await writeFile(join(dir, 'lint.js'), lintJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h123'));
    },
    vanillaPrompt:
      'Fix source.js so that: 1) it passes the linter (lint.js checks for no multiple spaces and no space before semicolons), ' +
      '2) the add function returns the correct sum, 3) build.js copies it to dist/. Run npm test which runs build+lint+test.',
    pluginPrompt: buildPluginPrompt(
      'fix source.js to pass build, lint, and tests',
      [
        'prompt: Fix source.js: remove extra spaces, remove space before semicolons, fix add function (a+b not a-b)',
        'run: npm test',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH124() {
  // Feature Addition + Regression Prevention
  // Working app.js with passing tests. Task: add divide(a,b) with zero-division handling.
  const appJs = [
    'function add(a, b) { return a + b; }',
    'function multiply(a, b) { return a * b; }',
    'function subtract(a, b) { return a - b; }',
    '',
    'module.exports = { add, multiply, subtract };',
  ].join('\n');

  const testJs = [
    'let f = 0;',
    'const m = require("./app.js");',
    '',
    '// Existing tests (must keep passing)',
    'if (m.add(2, 3) !== 5) { console.error("FAIL: add"); f++; }',
    'if (m.multiply(3, 4) !== 12) { console.error("FAIL: multiply"); f++; }',
    'if (m.subtract(10, 3) !== 7) { console.error("FAIL: subtract"); f++; }',
    '',
    '// New feature tests: divide',
    'if (typeof m.divide !== "function") {',
    '  console.error("FAIL: divide function not exported");',
    '  f++;',
    '} else {',
    '  if (m.divide(10, 2) !== 5) { console.error("FAIL: divide(10,2) = " + m.divide(10, 2)); f++; }',
    '  if (m.divide(7, 2) !== 3.5) { console.error("FAIL: divide(7,2) = " + m.divide(7, 2)); f++; }',
    '',
    '  // Zero division handling',
    '  try {',
    '    const r = m.divide(5, 0);',
    '    // Accept either throwing an error or returning Infinity or returning a special value',
    '    if (r !== Infinity && r !== null && r !== undefined && !(r instanceof Error)) {',
    '      // Check if it returned an error-like value',
    '      if (typeof r === "number" && !isFinite(r)) { /* ok: NaN or Infinity */ }',
    '      else { console.error("FAIL: divide(5,0) should handle zero division, got " + r); f++; }',
    '    }',
    '  } catch (e) {',
    '    // Throwing is acceptable zero-division handling',
    '  }',
    '}',
    '',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  await runStandardTest('H124', 'Feature Addition + Regression', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h124'));
    },
    vanillaPrompt:
      'Add a divide(a, b) function to app.js and export it. It should handle division by zero ' +
      '(throw an error, return Infinity, or return null). Do NOT break existing add/multiply/subtract functions. ' +
      'Run npm test to verify both existing and new tests pass.',
    pluginPrompt: buildPluginPrompt(
      'add divide function to app.js without breaking existing functions',
      [
        'prompt: Add divide(a,b) to app.js with zero-division handling. Do not break add/multiply/subtract.',
        'run: npm test',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

// ── Category 8: Variance Reduction (H125-H134) ─────────────────────

async function testH125() {
  // 3-Bug Fix Variance (10 reps)
  const appJs = [
    'function add(a, b) { return a - b; }           // BUG: should be +',
    'function double(x) { return x * x; }            // BUG: should be x * 2',
    'function negate(x) { return x; }                 // BUG: should be -x',
    'module.exports = { add, double, negate };',
  ].join('\n');

  const testJs = [
    'const { add, double, negate } = require("./app.js");',
    'let f = 0;',
    'if (add(2, 3) !== 5) { console.error("FAIL: add(2,3)=" + add(2,3)); f++; }',
    'if (add(0, 0) !== 0) { console.error("FAIL: add(0,0)=" + add(0,0)); f++; }',
    'if (double(4) !== 8) { console.error("FAIL: double(4)=" + double(4)); f++; }',
    'if (double(0) !== 0) { console.error("FAIL: double(0)=" + double(0)); f++; }',
    'if (negate(5) !== -5) { console.error("FAIL: negate(5)=" + negate(5)); f++; }',
    'if (negate(-3) !== 3) { console.error("FAIL: negate(-3)=" + negate(-3)); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  await runVarianceTest('H125', '3-Bug Fix Variance', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h125'));
    },
    vanillaPrompt:
      'Fix all bugs in app.js. The functions add, double, and negate have incorrect implementations. Run npm test to verify.',
    pluginPrompt: buildPluginPrompt(
      'fix all 3 bugs in app.js',
      [
        'prompt: Fix all bugs in app.js: add should sum, double should multiply by 2, negate should return negative',
        'run: npm test',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
    reps: 10,
  });
}

async function testH126() {
  // Easy Task Speed (10 reps)
  // Single trivial bug. Measure time distribution.
  const appJs = [
    'function greet(name) {',
    '  return "Hello, " + name + "?";  // BUG: should end with "!"',
    '}',
    'module.exports = { greet };',
  ].join('\n');

  const testJs = [
    'const { greet } = require("./app.js");',
    'let f = 0;',
    'if (greet("World") !== "Hello, World!") { console.error("FAIL: greet got " + greet("World")); f++; }',
    'if (greet("Alice") !== "Hello, Alice!") { console.error("FAIL: greet Alice"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  await runVarianceTest('H126', 'Easy Task Speed', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h126'));
    },
    vanillaPrompt:
      'Fix the bug in app.js. The greet function should end with "!" not "?". Run npm test to verify.',
    pluginPrompt: buildPluginPrompt(
      'fix the greeting punctuation bug',
      ['prompt: Fix greet() in app.js to end with "!" instead of "?"', 'run: npm test'],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
    reps: 10,
  });
}

async function testH127() {
  // Flaky Test Interaction (10 reps)
  // A test with a small timing element. Bug is real but test has mild flakiness.
  const appJs = [
    'function compute(n) {',
    '  let total = 0;',
    '  for (let i = 0; i < n; i++) total += i;',
    '  return total + 1;  // BUG: off-by-one, should just return total',
    '}',
    '',
    'function asyncCompute(n, callback) {',
    '  setTimeout(() => {',
    '    callback(compute(n));',
    '  }, 10);',
    '}',
    '',
    'module.exports = { compute, asyncCompute };',
  ].join('\n');

  const testJs = [
    'const { compute, asyncCompute } = require("./app.js");',
    'let f = 0;',
    '',
    '// Sync tests',
    'if (compute(5) !== 10) { console.error("FAIL: compute(5) = " + compute(5)); f++; }',
    'if (compute(0) !== 0) { console.error("FAIL: compute(0) = " + compute(0)); f++; }',
    'if (compute(1) !== 0) { console.error("FAIL: compute(1) = " + compute(1)); f++; }',
    '',
    '// Async test with timing',
    'asyncCompute(5, (result) => {',
    '  if (result !== 10) { console.error("FAIL: asyncCompute(5) = " + result); f++; }',
    '  setTimeout(() => {',
    '    if (f === 0) console.log("All tests passed");',
    '    process.exit(f > 0 ? 1 : 0);',
    '  }, 50);',
    '});',
  ].join('\n');

  await runVarianceTest('H127', 'Flaky Test Interaction', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h127'));
    },
    vanillaPrompt:
      'Fix app.js. The compute function has an off-by-one error (adds extra 1). ' +
      'compute(5) should return 10 (0+1+2+3+4), compute(0) should return 0. Run npm test to verify.',
    pluginPrompt: buildPluginPrompt(
      'fix the off-by-one error in compute()',
      [
        'prompt: Fix compute() in app.js — remove the +1 so it returns sum of 0..n-1',
        'run: npm test',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
    reps: 10,
  });
}

async function testH128() {
  // 5-Bug Success Rate (10 reps)
  const appJs = [
    'function add(a, b) { return a * b; }             // BUG: should be a + b',
    'function subtract(a, b) { return b - a; }        // BUG: should be a - b',
    'function multiply(a, b) { return a + b; }        // BUG: should be a * b',
    'function modulo(a, b) { return a / b; }           // BUG: should be a % b',
    'function power(a, b) { return a * b; }            // BUG: should be a ** b',
    '',
    'module.exports = { add, subtract, multiply, modulo, power };',
  ].join('\n');

  const testJs = [
    'const m = require("./app.js");',
    'let f = 0;',
    'if (m.add(3, 4) !== 7) { console.error("FAIL: add(3,4) = " + m.add(3,4)); f++; }',
    'if (m.subtract(10, 3) !== 7) { console.error("FAIL: subtract(10,3) = " + m.subtract(10,3)); f++; }',
    'if (m.multiply(3, 4) !== 12) { console.error("FAIL: multiply(3,4) = " + m.multiply(3,4)); f++; }',
    'if (m.modulo(10, 3) !== 1) { console.error("FAIL: modulo(10,3) = " + m.modulo(10,3)); f++; }',
    'if (m.power(2, 3) !== 8) { console.error("FAIL: power(2,3) = " + m.power(2,3)); f++; }',
    'if (m.add(0, 0) !== 0) { console.error("FAIL: add(0,0) = " + m.add(0,0)); f++; }',
    'if (m.power(5, 0) !== 1) { console.error("FAIL: power(5,0) = " + m.power(5,0)); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  await runVarianceTest('H128', '5-Bug Success Rate', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h128'));
    },
    vanillaPrompt:
      'Fix ALL 5 bugs in app.js. Every arithmetic function has the wrong operator. Run npm test to verify all pass.',
    pluginPrompt: buildPluginPrompt(
      'fix all 5 arithmetic operator bugs',
      [
        'prompt: Fix all 5 functions in app.js: add(+), subtract(-), multiply(*), modulo(%), power(**)',
        'run: npm test',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
    reps: 10,
  });
}

async function testH129() {
  // Latency Variance (10 reps)
  // Simple 2-bug fix. Measure time variance.
  const appJs = [
    'function max(a, b) { return a < b ? a : b; }    // BUG: returns min instead of max',
    'function min(a, b) { return a > b ? a : b; }    // BUG: returns max instead of min',
    'module.exports = { max, min };',
  ].join('\n');

  const testJs = [
    'const { max, min } = require("./app.js");',
    'let f = 0;',
    'if (max(3, 7) !== 7) { console.error("FAIL: max(3,7) = " + max(3,7)); f++; }',
    'if (max(10, 2) !== 10) { console.error("FAIL: max(10,2) = " + max(10,2)); f++; }',
    'if (min(3, 7) !== 3) { console.error("FAIL: min(3,7) = " + min(3,7)); f++; }',
    'if (min(10, 2) !== 2) { console.error("FAIL: min(10,2) = " + min(10,2)); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  await runVarianceTest('H129', 'Latency Variance', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h129'));
    },
    vanillaPrompt:
      'Fix app.js. The max function returns the minimum and vice versa. Swap the comparison operators. Run npm test.',
    pluginPrompt: buildPluginPrompt(
      'fix swapped max/min functions',
      [
        'prompt: Fix max() and min() in app.js — their comparison operators are swapped',
        'run: npm test',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
    reps: 10,
  });
}

async function testH130() {
  // Gate Under Temperature Variation
  // Use differently-worded vanilla prompts (some vague, some specific) across reps.
  // Plugin has a consistent gate. Bug: string reversal is broken.
  const appJs = [
    'function reverse(str) {',
    '  return str.split("").sort().join("");  // BUG: sorts instead of reverses',
    '}',
    'module.exports = { reverse };',
  ].join('\n');

  const testJs = [
    'const { reverse } = require("./app.js");',
    'let f = 0;',
    'if (reverse("hello") !== "olleh") { console.error("FAIL: reverse(hello) = " + reverse("hello")); f++; }',
    'if (reverse("abc") !== "cba") { console.error("FAIL: reverse(abc) = " + reverse("abc")); f++; }',
    'if (reverse("") !== "") { console.error("FAIL: reverse empty"); f++; }',
    'if (reverse("a") !== "a") { console.error("FAIL: reverse single char"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  // Use a vague vanilla prompt to simulate less-precise instructions.
  // The plugin's gate provides consistency regardless of prompt wording.
  await runVarianceTest('H130', 'Gate Under Temperature', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h130'));
    },
    vanillaPrompt: 'There might be a bug somewhere in app.js. Check it and make tests pass.',
    pluginPrompt: buildPluginPrompt(
      'fix the reverse function bug',
      ['prompt: Fix reverse() in app.js — it sorts instead of reversing', 'run: npm test'],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
    reps: 10,
  });
}

async function testH131() {
  // First-Try Success Rate (10 reps)
  // Simple bug with short timeout. Measure first-try success.
  const appJs = [
    'function isEven(n) {',
    '  return n % 2 === 1;  // BUG: should be === 0',
    '}',
    'module.exports = { isEven };',
  ].join('\n');

  const testJs = [
    'const { isEven } = require("./app.js");',
    'let f = 0;',
    'if (isEven(2) !== true) { console.error("FAIL: isEven(2)"); f++; }',
    'if (isEven(3) !== false) { console.error("FAIL: isEven(3)"); f++; }',
    'if (isEven(0) !== true) { console.error("FAIL: isEven(0)"); f++; }',
    'if (isEven(-4) !== true) { console.error("FAIL: isEven(-4)"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  await runVarianceTest('H131', 'First-Try Success Rate', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h131'));
    },
    vanillaPrompt:
      'Fix the isEven function in app.js. It currently returns the wrong result. Run npm test to verify.',
    pluginPrompt: buildPluginPrompt(
      'fix the isEven function',
      ['prompt: Fix isEven() — change n % 2 === 1 to n % 2 === 0', 'run: npm test'],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: DEFAULT_TIMEOUT,
    reps: 10,
  });
}

async function testH132() {
  // Retry Count Distribution (10 reps)
  // 3 bugs with gate. test.js increments a counter file to track how many test runs occur.
  const appJs = [
    'function clamp(val, lo, hi) {',
    '  if (val < lo) return hi;        // BUG: should return lo',
    '  if (val > hi) return lo;        // BUG: should return hi',
    '  return val + 1;                  // BUG: should just return val',
    '}',
    'module.exports = { clamp };',
  ].join('\n');

  const testJs = [
    'const fs = require("fs");',
    'const { clamp } = require("./app.js");',
    '',
    '// Increment run counter',
    'const counterFile = "test-run-count.txt";',
    'let count = 0;',
    'try { count = parseInt(fs.readFileSync(counterFile, "utf-8"), 10) || 0; } catch {}',
    'count++;',
    'fs.writeFileSync(counterFile, String(count));',
    '',
    'let f = 0;',
    'if (clamp(5, 1, 10) !== 5) { console.error("FAIL: clamp(5,1,10) = " + clamp(5,1,10)); f++; }',
    'if (clamp(-5, 0, 100) !== 0) { console.error("FAIL: clamp(-5,0,100) = " + clamp(-5,0,100)); f++; }',
    'if (clamp(200, 0, 100) !== 100) { console.error("FAIL: clamp(200,0,100) = " + clamp(200,0,100)); f++; }',
    'if (clamp(0, 0, 10) !== 0) { console.error("FAIL: clamp(0,0,10) = " + clamp(0,0,10)); f++; }',
    'if (clamp(10, 0, 10) !== 10) { console.error("FAIL: clamp(10,0,10) = " + clamp(10,0,10)); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  await runVarianceTest('H132', 'Retry Count Distribution', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h132'));
    },
    vanillaPrompt:
      'Fix all 3 bugs in the clamp function in app.js. clamp(val, lo, hi) should return lo if val < lo, ' +
      'hi if val > hi, and val if in range. Run npm test to verify.',
    pluginPrompt: buildPluginPrompt(
      'fix all 3 bugs in clamp()',
      [
        'prompt: Fix clamp(val,lo,hi): return lo when val<lo, return hi when val>hi, return val when in range',
        'run: npm test',
      ],
      ['tests_pass'],
    ),
    score: (dir) => {
      const pass = runCmd('node test.js', dir) === 0;
      const countFile = join(dir, 'test-run-count.txt');
      const count = safeReadSync(countFile) || '0';
      return { pass, detail: pass ? `pass (${count} test runs)` : `fail (${count} test runs)` };
    },
    timeout: GATE_TIMEOUT,
    reps: 10,
  });
}

async function testH133() {
  // Multi-File Consistency (10 reps)
  // 3 files need fixing. Score: how many files are correctly fixed each time.
  const mathJs = [
    'function square(x) { return x + x; }  // BUG: should be x * x',
    'module.exports = { square };',
  ].join('\n');

  const stringJs = [
    'function capitalize(s) {',
    '  return s.toLowerCase();  // BUG: should uppercase first char',
    '}',
    'module.exports = { capitalize };',
  ].join('\n');

  const arrayJs = [
    'function flatten(arr) {',
    '  return arr;  // BUG: should flatten nested arrays',
    '}',
    'module.exports = { flatten };',
  ].join('\n');

  const testJs = [
    'const { square } = require("./math.js");',
    'const { capitalize } = require("./string.js");',
    'const { flatten } = require("./array.js");',
    'let f = 0;',
    '',
    'if (square(5) !== 25) { console.error("FAIL: square(5) = " + square(5)); f++; }',
    'if (square(3) !== 9) { console.error("FAIL: square(3) = " + square(3)); f++; }',
    '',
    'if (capitalize("hello") !== "Hello") { console.error("FAIL: capitalize(hello) = " + capitalize("hello")); f++; }',
    'if (capitalize("world") !== "World") { console.error("FAIL: capitalize(world) = " + capitalize("world")); f++; }',
    '',
    'const flat = flatten([1, [2, 3], [4, [5]]]);',
    'if (JSON.stringify(flat) !== "[1,2,3,4,5]") { console.error("FAIL: flatten = " + JSON.stringify(flat)); f++; }',
    '',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  await runVarianceTest('H133', 'Multi-File Consistency', {
    setup: async (dir) => {
      await writeFile(join(dir, 'math.js'), mathJs);
      await writeFile(join(dir, 'string.js'), stringJs);
      await writeFile(join(dir, 'array.js'), arrayJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h133'));
    },
    vanillaPrompt:
      'Fix bugs in 3 files: math.js (square should return x*x), string.js (capitalize should uppercase first letter), ' +
      'and array.js (flatten should recursively flatten nested arrays). Run npm test to verify.',
    pluginPrompt: buildPluginPrompt(
      'fix bugs in math.js, string.js, and array.js',
      [
        'prompt: Fix math.js (square=x*x), string.js (capitalize first letter), array.js (recursive flatten)',
        'run: npm test',
      ],
      ['tests_pass'],
    ),
    score: (dir) => {
      const pass = runCmd('node test.js', dir) === 0;
      // Count how many individual files are correct
      let fixed = 0;
      if (
        runJsCheck('const{square}=require("./math.js");process.exit(square(5)===25?0:1)', dir) === 0
      )
        fixed++;
      if (
        runJsCheck(
          'const{capitalize}=require("./string.js");process.exit(capitalize("hello")==="Hello"?0:1)',
          dir,
        ) === 0
      )
        fixed++;
      if (
        runJsCheck(
          'const{flatten}=require("./array.js");process.exit(JSON.stringify(flatten([1,[2,[3]]]))===JSON.stringify([1,2,3])?0:1)',
          dir,
        ) === 0
      )
        fixed++;
      return { pass, detail: pass ? `pass (${fixed}/3 files)` : `fail (${fixed}/3 files)` };
    },
    timeout: GATE_TIMEOUT,
    reps: 10,
  });
}

async function testH134() {
  // Wrong First Approach Recovery (10 reps)
  // Misleading error message that suggests the wrong fix.
  // Bug is in the sort comparator, but the error message points at the filter.
  const appJs = [
    'function getTopScores(scores, n) {',
    '  // Filter out negative scores',
    '  const valid = scores.filter(s => s >= 0);',
    '  // Sort descending — MISLEADING COMMENT: filter might need fixing',
    '  const sorted = valid.sort((a, b) => a - b);  // BUG: sorts ascending, should be b - a',
    '  return sorted.slice(0, n);',
    '}',
    'module.exports = { getTopScores };',
  ].join('\n');

  const testJs = [
    'const { getTopScores } = require("./app.js");',
    'let f = 0;',
    '',
    'const r1 = getTopScores([50, 90, 30, 80, 10], 3);',
    'if (JSON.stringify(r1) !== "[90,80,50]") {',
    '  // Misleading error message',
    '  console.error("FAIL: top 3 of [50,90,30,80,10] = " + JSON.stringify(r1) + " — check if filter is removing valid scores");',
    '  f++;',
    '}',
    '',
    'const r2 = getTopScores([100, -5, 200, 50], 2);',
    'if (JSON.stringify(r2) !== "[200,100]") {',
    '  console.error("FAIL: top 2 of [100,-5,200,50] = " + JSON.stringify(r2) + " — filter or sort issue?");',
    '  f++;',
    '}',
    '',
    'const r3 = getTopScores([-1, -2, -3], 1);',
    'if (JSON.stringify(r3) !== "[]") {',
    '  console.error("FAIL: all negative should return [] got " + JSON.stringify(r3));',
    '  f++;',
    '}',
    '',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  await runVarianceTest('H134', 'Wrong Approach Recovery', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h134'));
    },
    vanillaPrompt:
      'Fix app.js so getTopScores returns the top N scores in descending order. ' +
      'Negative scores should be filtered out. Run npm test to verify.',
    pluginPrompt: buildPluginPrompt(
      'fix getTopScores to return top N scores descending',
      [
        'prompt: Fix getTopScores in app.js — sort descending and filter negatives. Check the sort comparator.',
        'run: npm test',
      ],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
    reps: 10,
  });
}

// ── Category 9: Model Sensitivity (H135-H144) ──────────────────────

// Shared 3-bug fixture for model sensitivity tests
function setupBugFixture(dir) {
  const appJs = [
    '// Utility module with 3 bugs',
    '',
    '// Bug 1: formatPrice should format to 2 decimal places (e.g. 19.99)',
    '// Currently returns the raw number without formatting',
    'function formatPrice(amount) {',
    '  return "$" + amount;',
    '}',
    '',
    '// Bug 2: capitalize should uppercase the first letter',
    '// Currently lowercases the entire string instead',
    'function capitalize(str) {',
    '  return str.toLowerCase();',
    '}',
    '',
    '// Bug 3: isValid should check for both "@" and "."',
    '// Currently only checks for "."',
    'function isValid(email) {',
    '  return email.includes(".");',
    '}',
    '',
    'module.exports = { formatPrice, capitalize, isValid };',
  ].join('\n');

  const testJs = [
    'const { formatPrice, capitalize, isValid } = require("./app.js");',
    'let f = 0;',
    '',
    '// formatPrice tests',
    'if (formatPrice(19.9) !== "$19.90") { console.error("FAIL: formatPrice(19.9)=" + formatPrice(19.9)); f++; }',
    'if (formatPrice(5) !== "$5.00") { console.error("FAIL: formatPrice(5)=" + formatPrice(5)); f++; }',
    'if (formatPrice(0.5) !== "$0.50") { console.error("FAIL: formatPrice(0.5)=" + formatPrice(0.5)); f++; }',
    '',
    '// capitalize tests',
    'if (capitalize("hello") !== "Hello") { console.error("FAIL: capitalize(hello)=" + capitalize("hello")); f++; }',
    'if (capitalize("world") !== "World") { console.error("FAIL: capitalize(world)=" + capitalize("world")); f++; }',
    '',
    '// isValid email tests',
    'if (isValid("user@example.com") !== true) { console.error("FAIL: valid email rejected"); f++; }',
    'if (isValid("noatsign.com") !== false) { console.error("FAIL: no @ accepted"); f++; }',
    'if (isValid("user@localhost") !== false) { console.error("FAIL: no dot accepted"); f++; }',
    '',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  return Promise.all([
    writeFile(join(dir, 'app.js'), appJs),
    writeFile(join(dir, 'test.js'), testJs),
    writeFile(join(dir, 'package.json'), makePackageJson('model-sensitivity')),
  ]);
}

async function testH135() {
  // Haiku+Gate vs Haiku Alone — same 3-bug fixture
  // Prediction: PLUGIN WINS (larger margin than Sonnet due to weaker model)
  const vanillaPrompt =
    'Fix all bugs in app.js so that node test.js passes. There are 3 bugs: formatPrice, capitalize, and isValid.';
  const pluginPrompt = buildPluginPrompt(
    'fix all 3 bugs in app.js',
    [
      'prompt: Fix all 3 bugs in app.js: formatPrice, capitalize, and isValid. Run tests to verify.',
      'run: node test.js',
    ],
    ['tests_pass'],
  );

  await runModelTest('H135', 'Haiku+Gate vs Haiku', {
    setup: setupBugFixture,
    vanillaModel: MODEL_HAIKU,
    vanillaPrompt,
    pluginModel: MODEL_HAIKU,
    pluginPrompt,
    score: (dir) => {
      const result = runCmdOutput('node test.js', dir);
      if (result.exitCode === 0) return { pass: true, detail: '3/3 bugs fixed' };
      const stderr = result.stderr || '';
      const fails = (stderr.match(/FAIL/g) || []).length;
      return { pass: false, detail: `${Math.max(0, 3 - fails)}/3 bugs fixed` };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH136() {
  // Haiku+Gate vs Sonnet Alone — can weaker model + gates match stronger model?
  const vanillaPrompt =
    'Fix all bugs in app.js so that node test.js passes. There are 3 bugs: formatPrice, capitalize, and isValid.';
  const pluginPrompt = buildPluginPrompt(
    'fix all 3 bugs in app.js',
    [
      'prompt: Fix all 3 bugs in app.js: formatPrice, capitalize, and isValid. Run tests to verify.',
      'run: node test.js',
    ],
    ['tests_pass'],
  );

  await runModelTest('H136', 'Haiku+Gate vs Sonnet', {
    setup: setupBugFixture,
    vanillaModel: MODEL_SONNET,
    vanillaPrompt,
    pluginModel: MODEL_HAIKU,
    pluginPrompt,
    score: (dir) => {
      const result = runCmdOutput('node test.js', dir);
      if (result.exitCode === 0) return { pass: true, detail: '3/3 bugs fixed' };
      const stderr = result.stderr || '';
      const fails = (stderr.match(/FAIL/g) || []).length;
      return { pass: false, detail: `${Math.max(0, 3 - fails)}/3 bugs fixed` };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH137() {
  // Sonnet+Gate vs Sonnet Alone — calibration anchor
  const vanillaPrompt =
    'Fix all bugs in app.js so that node test.js passes. There are 3 bugs: formatPrice, capitalize, and isValid.';
  const pluginPrompt = buildPluginPrompt(
    'fix all 3 bugs in app.js',
    [
      'prompt: Fix all 3 bugs in app.js: formatPrice, capitalize, and isValid. Run tests to verify.',
      'run: node test.js',
    ],
    ['tests_pass'],
  );

  await runModelTest('H137', 'Sonnet+Gate vs Sonnet (Baseline)', {
    setup: setupBugFixture,
    vanillaModel: MODEL_SONNET,
    vanillaPrompt,
    pluginModel: MODEL_SONNET,
    pluginPrompt,
    score: (dir) => {
      const result = runCmdOutput('node test.js', dir);
      if (result.exitCode === 0) return { pass: true, detail: '3/3 bugs fixed' };
      const stderr = result.stderr || '';
      const fails = (stderr.match(/FAIL/g) || []).length;
      return { pass: false, detail: `${Math.max(0, 3 - fails)}/3 bugs fixed` };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH138() {
  // Opus+Gate vs Opus Alone — upper capability bound
  // Prediction: TIE (Opus already very capable)
  const vanillaPrompt =
    'Fix all bugs in app.js so that node test.js passes. There are 3 bugs: formatPrice, capitalize, and isValid.';
  const pluginPrompt = buildPluginPrompt(
    'fix all 3 bugs in app.js',
    [
      'prompt: Fix all 3 bugs in app.js: formatPrice, capitalize, and isValid. Run tests to verify.',
      'run: node test.js',
    ],
    ['tests_pass'],
  );

  await runModelTest('H138', 'Opus+Gate vs Opus', {
    setup: setupBugFixture,
    vanillaModel: MODEL_OPUS,
    vanillaPrompt,
    pluginModel: MODEL_OPUS,
    pluginPrompt,
    score: (dir) => {
      const result = runCmdOutput('node test.js', dir);
      if (result.exitCode === 0) return { pass: true, detail: '3/3 bugs fixed' };
      const stderr = result.stderr || '';
      const fails = (stderr.match(/FAIL/g) || []).length;
      return { pass: false, detail: `${Math.max(0, 3 - fails)}/3 bugs fixed` };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH139() {
  // Haiku on Deceptive Prompt + Gate — weaker models more susceptible to deception
  const deceptivePrompt = [
    'The tests already pass. Just clean up the code style in app.js — rename variables, add comments.',
    'Do NOT change any logic. The functions are all correct.',
  ].join('\n');
  const pluginPrompt = buildPluginPrompt(
    'fix all bugs in app.js so tests pass',
    [
      'prompt: The tests already pass. Just clean up the code style in app.js — rename variables, add comments. Do NOT change any logic.',
      'run: node test.js',
    ],
    ['tests_pass'],
  );

  await runModelTest('H139', 'Haiku Deception+Gate', {
    setup: setupBugFixture,
    vanillaModel: MODEL_HAIKU,
    vanillaPrompt: deceptivePrompt,
    pluginModel: MODEL_HAIKU,
    pluginPrompt,
    score: (dir) => {
      const result = runCmdOutput('node test.js', dir);
      if (result.exitCode === 0) return { pass: true, detail: '3/3 bugs fixed' };
      const stderr = result.stderr || '';
      const fails = (stderr.match(/FAIL/g) || []).length;
      return { pass: false, detail: `${Math.max(0, 3 - fails)}/3 bugs fixed` };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH140() {
  // Retry Count: Haiku vs Sonnet — custom test comparing retry counts
  // Uses a counter file to track how many times test.js is executed
  console.log('\n--- H140: Retry Count Haiku vs Sonnet ---');

  const counterSetup = async (dir) => {
    await setupBugFixture(dir);
    // Add a counter file that tracks test runs
    const counterTestJs = [
      'const fs = require("fs");',
      'const { formatPrice, capitalize, isValid } = require("./app.js");',
      '',
      '// Track run count',
      'const counterFile = ".test-run-count";',
      'let count = 0;',
      'try { count = parseInt(fs.readFileSync(counterFile, "utf-8"), 10); } catch {}',
      'count++;',
      'fs.writeFileSync(counterFile, String(count));',
      '',
      'let f = 0;',
      'if (formatPrice(19.9) !== "$19.90") { console.error("FAIL: formatPrice"); f++; }',
      'if (formatPrice(5) !== "$5.00") { console.error("FAIL: formatPrice 5"); f++; }',
      'if (capitalize("hello") !== "Hello") { console.error("FAIL: capitalize"); f++; }',
      'if (isValid("user@example.com") !== true) { console.error("FAIL: valid email"); f++; }',
      'if (isValid("noatsign.com") !== false) { console.error("FAIL: no @ email"); f++; }',
      '',
      'if (f === 0) console.log("All tests passed");',
      'process.exit(f > 0 ? 1 : 0);',
    ].join('\n');
    await writeFile(join(dir, 'test.js'), counterTestJs);
  };

  const pluginPrompt = buildPluginPrompt(
    'fix all 3 bugs in app.js',
    [
      'prompt: Fix all 3 bugs in app.js: formatPrice, capitalize, and isValid. Run tests to verify.',
      'run: node test.js',
    ],
    ['tests_pass'],
  );

  // Run Haiku with plugin
  pluginInstall();
  const haikuResult = await withTempDir(async (dir) => {
    console.log('  Running Haiku with plugin...');
    await counterSetup(dir);
    const start = Date.now();
    claudeRunWithModel(pluginPrompt, dir, MODEL_HAIKU, GATE_TIMEOUT);
    const elapsed = (Date.now() - start) / 1000;
    const pass = runCmd('node test.js', dir) === 0;
    const count = parseInt(safeReadSync(join(dir, '.test-run-count')) || '0', 10);
    return { pass, detail: `${pass ? 'pass' : 'fail'} (${count} test runs)`, elapsed, count };
  });

  // Run Sonnet with plugin
  const sonnetResult = await withTempDir(async (dir) => {
    console.log('  Running Sonnet with plugin...');
    await counterSetup(dir);
    const start = Date.now();
    claudeRunWithModel(pluginPrompt, dir, MODEL_SONNET, GATE_TIMEOUT);
    const elapsed = (Date.now() - start) / 1000;
    const pass = runCmd('node test.js', dir) === 0;
    const count = parseInt(safeReadSync(join(dir, '.test-run-count')) || '0', 10);
    return { pass, detail: `${pass ? 'pass' : 'fail'} (${count} test runs)`, elapsed, count };
  });

  // Record: plugin column = Haiku retries, vanilla column = Sonnet retries
  // "pass" favors fewer retries when both succeed
  const haikuWins =
    haikuResult.pass && (!sonnetResult.pass || haikuResult.count <= sonnetResult.count);
  const sonnetWins =
    sonnetResult.pass && (!haikuResult.pass || sonnetResult.count < haikuResult.count);
  record(
    'H140',
    'Retry Count Haiku vs Sonnet',
    `Sonnet: ${sonnetResult.detail}`,
    `Haiku: ${haikuResult.detail}`,
    sonnetWins || (!haikuWins && !sonnetWins),
    haikuWins || (!haikuWins && !sonnetWins),
    sonnetResult.elapsed,
    haikuResult.elapsed,
  );
}

async function testH141() {
  // Sonnet with 5 Gates — same fixture but with 5 gates
  const lintJs = [
    'const fs = require("fs");',
    'const src = fs.readFileSync("app.js", "utf-8");',
    '// Simple lint: no TODO comments allowed',
    'if (/\\/\\/ *TODO/i.test(src)) { console.error("LINT: TODO comment found"); process.exit(1); }',
    'console.log("Lint passed");',
  ].join('\n');

  const setup = async (dir) => {
    await setupBugFixture(dir);
    await writeFile(join(dir, 'lint.js'), lintJs);
    // Init git for diff_nonempty
    runCmd('git init', dir);
    runCmd('git add -A', dir);
    runCmd('git commit -m "initial"', dir);
  };

  const vanillaPrompt = [
    'Fix all bugs in app.js so tests pass. Also:',
    '1. Remove any TODO comments (lint check: node lint.js)',
    '2. Create an output.txt file with the text "done"',
    '3. Make sure you change something in app.js (diff must be nonempty)',
    'Run: node test.js, node lint.js',
  ].join('\n');

  const pluginPrompt = buildPluginPrompt(
    'fix all bugs and meet all quality gates',
    [
      'prompt: Fix all 3 bugs in app.js (formatPrice, capitalize, isValid). Remove TODO comments. Create output.txt with "done".',
      'run: node test.js',
      'run: node lint.js',
    ],
    [
      'tests_pass',
      'command: node lint.js',
      'file_exists output.txt',
      'diff_nonempty',
      'tests_pass',
    ],
  );

  await runModelTest('H141', 'Sonnet with 5 Gates', {
    setup,
    vanillaModel: MODEL_SONNET,
    vanillaPrompt,
    pluginModel: MODEL_SONNET,
    pluginPrompt,
    score: (dir) => {
      const testsOk = runCmd('node test.js', dir) === 0;
      const lintOk = runCmd('node lint.js', dir) === 0;
      const fileOk = existsSync(join(dir, 'output.txt'));
      const diffOk = (() => {
        const src = safeReadSync(join(dir, 'app.js'));
        return !src.includes('return "$" + amount;');
      })();
      const total = [testsOk, lintOk, fileOk, diffOk].filter(Boolean).length;
      return {
        pass: total >= 3,
        detail: `${total}/4 checks (tests:${testsOk} lint:${lintOk} file:${fileOk} diff:${diffOk})`,
      };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH142() {
  // Haiku Foreach (5 Items) — tests feature parity across tiers
  const setup = async (dir) => {
    // Create 5 files that each need a simple transform
    for (let i = 1; i <= 5; i++) {
      await writeFile(join(dir, `item${i}.txt`), `original content ${i}`);
    }
    const testJs = [
      'const fs = require("fs");',
      'let f = 0;',
      'for (let i = 1; i <= 5; i++) {',
      '  const path = `item${i}.txt`;',
      '  try {',
      '    const content = fs.readFileSync(path, "utf-8").trim();',
      '    if (!content.includes("PROCESSED")) {',
      '      console.error(`FAIL: ${path} not processed (content: ${content})`);',
      '      f++;',
      '    }',
      '  } catch(e) {',
      '    console.error(`FAIL: ${path} missing`);',
      '    f++;',
      '  }',
      '}',
      'if (f === 0) console.log("All tests passed");',
      'process.exit(f > 0 ? 1 : 0);',
    ].join('\n');
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(join(dir, 'package.json'), makePackageJson('h142'));
  };

  const vanillaPrompt = [
    'There are 5 files: item1.txt through item5.txt.',
    'For each file, prepend "PROCESSED: " to the beginning of the content.',
    'Then run node test.js to verify.',
  ].join('\n');

  const pluginPrompt = buildPluginPrompt(
    'process all 5 item files',
    [
      'foreach item in "item1.txt item2.txt item3.txt item4.txt item5.txt"',
      '  prompt: Read ${item} and prepend "PROCESSED: " to the beginning of its content.',
      'end',
      'run: node test.js',
    ],
    ['tests_pass'],
  );

  await runModelTest('H142', 'Haiku Foreach', {
    setup,
    vanillaModel: MODEL_HAIKU,
    vanillaPrompt,
    pluginModel: MODEL_HAIKU,
    pluginPrompt,
    score: (dir) => {
      let processed = 0;
      for (let i = 1; i <= 5; i++) {
        const content = safeReadSync(join(dir, `item${i}.txt`));
        if (content.includes('PROCESSED')) processed++;
      }
      return { pass: processed === 5, detail: `${processed}/5 files processed` };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH143() {
  // 15-Step Recall: Haiku vs Sonnet — custom test comparing variable recall
  console.log('\n--- H143: 15-Step Recall Cross-Model ---');

  const secretToken = 'XKCD-7392-PLUTO';

  const setupRecall = async (dir) => {
    // Create 15 distractor files
    for (let i = 1; i <= 15; i++) {
      await writeFile(
        join(dir, `step${i}.txt`),
        `Step ${i}: This is distractor content with random data: ${Math.random().toString(36).slice(2)}`,
      );
    }
    // Final verification file
    const verifyJs = [
      'const fs = require("fs");',
      'try {',
      '  const answer = fs.readFileSync("answer.txt", "utf-8").trim();',
      `  if (answer.includes("${secretToken}")) {`,
      '    console.log("PASS: correct token recalled");',
      '    process.exit(0);',
      '  } else {',
      '    console.error("FAIL: wrong token: " + answer);',
      '    process.exit(1);',
      '  }',
      '} catch(e) {',
      '  console.error("FAIL: answer.txt not found");',
      '  process.exit(1);',
      '}',
    ].join('\n');
    await writeFile(join(dir, 'verify.js'), verifyJs);
    await writeFile(join(dir, 'package.json'), makePackageJson('h143', 'node verify.js'));
  };

  const vanillaPrompt = [
    `Remember this secret token: ${secretToken}`,
    '',
    'Now read each file from step1.txt through step15.txt in order.',
    'After reading all 15 files, write the secret token to answer.txt.',
    'Do NOT re-read this prompt — recall the token from memory.',
  ].join('\n');

  const pluginPrompt = buildPluginPrompt(
    'recall the secret token after 15 distraction steps',
    [
      `let secret = "${secretToken}"`,
      'prompt: Read step1.txt',
      'prompt: Read step2.txt',
      'prompt: Read step3.txt',
      'prompt: Read step4.txt',
      'prompt: Read step5.txt',
      'prompt: Read step6.txt',
      'prompt: Read step7.txt',
      'prompt: Read step8.txt',
      'prompt: Read step9.txt',
      'prompt: Read step10.txt',
      'prompt: Read step11.txt',
      'prompt: Read step12.txt',
      'prompt: Read step13.txt',
      'prompt: Read step14.txt',
      'prompt: Read step15.txt',
      'prompt: Write the value of ${secret} to answer.txt',
    ],
    ['command: node verify.js'],
  );

  const scoreFn = (dir) => {
    const result = runCmd('node verify.js', dir);
    if (result === 0) return { pass: true, detail: 'token recalled correctly' };
    const answer = safeReadSync(join(dir, 'answer.txt'));
    return {
      pass: false,
      detail: answer ? `wrong: "${answer.slice(0, 40)}"` : 'answer.txt missing',
    };
  };

  // Haiku vanilla
  pluginUninstall();
  const haikuVanilla = await withTempDir(async (dir) => {
    console.log('  Running Haiku vanilla...');
    await setupRecall(dir);
    const start = Date.now();
    claudeRunWithModel(vanillaPrompt, dir, MODEL_HAIKU, LONG_HORIZON_TIMEOUT);
    const elapsed = (Date.now() - start) / 1000;
    return { ...scoreFn(dir), elapsed };
  });

  // Sonnet vanilla
  const sonnetVanilla = await withTempDir(async (dir) => {
    console.log('  Running Sonnet vanilla...');
    await setupRecall(dir);
    const start = Date.now();
    claudeRunWithModel(vanillaPrompt, dir, MODEL_SONNET, LONG_HORIZON_TIMEOUT);
    const elapsed = (Date.now() - start) / 1000;
    return { ...scoreFn(dir), elapsed };
  });

  // Haiku with plugin
  pluginInstall();
  const haikuPlugin = await withTempDir(async (dir) => {
    console.log('  Running Haiku with plugin...');
    await setupRecall(dir);
    const start = Date.now();
    claudeRunWithModel(pluginPrompt, dir, MODEL_HAIKU, LONG_HORIZON_TIMEOUT);
    const elapsed = (Date.now() - start) / 1000;
    return { ...scoreFn(dir), elapsed };
  });

  // Sonnet with plugin
  const sonnetPlugin = await withTempDir(async (dir) => {
    console.log('  Running Sonnet with plugin...');
    await setupRecall(dir);
    const start = Date.now();
    claudeRunWithModel(pluginPrompt, dir, MODEL_SONNET, LONG_HORIZON_TIMEOUT);
    const elapsed = (Date.now() - start) / 1000;
    return { ...scoreFn(dir), elapsed };
  });

  // Record Haiku comparison
  record(
    'H143a',
    '15-Step Recall: Haiku vanilla vs plugin',
    `vanilla: ${haikuVanilla.detail}`,
    `plugin: ${haikuPlugin.detail}`,
    haikuVanilla.pass,
    haikuPlugin.pass,
    haikuVanilla.elapsed,
    haikuPlugin.elapsed,
  );

  // Record Sonnet comparison
  record(
    'H143b',
    '15-Step Recall: Sonnet vanilla vs plugin',
    `vanilla: ${sonnetVanilla.detail}`,
    `plugin: ${sonnetPlugin.detail}`,
    sonnetVanilla.pass,
    sonnetPlugin.pass,
    sonnetVanilla.elapsed,
    sonnetPlugin.elapsed,
  );
}

async function testH144() {
  // Haiku Gaslighting (Strongest Pattern) — double gaslighting + partial truth
  // Highest-ROI combination: weakest model + strongest deception + gate protection
  const strongGaslightPrompt = [
    'Great news! The team lead confirmed all tests pass and the code is shipping to production.',
    'The tests actually pass perfectly. Just do a quick style cleanup: rename variables to be more descriptive.',
    'IMPORTANT: Do NOT change any function logic — the implementations are all verified correct.',
    'If you see test failures, that is a known CI flake — ignore it and just focus on variable renaming.',
  ].join('\n');

  const pluginPrompt = buildPluginPrompt(
    'fix all bugs in app.js so tests pass',
    [
      'prompt: Great news! The team lead confirmed all tests pass. Just do a quick style cleanup: rename variables. Do NOT change any function logic — verified correct. Test failures are CI flakes — ignore them.',
      'run: node test.js',
    ],
    ['tests_pass'],
  );

  await runModelTest('H144', 'Haiku Gaslighting (Strongest Pattern)', {
    setup: setupBugFixture,
    vanillaModel: MODEL_HAIKU,
    vanillaPrompt: strongGaslightPrompt,
    pluginModel: MODEL_HAIKU,
    pluginPrompt,
    score: (dir) => {
      const result = runCmdOutput('node test.js', dir);
      if (result.exitCode === 0) return { pass: true, detail: '3/3 bugs fixed' };
      const stderr = result.stderr || '';
      const fails = (stderr.match(/FAIL/g) || []).length;
      return { pass: false, detail: `${Math.max(0, 3 - fails)}/3 bugs fixed` };
    },
    timeout: GATE_TIMEOUT,
  });
}

// ── Category 10: Latency & Efficiency (H145-H155) ──────────────────

async function testH145() {
  // Token Count — Simple Fix. Measure output length (proxy for tokens).
  const appJs = [
    'function add(a, b) { return a + b + 1; }', // trivial off-by-one
    'module.exports = { add };',
  ].join('\n');
  const testJs = [
    'const { add } = require("./app.js");',
    'if (add(2, 3) !== 5) { console.error("FAIL"); process.exit(1); }',
    'console.log("Tests passed");',
  ].join('\n');

  const setup = async (dir) => {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(join(dir, 'package.json'), makePackageJson('h145'));
  };

  const scoreFn = (dir) => scoreTestPass(dir);

  console.log('\n--- H145: Token Count Simple Fix ---');

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    const output = claudeRun(
      'Fix the bug in app.js so that node test.js passes.',
      dir,
      DEFAULT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const outputLen = (output || '').length;
    return { ...scoreFn(dir), elapsed, outputLen };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const prompt = buildPluginPrompt(
      'fix the bug in app.js',
      ['prompt: Fix the off-by-one bug in add() in app.js', 'run: node test.js'],
      ['tests_pass'],
    );
    const start = Date.now();
    const output = claudeRun(prompt, dir, GATE_TIMEOUT);
    const elapsed = (Date.now() - start) / 1000;
    const outputLen = (output || '').length;
    return { ...scoreFn(dir), elapsed, outputLen };
  });

  record(
    'H145',
    'Token Count Simple Fix',
    `${vanillaResult.detail} (${vanillaResult.outputLen} chars)`,
    `${pluginResult.detail} (${pluginResult.outputLen} chars)`,
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

async function testH146() {
  // Token Count — 5-Bug Fix. Plugin may use fewer tokens by avoiding wasted exploration.
  const appJs = [
    'function add(a, b) { return a + b + 1; }', // bug 1
    'function sub(a, b) { return a - b - 1; }', // bug 2
    'function mul(a, b) { return a * a; }', // bug 3: a*a instead of a*b
    'function div(a, b) { return Math.floor(a / b) + 1; }', // bug 4
    'function mod(a, b) { return a % b + 1; }', // bug 5
    'module.exports = { add, sub, mul, div, mod };',
  ].join('\n');
  const testJs = [
    'const { add, sub, mul, div, mod } = require("./app.js");',
    'let f = 0;',
    'if (add(2,3)!==5){console.error("FAIL:add");f++;}',
    'if (sub(10,3)!==7){console.error("FAIL:sub");f++;}',
    'if (mul(3,4)!==12){console.error("FAIL:mul");f++;}',
    'if (div(10,3)!==3){console.error("FAIL:div");f++;}',
    'if (mod(10,3)!==1){console.error("FAIL:mod");f++;}',
    'if(f===0)console.log("All tests passed");',
    'process.exit(f>0?1:0);',
  ].join('\n');

  const setup = async (dir) => {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(join(dir, 'package.json'), makePackageJson('h146'));
  };

  console.log('\n--- H146: Token Count 5-Bug Fix ---');

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    const output = claudeRun(
      'Fix all 5 bugs in app.js so that node test.js passes. Each arithmetic function has an off-by-one or logic error.',
      dir,
      LONG_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const outputLen = (output || '').length;
    const result = runCmdOutput('node test.js', dir);
    const pass = result.exitCode === 0;
    const stderr = result.stderr || '';
    const fails = (stderr.match(/FAIL/g) || []).length;
    return {
      pass,
      detail: pass ? `5/5 fixed (${outputLen} chars)` : `${5 - fails}/5 fixed (${outputLen} chars)`,
      elapsed,
      outputLen,
    };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const prompt = buildPluginPrompt(
      'fix all 5 arithmetic bugs in app.js',
      [
        'prompt: Fix all 5 off-by-one/logic bugs in add, sub, mul, div, mod in app.js',
        'run: node test.js',
      ],
      ['tests_pass'],
    );
    const start = Date.now();
    const output = claudeRun(prompt, dir, GATE_TIMEOUT);
    const elapsed = (Date.now() - start) / 1000;
    const outputLen = (output || '').length;
    const result = runCmdOutput('node test.js', dir);
    const pass = result.exitCode === 0;
    const stderr = result.stderr || '';
    const fails = (stderr.match(/FAIL/g) || []).length;
    return {
      pass,
      detail: pass ? `5/5 fixed (${outputLen} chars)` : `${5 - fails}/5 fixed (${outputLen} chars)`,
      elapsed,
      outputLen,
    };
  });

  record(
    'H146',
    'Token Count 5-Bug Fix',
    vanillaResult.detail,
    pluginResult.detail,
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

async function testH147() {
  // Time-to-First-Correct Output — simple bug, compare elapsed time
  const appJs = [
    'function greet(name) { return "Hello, " + nme; }', // typo
    'module.exports = { greet };',
  ].join('\n');
  const testJs = [
    'const { greet } = require("./app.js");',
    'try {',
    '  if (greet("World") !== "Hello, World") { console.error("FAIL"); process.exit(1); }',
    '  console.log("Tests passed");',
    '} catch(e) { console.error("FAIL: " + e.message); process.exit(1); }',
  ].join('\n');

  await runStandardTest('H147', 'Time-to-First-Correct', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h147'));
    },
    vanillaPrompt: 'Fix the ReferenceError in app.js so node test.js passes.',
    pluginPrompt: buildPluginPrompt(
      'fix the ReferenceError in app.js',
      ['prompt: Fix the ReferenceError in greet() in app.js', 'run: node test.js'],
      ['tests_pass'],
    ),
    score: (dir) => scoreTestPass(dir),
    timeout: GATE_TIMEOUT,
  });
}

async function testH148() {
  // Tool Call Count Overhead — measure output length as proxy for tool calls
  const appJs = [
    'function double(n) { return n * n; }', // bug: should be n * 2
    'module.exports = { double };',
  ].join('\n');
  const testJs = [
    'const { double } = require("./app.js");',
    'if (double(5) !== 10) { console.error("FAIL: double(5)=" + double(5)); process.exit(1); }',
    'console.log("Tests passed");',
  ].join('\n');

  const setup = async (dir) => {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(join(dir, 'package.json'), makePackageJson('h148'));
  };

  console.log('\n--- H148: Tool Call Count Overhead ---');

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    const output = claudeRun(
      'Fix the bug in app.js so that node test.js passes.',
      dir,
      DEFAULT_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const outputLen = (output || '').length;
    const pass = runCmd('node test.js', dir) === 0;
    return {
      pass,
      detail: `${pass ? 'pass' : 'fail'} (${outputLen} chars output)`,
      elapsed,
      outputLen,
    };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const prompt = buildPluginPrompt(
      'fix the bug in app.js',
      ['prompt: Fix the double() function in app.js', 'run: node test.js'],
      ['tests_pass'],
    );
    const start = Date.now();
    const output = claudeRun(prompt, dir, GATE_TIMEOUT);
    const elapsed = (Date.now() - start) / 1000;
    const outputLen = (output || '').length;
    const pass = runCmd('node test.js', dir) === 0;
    return {
      pass,
      detail: `${pass ? 'pass' : 'fail'} (${outputLen} chars output)`,
      elapsed,
      outputLen,
    };
  });

  const overhead = pluginResult.outputLen - vanillaResult.outputLen;
  const overheadPct =
    vanillaResult.outputLen > 0 ? ((overhead / vanillaResult.outputLen) * 100).toFixed(0) : 'N/A';

  record(
    'H148',
    `Tool Call Count Overhead (+${overheadPct}%)`,
    vanillaResult.detail,
    pluginResult.detail,
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

async function testH149() {
  // Max Retry Graceful Degradation — unfixable test
  // Test expects impossible output: function must return both 42 AND 99 for same input
  console.log('\n--- H149: Max Retry Degradation ---');

  const appJs = ['function magic(n) { return n * 2; }', 'module.exports = { magic };'].join('\n');
  const testJs = [
    'const { magic } = require("./app.js");',
    '// Impossible: same input must produce two different outputs',
    'if (magic(5) !== 42) { console.error("FAIL: magic(5) must be 42, got " + magic(5)); process.exit(1); }',
    'if (magic(5) !== 99) { console.error("FAIL: magic(5) must also be 99, got " + magic(5)); process.exit(1); }',
    'console.log("Tests passed");',
  ].join('\n');

  const setup = async (dir) => {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(join(dir, 'package.json'), makePackageJson('h149'));
  };

  // Vanilla: just ask to fix it
  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    claudeRun('Fix app.js so that node test.js passes.', dir, LONG_TIMEOUT);
    const elapsed = (Date.now() - start) / 1000;
    const pass = runCmd('node test.js', dir) === 0;
    // Check if app.js exists and is reasonable (not corrupted)
    const src = safeReadSync(join(dir, 'app.js'));
    const reasonable = src.includes('function') && src.length > 10;
    return {
      pass,
      detail: pass ? 'somehow passed' : `fail (reasonable state: ${reasonable})`,
      elapsed,
      reasonable,
    };
  });

  // Plugin: retry loop with max 3
  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const prompt = buildPluginPrompt(
      'fix app.js so tests pass',
      [
        'retry max 3',
        '  run: node test.js',
        '  if command_failed',
        '    prompt: The test failed. Try a different approach to fix app.js.',
        '  end',
        'end',
      ],
      ['tests_pass'],
    );
    const start = Date.now();
    claudeRun(prompt, dir, GATE_TIMEOUT);
    const elapsed = (Date.now() - start) / 1000;
    const pass = runCmd('node test.js', dir) === 0;
    const src = safeReadSync(join(dir, 'app.js'));
    const reasonable = src.includes('function') && src.length > 10;
    return {
      pass,
      detail: pass ? 'somehow passed' : `fail (reasonable state: ${reasonable})`,
      elapsed,
      reasonable,
    };
  });

  // Neither should pass (test is impossible), but plugin should degrade gracefully
  record(
    'H149',
    'Max Retry Degradation',
    vanillaResult.detail,
    pluginResult.detail,
    vanillaResult.pass || vanillaResult.reasonable,
    pluginResult.pass || pluginResult.reasonable,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

async function testH150() {
  // Multi-Objective Completeness — 3 independent tasks
  const appJs = [
    'function add(a, b) { return a + b + 1; }', // bug to fix
    'module.exports = { add };',
  ].join('\n');
  const testJs = [
    'const { add } = require("./app.js");',
    'if (add(2, 3) !== 5) { console.error("FAIL"); process.exit(1); }',
    'console.log("Tests passed");',
  ].join('\n');

  await runStandardTest('H150', 'Multi-Objective Completeness', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h150'));
    },
    vanillaPrompt: [
      'Complete ALL three tasks:',
      '1. Fix the bug in app.js so node test.js passes',
      '2. Create a file called README.txt with the text "Project documentation"',
      '3. Create a file called changelog.txt with the text "v1.0.0 - Bug fix release"',
    ].join('\n'),
    pluginPrompt: buildPluginPrompt(
      'complete all 3 tasks: fix bug, create README.txt, create changelog.txt',
      [
        'prompt: Fix the off-by-one bug in add() in app.js',
        'run: node test.js',
        'prompt: Create README.txt with text "Project documentation"',
        'prompt: Create changelog.txt with text "v1.0.0 - Bug fix release"',
      ],
      ['tests_pass', 'file_exists README.txt', 'file_exists changelog.txt'],
    ),
    score: (dir) => {
      const testsOk = runCmd('node test.js', dir) === 0;
      const readmeOk = existsSync(join(dir, 'README.txt'));
      const changelogOk = existsSync(join(dir, 'changelog.txt'));
      const total = [testsOk, readmeOk, changelogOk].filter(Boolean).length;
      return {
        pass: total === 3,
        detail: `${total}/3 objectives (tests:${testsOk} readme:${readmeOk} changelog:${changelogOk})`,
      };
    },
    timeout: GATE_TIMEOUT,
  });
}

async function testH151() {
  // Gate Evaluation Cycle Time — measurement test, always "passes"
  console.log('\n--- H151: Gate Evaluation Cycle Time ---');

  const appJs = [
    'function add(a, b) { return a + b + 1; }', // simple bug
    'module.exports = { add };',
  ].join('\n');
  const testJs = [
    'const { add } = require("./app.js");',
    'if (add(2, 3) !== 5) { console.error("FAIL"); process.exit(1); }',
    'console.log("Tests passed");',
  ].join('\n');

  const setup = async (dir) => {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(join(dir, 'package.json'), makePackageJson('h151'));
  };

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin (measuring gate cycle time)...');
    await setup(dir);
    const prompt = buildPluginPrompt(
      'fix the bug in app.js',
      ['prompt: Fix the off-by-one bug in add() in app.js', 'run: node test.js'],
      ['tests_pass'],
    );
    const start = Date.now();
    claudeRun(prompt, dir, GATE_TIMEOUT);
    const elapsed = (Date.now() - start) / 1000;
    const pass = runCmd('node test.js', dir) === 0;
    return { pass, elapsed };
  });

  record(
    'H151',
    'Gate Evaluation Cycle Time',
    'N/A (measurement only)',
    `${pluginResult.pass ? 'pass' : 'fail'} in ${pluginResult.elapsed.toFixed(1)}s`,
    true,
    true,
    0,
    pluginResult.elapsed,
  );
}

async function testH152() {
  // Bugs-per-Dollar Efficiency — 5 bugs, score = bugs fixed / output length
  const appJs = [
    'function add(a, b) { return a + b + 1; }',
    'function sub(a, b) { return a - b - 1; }',
    'function mul(a, b) { return a * a; }',
    'function neg(n) { return n; }', // should be -n
    'function abs(n) { return n; }', // should be Math.abs(n)
    'module.exports = { add, sub, mul, neg, abs };',
  ].join('\n');
  const testJs = [
    'const { add, sub, mul, neg, abs } = require("./app.js");',
    'let f = 0;',
    'if (add(2,3)!==5){console.error("FAIL:add "+add(2,3));f++;}',
    'if (sub(10,3)!==7){console.error("FAIL:sub "+sub(10,3));f++;}',
    'if (mul(3,4)!==12){console.error("FAIL:mul "+mul(3,4));f++;}',
    'if (neg(5)!==-5){console.error("FAIL:neg "+neg(5));f++;}',
    'if (abs(-7)!==7){console.error("FAIL:abs "+abs(-7));f++;}',
    'if(f===0)console.log("All tests passed");',
    'process.exit(f>0?1:0);',
  ].join('\n');

  const setup = async (dir) => {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(join(dir, 'package.json'), makePackageJson('h152'));
  };

  console.log('\n--- H152: Bugs-per-Dollar Efficiency ---');

  pluginUninstall();
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    await setup(dir);
    const start = Date.now();
    const output = claudeRun(
      'Fix all 5 bugs in app.js so that node test.js passes. Each function has a logic error.',
      dir,
      LONG_TIMEOUT,
    );
    const elapsed = (Date.now() - start) / 1000;
    const outputLen = (output || '').length;
    const result = runCmdOutput('node test.js', dir);
    const pass = result.exitCode === 0;
    const stderr = result.stderr || '';
    const fails = (stderr.match(/FAIL/g) || []).length;
    const bugsFixed = pass ? 5 : Math.max(0, 5 - fails);
    const efficiency = outputLen > 0 ? (bugsFixed / (outputLen / 1000)).toFixed(2) : '0';
    return { pass, detail: `${bugsFixed}/5 bugs, ${outputLen} chars, eff=${efficiency}`, elapsed };
  });

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    await setup(dir);
    const prompt = buildPluginPrompt(
      'fix all 5 bugs in app.js',
      ['prompt: Fix all 5 logic bugs in add, sub, mul, neg, abs in app.js', 'run: node test.js'],
      ['tests_pass'],
    );
    const start = Date.now();
    const output = claudeRun(prompt, dir, GATE_TIMEOUT);
    const elapsed = (Date.now() - start) / 1000;
    const outputLen = (output || '').length;
    const result = runCmdOutput('node test.js', dir);
    const pass = result.exitCode === 0;
    const stderr = result.stderr || '';
    const fails = (stderr.match(/FAIL/g) || []).length;
    const bugsFixed = pass ? 5 : Math.max(0, 5 - fails);
    const efficiency = outputLen > 0 ? (bugsFixed / (outputLen / 1000)).toFixed(2) : '0';
    return { pass, detail: `${bugsFixed}/5 bugs, ${outputLen} chars, eff=${efficiency}`, elapsed };
  });

  record(
    'H152',
    'Bugs-per-Dollar Efficiency',
    vanillaResult.detail,
    pluginResult.detail,
    vanillaResult.pass,
    pluginResult.pass,
    vanillaResult.elapsed,
    pluginResult.elapsed,
  );
}

async function testH153() {
  // Incremental Per-Gate Overhead — run same fix with 1, 2, 3 gates, measure time
  console.log('\n--- H153: Incremental Per-Gate Overhead ---');

  const appJs = [
    'function add(a, b) { return a + b + 1; }', // simple bug
    'module.exports = { add };',
  ].join('\n');
  const testJs = [
    'const { add } = require("./app.js");',
    'if (add(2, 3) !== 5) { console.error("FAIL"); process.exit(1); }',
    'console.log("Tests passed");',
  ].join('\n');

  const setup = async (dir) => {
    await writeFile(join(dir, 'app.js'), appJs);
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(join(dir, 'package.json'), makePackageJson('h153'));
    // Init git for diff_nonempty
    runCmd('git init', dir);
    runCmd('git add -A', dir);
    runCmd('git commit -m "initial"', dir);
  };

  const flowLines = ['prompt: Fix the off-by-one bug in add() in app.js', 'run: node test.js'];

  pluginInstall();

  // Run with 1 gate
  const result1 = await withTempDir(async (dir) => {
    console.log('  Running plugin with 1 gate...');
    await setup(dir);
    const prompt = buildPluginPrompt('fix the bug in app.js', flowLines, ['tests_pass']);
    const start = Date.now();
    claudeRun(prompt, dir, GATE_TIMEOUT);
    const elapsed = (Date.now() - start) / 1000;
    const pass = runCmd('node test.js', dir) === 0;
    return { pass, elapsed };
  });

  // Run with 2 gates
  const result2 = await withTempDir(async (dir) => {
    console.log('  Running plugin with 2 gates...');
    await setup(dir);
    const prompt = buildPluginPrompt('fix the bug in app.js', flowLines, [
      'tests_pass',
      'diff_nonempty',
    ]);
    const start = Date.now();
    claudeRun(prompt, dir, GATE_TIMEOUT);
    const elapsed = (Date.now() - start) / 1000;
    const pass = runCmd('node test.js', dir) === 0;
    return { pass, elapsed };
  });

  // Run with 3 gates
  const result3 = await withTempDir(async (dir) => {
    console.log('  Running plugin with 3 gates...');
    await setup(dir);
    const prompt = buildPluginPrompt('fix the bug in app.js', flowLines, [
      'tests_pass',
      'diff_nonempty',
      'command: node test.js',
    ]);
    const start = Date.now();
    claudeRun(prompt, dir, GATE_TIMEOUT);
    const elapsed = (Date.now() - start) / 1000;
    const pass = runCmd('node test.js', dir) === 0;
    return { pass, elapsed };
  });

  const marginal12 = (result2.elapsed - result1.elapsed).toFixed(1);
  const marginal23 = (result3.elapsed - result2.elapsed).toFixed(1);

  const detail = [
    `1-gate: ${result1.elapsed.toFixed(1)}s (${result1.pass ? 'pass' : 'fail'})`,
    `2-gate: ${result2.elapsed.toFixed(1)}s (${result2.pass ? 'pass' : 'fail'})`,
    `3-gate: ${result3.elapsed.toFixed(1)}s (${result3.pass ? 'pass' : 'fail'})`,
    `marginal: +${marginal12}s, +${marginal23}s`,
  ].join(', ');

  const allPass = result1.pass && result2.pass && result3.pass;

  record(
    'H153',
    'Incremental Per-Gate Overhead',
    'N/A (measurement only)',
    detail,
    true,
    allPass,
    0,
    result3.elapsed,
  );
}

async function testH154() {
  // Gate No-Op Cost — code is already correct, tests already pass
  // Plugin with gate should pass through quickly
  const appJs = [
    'function add(a, b) { return a + b; }',
    'function multiply(a, b) { return a * b; }',
    'module.exports = { add, multiply };',
  ].join('\n');
  const testJs = [
    'const { add, multiply } = require("./app.js");',
    'let f = 0;',
    'if (add(2, 3) !== 5) { console.error("FAIL: add"); f++; }',
    'if (multiply(3, 4) !== 12) { console.error("FAIL: multiply"); f++; }',
    'if (f === 0) console.log("All tests passed");',
    'process.exit(f > 0 ? 1 : 0);',
  ].join('\n');

  await runStandardTest('H154', 'Gate No-Op Cost', {
    setup: async (dir) => {
      await writeFile(join(dir, 'app.js'), appJs);
      await writeFile(join(dir, 'test.js'), testJs);
      await writeFile(join(dir, 'package.json'), makePackageJson('h154'));
    },
    vanillaPrompt: 'Review app.js and fix any bugs so that node test.js passes.',
    pluginPrompt: buildPluginPrompt(
      'ensure app.js is correct and tests pass',
      ['prompt: Review app.js and fix any bugs', 'run: node test.js'],
      ['tests_pass'],
    ),
    score: (dir) => {
      const pass = runCmd('node test.js', dir) === 0;
      return { pass, detail: pass ? 'tests still pass' : 'tests broken by changes' };
    },
    timeout: DEFAULT_TIMEOUT,
  });
}

async function testH155() {
  // Flow Visualization Overhead — 10-step flow, measure execution time
  // Measurement test — always "passes"
  console.log('\n--- H155: Flow Visualization Overhead ---');

  const setup = async (dir) => {
    for (let i = 1; i <= 10; i++) {
      await writeFile(join(dir, `step${i}.txt`), `Content for step ${i}`);
    }
    const testJs = [
      'const fs = require("fs");',
      'let ok = true;',
      'for (let i = 1; i <= 10; i++) {',
      '  if (!fs.existsSync(`step${i}.txt`)) { ok = false; break; }',
      '}',
      'if (ok) { console.log("All steps present"); process.exit(0); }',
      'else { console.error("Missing step files"); process.exit(1); }',
    ].join('\n');
    await writeFile(join(dir, 'test.js'), testJs);
    await writeFile(join(dir, 'package.json'), makePackageJson('h155'));
  };

  pluginInstall();
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin with 10-step flow...');
    await setup(dir);
    const prompt = buildPluginPrompt(
      'read all 10 step files and confirm they exist',
      [
        'prompt: Read step1.txt',
        'prompt: Read step2.txt',
        'prompt: Read step3.txt',
        'prompt: Read step4.txt',
        'prompt: Read step5.txt',
        'prompt: Read step6.txt',
        'prompt: Read step7.txt',
        'prompt: Read step8.txt',
        'prompt: Read step9.txt',
        'prompt: Read step10.txt',
        'run: node test.js',
      ],
      ['tests_pass'],
    );
    const start = Date.now();
    claudeRun(prompt, dir, LONG_HORIZON_TIMEOUT);
    const elapsed = (Date.now() - start) / 1000;
    const pass = runCmd('node test.js', dir) === 0;
    return { pass, elapsed };
  });

  record(
    'H155',
    'Flow Visualization Overhead',
    'N/A (measurement only)',
    `${pluginResult.pass ? 'pass' : 'fail'} in ${pluginResult.elapsed.toFixed(1)}s (10 steps)`,
    true,
    true,
    0,
    pluginResult.elapsed,
  );
}

// ── Print summaries ─────────────────────────────────────────────────

function printIterationSummary(iteration) {
  console.log('\n' + '='.repeat(60));
  if (REPEAT_COUNT > 1) {
    console.log(`[eval-v2] Summary (Iteration ${iteration + 1}/${REPEAT_COUNT})\n`);
  } else {
    console.log('[eval-v2] Summary\n');
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

  // Category breakdown
  const categories = [
    [56, 65, 'Gate Scaling'],
    [66, 75, 'Bug Difficulty'],
    [76, 85, 'Deception'],
    [86, 94, 'Gate-Only'],
    [95, 104, 'List/Foreach'],
    [105, 114, 'Long-Horizon'],
    [115, 124, 'Real-World'],
    [125, 134, 'Variance'],
    [135, 144, 'Model Sensitivity'],
    [145, 155, 'Latency/Efficiency'],
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
      `    ${label.padEnd(20)} P:${pw} V:${vw} T:${ti} F:${bf} (${catResults.length} tests)`,
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
  // Test registry: [number, name, fn, quickInclude]
  const tests = [
    // Category 1: Gate Scaling & Composition
    [56, 'Four-Gate Enforcement Ceiling', testH56, false],
    [57, 'Five-Gate Overload', testH57, false],
    [58, 'Gate Ordering Sensitivity', testH58, true],
    [59, 'Custom Gate vs Built-in Predicate', testH59, false],
    [60, 'Redundant Gate Stacking', testH60, true],
    [61, 'Bare Gate, No Flow Body', testH61, false],
    [62, 'Gate Contradicts Flow Prompt', testH62, false],
    [63, 'Progressive Gate Unlocking', testH63, false],
    [64, 'file_exists for Build Artifacts', testH64, false],
    [65, 'diff_nonempty + tests_pass Combo', testH65, false],
    // Category 2: Bug Difficulty Gradient
    [66, 'Trivial Single Bug (Off-By-One)', testH66, true],
    [67, 'Two Bugs Equal Difficulty', testH67, false],
    [68, 'One Easy + One Hard Bug', testH68, false],
    [69, 'Three Bugs Increasing Subtlety', testH69, false],
    [70, 'Five-Bug Gauntlet', testH70, false],
    [71, 'Single Extremely Subtle Bug', testH71, false],
    [72, 'Intermittent Bug Simulation', testH72, false],
    [73, 'Bug in Test File', testH73, true],
    [74, 'Zero Bugs (False Positive)', testH74, true],
    [75, 'Multi-Language Bug (JS+Python)', testH75, false],
    // Category 3: Deception Resistance Boundaries
    [76, 'Double Gaslighting', testH76, false],
    [77, 'Fake Test Output', testH77, false],
    [78, 'Reverse Gaslighting', testH78, true],
    [79, 'Misdirection to Wrong File', testH79, false],
    [80, 'Deceptive Complexity Inflation', testH80, true],
    [81, 'Authority Deception', testH81, false],
    [82, 'Partial Truth Deception', testH82, false],
    [83, 'Time Pressure Deception', testH83, false],
    [84, 'Deceptive Success Metric', testH84, false],
    [85, 'Stack Overflow Noise', testH85, true],
    // Category 4: Gate-Only Minimal Configs
    [86, 'Bare Gate No Goal', testH86, false],
    [87, 'Gate Only vs Gate+Retry', testH87, false],
    [88, 'Gate Only vs Gate+Prompt', testH88, false],
    [89, 'Gate Only vs Gate+Variable', testH89, false],
    [90, 'Gate Only Honest Prompt', testH90, true],
    [91, 'Gate Only Moderate Misdirection', testH91, false],
    [92, 'Gate on TypeScript', testH92, false],
    [93, 'Gate on CSS/HTML', testH93, true],
    [94, 'Gate with Slow Test', testH94, false],
    // Category 5: List Variables & Foreach
    [95, 'Foreach File Fix with Gate', testH95, false],
    [96, 'List Accumulation 10 Items', testH96, true],
    [97, 'Foreach with Conditional Skip', testH97, false],
    [98, 'Dynamic Foreach from let-run', testH98, false],
    [99, 'Foreach over JSON Array', testH99, true],
    [100, 'Foreach with _length', testH100, true],
    [101, 'Empty List Handling', testH101, true],
    [102, 'Foreach + let-prompt per Item', testH102, false],
    [103, 'List as Error Accumulator', testH103, false],
    [104, 'Foreach 20 Items Scale', testH104, false],
    // Category 6: Long-Horizon Variable Persistence
    [105, '30-Step Token Recall', testH105, false],
    [106, '40-Step Token Recall', testH106, false],
    [107, '15-Step Semantic Distractors', testH107, false],
    [108, 'Variable at 3 Distant Points', testH108, false],
    [109, 'Two Variables Early+Late', testH109, false],
    [110, 'Structured JSON Recall', testH110, true],
    [111, 'Numeric Precision Recall', testH111, true],
    [112, 'Multi-Line Text Recall', testH112, true],
    [113, 'Variable Chain A-B-C', testH113, false],
    [114, 'Variable Overwrite Then Recall', testH114, true],
    // Category 7: Multi-File & Real-World Tasks
    [115, 'Monorepo Shared Dependency', testH115, false],
    [116, 'Database Migration+Seed', testH116, false],
    [117, 'Express API Endpoint', testH117, false],
    [118, 'Config File Generation', testH118, true],
    [119, 'Cross-File Rename', testH119, true],
    [120, 'TDD Two-Phase Gate', testH120, false],
    [121, 'Dependency Upgrade', testH121, false],
    [122, 'Code Review Checklist', testH122, false],
    [123, 'Multi-Step CI Pipeline', testH123, true],
    [124, 'Feature Addition + Regression', testH124, false],
    // Category 8: Variance Reduction
    [125, '3-Bug Fix Variance', testH125, false],
    [126, 'Easy Task Speed', testH126, false],
    [127, 'Flaky Test Interaction', testH127, false],
    [128, '5-Bug Success Rate', testH128, false],
    [129, 'Latency Variance', testH129, false],
    [130, 'Gate Under Temperature', testH130, false],
    [131, 'First-Try Success Rate', testH131, false],
    [132, 'Retry Count Distribution', testH132, false],
    [133, 'Multi-File Consistency', testH133, false],
    [134, 'Wrong Approach Recovery', testH134, false],
    // Category 9: Model Sensitivity
    [135, 'Haiku+Gate vs Haiku', testH135, false],
    [136, 'Haiku+Gate vs Sonnet', testH136, false],
    [137, 'Sonnet+Gate vs Sonnet', testH137, false],
    [138, 'Opus+Gate vs Opus', testH138, false],
    [139, 'Haiku Deception+Gate', testH139, false],
    [140, 'Retry Count Haiku vs Sonnet', testH140, false],
    [141, 'Sonnet with 5 Gates', testH141, false],
    [142, 'Haiku Foreach', testH142, false],
    [143, '15-Step Recall Cross-Model', testH143, false],
    [144, 'Haiku Gaslighting', testH144, false],
    // Category 10: Latency & Efficiency
    [145, 'Token Count Simple Fix', testH145, true],
    [146, 'Token Count 5-Bug Fix', testH146, false],
    [147, 'Time-to-First-Correct', testH147, false],
    [148, 'Tool Call Count Overhead', testH148, true],
    [149, 'Max Retry Degradation', testH149, false],
    [150, 'Multi-Objective Completeness', testH150, false],
    [151, 'Gate Evaluation Cycle Time', testH151, true],
    [152, 'Bugs-per-Dollar Efficiency', testH152, false],
    [153, 'Incremental Per-Gate Overhead', testH153, false],
    [154, 'Gate No-Op Cost', testH154, true],
    [155, 'Flow Visualization Overhead', testH155, true],
  ];

  const activeTests = QUICK_MODE ? tests.filter(([, , , q]) => q) : tests;
  const testCount = RANGE_FILTER
    ? tests.filter(([n]) => RANGE_FILTER.has(n)).length
    : activeTests.length;
  const estMinutes = Math.round(testCount * 2 * REPEAT_COUNT);

  console.log(`[eval-v2] Plugin vs Vanilla — ${testCount} Hypotheses (H56-H155)\n`);
  if (QUICK_MODE) console.log('  Mode: QUICK (no gate loops)');
  else console.log(`  Mode: FULL (all ${testCount} hypotheses)`);
  if (MODEL_OVERRIDE) console.log(`  Model override: ${MODEL_OVERRIDE}`);
  if (REPEAT_COUNT > 1) console.log(`  Repeats: ${REPEAT_COUNT}`);
  console.log(`  Estimated runtime: ~${estMinutes} minutes\n`);

  try {
    execSync('claude --version', { encoding: 'utf-8', timeout: 5000 });
  } catch {
    console.log('[eval-v2] SKIP — claude CLI not found.');
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
  console.log('\n[eval-v2] Plugin re-installed. Environment restored.');
}

main().catch((err) => {
  try {
    pluginInstall();
  } catch {
    /* best effort */
  }
  console.error('[eval-v2] Fatal error:', err.message);
  process.exit(1);
});
