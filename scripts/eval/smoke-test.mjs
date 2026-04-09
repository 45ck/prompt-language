#!/usr/bin/env node
/**
 * smoke-test.mjs — Live CLI smoke tests via `claude -p`.
 *
 * Validates the full plugin pipeline end-to-end through Claude's real agent
 * loop. Unlike unit tests (mocks) and e2e-eval (hook pipe-through), these
 * tests run the actual installed plugin with a live Claude session.
 *
 * Requires: `claude` CLI available, plugin installed.
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
 *   AO: Include file directive
 *
 * Usage:
 *   node scripts/eval/smoke-test.mjs          # all tests
 *   node scripts/eval/smoke-test.mjs --quick  # fast subset (no gate test)
 */

import { execSync } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { tmpdir, platform } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, 'results');

const QUICK_MODE = process.argv.includes('--quick');
const TIMEOUT = 120_000;

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
  currentTest = { name, label, startTime: Date.now() };
  await fn();
}

/** Write structured results to a JSON file. */
async function writeResults(totalStart) {
  await mkdir(RESULTS_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `smoke-${timestamp}.json`;
  const filepath = join(RESULTS_DIR, filename);

  let nodeVersion = '';
  try {
    nodeVersion = execSync('node -v', { encoding: 'utf-8' }).trim();
  } catch {
    nodeVersion = process.version;
  }

  const report = {
    timestamp: new Date().toISOString(),
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

function claudeRun(prompt, cwd) {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  try {
    return execSync('claude -p --dangerously-skip-permissions', {
      input: prompt,
      encoding: 'utf-8',
      cwd,
      timeout: TIMEOUT,
      env,
    });
  } catch (err) {
    // Log stderr for debugging when Claude exits non-zero or times out
    if (err.stderr) console.error(`  [debug] stderr: ${err.stderr.slice(0, 200)}`);
    return err.stdout ?? '';
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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(writePrompt, dir);

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

    claudeRun(readPrompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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
      '  run: echo "count=0" > counter.txt',
      '  while ask "Is count less than 2?" grounded-by "cat counter.txt" max 5',
      "    let c = run \"node -e \\\"const fs=require('fs'); const p='counter.txt'; const text=fs.readFileSync(p, 'utf8'); const n=Number((text.match(/\\\\d+/)||['0'])[0]); fs.writeFileSync(p, `count=${n+1}\\n`); console.log(n+1);\\\"\"",
      '  end',
      '  run: echo loop-done > while-grounded.txt',
    ].join('\n');

    claudeRun(prompt, dir);

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
    const prompt = [
      'Goal: test continue in while',
      '',
      'flow:',
      '  let counter = "0"',
      '  until ${counter} == "5" max 10',
      '    let counter = run "node -e \\"console.log(Number(\'${counter}\') + 1)\\""',
      '    if ${counter} == "3"',
      '      continue',
      '    end',
      '    run: echo iter-${counter} >> while-continue.txt',
      '  end',
      '  run: echo final-${counter} > while-continue-final.txt',
    ].join('\n');

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

    claudeRun(prompt, dir);

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

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const totalStart = Date.now();
  console.log('[smoke-test] Starting live CLI smoke tests...\n');

  // Check claude CLI is available
  try {
    execSync('claude --version', { encoding: 'utf-8', timeout: 5000 });
  } catch {
    console.log('[smoke-test] SKIP — claude CLI not found.');
    process.exit(0);
  }

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
