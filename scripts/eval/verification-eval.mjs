#!/usr/bin/env node
/**
 * verification-eval.mjs — A/B verification benchmark.
 *
 * Tests whether "done when: tests_pass" gates improve task completion
 * on realistic bug-fix tasks. Each fixture is a small project with a
 * deliberate defect and a test that fails.
 *
 * Mode A (vanilla): Claude fixes the bug with a plain prompt.
 * Mode B (gated):   Claude fixes the bug with a "done when: tests_pass" gate.
 *
 * After each run, we verify by running `node test.js` ourselves.
 *
 * Usage:
 *   node scripts/eval/verification-eval.mjs             # single run
 *   node scripts/eval/verification-eval.mjs --repeat 3   # 3 repetitions
 *   node scripts/eval/verification-eval.mjs --fixture broken-math  # single fixture
 */

import { execSync } from 'node:child_process';
import { mkdtemp, rm, readdir, readFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHarnessPrompt } from './harness.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');
const TIMEOUT = 120_000;

// Parse CLI args
const args = process.argv.slice(2);
const repeatIdx = args.indexOf('--repeat');
const REPEAT = repeatIdx >= 0 ? parseInt(args[repeatIdx + 1] ?? '1', 10) : 1;
const fixtureIdx = args.indexOf('--fixture');
const FIXTURE_FILTER = fixtureIdx >= 0 ? args[fixtureIdx + 1] : null;

function claudeRun(prompt, cwd) {
  try {
    runHarnessPrompt(prompt, { cwd, timeout: TIMEOUT });
    return true;
  } catch {
    return false;
  }
}

function verify(dir) {
  try {
    execSync('node test.js', { cwd: dir, encoding: 'utf-8', timeout: 10_000 });
    return true;
  } catch {
    return false;
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
      if (i < retries - 1) await sleep(1000);
    }
  }
}

async function runFixture(fixtureName, mode) {
  const fixtureDir = join(FIXTURES_DIR, fixtureName);
  const task = (await readFile(join(fixtureDir, 'task.txt'), 'utf-8')).trim();
  const dir = await mkdtemp(join(tmpdir(), `pl-veri-${fixtureName}-`));

  try {
    // Copy fixture files to temp dir
    await cp(fixtureDir, dir, { recursive: true });

    let prompt;
    if (mode === 'vanilla') {
      prompt = task;
    } else {
      // Gated mode: wrap in gate
      prompt = `${task}\n\ndone when:\n  tests_pass`;
    }

    claudeRun(prompt, dir);
    return verify(dir);
  } finally {
    await cleanupDir(dir);
  }
}

async function main() {
  console.log('[verification-eval] A/B Verification Benchmark');
  console.log(`  Repeats: ${REPEAT}`);
  console.log(`  Fixture filter: ${FIXTURE_FILTER ?? 'all'}\n`);

  // Discover fixtures
  const entries = await readdir(FIXTURES_DIR, { withFileTypes: true });
  let fixtures = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  if (FIXTURE_FILTER) {
    fixtures = fixtures.filter((f) => f === FIXTURE_FILTER);
    if (fixtures.length === 0) {
      console.error(`Fixture "${FIXTURE_FILTER}" not found.`);
      process.exit(1);
    }
  }
  fixtures.sort();

  console.log(`  Fixtures: ${fixtures.length}\n`);

  // Results storage
  const results = {};
  for (const f of fixtures) {
    results[f] = { vanilla: { pass: 0, fail: 0 }, gated: { pass: 0, fail: 0 } };
  }

  for (let rep = 0; rep < REPEAT; rep++) {
    if (REPEAT > 1) console.log(`--- Repetition ${rep + 1}/${REPEAT} ---\n`);

    for (const fixture of fixtures) {
      // Run vanilla (mode A)
      process.stdout.write(`  [A] ${fixture} (vanilla) ... `);
      const vanillaPass = await runFixture(fixture, 'vanilla');
      results[fixture].vanilla[vanillaPass ? 'pass' : 'fail']++;
      console.log(vanillaPass ? 'PASS' : 'FAIL');

      // Run gated (mode B)
      process.stdout.write(`  [B] ${fixture} (gated)   ... `);
      const gatedPass = await runFixture(fixture, 'gated');
      results[fixture].gated[gatedPass ? 'pass' : 'fail']++;
      console.log(gatedPass ? 'PASS' : 'FAIL');

      console.log();
    }
  }

  // Summary
  console.log('=== RESULTS ===\n');
  console.log('Fixture'.padEnd(20) + 'Vanilla'.padEnd(12) + 'Gated'.padEnd(12) + 'Winner');
  console.log('-'.repeat(56));

  let vanillaTotal = 0;
  let gatedTotal = 0;
  let gateWins = 0;
  let vanillaWins = 0;
  let ties = 0;

  for (const fixture of fixtures) {
    const v = results[fixture].vanilla;
    const g = results[fixture].gated;
    const vRate = v.pass / (v.pass + v.fail);
    const gRate = g.pass / (g.pass + g.fail);
    vanillaTotal += v.pass;
    gatedTotal += g.pass;

    let winner;
    if (gRate > vRate) {
      winner = 'GATE';
      gateWins++;
    } else if (vRate > gRate) {
      winner = 'VANILLA';
      vanillaWins++;
    } else {
      winner = 'TIE';
      ties++;
    }

    const vStr = `${v.pass}/${v.pass + v.fail}`;
    const gStr = `${g.pass}/${g.pass + g.fail}`;
    console.log(fixture.padEnd(20) + vStr.padEnd(12) + gStr.padEnd(12) + winner);
  }

  const totalRuns = fixtures.length * REPEAT;
  console.log('-'.repeat(56));
  console.log(
    'TOTAL'.padEnd(20) +
      `${vanillaTotal}/${totalRuns}`.padEnd(12) +
      `${gatedTotal}/${totalRuns}`.padEnd(12),
  );
  console.log(`\nGate wins: ${gateWins}  Vanilla wins: ${vanillaWins}  Ties: ${ties}`);
  console.log(
    `Gate pass rate: ${((gatedTotal / totalRuns) * 100).toFixed(0)}%  ` +
      `Vanilla pass rate: ${((vanillaTotal / totalRuns) * 100).toFixed(0)}%`,
  );

  if (gatedTotal < vanillaTotal) {
    console.log('\n⚠ Gates underperformed vanilla — investigate fixture difficulty.');
  } else if (gatedTotal > vanillaTotal) {
    console.log('\nGates outperformed vanilla on verification tasks.');
  } else {
    console.log('\nTied — gates matched vanilla on these tasks.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
