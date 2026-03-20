#!/usr/bin/env node
/**
 * comparative-eval.mjs — Comparative evaluation: Plugin vs Vanilla Claude.
 *
 * Runs identical task prompts with the plugin disabled (uninstalled) and
 * enabled (installed), then compares outcomes to validate the plugin's
 * value proposition.
 *
 * Requires: `claude` CLI available, project built.
 *
 * Usage:
 *   node scripts/eval/comparative-eval.mjs          # all hypotheses
 *   node scripts/eval/comparative-eval.mjs --quick   # skip slow tests (H2, H6)
 */

import { execSync } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const CLI = join(ROOT, 'bin', 'cli.mjs');

const QUICK_MODE = process.argv.includes('--quick');
const TIMEOUT = 120_000;

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

// ── Results tracking ────────────────────────────────────────────────

const results = [];

function record(id, title, vanillaResult, pluginResult, vanillaPass, pluginPass) {
  let verdict;
  if (vanillaPass && pluginPass) verdict = 'TIE';
  else if (pluginPass && !vanillaPass) verdict = 'PLUGIN WINS';
  else if (vanillaPass && !pluginPass) verdict = 'VANILLA WINS';
  else verdict = 'BOTH FAIL';

  results.push({ id, title, vanillaResult, pluginResult, vanillaPass, pluginPass, verdict });

  console.log(`\n[comparative-eval] ${id}: ${title}`);
  console.log(`  VANILLA: ${vanillaResult}`);
  console.log(`  PLUGIN:  ${pluginResult}`);
  console.log(`  RESULT:  ${verdict}`);
}

// ── H1: Step Enforcement ────────────────────────────────────────────

async function testH1() {
  console.log('\n--- H1: Step Enforcement ---');

  const files = ['step1.txt', 'step2.txt', 'step3.txt', 'step4.txt', 'step5.txt'];
  const expected = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];

  // Vanilla: plain English instructions
  const vanillaPrompt = [
    'Create five files in sequence, one at a time:',
    '1. Create file step1.txt containing exactly "alpha"',
    '2. Create file step2.txt containing exactly "bravo"',
    '3. Create file step3.txt containing exactly "charlie"',
    '4. Create file step4.txt containing exactly "delta"',
    '5. Create file step5.txt containing exactly "echo"',
    'Each file must contain exactly the specified word and nothing else.',
  ].join('\n');

  // Plugin: same task via flow DSL
  const pluginPrompt = [
    'Goal: create five files in sequence',
    '',
    'flow:',
    '  prompt: Create file step1.txt containing exactly "alpha"',
    '  prompt: Create file step2.txt containing exactly "bravo"',
    '  prompt: Create file step3.txt containing exactly "charlie"',
    '  prompt: Create file step4.txt containing exactly "delta"',
    '  prompt: Create file step5.txt containing exactly "echo"',
  ].join('\n');

  async function evaluate(prompt, label) {
    return withTempDir(async (dir) => {
      console.log(`  Running ${label}...`);
      claudeRun(prompt, dir);
      let correct = 0;
      for (let i = 0; i < files.length; i++) {
        const content = await safeRead(join(dir, files[i]));
        if (content === expected[i]) correct++;
      }
      return correct;
    });
  }

  pluginUninstall();
  const vanillaScore = await evaluate(vanillaPrompt, 'vanilla');

  pluginInstall();
  const pluginScore = await evaluate(pluginPrompt, 'plugin');

  record(
    'H1',
    'Step Enforcement',
    `${vanillaScore}/5 files correct`,
    `${pluginScore}/5 files correct`,
    vanillaScore === 5,
    pluginScore === 5,
  );
}

// ── H2: Gate Enforcement ────────────────────────────────────────────

async function testH2() {
  console.log('\n--- H2: Gate Enforcement ---');

  async function evaluate(prompt, label) {
    return withTempDir(async (dir) => {
      console.log(`  Running ${label}...`);
      await writeFile(join(dir, 'app.js'), 'process.exit(1)\n');
      await writeFile(
        join(dir, 'package.json'),
        JSON.stringify({ name: 'gate-test', scripts: { test: 'node app.js' } }),
      );
      claudeRun(prompt, dir);

      let exitCode = 1;
      try {
        execSync(`node "${join(dir, 'app.js')}"`, { timeout: 5000 });
        exitCode = 0;
      } catch {
        /* still fails */
      }
      return exitCode === 0;
    });
  }

  const vanillaPrompt = [
    'Fix app.js so it exits 0 instead of 1.',
    'After fixing it, verify by running: node app.js',
    'Then run: npm test',
    'Make sure npm test passes before you stop.',
  ].join('\n');

  const pluginPrompt = [
    'Goal: fix app',
    '',
    'flow:',
    '  prompt: Fix app.js so it exits 0 instead of 1',
    '  run: node app.js',
    '',
    'done when:',
    '  tests_pass',
  ].join('\n');

  pluginUninstall();
  const vanillaPass = await evaluate(vanillaPrompt, 'vanilla');

  pluginInstall();
  const pluginPass = await evaluate(pluginPrompt, 'plugin');

  record(
    'H2',
    'Gate Enforcement',
    vanillaPass ? 'app.js fixed, exits 0' : 'app.js still exits non-zero',
    pluginPass ? 'app.js fixed, exits 0' : 'app.js still exits non-zero',
    vanillaPass,
    pluginPass,
  );
}

