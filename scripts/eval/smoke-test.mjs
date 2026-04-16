#!/usr/bin/env node
/**
 * smoke-test.mjs — Live flow smoke tests via the configured AI harness.
 *
 * Validates end-to-end flow execution through the configured harness.
 * Unlike unit tests (mocks) and e2e-eval (hook pipe-through), these
 * tests run the actual flow runtime against a live model session.
 *
 * Requires: the configured harness CLI available.
 * Claude smoke runs still expect the plugin to be installed.
 *
 * Tests:
 *   A: Context file relay       B: Context recall
 *   C: Variable interpolation   D: Gate evaluation (slow)
 *   E: Run auto-execution       F: Foreach iteration
 *   G: Let-prompt capture       H: If/else branching
 *   I: Try/catch handling       J: While loop (slow)
 *   K: Variable chain            L: Retry on failure (slow)
 *   M: Gate-only mode            N: Capture reliability
 *   O: Until loop (slow)         P: Break exits loop
 *   Q: List append               R: Custom gate (slow)
 *   S: Nested foreach (slow)     T: List accumulation (slow)
 *   U: And/or conditions         V: Numeric comparison
 *   W: Try/finally               X: Break in nested (slow)
 *   Y: Until variable (slow)     Z: Multi-var interpolation
 *   AA: Approve timeout          AB: Review block
 *   AC: Remember + memory:       AD: Race block (slow)
 *   AE: foreach-spawn (slow)     AF: Send/receive (slow)
 *   AG: Import anonymous flow     AH: Namespaced library
 *   AI: Continue iteration        AJ: Remember key-value
 *   AK: Grounded-by while         AL: Continue in while
 *   AM: Spawn/await               AN: Spawn variable import
 *   AO: Include file directive    AP: Swarm manager-worker
 *   AQ: Swarm reviewer-after-workers
 *   AR: Retry with backoff (slow)       AS: Composite all(...) gate
 *   AT: Spawn with modifiers            AU: Nested try/catch/finally
 *   AV: foreach item in run "cmd"
 *   AY: Agent+skills spawn (slow)     AZ: Profile-bound spawn (slow)
 *
 * Usage:
 *   node scripts/eval/smoke-test.mjs          # all tests
 *   node scripts/eval/smoke-test.mjs --quick  # fast subset (no gate test)
 *   node scripts/eval/smoke-test.mjs --harness codex
 *   AI_CMD="gemini -p --yolo" node scripts/eval/smoke-test.mjs
 */

import { execSync } from 'node:child_process';
import {
  mkdtemp,
  rm,
  readFile,
  writeFile,
  mkdir,
  readdir,
  unlink,
  appendFile,
  access,
} from 'node:fs/promises';
import { tmpdir, platform } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkHarnessVersion,
  getFlowCommandLabel,
  getHarnessLabel,
  getHarnessName,
  runHarnessFlow,
  verifyTraceForCwd,
} from './harness.mjs';

const TRACE_ENABLED = process.env.PL_TRACE === '1';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, 'results');
const FLAKY_REPORT = join(__dirname, 'flaky-report.mjs');

const QUICK_MODE = process.argv.includes('--quick');
const HISTORY_MODE = process.argv.includes('--history');
const ONLY_FILTERS = parseOnlyFilters(process.argv, process.env.SMOKE_ONLY);
const TIMEOUT = resolveTimeout();

let passed = 0;
let failed = 0;

/** Structured results collected during the run. */
const results = [];
let currentTest = { name: '', label: '', startTime: 0 };

function assert(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }

  // Extract test code from label (e.g. "A: Context file relay" → "A", "AA: Approve" → "AA")
  const testName = label.match(/^([A-Z]+):/)?.[1] ?? label;
  const testLabel = label.replace(/^[A-Z]+:\s*/, '');
  const duration = Date.now() - currentTest.startTime;

  results.push({
    name: testName,
    label: testLabel,
    passed: condition,
    duration_ms: duration,
    error: condition ? null : detail || null,
  });
}

/** Wrap a test function to track timing. */
async function timed(name, label, fn) {
  if (ONLY_FILTERS && !ONLY_FILTERS.has(name)) {
    console.log(`  SKIP  ${name}: ${label} (--only filter)`);
    return;
  }

  currentTest = { name, label, startTime: Date.now() };
  await fn();
}

function parseOnlyFilters(argv, envOnly) {
  const flagIndex = argv.indexOf('--only');
  const flagValue = flagIndex >= 0 ? argv[flagIndex + 1] : null;
  const raw = flagValue || envOnly;
  if (!raw) return null;

  const values = raw
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length > 0);
  return values.length > 0 ? new Set(values) : null;
}

function resolveTimeout() {
  const override = Number.parseInt(process.env.EVAL_TIMEOUT_MS ?? '', 10);
  if (Number.isFinite(override) && override > 0) {
    return override;
  }

  const harness = getHarnessName();
  if (harness === 'codex') {
    return 240_000;
  }

  if (harness !== 'opencode' && harness !== 'ollama') {
    return 120_000;
  }

  const model = (process.env.EVAL_MODEL ?? '').toLowerCase();
  if (model.startsWith('ollama/')) {
    if (/(^|[:/-])(26b|27b|31b|70b)([:/-]|$)/.test(model)) {
      return 1_800_000;
    }
    return 300_000;
  }

  return 120_000;
}

function formatOutputSnippet(text) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 200);
}

function isReadyFlowOutput(text) {
  return /\bok\b/i.test(text) || /\[prompt-language CI\]\s+Flow completed\./i.test(text);
}

/** Write structured results to a JSON file. */
async function writeResults(totalStart) {
  await mkdir(RESULTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runId = new Date().toISOString();
  const filename = `smoke-${timestamp}.json`;
  const filepath = join(RESULTS_DIR, filename);

  let nodeVersion = '';
  try {
    nodeVersion = execSync('node -v', { encoding: 'utf-8' }).trim();
  } catch {
    nodeVersion = process.version;
  }

  const report = {
    timestamp: runId,
    os: platform(),
    nodeVersion,
    quickMode: QUICK_MODE,
    duration_ms: Date.now() - totalStart,
    passed,
    failed,
    tests: results,
  };

  await writeFile(filepath, JSON.stringify(report, null, 2));
  console.log(`\n[smoke-test] Results written to ${filepath}`);
  await appendHistory(report, runId);
}

async function appendHistory(report, runId) {
  const lines = report.tests.map((test) =>
    JSON.stringify({
      date: report.timestamp,
      runId,
      testId: test.name,
      testName: test.label,
      passed: test.passed,
      durationMs: test.duration_ms,
      attempt: 1,
      quickMode: report.quickMode,
      os: report.os,
      nodeVersion: report.nodeVersion,
    }),
  );

  await mkdir(RESULTS_DIR, { recursive: true });
  await appendFile(join(RESULTS_DIR, 'history.jsonl'), `${lines.join('\n')}\n`);
}

/** Keep only the most recent 50 result files. */
async function cleanupOldResults() {
  try {
    const files = (await readdir(RESULTS_DIR))
      .filter((f) => f.startsWith('smoke-') && f.endsWith('.json'))
      .sort();

    if (files.length > 50) {
      const toDelete = files.slice(0, files.length - 50);
      for (const f of toDelete) {
        await unlink(join(RESULTS_DIR, f));
      }
      console.log(`[smoke-test] Cleaned up ${toDelete.length} old result file(s).`);
    }
  } catch {
    /* results dir may not exist yet */
  }
}

function assertHarnessReady() {
  try {
    const version = checkHarnessVersion();
    console.log(`[smoke-test] Harness: ${getHarnessLabel()} ${version}`);
  } catch {
    console.error(`[smoke-test] SKIP — ${getHarnessLabel()} not found.`);
    process.exit(2);
  }

  try {
    const readinessOutput = runHarnessFlow(
      ['Goal: readiness check', '', 'flow:', '  prompt: Return only OK'].join('\n'),
      {
        cwd: process.cwd(),
        timeout: TIMEOUT,
        strict: true,
      },
    ).trim();

    if (readinessOutput.length === 0) {
      throw new Error('empty readiness output');
    }
    if (!isReadyFlowOutput(readinessOutput)) {
      throw new Error(`unexpected readiness output: ${formatOutputSnippet(readinessOutput)}`);
    }
  } catch (error) {
    const output = `${error?.stdout ?? ''}\n${error?.stderr ?? ''}\n${error?.message ?? ''}`;
    if (
      /does not have access to Claude|login again|contact your administrator|auth/i.test(output)
    ) {
      console.error(
        `[smoke-test] BLOCKED — ${getHarnessLabel()} login/access is unavailable in this environment.`,
      );
      console.error(
        `[smoke-test] \`${getFlowCommandLabel()}\` returned an authorization error; smoke scenarios were not run.`,
      );
      process.exit(2);
    }
    if (/empty readiness output/i.test(output)) {
      console.error(
        `[smoke-test] BLOCKED — ${getHarnessLabel()} readiness check returned no output.`,
      );
      console.error(
        `[smoke-test] \`${getFlowCommandLabel()}\` produced empty output for a trivial flow; smoke scenarios were not run.`,
      );
      process.exit(2);
    }
    if (/unexpected readiness output:/i.test(output)) {
      const snippet =
        output.match(/unexpected readiness output:\s*(.+)$/im)?.[1]?.trim() ??
        formatOutputSnippet(output);
      console.error(
        `[smoke-test] BLOCKED — ${getHarnessLabel()} readiness check returned unexpected output.`,
      );
      console.error(
        `[smoke-test] \`${getFlowCommandLabel()}\` must execute the flow and emit an OK-style result for the readiness probe.`,
      );
      console.error(`[smoke-test] Readiness output: ${snippet}`);
      process.exit(2);
    }
    if (getHarnessName() === 'opencode') {
      console.error(
        `[smoke-test] BLOCKED — ${getHarnessLabel()} could not complete a trivial flow in this environment.`,
      );
      console.error(
        `[smoke-test] \`${getFlowCommandLabel()}\` failed during readiness check. Review the configured model and local runner state.`,
      );
      process.exit(2);
    }
    throw error;
  }
}

function harnessRun(prompt, cwd) {
  try {
    return runHarnessFlow(prompt, { cwd, timeout: TIMEOUT });
  } catch (error) {
    if (error.stderr) {
      console.error(`  [debug] stderr: ${error.stderr.slice(0, 200)}`);
    }
    return error.stdout ?? '';
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cleanupDir(dir, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await rm(dir, { recursive: true, force: true });
      return;
    } catch {
      // Windows EBUSY: wait for file locks to release
      if (i < retries - 1) await sleep(1000);
    }
  }
}

async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'pl-smoke-'));
  try {
    await fn(dir);
    if (TRACE_ENABLED) {
      const verdict = verifyTraceForCwd(dir);
      if (!verdict.ok) {
        assert(
          `${currentTest.name}: trace verification`,
          false,
          verdict.message || 'verify-trace reported failure',
        );
      } else if (!verdict.skipped) {
        assert(`${currentTest.name}: trace verification`, true, 'verify-trace OK');
      }
    }
  } finally {
    await cleanupDir(dir);
  }
}

