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

  if (!QUICK_MODE) {
    await testGateEvaluation();
    await testWhileLoop();
    await testRetryOnFailure();
  } else {
    console.log('  SKIP  D: Gate evaluation (--quick mode)');
    console.log('  SKIP  J: While loop (--quick mode)');
    console.log('  SKIP  L: Retry on failure (--quick mode)');
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
