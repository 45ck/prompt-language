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
 *   I: Try/catch handling       K: Variable chain (let-run + if + interpolation)
 *   N: Capture reliability      O: Until loop (slow)
 *   P: Break exits loop         Q: List append
 *   R: Custom gate (slow)       S: Nested foreach (slow)
 *   T: List accumulation (slow) U: And/or conditions
 *   V: Numeric comparison       W: Try/finally
 *   X: Break in nested (slow)   Y: Until variable (slow)
 *   Z: Multi-var interpolation
 *
 * Usage:
 *   node scripts/eval/smoke-test.mjs          # all tests
 *   node scripts/eval/smoke-test.mjs --quick  # fast subset (no gate test)
 */

import { execSync } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const QUICK_MODE = process.argv.includes('--quick');
const TIMEOUT = 120_000;

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
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

// ── Test T: List accumulation in foreach (prompt uses result) ──────────

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
      '  prompt: Write the accumulated results "${results}" to accumulated.txt. Write only the raw value, nothing else.',
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

// ── Test X: Break inside if inside foreach (prompt before break) ──────

async function testBreakInsideIfForeach() {
  await withTempDir(async (dir) => {
    const prompt = [
      'Goal: test break inside if inside foreach',
      '',
      'flow:',
      '  foreach item in "one two three four"',
      '    run: echo ${item} >> visited.txt',
      '    if ${item} == "two"',
      '      prompt: Create break-marker.txt containing exactly "stopped-at-two", nothing else.',
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
        ? 'break stopped at two, marker created by prompt'
        : `visited="${visitedContent.slice(0, 80)}", marker="${markerContent.slice(0, 40)}"`,
    );
  });
}

// ── Test Y: Until with variable condition (prompt writes result) ──────

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
      '  prompt: Write "counter-reached-${counter}" to until-final.txt. Write only that text, nothing else.',
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
        ? 'counter reached 3, prompt wrote result'
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

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
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
  await testContextFileRelay();
  await testContextRecall();
  await testRunAutoExecution();
  await testVariableInterpolation();
  await testForeachIteration();
  await testLetPromptCapture();
  await testIfElseBranching();
  await testTryCatch();
  await testVariableChain();
  await testCaptureReliability();
  await testAndOrConditions();
  await testNumericComparison();
  await testTryFinally();
  await testMultiVarInterpolation();

  if (!QUICK_MODE) {
    await testGateEvaluation();
    await testWhileLoop();
    await testRetryOnFailure();
    await testGateOnlyMode();
    await testUntilLoop();
    await testBreakNode();
    await testListAppend();
    await testCustomGate();
    await testNestedForeach();
    await testListAccumulation();
    await testBreakInsideIfForeach();
    await testUntilVariable();
  } else {
    console.log('  SKIP  D: Gate evaluation (--quick mode)');
    console.log('  SKIP  J: While loop (--quick mode)');
    console.log('  SKIP  L: Retry on failure (--quick mode)');
    console.log('  SKIP  M: Gate-only mode (--quick mode)');
    console.log('  SKIP  O: Until loop (--quick mode)');
    console.log('  SKIP  P: Break node (--quick mode)');
    await testListAppend();
    console.log('  SKIP  R: Custom gate (--quick mode)');
    console.log('  SKIP  S: Nested foreach (--quick mode)');
    console.log('  SKIP  T: List accumulation (--quick mode)');
    console.log('  SKIP  X: Break in nested (--quick mode)');
    console.log('  SKIP  Y: Until variable (--quick mode)');
  }

  console.log(`\n[smoke-test] Summary: ${passed}/${passed + failed} passed`);

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