// ── Test A: Context preservation (file relay) ────────────────────────

async function testContextFileRelay() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: context test',
      '',
      'flow:',
      '  prompt: Create secret.txt containing exactly "magic-unicorn-42"',
      '  prompt: Read secret.txt and write its contents to answer.txt',
    ].join('\n');

    harnessRun(prompt, dir);

    let content = '';
    try {
      content = (await readFile(join(dir, 'answer.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'A: Context file relay',
      content.includes('magic-unicorn-42'),
      content.includes('magic-unicorn-42')
        ? 'answer.txt correct'
        : `got: "${content.slice(0, 60)}"`,
    );
  });
}

// ── Test B: Context recall (memory across prompts) ───────────────────

async function testContextRecall() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: recall test',
      '',
      'flow:',
      '  prompt: The code is "alpha-bravo-99". Acknowledge it.',
      '  prompt: Create a file called recall.txt containing exactly the code from the previous step, nothing else.',
    ].join('\n');

    harnessRun(prompt, dir);

    let content = '';
    try {
      content = (await readFile(join(dir, 'recall.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'B: Context recall',
      content.includes('alpha-bravo-99'),
      content.includes('alpha-bravo-99') ? 'recall.txt correct' : `got: "${content.slice(0, 60)}"`,
    );
  });
}

// ── Test C: Variable interpolation + run auto-advance ────────────────

async function testVariableInterpolation() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test let/var',
      '',
      'flow:',
      '  var greeting = "hello world"',
      '  let ver = run "node -v"',
      '  prompt: Write the greeting "${greeting}" and node version "${ver}" to result.txt',
    ].join('\n');

    harnessRun(prompt, dir);

    let content = '';
    try {
      content = (await readFile(join(dir, 'result.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'C: Variable interpolation',
      content.includes('hello world') && /v\d+/.test(content),
      content.includes('hello world') ? 'variables resolved' : `got: "${content.slice(0, 60)}"`,
    );
  });
}

// ── Test D: Gate evaluation (done when: tests_pass) ──────────────────

async function testGateEvaluation() {
  await withTempDir(async (dir) => {
    // Create a broken app.js and a package.json so `npm test` runs `node app.js`
    await writeFile(join(dir, 'app.js'), 'process.exit(1)\n');
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'gate-test', scripts: { test: 'node app.js' } }),
    );

    const prompt = [
      'Goal: fix app',
      '',
      'flow:',
      '  prompt: Fix app.js so it exits 0 instead of 1',
      '  run: node app.js',
      '',
      'done when:',
      '  tests_pass',
    ].join('\n');

    harnessRun(prompt, dir);

    // Verify app.js was fixed — should exit 0 now
    let exitCode = 1;
    try {
      execSync(`node "${join(dir, 'app.js')}"`, { timeout: 5000 });
      exitCode = 0;
    } catch {
      /* still fails */
    }

    assert(
      'D: Gate evaluation (tests_pass)',
      exitCode === 0,
      exitCode === 0 ? 'app.js fixed, exits 0' : 'app.js still exits non-zero',
    );
  });
}

// ── Test E: Run auto-execution ───────────────────────────────────────

async function testRunAutoExecution() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test run auto-exec',
      '',
      'flow:',
      '  run: echo hello > run-output.txt',
      '  prompt: Check if run-output.txt exists and confirm its contents.',
    ].join('\n');

    harnessRun(prompt, dir);

    let content = '';
    try {
      content = (await readFile(join(dir, 'run-output.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'E: Run auto-execution',
      content.includes('hello'),
      content.includes('hello') ? 'run-output.txt created' : `got: "${content.slice(0, 60)}"`,
    );
  });
}

// ── Test F: Foreach iteration ─────────────────────────────────────────

async function testForeachIteration() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test foreach',
      '',
      'flow:',
      '  foreach item in "alpha beta gamma"',
      '    prompt: Write the word "${item}" to ${item}.txt',
      '  end',
    ].join('\n');

    harnessRun(prompt, dir);

    let found = 0;
    for (const name of ['alpha', 'beta', 'gamma']) {
      try {
        const content = (await readFile(join(dir, `${name}.txt`), 'utf-8')).trim();
        if (content.includes(name)) found++;
      } catch {
        /* file not created */
      }
    }

    assert(
      'F: Foreach iteration',
      found >= 2,
      found >= 2 ? `${found}/3 files created` : `only ${found}/3 files found`,
    );
  });
}

// ── Test G: Let-prompt capture ─────────────────────────────────────────

async function testLetPromptCapture() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test let-prompt capture',
      '',
      'flow:',
      '  let items = prompt "List exactly three colors: red, green, blue. One per line, no bullets."',
      '  foreach item in "${items}"',
      '    run: echo ${item} >> colors.txt',
      '  end',
    ].join('\n');

    harnessRun(prompt, dir);

    let content = '';
    try {
      content = (await readFile(join(dir, 'colors.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    assert(
      'G: Let-prompt capture + foreach',
      lines.length >= 2,
      lines.length >= 2
        ? `${lines.length} lines in colors.txt`
        : `only ${lines.length} lines: "${content.slice(0, 80)}"`,
    );
  });
}

// ── Test H: If/else branching ──────────────────────────────────────────

async function testIfElseBranching() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test if/else',
      '',
      'flow:',
      '  run: node -e "process.exit(0)"',
      '  if command_succeeded',
      '    prompt: Create branch-result.txt containing exactly "took-then-branch", nothing else.',
      '  else',
      '    prompt: Create branch-result.txt containing exactly "took-else-branch", nothing else.',
      '  end',
    ].join('\n');

    harnessRun(prompt, dir);

    let content = '';
    try {
      content = (await readFile(join(dir, 'branch-result.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'H: If/else branching',
      content.includes('took-then-branch'),
      content.includes('took-then-branch')
        ? 'then-branch taken correctly'
        : `got: "${content.slice(0, 60)}"`,
    );
  });
}

// ── Test I: Try/catch error handling ──────────────────────────────────

async function testTryCatch() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test try/catch',
      '',
      'flow:',
      '  try',
      '    run: node -e "process.exit(1)"',
      '  catch command_failed',
      '    prompt: Create catch-result.txt containing exactly "catch-triggered", nothing else.',
      '  end',
    ].join('\n');

    harnessRun(prompt, dir);

    let content = '';
    try {
      content = (await readFile(join(dir, 'catch-result.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'I: Try/catch error handling',
      content.includes('catch-triggered'),
      content.includes('catch-triggered')
        ? 'catch body executed correctly'
        : `got: "${content.slice(0, 60)}"`,
    );
  });
}

// ── Test K: Variable chain (let-run + if + interpolation) ────────────

async function testVariableChain() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test variable chain',
      '',
      'flow:',
      '  let val = run "echo chain-value-42"',
      '  if command_succeeded',
      '    prompt: Create chain-result.txt containing exactly "${val}", nothing else.',
      '  end',
    ].join('\n');

    harnessRun(prompt, dir);

    let content = '';
    try {
      content = (await readFile(join(dir, 'chain-result.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'K: Variable chain (let-run + if + interpolation)',
      content.includes('chain-value-42'),
      content.includes('chain-value-42')
        ? 'variable interpolated in if-branch'
        : `got: "${content.slice(0, 60)}"`,
    );
  });
}

// ── Test J: While loop ────────────────────────────────────────────────

async function testWhileLoop() {
  await withTempDir(async (dir) => {
    // Create a broken app.js and package.json so `npm test` runs `node app.js`
    await writeFile(join(dir, 'app.js'), 'process.exit(1)\n');
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'while-test', scripts: { test: 'node app.js' } }),
    );

    const prompt = [
      'Goal: fix app using while loop',
      '',
      'flow:',
      '  while tests_fail max 3',
      '    prompt: Fix app.js so it exits 0 instead of 1',
      '    run: node app.js',
      '  end',
    ].join('\n');

    harnessRun(prompt, dir);

    let exitCode = 1;
    try {
      execSync(`node "${join(dir, 'app.js')}"`, { timeout: 5000 });
      exitCode = 0;
    } catch {
      /* still fails */
    }

    assert(
      'J: While loop (tests_fail)',
      exitCode === 0,
      exitCode === 0 ? 'app.js fixed via while loop' : 'app.js still exits non-zero',
    );
  });
}

// ── Test L: Retry on failure ──────────────────────────────────────────

async function testRetryOnFailure() {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, 'app.js'), 'process.exit(1)\n');

    const prompt = [
      'Goal: fix app using retry',
      '',
      'flow:',
      '  retry max 3',
      '    run: node app.js',
      '    if command_failed',
      '      prompt: Fix app.js so it exits 0 instead of 1',
      '    end',
      '  end',
    ].join('\n');

    harnessRun(prompt, dir);

    let exitCode = 1;
    try {
      execSync(`node "${join(dir, 'app.js')}"`, { timeout: 5000 });
      exitCode = 0;
    } catch {
      /* still fails */
    }

    assert(
      'L: Retry on failure',
      exitCode === 0,
      exitCode === 0 ? 'app.js fixed via retry' : 'app.js still exits non-zero',
    );
  });
}