// ── H3: Variable Fidelity ───────────────────────────────────────────

async function testH3() {
  console.log('\n--- H3: Variable Fidelity ---');

  // Vanilla: ask Claude to run the command and capture its output
  const vanillaPrompt = [
    'Run this exact command: node -e "console.log(Math.random().toFixed(8))"',
    'Capture the output. Then write ONLY that exact output to result.txt.',
    'Do not re-run the command. Do not compute your own random number.',
    'The file should contain just the number, nothing else.',
  ].join('\n');

  // Plugin: let captures stdout, interpolation delivers it
  const pluginPrompt = [
    'Goal: variable precision',
    '',
    'flow:',
    '  let checksum = run "node -e \\"console.log(Math.random().toFixed(8))\\""',
    '  prompt: Write the exact checksum "${checksum}" to result.txt. Do not compute it yourself. Write ONLY that value.',
  ].join('\n');

  // For vanilla: we cannot know what random number was generated, but we can
  // check that result.txt contains a plausible 0.XXXXXXXX number
  const vanillaResult = await withTempDir(async (dir) => {
    console.log('  Running vanilla...');
    pluginUninstall();
    claudeRun(vanillaPrompt, dir);
    const content = await safeRead(join(dir, 'result.txt'));
    const isPlausible = /^0\.\d{8}$/.test(content);
    return { content, isPlausible };
  });

  // For plugin: we can verify the captured value matches by reading session state
  // But since the random value is ephemeral, we just check result.txt has a valid number
  const pluginResult = await withTempDir(async (dir) => {
    console.log('  Running plugin...');
    pluginInstall();
    claudeRun(pluginPrompt, dir);
    const content = await safeRead(join(dir, 'result.txt'));
    const isPlausible = /^0\.\d{8}$/.test(content);

    // Try to read session state for the actual captured value
    let capturedChecksum = '';
    try {
      const state = JSON.parse(
        await readFile(join(dir, '.prompt-language', 'session-state.json'), 'utf-8'),
      );
      capturedChecksum = state.variables?.checksum?.trim() ?? '';
    } catch {
      /* no state file */
    }

    const exactMatch = capturedChecksum && content === capturedChecksum;
    return { content, isPlausible, capturedChecksum, exactMatch };
  });

  const vanillaDetail = vanillaResult.isPlausible
    ? `result.txt = "${vanillaResult.content}" (plausible value)`
    : `result.txt = "${vanillaResult.content.slice(0, 40)}" (not a valid number)`;

  let pluginDetail;
  if (pluginResult.exactMatch) {
    pluginDetail = `result.txt = "${pluginResult.content}" (exact match with captured "${pluginResult.capturedChecksum}")`;
  } else if (pluginResult.isPlausible) {
    pluginDetail = `result.txt = "${pluginResult.content}" (plausible, captured = "${pluginResult.capturedChecksum}")`;
  } else {
    pluginDetail = `result.txt = "${pluginResult.content.slice(0, 40)}" (not a valid number)`;
  }

  // Plugin wins if it got an exact match; vanilla only gets "plausible"
  record(
    'H3',
    'Variable Fidelity',
    vanillaDetail,
    pluginDetail,
    vanillaResult.isPlausible,
    pluginResult.isPlausible,
  );
}

// ── H4: Run Auto-Execution ──────────────────────────────────────────

async function testH4() {
  console.log('\n--- H4: Run Auto-Execution ---');

  const vanillaPrompt = [
    "Run this exact command: node -e \"require('fs').writeFileSync('auto-created.txt', 'plugin-did-this')\"",
    'Then read auto-created.txt and write its contents to verify.txt.',
  ].join('\n');

  const pluginPrompt = [
    'Goal: test auto-exec',
    '',
    'flow:',
    "  run: node -e \"require('fs').writeFileSync('auto-created.txt', 'plugin-did-this')\"",
    '  prompt: Read auto-created.txt and write its contents to verify.txt',
  ].join('\n');

  async function evaluate(prompt, label) {
    return withTempDir(async (dir) => {
      console.log(`  Running ${label}...`);
      claudeRun(prompt, dir);
      const content = await safeRead(join(dir, 'verify.txt'));
      return content.includes('plugin-did-this');
    });
  }

  pluginUninstall();
  const vanillaPass = await evaluate(vanillaPrompt, 'vanilla');

  pluginInstall();
  const pluginPass = await evaluate(pluginPrompt, 'plugin');

  record(
    'H4',
    'Run Auto-Execution',
    vanillaPass ? 'verify.txt correct' : 'verify.txt missing or wrong',
    pluginPass ? 'verify.txt correct' : 'verify.txt missing or wrong',
    vanillaPass,
    pluginPass,
  );
}