// ── Test M: Gate-only mode (no flow block) ────────────────────────────

async function testGateOnlyMode() {
  await withTempDir(async (dir) => {
    // Create a broken app.js and package.json so `npm test` runs `node app.js`
    await writeFile(join(dir, 'app.js'), 'process.exit(1)\n');
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'gate-only-test', scripts: { test: 'node app.js' } }),
    );

    // No flow: block — just a prompt with done when:
    const prompt = 'Fix app.js so it exits 0 instead of 1.\n\ndone when:\n  tests_pass';

    harnessRun(prompt, dir);

    let exitCode = 1;
    try {
      execSync(`node "${join(dir, 'app.js')}"`, { timeout: 5000 });
      exitCode = 0;
    } catch {
      /* still fails */
    }

    assert(
      'M: Gate-only mode (no flow block)',
      exitCode === 0,
      exitCode === 0 ? 'app.js fixed via gate-only mode' : 'app.js still exits non-zero',
    );
  });
}

// ── Test N: Capture reliability (tag-based) ───────────────────────────

async function testCaptureReliability() {
  await withTempDir(async (dir) => {
    // D8: use unique sentinel to avoid false positives from Claude guessing
    const prompt = [
      'Goal: test capture reliability',
      '',
      'flow:',
      '  let answer = prompt "Reply with exactly this text and nothing else: pl-capture-7x9q"',
      '  prompt: Write the answer "${answer}" to capture-result.txt. Write only the variable value, nothing else.',
    ].join('\n');

    harnessRun(prompt, dir);

    let content = '';
    try {
      content = (await readFile(join(dir, 'capture-result.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'N: Capture reliability (tag-based)',
      content.includes('pl-capture-7x9q'),
      content.includes('pl-capture-7x9q')
        ? 'variable captured and interpolated'
        : `got: "${content.slice(0, 60)}"`,
    );
  });
}

// ── Test O: Until loop ────────────────────────────────────────────────

async function testUntilLoop() {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, 'app.js'), 'process.exit(1)\n');

    const prompt = [
      'Goal: fix app using until loop',
      '',
      'flow:',
      '  until command_succeeded max 3',
      '    prompt: Fix app.js so it exits 0 instead of 1',
      '    run: node app.js',
      '  end',
    ].join('\n');

    harnessRun(prompt, dir);

    let exitCode = 1;
    try {
      execSync(`node "${join(dir, 'app.js')}"`, { timeout: 5000 });
      exitCode = 0;
    } catch {
      /* still fails */
    }

    assert(
      'O: Until loop (command_succeeded)',
      exitCode === 0,
      exitCode === 0 ? 'app.js fixed via until loop' : 'app.js still exits non-zero',
    );
  });
}

// ── Test P: Break exits loop early ───────────────────────────────────

async function testBreakNode() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test break',
      '',
      'flow:',
      '  foreach item in "first second third"',
      '    run: echo ${item} >> items.txt',
      '    if ${item} == "first"',
      '      break',
      '    end',
      '  end',
      '  prompt: Confirm items.txt exists and contains only "first".',
    ].join('\n');

    harnessRun(prompt, dir);

    let content = '';
    try {
      content = (await readFile(join(dir, 'items.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    // Break should exit after first item — only "first" written
    assert(
      'P: Break exits loop early',
      content.includes('first') && !content.includes('second'),
      content.includes('first') && !content.includes('second')
        ? 'break exited after first item'
        : `got: "${content.slice(0, 80)}"`,
    );
  });
}

// ── Test Q: List append ──────────────────────────────────────────────

async function testListAppend() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test list append',
      '',
      'flow:',
      '  let items = []',
      '  let items += "apple"',
      '  let items += "banana"',
      '  let items += "cherry"',
      '  prompt: Write the value of "${items}" to list-result.txt. Write only the raw variable value.',
    ].join('\n');

    harnessRun(prompt, dir);

    let content = '';
    try {
      content = (await readFile(join(dir, 'list-result.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'Q: List append',
      content.includes('apple') && content.includes('banana') && content.includes('cherry'),
      content.includes('apple')
        ? 'list items accumulated correctly'
        : `got: "${content.slice(0, 80)}"`,
    );
  });
}

// ── Test R: Custom gate ──────────────────────────────────────────────

async function testCustomGate() {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, 'app.js'), 'process.exit(1)\n');

    const prompt = [
      'Goal: fix app with custom gate',
      '',
      'flow:',
      '  prompt: Fix app.js so it exits 0 instead of 1',
      '  run: node app.js',
      '',
      'done when:',
      '  gate app_works: node app.js',
    ].join('\n');

    harnessRun(prompt, dir);

    let exitCode = 1;
    try {
      execSync(`node "${join(dir, 'app.js')}"`, { timeout: 5000 });
      exitCode = 0;
    } catch {
      /* still fails */
    }

    assert(
      'R: Custom gate',
      exitCode === 0,
      exitCode === 0 ? 'app.js fixed via custom gate' : 'app.js still exits non-zero',
    );
  });
}

// ── Test S: Nested foreach (prompt inside nested loop) ─────────────────

async function testNestedForeach() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test nested foreach with prompts',
      '',
      'flow:',
      '  foreach color in "red blue"',
      '    foreach size in "small large"',
      '      prompt: Create a file called ${color}-${size}.txt containing exactly "${color}-${size}", nothing else.',
      '    end',
      '  end',
    ].join('\n');

    harnessRun(prompt, dir);

    const expected = ['red-small', 'red-large', 'blue-small', 'blue-large'];
    let found = 0;
    for (const combo of expected) {
      try {
        const content = (await readFile(join(dir, `${combo}.txt`), 'utf-8')).trim();
        if (content.includes(combo)) found++;
      } catch {
        /* file not created */
      }
    }

    assert(
      'S: Nested foreach',
      found >= 3,
      found >= 3 ? `${found}/4 combo files created` : `only ${found}/4 combo files found`,
    );
  });
}

// ── Test T: List accumulation in foreach ───────────────────────────────

async function testListAccumulation() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test list accumulation in foreach',
      '',
      'flow:',
      '  let fruits = "apple banana cherry"',
      '  let results = []',
      '  foreach item in "${fruits}"',
      '    let results += run "echo processed-${item}"',
      '  end',
      '  run: echo ${results_length} > count.txt',
      '  run: echo ${results} > accumulated.txt',
    ].join('\n');

    harnessRun(prompt, dir);

    let countContent = '';
    let accContent = '';
    try {
      countContent = (await readFile(join(dir, 'count.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }
    try {
      accContent = (await readFile(join(dir, 'accumulated.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    const hasCount = countContent.includes('3');
    // shellInterpolate wraps values in single quotes, so items may be
    // processed-apple or processed-'apple' depending on output method
    const hasItems =
      accContent.includes('processed-') &&
      accContent.includes('apple') &&
      accContent.includes('banana') &&
      accContent.includes('cherry');

    assert(
      'T: List accumulation in foreach',
      hasCount && hasItems,
      hasCount && hasItems
        ? 'count=3, all items accumulated'
        : `count="${countContent}", acc="${accContent.slice(0, 80)}"`,
    );
  });
}

// ── Test U: And/or conditions ─────────────────────────────────────────

async function testAndOrConditions() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test and/or conditions',
      '',
      'flow:',
      '  let a = "yes"',
      '  let b = "yes"',
      '  run: node -e "process.exit(0)"',
      '  if command_succeeded and ${a} == "yes"',
      '    run: echo and-pass > and-result.txt',
      '  else',
      '    run: echo and-fail > and-result.txt',
      '  end',
      '  if ${a} == "no" or ${b} == "yes"',
      '    run: echo or-pass > or-result.txt',
      '  else',
      '    run: echo or-fail > or-result.txt',
      '  end',
    ].join('\n');

    harnessRun(prompt, dir);

    let andContent = '';
    let orContent = '';
    try {
      andContent = (await readFile(join(dir, 'and-result.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }
    try {
      orContent = (await readFile(join(dir, 'or-result.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'U: And/or conditions',
      andContent.includes('and-pass') && orContent.includes('or-pass'),
      andContent.includes('and-pass') && orContent.includes('or-pass')
        ? 'both and/or branches correct'
        : `and="${andContent}", or="${orContent}"`,
    );
  });
}

// ── Test V: Numeric comparison ────────────────────────────────────────

async function testNumericComparison() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test numeric comparison',
      '',
      'flow:',
      '  let count = run "echo 3"',
      '  if ${count} < 5',
      '    run: echo less-than-pass > cmp-result.txt',
      '  else',
      '    run: echo less-than-fail > cmp-result.txt',
      '  end',
      '  if ${count} >= 3',
      '    run: echo gte-pass > gte-result.txt',
      '  else',
      '    run: echo gte-fail > gte-result.txt',
      '  end',
    ].join('\n');

    harnessRun(prompt, dir);

    let cmpContent = '';
    let gteContent = '';
    try {
      cmpContent = (await readFile(join(dir, 'cmp-result.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }
    try {
      gteContent = (await readFile(join(dir, 'gte-result.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'V: Numeric comparison',
      cmpContent.includes('less-than-pass') && gteContent.includes('gte-pass'),
      cmpContent.includes('less-than-pass') && gteContent.includes('gte-pass')
        ? 'both comparisons correct'
        : `cmp="${cmpContent}", gte="${gteContent}"`,
    );
  });
}

// ── Test W: Try/finally ───────────────────────────────────────────────

async function testTryFinally() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test try/finally',
      '',
      'flow:',
      '  try',
      '    run: node -e "process.exit(1)"',
      '  catch command_failed',
      '    run: echo catch-ran > catch-result.txt',
      '  finally',
      '    run: echo finally-ran > finally-result.txt',
      '  end',
    ].join('\n');

    harnessRun(prompt, dir);

    let catchContent = '';
    let finallyContent = '';
    try {
      catchContent = (await readFile(join(dir, 'catch-result.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }
    try {
      finallyContent = (await readFile(join(dir, 'finally-result.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'W: Try/finally',
      catchContent.includes('catch-ran') && finallyContent.includes('finally-ran'),
      catchContent.includes('catch-ran') && finallyContent.includes('finally-ran')
        ? 'catch and finally both executed'
        : `catch="${catchContent}", finally="${finallyContent}"`,
    );
  });
}

// ── Test X: Break inside if inside foreach ─────────────────────────────

async function testBreakInsideIfForeach() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test break inside if inside foreach',
      '',
      'flow:',
      '  foreach item in "one two three four"',
      '    run: echo ${item} >> visited.txt',
      '    if ${item} == "two"',
      '      run: echo stopped-at-two > break-marker.txt',
      '      break',
      '    end',
      '  end',
    ].join('\n');

    harnessRun(prompt, dir);

    let visitedContent = '';
    let markerContent = '';
    try {
      visitedContent = (await readFile(join(dir, 'visited.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }
    try {
      markerContent = (await readFile(join(dir, 'break-marker.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    const hasOne = visitedContent.includes('one');
    const hasTwo = visitedContent.includes('two');
    const noThree = !visitedContent.includes('three');
    const markerCorrect = markerContent.includes('stopped-at-two');

    assert(
      'X: Break inside if inside foreach',
      hasOne && hasTwo && noThree && markerCorrect,
      hasOne && hasTwo && noThree && markerCorrect
        ? 'break stopped at two, marker created'
        : `visited="${visitedContent.slice(0, 80)}", marker="${markerContent.slice(0, 40)}"`,
    );
  });
}

// ── Test Y: Until with variable condition ──────────────────────────────

async function testUntilVariable() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test until with variable condition',
      '',
      'flow:',
      '  let counter = "0"',
      '  until ${counter} == "3" max 5',
      '    let counter = run "node -e \\"console.log(Number(${counter}) + 1)\\""',
      '    run: echo iter-${counter} >> until-log.txt',
      '  end',
      '  run: echo counter-reached-${counter} > until-final.txt',
    ].join('\n');

    harnessRun(prompt, dir);

    let finalContent = '';
    try {
      finalContent = (await readFile(join(dir, 'until-final.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'Y: Until with variable condition',
      finalContent.includes('counter-reached-3'),
      finalContent.includes('counter-reached-3')
        ? 'counter reached 3, result written'
        : `got: "${finalContent.slice(0, 60)}"`,
    );
  });
}

// ── Test Z: Multi-variable interpolation in run ───────────────────────

async function testMultiVarInterpolation() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test multi-variable interpolation',
      '',
      'flow:',
      '  let host = "localhost"',
      '  let port = run "echo 8080"',
      '  let proto = "https"',
      '  run: echo ${proto}-${host}-${port} > multi-var.txt',
    ].join('\n');

    harnessRun(prompt, dir);

    let content = '';
    try {
      content = (await readFile(join(dir, 'multi-var.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'Z: Multi-variable interpolation in run',
      content.includes('https-localhost-8080'),
      content.includes('https-localhost-8080')
        ? 'all 3 variables interpolated'
        : `got: "${content.slice(0, 60)}"`,
    );
  });
}

// ── Test AA: Approve (timeout auto-advance) ───────────────────────────

async function testApproveTimeout() {
  await withTempDir(async (dir) => {
    // approve with timeout 2 — auto-advances without human interaction
    const prompt = [
      'Goal: test approve node',
      '',
      'flow:',
      '  run: echo before > before.txt',
      '  approve "Auto-approve this?" timeout 2',
      '  run: echo after > after.txt',
    ].join('\n');

    harnessRun(prompt, dir);

    let beforeOk = false;
    let afterOk = false;
    try {
      await readFile(join(dir, 'before.txt'), 'utf-8');
      beforeOk = true;
    } catch {
      /* not created */
    }
    try {
      await readFile(join(dir, 'after.txt'), 'utf-8');
      afterOk = true;
    } catch {
      /* not created */
    }

    assert(
      'AA: Approve timeout auto-advance',
      beforeOk && afterOk,
      beforeOk && afterOk
        ? 'flow continued past approve after timeout'
        : `before=${beforeOk} after=${afterOk}`,
    );
  });
}

// ── Test AB: Review block (max 1, exits after one pass) ───────────────

async function testReviewBlock() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test review block',
      '',
      'flow:',
      '  review max 1',
      '    prompt: Write a single word to review-output.txt. Use exactly one word.',
      '  end',
      '  run: echo review-done > review-done.txt',
    ].join('\n');

    harnessRun(prompt, dir);

    let doneOk = false;
    try {
      await readFile(join(dir, 'review-done.txt'), 'utf-8');
      doneOk = true;
    } catch {
      /* not created */
    }

    assert(
      'AB: Review block completes and advances',
      doneOk,
      doneOk ? 'flow advanced past review block' : 'review-done.txt not created',
    );
  });
}

// ── Test AC: Remember + memory: prefetch ─────────────────────────────

async function testRememberMemory() {
  await withTempDir(async (dir) => {
    // Phase 1: write to memory store
    const writePrompt = [
      'Goal: store memory',
      '',
      'flow:',
      '  remember key="smoke_lang" value="TypeScript-42"',
    ].join('\n');

    harnessRun(writePrompt, dir);

    // Phase 2: read back via memory: section (same dir, same state)
    const readPrompt = [
      'Goal: read memory',
      '',
      'memory:',
      '  smoke_lang',
      '',
      'flow:',
      '  run: echo "${smoke_lang}" > lang.txt',
    ].join('\n');

    harnessRun(readPrompt, dir);

    let content = '';
    try {
      content = (await readFile(join(dir, 'lang.txt'), 'utf-8')).trim();
    } catch {
      /* not created */
    }

    assert(
      'AC: Remember + memory: prefetch',
      content.includes('TypeScript-42'),
      content.includes('TypeScript-42')
        ? 'memory value correctly retrieved'
        : `got: "${content.slice(0, 60)}"`,
    );
  });
}

// ── Test AG: Import anonymous flow ──────────────────────────────────

async function testImportAnonymousFlow() {
  await withTempDir(async (dir) => {
    await writeFile(
      join(dir, 'helpers.flow'),
      ['flow:', '  run: echo imported > imported.txt'].join('\n'),
    );

    const prompt = [
      'Goal: test import',
      '',
      'import "helpers.flow"',
      '',
      'flow:',
      '  run: echo main > main-marker.txt',
    ].join('\n');

    harnessRun(prompt, dir);

    let imported = '';
    let mainMarker = '';
    try {
      imported = (await readFile(join(dir, 'imported.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }
    try {
      mainMarker = (await readFile(join(dir, 'main-marker.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'AG: Import anonymous flow',
      imported.includes('imported') && mainMarker.includes('main'),
      imported.includes('imported') && mainMarker.includes('main')
        ? 'imported flow ran before main flow'
        : `imported="${imported}", main="${mainMarker}"`,
    );
  });
}

// ── Test AH: Import namespaced library ───────────────────────────────

async function testImportNamespacedLibrary() {
  await withTempDir(async (dir) => {
    await writeFile(
      join(dir, 'mylib.flow'),
      [
        'library: mylib',
        '',
        'export flow greet(name="world"):',
        '  run: echo hello-${name} > greet-result.txt',
      ].join('\n'),
    );

    const prompt = [
      'Goal: test namespaced import',
      '',
      'import "mylib.flow" as mylib',
      '',
      'flow:',
      '  use mylib.greet(name="smoke-test")',
    ].join('\n');

    harnessRun(prompt, dir);

    let content = '';
    try {
      content = (await readFile(join(dir, 'greet-result.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'AH: Import namespaced library',
      content.includes('hello-smoke-test'),
      content.includes('hello-smoke-test')
        ? 'library export expanded correctly'
        : `got: "${content.slice(0, 60)}"`,
    );
  });
}

// ── Test AI: Continue skips loop iteration ───────────────────────────

async function testContinueSkipsIteration() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test continue',
      '',
      'flow:',
      '  foreach item in "alpha beta gamma delta" max 5',
      '    if ${item} == "beta"',
      '      continue',
      '    end',
      '    run: echo ${item} >> continue-result.txt',
      '  end',
    ].join('\n');

    harnessRun(prompt, dir);

    let content = '';
    try {
      content = await readFile(join(dir, 'continue-result.txt'), 'utf-8');
    } catch {
      /* file not created */
    }

    assert(
      'AI: Continue skips loop iteration',
      content.includes('alpha') &&
        content.includes('gamma') &&
        content.includes('delta') &&
        !content.includes('beta'),
      content.includes('alpha') && !content.includes('beta')
        ? 'continue skipped beta as expected'
        : `got: "${content.slice(0, 80)}"`,
    );
  });
}

// ── Test AJ: Remember key-value storage ──────────────────────────────

async function testRememberKeyValue() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test remember key-value',
      '',
      'flow:',
      '  remember key="color" value="red"',
      '  remember key="color" value="blue"',
      '  remember key="size" value="large"',
      '  run: echo done > kv-marker.txt',
    ].join('\n');

    harnessRun(prompt, dir);

    let memory = [];
    try {
      const parsed = JSON.parse(
        await readFile(join(dir, '.prompt-language', 'memory.json'), 'utf-8'),
      );
      if (Array.isArray(parsed)) {
        memory = parsed;
      }
    } catch {
      /* memory file not created */
    }

    const colorEntries = memory.filter((entry) => entry.key === 'color');
    const sizeEntries = memory.filter((entry) => entry.key === 'size');
    let marker = '';
    try {
      marker = (await readFile(join(dir, 'kv-marker.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'AJ: Remember key-value storage',
      marker === 'done' &&
        colorEntries.length === 1 &&
        colorEntries[0]?.value === 'blue' &&
        sizeEntries.length === 1 &&
        sizeEntries[0]?.value === 'large',
      colorEntries.length === 1
        ? `color=${colorEntries[0]?.value}, size=${sizeEntries[0]?.value}`
        : `memory entries=${JSON.stringify(memory).slice(0, 80)}`,
    );
  });
}

// ── Test AK: Grounded-by condition in while loop ─────────────────────

async function testGroundedWhileLoop() {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, 'counter.txt'), 'count=0\n');

    const prompt = [
      'Goal: test grounded-by while',
      '',
      'flow:',
      "  run: node -e \"require('node:fs').writeFileSync('counter.txt', 'count=0\\n')\"",
      `  run: node -e "require('node:fs').writeFileSync('check-counter.mjs', 'import { readFileSync } from \\"node:fs\\"; const text = readFileSync(process.argv[2], \\"utf8\\"); const n = Number((text.match(/\\\\d+/) || [\\"0\\"])[0]); process.exit([0, 1].includes(n) ? 0 : 1);')"`,
      `  run: node -e "require('node:fs').writeFileSync('increment-counter.mjs', 'import { readFileSync, writeFileSync } from \\"node:fs\\"; const text = readFileSync(process.argv[2], \\"utf8\\"); const n = Number((text.match(/\\\\d+/) || [\\"0\\"])[0]); writeFileSync(process.argv[2], \\"count=\\" + (n + 1) + \\"\\\\n\\");')"`,
      `  while ask "Is count less than 2?" grounded-by 'node check-counter.mjs counter.txt' max 5`,
      `    run: node increment-counter.mjs counter.txt`,
      '  end',
      '  run: echo loop-done > while-grounded.txt',
    ].join('\n');

    harnessRun(prompt, dir);

    let done = '';
    let counter = '';
    try {
      done = (await readFile(join(dir, 'while-grounded.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }
    try {
      counter = (await readFile(join(dir, 'counter.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'AK: Grounded-by while loop',
      done === 'loop-done' && /count=[2-9]/.test(counter),
      done === 'loop-done' ? `counter="${counter}"` : 'while-grounded.txt not created',
    );
  });
}

// ── Test AL: Continue in while loop ──────────────────────────────────

async function testContinueInWhileLoop() {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, 'counter.txt'), '0');
    await writeFile(
      join(dir, 'bump-counter.js'),
      [
        "const fs = require('node:fs');",
        "const p = 'counter.txt';",
        "const current = Number(fs.readFileSync(p, 'utf8').trim());",
        'const next = current + 1;',
        'fs.writeFileSync(p, String(next));',
        'console.log(next);',
      ].join('\n'),
    );
    const prompt = [
      'Goal: test continue in while',
      '',
      'flow:',
      '  let counter = "0"',
      '  until ${counter} == "5" max 10',
      '    let counter = run "node bump-counter.js"',
      '    if ${counter} == "3"',
      '      continue',
      '    end',
      '    run: echo iter-${counter} >> while-continue.txt',
      '  end',
      '  run: echo final-${counter} > while-continue-final.txt',
    ].join('\n');

    harnessRun(prompt, dir);

    let content = '';
    let final = '';
    try {
      content = await readFile(join(dir, 'while-continue.txt'), 'utf-8');
    } catch {
      /* file not created */
    }
    try {
      final = (await readFile(join(dir, 'while-continue-final.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'AL: Continue in while loop',
      content.includes('iter-1') &&
        content.includes('iter-2') &&
        !content.includes('iter-3') &&
        content.includes('iter-4') &&
        content.includes('iter-5') &&
        final.includes('final-5'),
      final ? `final="${final}"` : `got: "${content.slice(0, 80)}"`,
    );
  });
}

// ── Test AM: Spawn basic child process ───────────────────────────────

async function testSpawnBasicChild() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test spawn and await',
      '',
      'flow:',
      '  spawn "worker"',
      '    run: echo child-output > worker-result.txt',
      '  end',
      '  await "worker"',
      '  run: echo parent-done > parent-marker.txt',
    ].join('\n');

    harnessRun(prompt, dir);

    let worker = '';
    let parent = '';
    try {
      worker = (await readFile(join(dir, 'worker-result.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }
    try {
      parent = (await readFile(join(dir, 'parent-marker.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'AM: Spawn basic child process',
      worker === 'child-output' && parent === 'parent-done',
      worker === 'child-output' ? `parent="${parent}"` : `worker="${worker}"`,
    );
  });
}

// ── Test AN: Spawn inherits parent variables ────────────────────────

async function testSpawnInheritsParentVariables() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test spawn variable passing',
      '',
      'flow:',
      '  let color = "purple"',
      '  spawn "painter"',
      '    run: echo ${color} > painted.txt',
      '    let result = run "echo painted-${color}"',
      '  end',
      '  await "painter"',
      '  run: echo ${painter.result} > spawn-var.txt',
    ].join('\n');

    harnessRun(prompt, dir);

    let painted = '';
    let spawnVar = '';
    try {
      painted = (await readFile(join(dir, 'painted.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }
    try {
      spawnVar = (await readFile(join(dir, 'spawn-var.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'AN: Spawn inherits parent variables',
      painted.includes('purple') && spawnVar.includes('painted-purple'),
      painted.includes('purple') ? `spawnVar="${spawnVar}"` : `painted="${painted}"`,
    );
  });
}

// ── Test AP: Swarm manager-worker equivalence pattern ───────────────

async function testSwarmManagerWorker() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: swarm manager worker',
      '',
      'flow:',
      '  swarm delivery',
      '    role worker',
      '      run: echo worker-ready > worker-note.txt',
      '      return "worker-ready"',
      '    end',
      '    flow:',
      '      start worker',
      '      await all',
      '    end',
      '  end',
      '  run: echo ${delivery.worker.returned} > manager-summary.txt',
      '  run: echo ${delivery.worker.status} > manager-status.txt',
    ].join('\n');

    harnessRun(prompt, dir);

    let summary = '';
    let status = '';
    let worker = '';
    try {
      summary = (await readFile(join(dir, 'manager-summary.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }
    try {
      status = (await readFile(join(dir, 'manager-status.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }
    try {
      worker = (await readFile(join(dir, 'worker-note.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'AP: Swarm manager-worker pattern',
      summary.includes('worker-ready') && status === 'completed' && worker.includes('worker-ready'),
      summary.includes('worker-ready')
        ? `status="${status}", worker="${worker}"`
        : `summary="${summary}", status="${status}", worker="${worker}"`,
    );
  });
}

// ── Test AQ: Swarm reviewer-after-workers pattern ───────────────────

async function testSwarmReviewerAfterWorkers() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: swarm reviewer after workers',
      '',
      'flow:',
      '  swarm review_pass',
      '    role frontend',
      '      run: echo frontend-ready > frontend.txt',
      '      return "frontend-ready"',
      '    end',
      '    role backend',
      '      run: echo backend-ready > backend.txt',
      '      return "backend-ready"',
      '    end',
      '    role reviewer',
      '      run: echo ${frontend_result}+${backend_result} > review.txt',
      '      return ${frontend_result}-${backend_result}',
      '    end',
      '    flow:',
      '      start frontend, backend',
      '      await all',
      '      let frontend_result = ${review_pass.frontend.returned}',
      '      let backend_result = ${review_pass.backend.returned}',
      '      start reviewer',
      '      await reviewer',
      '    end',
      '  end',
      '  run: echo ${review_pass.reviewer.returned} > summary.txt',
    ].join('\n');

    harnessRun(prompt, dir);

    let review = '';
    let summary = '';
    try {
      review = (await readFile(join(dir, 'review.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }
    try {
      summary = (await readFile(join(dir, 'summary.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'AQ: Swarm reviewer-after-workers pattern',
      review.includes('frontend-ready+backend-ready') &&
        summary.includes('frontend-ready-backend-ready'),
      review.includes('frontend-ready+backend-ready')
        ? `summary="${summary}"`
        : `review="${review}", summary="${summary}"`,
    );
  });
}

// ── Test AD: Race block (first spawn wins) ────────────────────────────

async function testRaceBlock() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test race block',
      '',
      'flow:',
      '  race timeout 60',
      '    spawn "fast"',
      '      run: echo fast > fast-result.txt',
      '    end',
      '    spawn "slow"',
      '      prompt: Please wait a moment, then create slow-result.txt.',
      '    end',
      '  end',
      '  await all',
      '  run: echo "${race_winner}" > winner.txt',
    ].join('\n');

    harnessRun(prompt, dir);

    let winner = '';
    try {
      winner = (await readFile(join(dir, 'winner.txt'), 'utf-8')).trim();
    } catch {
      /* not created */
    }

    assert(
      'AD: Race block sets race_winner',
      winner.length > 0,
      winner.length > 0 ? `winner="${winner}"` : 'winner.txt not created or empty',
    );
  });
}

// ── Test AE: foreach-spawn (parallel fan-out) ─────────────────────────

async function testForeachSpawn() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test foreach-spawn',
      '',
      'flow:',
      '  let items = "alpha beta gamma"',
      '  foreach-spawn item in ${items} max 5',
      '    run: echo ${item} > spawn-${item}.txt',
      '  end',
      '  await all',
    ].join('\n');

    harnessRun(prompt, dir);

    const expectedFiles = ['spawn-alpha.txt', 'spawn-beta.txt', 'spawn-gamma.txt'];
    let found = 0;
    for (const f of expectedFiles) {
      try {
        await readFile(join(dir, f), 'utf-8');
        found++;
      } catch {
        /* not created */
      }
    }

    assert(
      'AE: foreach-spawn creates per-item files',
      found === expectedFiles.length,
      found === expectedFiles.length
        ? `all ${found} spawn files created`
        : `only ${found}/${expectedFiles.length} files created`,
    );
  });
}

// ── Test AF: send / receive (inter-agent messaging) ───────────────────

async function testSendReceive() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test send/receive messaging',
      '',
      'flow:',
      '  spawn "worker"',
      '    run: echo "worker-done"',
      '    send parent "hello-from-worker"',
      '  end',
      '  receive msg from "worker" timeout 30',
      '  run: echo "${msg}" > received.txt',
    ].join('\n');

    harnessRun(prompt, dir);

    let content = '';
    try {
      content = (await readFile(join(dir, 'received.txt'), 'utf-8')).trim();
    } catch {
      /* not created */
    }

    assert(
      'AF: send/receive inter-agent messaging',
      content.includes('hello-from-worker'),
      content.includes('hello-from-worker')
        ? 'message received from worker'
        : `got: "${content.slice(0, 60)}"`,
    );
  });
}

// ── Test AO: Include file directive ─────────────────────────────────

async function testIncludeDirective() {
  await withTempDir(async (dir) => {
    await writeFile(
      join(dir, 'shared.prompt'),
      'prompt: Create include-result.txt containing exactly "included-ok"',
    );

    const prompt = ['Goal: test include directive', '', 'flow:', '  include "shared.prompt"'].join(
      '\n',
    );

    harnessRun(prompt, dir);

    let content = '';
    try {
      content = (await readFile(join(dir, 'include-result.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    assert(
      'AO: Include file directive',
      content.includes('included-ok'),
      content.includes('included-ok')
        ? 'include directive inlined shared prompt'
        : `got: "${content.slice(0, 60)}"`,
    );
  });
}

// ── Z-series: differential oracles (state-file + artifact cross-checks) ──

async function readSessionState(dir) {
  try {
    const raw = await readFile(join(dir, '.prompt-language', 'session-state.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function harnessPidBaseline() {
  return process.pid;
}

function parseListVar(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// ── Test AW: Labeled break exits outer loop ──────────────────────────

async function testAWLabeledBreak() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: labeled_break',
      '',
      'flow:',
      '  outer: foreach i in "1 2 3"',
      '    foreach j in "a b c"',
      "      run: node -e \"require('fs').writeFileSync('iter-${i}${j}.txt', 'iter-${i}${j}')\"",
      '      if ${i} == "2"',
      '        break outer',
      '      end',
      '    end',
      '  end',
    ].join('\n');

    harnessRun(prompt, dir);

    const exists = async (f) => {
      try {
        await access(join(dir, f));
        return true;
      } catch {
        return false;
      }
    };

    const expectedFiles = ['iter-1a.txt', 'iter-1b.txt', 'iter-1c.txt', 'iter-2a.txt'];
    const forbiddenFiles = [
      'iter-2b.txt',
      'iter-2c.txt',
      'iter-3a.txt',
      'iter-3b.txt',
      'iter-3c.txt',
    ];

    const expectedResults = await Promise.all(expectedFiles.map(exists));
    const forbiddenResults = await Promise.all(forbiddenFiles.map(exists));
    const missingExpected = expectedFiles.filter((_, i) => !expectedResults[i]);
    const presentForbidden = forbiddenFiles.filter((_, i) => forbiddenResults[i]);

    const ok = missingExpected.length === 0 && presentForbidden.length === 0;

    assert(
      'AW: Labeled break exits outer loop (labeled_break)',
      ok,
      ok
        ? 'break outer unwound inner foreach and terminated labeled outer loop'
        : `missing_expected=[${missingExpected.join(',')}] forbidden_present=[${presentForbidden.join(',')}]`,
    );
  });
}

async function testZ1LengthDrift() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: length-drift',
      '',
      'flow:',
      '  let items = []',
      '  foreach n in [1,2,3,4]',
      '    let items += "x"',
      "    run: node -e \"require('fs').appendFileSync('trace.txt', '${items_length}\\n')\"",
      '  end',
    ].join('\n');

    harnessRun(prompt, dir);

    let trace = '';
    try {
      trace = await readFile(join(dir, 'trace.txt'), 'utf-8');
    } catch {
      /* missing */
    }
    const state = await readSessionState(dir);
    const lenVar = state?.variables?.items_length;
    const itemsList = parseListVar(state?.variables?.items);

    const traceOk = trace === '1\n2\n3\n4\n';
    const lenOk = lenVar === '4' || lenVar === 4;
    const listOk = Array.isArray(itemsList) && itemsList.length === 4;

    assert(
      'Z1: List-length drift in foreach+append',
      traceOk && lenOk && listOk,
      `trace=${JSON.stringify(trace)} items_length=${JSON.stringify(lenVar)} items.len=${itemsList?.length ?? 'n/a'}`,
    );
  });
}

async function runZ2Once(dir) {
  const prompt = [
    'Goal: nonce-propagate',
    '',
    'flow:',
    '  let nonce = run "node -e \\"process.stdout.write(require(\'crypto\').randomUUID())\\""',
    "  run: node -e \"require('fs').writeFileSync('a.txt', '${nonce}')\"",
    "  run: node -e \"require('fs').writeFileSync('b.txt', '${nonce}')\"",
    "  run: node -e \"require('fs').writeFileSync('c.txt', '${nonce}')\"",
  ].join('\n');

  harnessRun(prompt, dir);

  const read = async (f) => {
    try {
      return (await readFile(join(dir, f), 'utf-8')).trim();
    } catch {
      return '';
    }
  };
  const a = await read('a.txt');
  const b = await read('b.txt');
  const c = await read('c.txt');
  const state = await readSessionState(dir);
  const nonce = (state?.variables?.nonce ?? '').trim();
  return { a, b, c, nonce };
}

async function testZ2NoncePropagation() {
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const run1 = await (async () => {
    let result;
    await withTempDir(async (dir) => {
      result = await runZ2Once(dir);
    });
    return result;
  })();
  const run2 = await (async () => {
    let result;
    await withTempDir(async (dir) => {
      result = await runZ2Once(dir);
    });
    return result;
  })();

  const run1Ok =
    uuidRe.test(run1.nonce) &&
    run1.a === run1.nonce &&
    run1.b === run1.nonce &&
    run1.c === run1.nonce;
  const run2Ok =
    uuidRe.test(run2.nonce) &&
    run2.a === run2.nonce &&
    run2.b === run2.nonce &&
    run2.c === run2.nonce;
  const differs = run1.nonce !== run2.nonce;

  assert(
    'Z2: Nonce propagation across runs',
    run1Ok && run2Ok && differs,
    `run1=${run1.nonce.slice(0, 8)} run2=${run2.nonce.slice(0, 8)} differs=${differs}`,
  );
}

async function testZ3CaptureGatedBranch() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: branch-capture',
      '',
      'flow:',
      '  let coin = prompt "Reply with ONLY the single word HEADS or TAILS, nothing else."',
      '  if coin == "HEADS"',
      "    run: node -e \"require('fs').writeFileSync('h.txt', '${coin}')\"",
      '  else',
      "    run: node -e \"require('fs').writeFileSync('t.txt', '${coin}')\"",
      '  end',
    ].join('\n');

    harnessRun(prompt, dir);

    const read = async (f) => {
      try {
        return (await readFile(join(dir, f), 'utf-8')).trim();
      } catch {
        return null;
      }
    };
    const h = await read('h.txt');
    const t = await read('t.txt');
    const state = await readSessionState(dir);
    const coin = (state?.variables?.coin ?? '').trim();

    const exactlyOne = (h !== null) !== (t !== null);
    const written = h ?? t;
    const matches = written !== null && written === coin;

    assert('Z3: Capture-gated branch', exactlyOne && matches, `h=${h} t=${t} coin="${coin}"`);
  });
}

async function testZ4InterleavedStateProbe() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: probe',
      '',
      'flow:',
      '  foreach n in [10,20,30]',
      '    let counter = run "node -e \\"process.stdout.write(String(${n}*${n}))\\""',
      "    run: node -e \"require('fs').appendFileSync('probe.txt', '${n}=${counter}\\n')\"",
      '  end',
    ].join('\n');

    harnessRun(prompt, dir);

    let probe = '';
    try {
      probe = await readFile(join(dir, 'probe.txt'), 'utf-8');
    } catch {
      /* missing */
    }
    const state = await readSessionState(dir);
    const counter = (state?.variables?.counter ?? '').toString().trim();

    const probeOk = probe === '10=100\n20=400\n30=900\n';
    const counterOk = counter === '900';

    assert(
      'Z4: Interleaved state probe',
      probeOk && counterOk,
      `probe=${JSON.stringify(probe)} counter="${counter}"`,
    );
  });
}

async function testZ5ForeachSpawnPidFingerprint() {
  const harnessPid = harnessPidBaseline();
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: spawn-fingerprint',
      '',
      'flow:',
      '  foreach-spawn who in ["a","b","c","d"] max 5',
      "    run: node -e \"require('fs').writeFileSync('${who}.pid', process.pid + ':' + Date.now())\"",
      '  end',
      '  await all',
    ].join('\n');

    harnessRun(prompt, dir);

    const names = ['a', 'b', 'c', 'd'];
    const records = [];
    for (const n of names) {
      try {
        const txt = (await readFile(join(dir, `${n}.pid`), 'utf-8')).trim();
        const [pid, ts] = txt.split(':').map((s) => Number.parseInt(s, 10));
        records.push({ n, pid, ts });
      } catch {
        /* missing */
      }
    }

    const state = await readSessionState(dir);
    const spawned = state?.spawnedChildren ?? {};
    const spawnCount = Object.keys(spawned).length;

    const allFound = records.length === 4;
    const pids = records.map((r) => r.pid);
    const distinct = new Set(pids).size === pids.length;
    const notHarness = pids.every((p) => p !== harnessPid && Number.isFinite(p));
    const times = records.map((r) => r.ts).filter((t) => Number.isFinite(t));
    const span = times.length > 0 ? Math.max(...times) - Math.min(...times) : Infinity;
    const spanOk = span < 5000;
    const spawnOk = spawnCount === 4;

    assert(
      'Z5: foreach-spawn PID fingerprint',
      allFound && distinct && notHarness && spanOk && spawnOk,
      `found=${records.length}/4 distinctPids=${distinct} notHarness=${notHarness} spanMs=${span} spawnedChildren=${spawnCount}`,
    );
  });
}

async function testZ6RaceWinnerVariance() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: race',
      '',
      'flow:',
      '  race',
      '    spawn "alpha"',
      "      run: node -e \"setTimeout(()=>require('fs').writeFileSync('alpha.done','1'), Math.floor(Math.random()*500))\"",
      '    end',
      '    spawn "beta"',
      "      run: node -e \"setTimeout(()=>require('fs').writeFileSync('beta.done','1'), Math.floor(Math.random()*500))\"",
      '    end',
      '  end',
      "  run: node -e \"require('fs').writeFileSync('winner.txt', '${race_winner}')\"",
    ].join('\n');

    harnessRun(prompt, dir);

    let winnerFile = '';
    try {
      winnerFile = (await readFile(join(dir, 'winner.txt'), 'utf-8')).trim();
    } catch {
      /* missing */
    }
    const state = await readSessionState(dir);
    const winnerState = (state?.variables?.race_winner ?? '').toString().trim();

    const valid = winnerFile === 'alpha' || winnerFile === 'beta';
    const matches = winnerFile === winnerState;

    assert(
      'Z6: Race-winner single-run oracle',
      valid && matches,
      `winnerFile="${winnerFile}" stateWinner="${winnerState}"`,
    );
  });
}

async function testZ7SendReceiveHash() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: send-receive',
      '',
      'flow:',
      '  let token = run "node -e \\"process.stdout.write(require(\'crypto\').randomBytes(16).toString(\'hex\'))\\""',
      '  spawn "producer"',
      '    send "chan" "${token}-PAYLOAD"',
      '  end',
      '  receive msg from "chan" timeout 10',
      "  run: node -e \"const h=require('crypto').createHash('sha256').update('${msg}').digest('hex'); require('fs').writeFileSync('hash.txt', h)\"",
      '  await all',
    ].join('\n');

    harnessRun(prompt, dir);

    const state = await readSessionState(dir);
    const token = (state?.variables?.token ?? '').toString().trim();
    const msg = (state?.variables?.msg ?? '').toString().trim();

    let hashFile = '';
    try {
      hashFile = (await readFile(join(dir, 'hash.txt'), 'utf-8')).trim();
    } catch {
      /* missing */
    }

    const tokenOk = /^[0-9a-f]{32}$/.test(token);
    const msgOk = msg === `${token}-PAYLOAD`;

    const { createHash } = await import('node:crypto');
    const expectedHash = msgOk ? createHash('sha256').update(msg).digest('hex') : '';
    const hashOk = hashFile.length > 0 && hashFile === expectedHash;

    assert(
      'Z7: send/receive content hash',
      tokenOk && msgOk && hashOk,
      `tokenHex=${tokenOk} msgMatch=${msgOk} hashMatch=${hashOk}`,
    );
  });
}

// ── AR-AV: DSL coverage gap closers ─────────────────────────────────

async function testARRetryBackoff() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: retry-backoff',
      '',
      'flow:',
      '  let attempt = []',
      '  retry max 3 backoff 1s',
      '    let attempt += run "node -e \\"process.stdout.write(String(Date.now()))\\""',
      '    run: node -e "process.exit(${attempt_length} >= 3 ? 0 : 1)"',
      '  end',
    ].join('\n');

    harnessRun(prompt, dir);

    const state = await readSessionState(dir);
    const attemptList = parseListVar(state?.variables?.attempt);
    const lenOk = Array.isArray(attemptList) && attemptList.length === 3;

    let spacingOk = false;
    let gaps = [];
    if (lenOk) {
      const ts = attemptList.map((v) => Number(String(v).trim())).filter((n) => Number.isFinite(n));
      if (ts.length === 3) {
        gaps = [ts[1] - ts[0], ts[2] - ts[1]];
        // Allow 100ms jitter below the 1s floor (backoff 1s)
        spacingOk = gaps.every((g) => g >= 900);
      }
    }

    // No lingering pause state — flow completed
    const completed = !state?.pauseState && !state?.paused;

    assert(
      'AR: Retry with backoff',
      lenOk && spacingOk && completed,
      `attempts=${attemptList?.length ?? 'n/a'} gaps=${JSON.stringify(gaps)} completed=${completed}`,
    );
  });
}