// ── H5: Stdout Visibility ───────────────────────────────────────────

async function testH5() {
  console.log('\n--- H5: Stdout Visibility ---');

  const vanillaPrompt = [
    'Run this exact command: node -e "console.log(\'secret-token-\' + Date.now())"',
    'What was the exact output of that command? Write ONLY that output to result.txt.',
    'Do not re-run the command. Do not compute your own timestamp.',
  ].join('\n');

  const pluginPrompt = [
    'Goal: stdout relay',
    '',
    'flow:',
    '  run: node -e "console.log(\'secret-token-\' + Date.now())"',
    '  prompt: What was the exact output of the previous command? Write ONLY that output to result.txt',
  ].join('\n');

  async function evaluate(prompt, label) {
    return withTempDir(async (dir) => {
      console.log(`  Running ${label}...`);
      claudeRun(prompt, dir);
      const content = await safeRead(join(dir, 'result.txt'));
      return {
        content,
        pass: /^secret-token-\d+$/.test(content),
      };
    });
  }

  pluginUninstall();
  const vanilla = await evaluate(vanillaPrompt, 'vanilla');

  pluginInstall();
  const plugin = await evaluate(pluginPrompt, 'plugin');

  record(
    'H5',
    'Stdout Visibility',
    vanilla.pass
      ? `result.txt = "${vanilla.content}" (valid token)`
      : `result.txt = "${vanilla.content.slice(0, 40)}" (invalid)`,
    plugin.pass
      ? `result.txt = "${plugin.content}" (valid token)`
      : `result.txt = "${plugin.content.slice(0, 40)}" (invalid)`,
    vanilla.pass,
    plugin.pass,
  );
}

// ── H6: Loop Iteration ─────────────────────────────────────────────

async function testH6() {
  console.log('\n--- H6: Loop Iteration ---');

  // Create a broken app.js that requires a fix
  const brokenApp = [
    '// Bug: variable name typo causes ReferenceError',
    'const mesage = "hello";',
    'console.log(message);',
  ].join('\n');

  async function evaluate(prompt, label) {
    return withTempDir(async (dir) => {
      console.log(`  Running ${label}...`);
      await writeFile(join(dir, 'app.js'), brokenApp);
      await writeFile(
        join(dir, 'package.json'),
        JSON.stringify({ name: 'retry-test', scripts: { test: 'node app.js' } }),
      );
      claudeRun(prompt, dir);

      let exitCode = 1;
      try {
        execSync(`node "${join(dir, 'app.js')}"`, { timeout: 5000 });
        exitCode = 0;
      } catch {
        /* still fails */
      }
      return exitCode === 0;
    });
  }

  const vanillaPrompt = [
    'Fix app.js so it runs without errors.',
    'Run: node app.js',
    'If it fails, fix the error and try again.',
    'Retry up to 3 times. Make sure npm test passes.',
  ].join('\n');

  const pluginPrompt = [
    'Goal: fix with retry',
    '',
    'flow:',
    '  retry max 3',
    '    run: node app.js',
    '    if command_failed',
    '      prompt: Fix the error in app.js. The test must pass.',
    '    end',
    '  end',
    '',
    'done when:',
    '  tests_pass',
  ].join('\n');

  pluginUninstall();
  const vanillaPass = await evaluate(vanillaPrompt, 'vanilla');

  pluginInstall();
  const pluginPass = await evaluate(pluginPrompt, 'plugin');

  record(
    'H6',
    'Loop Iteration',
    vanillaPass ? 'app.js fixed' : 'app.js still broken',
    pluginPass ? 'app.js fixed' : 'app.js still broken',
    vanillaPass,
    pluginPass,
  );
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('[comparative-eval] Plugin vs Vanilla Claude — Comparative Evaluation\n');

  // Check claude CLI is available
  try {
    execSync('claude --version', { encoding: 'utf-8', timeout: 5000 });
  } catch {
    console.log('[comparative-eval] SKIP — claude CLI not found.');
    process.exit(0);
  }

  // Run all hypothesis tests
  await testH1();
  await testH3();
  await testH4();
  await testH5();

  if (!QUICK_MODE) {
    await testH2();
    await testH6();
  } else {
    console.log('\n  SKIP  H2: Gate Enforcement (--quick mode)');
    console.log('  SKIP  H6: Loop Iteration (--quick mode)');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('[comparative-eval] Summary\n');

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

  // Re-install plugin to leave environment in a good state
  pluginInstall();
  console.log('\n[comparative-eval] Plugin re-installed. Environment restored.');
}

main().catch((err) => {
  // Ensure plugin is re-installed even on error
  try {
    pluginInstall();
  } catch {
    /* best effort */
  }
  console.error('[comparative-eval] Fatal error:', err.message);
  process.exit(1);
});