async function testASCompositeGates() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: composite-gates',
      '',
      'flow:',
      "  run: node -e \"require('fs').writeFileSync('a.txt', 'A')\"",
      "  run: node -e \"require('fs').writeFileSync('b.txt', 'B')\"",
      "  run: node -e \"require('fs').writeFileSync('c.txt', 'C')\"",
      '',
      'done when:',
      '  all(file_exists a.txt, file_exists b.txt, file_exists c.txt)',
    ].join('\n');

    harnessRun(prompt, dir);

    const read = async (f) => {
      try {
        return (await readFile(join(dir, f), 'utf-8')).trim();
      } catch {
        return '';
      }
    };
    const [a, b, c] = await Promise.all([read('a.txt'), read('b.txt'), read('c.txt')]);
    const state = await readSessionState(dir);
    // Gate completion = no paused pending-gate state; predicate recorded somewhere
    const completed = !state?.pauseState && !state?.paused;
    const filesOk = a === 'A' && b === 'B' && c === 'C';

    assert(
      'AS: Composite all(...) gate',
      filesOk && completed,
      `a=${a} b=${b} c=${c} completed=${completed}`,
    );
  });
}

async function testATSpawnModifiers() {
  // Parser accepts `spawn "name" if <cond>` (suffix) + `model "m"` + `in "path"`.
  // The user-requested `when cond` is expressed as `if cond` in the DSL. We exercise
  // `if` here (the supported form) and keep the spawn block body as specified.
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: spawn-modifiers',
      '',
      'flow:',
      '  let should_spawn = "yes"',
      '  if should_spawn == "yes"',
      '    spawn "worker"',
      "      run: node -e \"require('fs').writeFileSync('worker.txt', 'ran')\"",
      '    end',
      '  end',
      '  await all',
    ].join('\n');

    harnessRun(prompt, dir);

    let content = '';
    try {
      content = (await readFile(join(dir, 'worker.txt'), 'utf-8')).trim();
    } catch {
      /* missing */
    }
    const state = await readSessionState(dir);
    const children = state?.spawnedChildren ?? {};
    const hasWorker = Object.prototype.hasOwnProperty.call(children, 'worker');

    assert(
      'AT: Spawn with modifiers (if-conditional)',
      content === 'ran' && hasWorker,
      `worker.txt="${content}" hasWorkerChild=${hasWorker}`,
    );
  });
}

async function testAUNestedTryCatchFinally() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: nested-try',
      '',
      'flow:',
      '  try',
      '    try',
      '      run: node -e "process.exit(1)"',
      '    catch',
      "      run: node -e \"require('fs').writeFileSync('inner-catch.txt', 'caught')\"",
      '      run: node -e "process.exit(2)"',
      '    end',
      '  catch',
      "    run: node -e \"require('fs').writeFileSync('outer-catch.txt', 'caught')\"",
      '  finally',
      "    run: node -e \"require('fs').writeFileSync('outer-finally.txt', 'ran')\"",
      '  end',
    ].join('\n');

    harnessRun(prompt, dir);

    const read = async (f) => {
      try {
        return (await readFile(join(dir, f), 'utf-8')).trim();
      } catch {
        return '';
      }
    };
    const [inner, outer, finallyContent] = await Promise.all([
      read('inner-catch.txt'),
      read('outer-catch.txt'),
      read('outer-finally.txt'),
    ]);

    const innerOk = inner === 'caught';
    const outerOk = outer === 'caught';
    const finallyOk = finallyContent === 'ran';

    assert(
      'AU: Nested try/catch/finally',
      innerOk && outerOk && finallyOk,
      `inner="${inner}" outer="${outer}" finally="${finallyContent}"`,
    );
  });
}

async function testAVForeachRunSource() {
  await withTempDir(async (dir) => {
    // foreach ... in run "cmd": command stdout is split into iterable values.
    // Using space-separated tokens since splitIterable's baseline is whitespace split;
    // this keeps the test portable across the splitting strategy.
    const prompt = [
      'Goal: foreach-run-source',
      '',
      'flow:',
      '  foreach item in run "node -e \\"process.stdout.write(\'alpha beta gamma\')\\""',
      "    run: node -e \"require('fs').writeFileSync('${item}.txt', '${item}')\"",
      '  end',
    ].join('\n');

    harnessRun(prompt, dir);

    const read = async (f) => {
      try {
        return (await readFile(join(dir, f), 'utf-8')).trim();
      } catch {
        return '';
      }
    };
    const [alpha, beta, gamma] = await Promise.all([
      read('alpha.txt'),
      read('beta.txt'),
      read('gamma.txt'),
    ]);

    assert(
      'AV: foreach item in run "cmd"',
      alpha === 'alpha' && beta === 'beta' && gamma === 'gamma',
      `alpha="${alpha}" beta="${beta}" gamma="${gamma}"`,
    );
  });
}

async function testBASnapshotFileCapture() {
  // Requires the PR2 file-capture flag to be set in the harness env.
  if (process.env.PL_SNAPSHOT_INCLUDE_FILES !== '1') {
    console.log('  SKIP  BA: Snapshot file capture (PL_SNAPSHOT_INCLUDE_FILES unset)');
    return;
  }
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: snapshot + rollback with file capture',
      '',
      'flow:',
      '  snapshot "cp"',
      "  run: node -e \"require('fs').writeFileSync('.prompt-language/drift.txt', 'drift')\"",
      '  rollback to "cp"',
      "  run: node -e \"const fs=require('fs'); fs.writeFileSync('result.txt', fs.existsSync('.prompt-language/drift.txt') ? 'present' : 'gone')\"",
    ].join('\n');

    harnessRun(prompt, dir);

    let result = '';
    try {
      result = (await readFile(join(dir, 'result.txt'), 'utf-8')).trim();
    } catch {
      result = '';
    }

    assert(
      'BA: Snapshot file capture + rollback',
      result === 'gone',
      `drift.txt after rollback: "${result}"`,
    );
  });
}

async function testAXSnapshotRollback() {
  await withTempDir(async (dir) => {
    // PR1: snapshot + rollback restore variables state-only.
    const prompt = [
      'Goal: snapshot + rollback acceptance',
      '',
      'flow:',
      '  let x = "before"',
      '  snapshot "cp"',
      '  let x = "after"',
      '  rollback to "cp"',
      "  run: node -e \"require('fs').writeFileSync('x.txt', '${x}')\"",
    ].join('\n');

    harnessRun(prompt, dir);

    let xValue = '';
    try {
      xValue = (await readFile(join(dir, 'x.txt'), 'utf-8')).trim();
    } catch {
      xValue = '';
    }

    let stateVar = '';
    let snapHash = '';
    try {
      const stateRaw = await readFile(join(dir, '.prompt-language', 'session-state.json'), 'utf-8');
      const state = JSON.parse(stateRaw);
      stateVar = state?.variables?.x ?? '';
      snapHash = state?.snapshots?.cp?.stateHash ?? '';
    } catch {
      // state file optional in some runner modes
    }

    assert(
      'AX: snapshot + rollback state-only',
      xValue === 'before' && (stateVar === '' || stateVar === 'before') && snapHash !== '',
      `x.txt="${xValue}" state.variables.x="${stateVar}" snapshot.stateHash="${snapHash}"`,
    );
  });
}

// ── Test AY: Agent definition with skills spawn ──────────────────────

async function testAYAgentSkillsSpawn() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test agent definition with skills',
      '',
      'agents:',
      '  file-creator:',
      '    model: "sonnet"',
      '    skills: "file-management"',
      '',
      'flow:',
      '  spawn "worker" as file-creator',
      '    run: echo agent-with-skills > agent-output.txt',
      '  end',
      '  await "worker" timeout 60',
      '  run: echo ${worker.returned:-done} > final.txt',
    ].join('\n');

    harnessRun(prompt, dir);

    let agentOutput = '';
    let finalOutput = '';
    try {
      agentOutput = (await readFile(join(dir, 'agent-output.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }
    try {
      finalOutput = (await readFile(join(dir, 'final.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    const state = await readSessionState(dir);
    const children = state?.spawnedChildren ?? {};
    const hasWorker = Object.prototype.hasOwnProperty.call(children, 'worker');

    assert(
      'AY: Agent+skills spawn',
      agentOutput === 'agent-with-skills' && hasWorker,
      `agent-output="${agentOutput}" final="${finalOutput}" hasWorker=${hasWorker}`,
    );
  });
}

// ── Test AZ: Profile-bound spawn ─────────────────────────────────────

async function testAZProfileBoundSpawn() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test profile binding on spawn',
      '',
      'flow:',
      '  spawn "reviewer" using profile "default"',
      '    run: echo profile-bound > profile-output.txt',
      '  end',
      '  await "reviewer" timeout 60',
    ].join('\n');

    harnessRun(prompt, dir);

    let profileOutput = '';
    try {
      profileOutput = (await readFile(join(dir, 'profile-output.txt'), 'utf-8')).trim();
    } catch {
      /* file not created */
    }

    const state = await readSessionState(dir);
    const children = state?.spawnedChildren ?? {};
    const hasReviewer = Object.prototype.hasOwnProperty.call(children, 'reviewer');

    assert(
      'AZ: Profile-bound spawn',
      profileOutput === 'profile-bound' && hasReviewer,
      `profile-output="${profileOutput}" hasReviewer=${hasReviewer}`,
    );
  });
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  if (HISTORY_MODE) {
    try {
      await access(FLAKY_REPORT);
      execSync(`${process.execPath} ${JSON.stringify(FLAKY_REPORT)} --history`, {
        stdio: 'inherit',
      });
      process.exit(0);
    } catch (err) {
      if (err?.status != null) process.exit(err.status);
      console.error('[smoke-test] History report unavailable.');
      process.exit(1);
    }
  }

  const totalStart = Date.now();
  if (ONLY_FILTERS) {
    console.log(`[smoke-test] Restricting run to: ${[...ONLY_FILTERS].join(', ')}\n`);
  }
  console.log(`[smoke-test] Starting live flow smoke tests via ${getFlowCommandLabel()}...\n`);

  // Check harness CLI is available
  try {
    const version = checkHarnessVersion();
    console.log(`[smoke-test] Version: ${version}`);
  } catch {
    console.log(`[smoke-test] SKIP — ${getHarnessLabel()} not found.`);
    process.exit(0);
  }

  assertHarnessReady();

  // Plugin should already be built + installed by npm run eval:smoke.
  // Run tests — A, B, E, H, I, K are fast; C is medium; D is slow (gate loop)
  await timed('A', 'Context file relay', testContextFileRelay);
  await timed('B', 'Context recall', testContextRecall);
  await timed('E', 'Run auto-execution', testRunAutoExecution);
  await timed('C', 'Variable interpolation', testVariableInterpolation);
  await timed('F', 'Foreach iteration', testForeachIteration);
  await timed('G', 'Let-prompt capture', testLetPromptCapture);
  await timed('H', 'If/else branching', testIfElseBranching);
  await timed('I', 'Try/catch handling', testTryCatch);
  await timed('K', 'Variable chain', testVariableChain);
  await timed('N', 'Capture reliability', testCaptureReliability);
  await timed('U', 'And/or conditions', testAndOrConditions);
  await timed('V', 'Numeric comparison', testNumericComparison);
  await timed('W', 'Try/finally', testTryFinally);
  await timed('Z', 'Multi-var interpolation', testMultiVarInterpolation);
  await timed('AA', 'Approve timeout', testApproveTimeout);
  await timed('AB', 'Review block', testReviewBlock);
  await timed('AC', 'Remember + memory:', testRememberMemory);
  await timed('AK', 'Grounded-by while', testGroundedWhileLoop);
  await timed('AL', 'Continue in while', testContinueInWhileLoop);
  await timed('AM', 'Spawn basic child', testSpawnBasicChild);
  await timed('AN', 'Spawn inherits parent variables', testSpawnInheritsParentVariables);
  await timed('AG', 'Import anonymous flow', testImportAnonymousFlow);
  await timed('AH', 'Import namespaced library', testImportNamespacedLibrary);
  await timed('AI', 'Continue skips iteration', testContinueSkipsIteration);
  await timed('AJ', 'Remember key-value storage', testRememberKeyValue);
  await timed('AO', 'Include file directive', testIncludeDirective);
  await timed('AP', 'Swarm manager-worker', testSwarmManagerWorker);
  await timed('AQ', 'Swarm reviewer-after-workers', testSwarmReviewerAfterWorkers);
  await timed('AW', 'Labeled break exits outer loop', testAWLabeledBreak);
  await timed('Z1', 'List-length drift in foreach+append', testZ1LengthDrift);
  await timed('Z2', 'Nonce propagation across runs', testZ2NoncePropagation);
  await timed('Z3', 'Capture-gated branch', testZ3CaptureGatedBranch);
  await timed('Z4', 'Interleaved state probe', testZ4InterleavedStateProbe);
  await timed('AS', 'Composite all(...) gate', testASCompositeGates);
  await timed('AT', 'Spawn with modifiers', testATSpawnModifiers);
  await timed('AU', 'Nested try/catch/finally', testAUNestedTryCatchFinally);
  await timed('AV', 'foreach item in run "cmd"', testAVForeachRunSource);
  await timed('AX', 'Snapshot + rollback (state-only)', testAXSnapshotRollback);
  await timed('BA', 'Snapshot file capture (PR2, gated)', testBASnapshotFileCapture);

  if (!QUICK_MODE) {
    await timed('D', 'Gate evaluation', testGateEvaluation);
    await timed('J', 'While loop', testWhileLoop);
    await timed('L', 'Retry on failure', testRetryOnFailure);
    await timed('M', 'Gate-only mode', testGateOnlyMode);
    await timed('O', 'Until loop', testUntilLoop);
    await timed('P', 'Break exits loop', testBreakNode);
    await timed('Q', 'List append', testListAppend);
    await timed('R', 'Custom gate', testCustomGate);
    await timed('S', 'Nested foreach', testNestedForeach);
    await timed('T', 'List accumulation', testListAccumulation);
    await timed('X', 'Break in nested', testBreakInsideIfForeach);
    await timed('Y', 'Until variable', testUntilVariable);
    await timed('AD', 'Race block', testRaceBlock);
    await timed('AE', 'foreach-spawn', testForeachSpawn);
    await timed('AF', 'Send/receive', testSendReceive);
    await timed('Z5', 'foreach-spawn PID fingerprint', testZ5ForeachSpawnPidFingerprint);
    await timed('Z6', 'Race-winner single-run oracle', testZ6RaceWinnerVariance);
    await timed('Z7', 'send/receive content hash', testZ7SendReceiveHash);
    await timed('AR', 'Retry with backoff', testARRetryBackoff);
    await timed('AY', 'Agent+skills spawn', testAYAgentSkillsSpawn);
    await timed('AZ', 'Profile-bound spawn', testAZProfileBoundSpawn);
  } else {
    console.log('  SKIP  D: Gate evaluation (--quick mode)');
    console.log('  SKIP  J: While loop (--quick mode)');
    console.log('  SKIP  L: Retry on failure (--quick mode)');
    console.log('  SKIP  M: Gate-only mode (--quick mode)');
    console.log('  SKIP  O: Until loop (--quick mode)');
    console.log('  SKIP  P: Break node (--quick mode)');
    await timed('Q', 'List append', testListAppend);
    console.log('  SKIP  R: Custom gate (--quick mode)');
    console.log('  SKIP  S: Nested foreach (--quick mode)');
    console.log('  SKIP  T: List accumulation (--quick mode)');
    console.log('  SKIP  X: Break in nested (--quick mode)');
    console.log('  SKIP  Y: Until variable (--quick mode)');
    console.log('  SKIP  AD: Race block (--quick mode)');
    console.log('  SKIP  AE: foreach-spawn (--quick mode)');
    console.log('  SKIP  AF: Send/receive (--quick mode)');
    console.log('  SKIP  Z5: foreach-spawn PID fingerprint (--quick mode)');
    console.log('  SKIP  Z6: Race-winner single-run oracle (--quick mode)');
    console.log('  SKIP  Z7: send/receive content hash (--quick mode)');
    console.log('  SKIP  AR: Retry with backoff (--quick mode)');
    console.log('  SKIP  AY: Agent+skills spawn (--quick mode)');
    console.log('  SKIP  AZ: Profile-bound spawn (--quick mode)');
  }

  console.log(`\n[smoke-test] Summary: ${passed}/${passed + failed} passed`);

  // Write structured results and clean up old files
  await writeResults(totalStart);
  await cleanupOldResults();

  if (failed > 0) {
    console.error('[smoke-test] FAIL — some tests did not pass.');
    process.exit(1);
  }

  console.log('[smoke-test] PASS — all tests passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[smoke-test] Fatal error:', err.message);
  process.exit(1);
});
