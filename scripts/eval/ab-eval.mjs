#!/usr/bin/env node
/**
 * ab-eval.mjs — A/B evaluation v4: Final Hypothesis Testing.
 *
 * Tests the plugin's one remaining mechanistic differentiator: gate enforcement.
 * Previous rounds (v1-v3) showed vanilla Claude follows DSL instructions,
 * executes commands, and substitutes values correctly on its own. The plugin's
 * sequential shell execution was actually a bottleneck.
 *
 * E5: Gate-enforced iterative fix (H4 — strongest remaining hypothesis)
 * E6: Multi-step file creation (H5 — control, expected tie)
 * E7: Latency tax (H6 — quantify plugin overhead)
 *
 * Toggles `enabledPlugins["prompt-language@prompt-language-local"]` in
 * `~/.claude/settings.json` between true/false for each run.
 *
 * Usage:
 *   node scripts/eval/ab-eval.mjs          # all tests (E5-E7)
 *   node scripts/eval/ab-eval.mjs --quick  # same (no slow tests to skip)
 */

import { execSync } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const QUICK_MODE = process.argv.includes('--quick');
const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');
const PLUGIN_KEY = 'prompt-language@prompt-language-local';

// ── Helpers ──────────────────────────────────────────────────────────

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
  const dir = await mkdtemp(join(tmpdir(), 'pl-ab-'));
  try {
    return await fn(dir);
  } finally {
    await cleanupDir(dir);
  }
}

function claudeRun(prompt, cwd, timeout = 120_000) {
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
    if (err.stderr) console.error(`    [debug] stderr: ${err.stderr.slice(0, 200)}`);
    return err.stdout ?? '';
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

// ── Plugin Toggle ────────────────────────────────────────────────────

let originalSettings = null;

async function readSettings() {
  return JSON.parse(await readFile(SETTINGS_PATH, 'utf-8'));
}

async function writeSettings(settings) {
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n');
}

async function backupSettings() {
  originalSettings = await readFile(SETTINGS_PATH, 'utf-8');
}

async function restoreSettings() {
  if (originalSettings !== null) {
    await writeFile(SETTINGS_PATH, originalSettings);
    originalSettings = null;
  }
}

async function setPluginEnabled(enabled) {
  const settings = await readSettings();
  if (!settings.enabledPlugins) settings.enabledPlugins = {};
  settings.enabledPlugins[PLUGIN_KEY] = enabled;
  await writeSettings(settings);
}

// Safety: restore settings on unexpected exit
process.on('SIGINT', async () => {
  console.log('\n[ab-eval] Interrupted — restoring settings...');
  await restoreSettings();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await restoreSettings();
  process.exit(1);
});

// ── Scenarios ────────────────────────────────────────────────────────

const E5_APP_JS = `\
function wordCount(str) {
  const words = str.split(' ');
  return wrds.length;  // Bug 1: ReferenceError (wrds -> words)
}

function wrapHour(h) {
  return h > 11 ? h - 11 : h;  // Bug 2: off-by-one (>11 -> >12, -11 -> -12)
}

function isZero(val) {
  return val == 0;  // Bug 3: loose equality (== -> ===)
}

module.exports = { wordCount, wrapHour, isZero };
`;

const E5_TEST_JS = `\
const { wordCount, wrapHour, isZero } = require('./app.js');
let failures = 0;

try {
  const result = wordCount('hello world');
  if (result !== 2) { console.error('FAIL: wordCount expected 2, got ' + result); failures++; }
} catch (e) { console.error('FAIL: wordCount threw: ' + e.message); failures++; }

if (wrapHour(13) !== 1) { console.error('FAIL: wrapHour(13) expected 1, got ' + wrapHour(13)); failures++; }
if (wrapHour(12) !== 12) { console.error('FAIL: wrapHour(12) expected 12, got ' + wrapHour(12)); failures++; }

if (isZero(0) !== true) { console.error('FAIL: isZero(0) expected true'); failures++; }
if (isZero('') !== false) { console.error('FAIL: isZero("") expected false'); failures++; }
if (isZero(null) !== false) { console.error('FAIL: isZero(null) expected false'); failures++; }

if (failures === 0) console.log('All tests passed');
process.exit(failures > 0 ? 1 : 0);
`;

const scenarios = [
  // ── E5: Gate-Enforced Iterative Fix (H4 — strongest signal) ────────
  // app.js has 3 bugs of decreasing obviousness. The prompt focuses Claude
  // on the obvious crash (Bug 1). The gate requires ALL 6 assertions to pass.
  // With plugin ON, the TaskCompleted hook mechanically runs npm test and
  // blocks exit if failing. With plugin OFF, Claude relies on self-discipline.
  {
    id: 'E5',
    name: 'Gate-Enforced Iterative Fix',
    timeout: 180_000,
    skipInQuick: false,
    prompt: [
      'Goal: fix all bugs in app.js',
      '',
      'flow:',
      '  prompt: Fix the crash bug in app.js — wordCount() throws a ReferenceError on a typo.',
      '  run: npm test',
      '',
      'done when:',
      '  tests_pass',
    ].join('\n'),
    async setup(dir) {
      await writeFile(join(dir, 'app.js'), E5_APP_JS);
      await writeFile(join(dir, 'test.js'), E5_TEST_JS);
      await writeFile(
        join(dir, 'package.json'),
        JSON.stringify({ name: 'e5-test', scripts: { test: 'node test.js' } }, null, 2) + '\n',
      );
    },
    async evaluate(dir) {
      const details = {};
      let score = 0;

      // Check wordCount fix (Bug 1: wrds → words)
      const wc = runCmd(
        "node -e \"const a = require('./app.js'); console.log(a.wordCount('hello world'))\"",
        dir,
      );
      if (wc === 0) {
        // Verify it returns 2
        try {
          const out = execSync(
            "node -e \"const a = require('./app.js'); process.stdout.write(String(a.wordCount('hello world')))\"",
            { cwd: dir, timeout: 5000, encoding: 'utf-8' },
          );
          if (out.trim() === '2') {
            score++;
            details.wordCount = 'ok';
          } else {
            details.wordCount = `FAIL(returned ${out.trim()})`;
          }
        } catch {
          details.wordCount = 'FAIL(threw)';
        }
      } else {
        details.wordCount = 'FAIL(crashes)';
      }

      // Check wrapHour fix (Bug 2: >11 → >12, -11 → -12)
      try {
        const out13 = execSync(
          'node -e "const a = require(\'./app.js\'); process.stdout.write(String(a.wrapHour(13)))"',
          { cwd: dir, timeout: 5000, encoding: 'utf-8' },
        );
        const out12 = execSync(
          'node -e "const a = require(\'./app.js\'); process.stdout.write(String(a.wrapHour(12)))"',
          { cwd: dir, timeout: 5000, encoding: 'utf-8' },
        );
        if (out13.trim() === '1' && out12.trim() === '12') {
          score++;
          details.wrapHour = 'ok';
        } else {
          details.wrapHour = `FAIL(13→${out13.trim()}, 12→${out12.trim()})`;
        }
      } catch {
        details.wrapHour = 'FAIL(threw)';
      }

      // Check isZero fix (Bug 3: == → ===)
      try {
        const isZeroOut = execSync(
          'node -e "const a = require(\'./app.js\'); const r = [a.isZero(0), a.isZero(String()), a.isZero(null)]; process.stdout.write(JSON.stringify(r))"',
          { cwd: dir, timeout: 5000, encoding: 'utf-8' },
        );
        const [forZero, forEmpty, forNull] = JSON.parse(isZeroOut.trim());
        if (forZero === true && forEmpty === false && forNull === false) {
          score++;
          details.isZero = 'ok';
        } else {
          details.isZero = `FAIL(0→${forZero}, ""→${forEmpty}, null→${forNull})`;
        }
      } catch {
        details.isZero = 'FAIL(threw)';
      }

      // Also check npm test overall
      const npmTest = runCmd('npm test', dir);
      details.npmTest = npmTest === 0 ? 'pass' : 'fail';

      const detailStr = Object.entries(details)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      return { score, total: 3, detail: detailStr, fields: details };
    },
  },

  // ── E6: Multi-Step File Creation (H5 — control, expected tie) ──────
  // Three simple file creation steps. No setup files needed.
  // Both conditions should score 3/3. Confirms the plugin's value (if any)
  // lies in gate enforcement, not step tracking or flow visualization.
  {
    id: 'E6',
    name: 'Multi-Step File Creation',
    timeout: 120_000,
    skipInQuick: false,
    prompt: [
      'Goal: create three artifacts',
      '',
      'flow:',
      '  prompt: Create colors.json containing exactly: {"primary":"blue","secondary":"green","accent":"coral"}',
      '  prompt: Create greeting.txt containing exactly: Hello from the eval suite',
      '  prompt: Create manifest.csv with exactly two lines: name,version,status then prompt-lang,1.0.0,active',
    ].join('\n'),
    async evaluate(dir) {
      const details = {};
      let score = 0;

      // Check colors.json
      try {
        const raw = (await readFile(join(dir, 'colors.json'), 'utf-8')).trim();
        const data = JSON.parse(raw);
        if (data.primary === 'blue' && data.secondary === 'green' && data.accent === 'coral') {
          score++;
          details.colors = 'ok';
        } else {
          details.colors = `FAIL(${JSON.stringify(data)})`;
        }
      } catch {
        details.colors = 'FAIL(missing or invalid)';
      }

      // Check greeting.txt
      try {
        const raw = (await readFile(join(dir, 'greeting.txt'), 'utf-8')).trim();
        if (raw === 'Hello from the eval suite') {
          score++;
          details.greeting = 'ok';
        } else {
          details.greeting = `FAIL("${raw.slice(0, 60)}")`;
        }
      } catch {
        details.greeting = 'FAIL(missing)';
      }

      // Check manifest.csv
      try {
        const raw = (await readFile(join(dir, 'manifest.csv'), 'utf-8')).trim();
        const lines = raw.split('\n').map((l) => l.trim());
        if (
          lines.length >= 2 &&
          lines[0] === 'name,version,status' &&
          lines[1] === 'prompt-lang,1.0.0,active'
        ) {
          score++;
          details.manifest = 'ok';
        } else {
          details.manifest = `FAIL(${lines.length} lines: "${lines.join(' | ')}")`;
        }
      } catch {
        details.manifest = 'FAIL(missing)';
      }

      const detailStr = Object.entries(details)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      return { score, total: 3, detail: detailStr, fields: details };
    },
  },

  // ── E7: Latency Tax (H6 — quantify overhead) ──────────────────────
  // Simplest possible task: create one file. Both should score 1/1.
  // The real metric is elapsed time — quantifies the plugin's overhead.
  {
    id: 'E7',
    name: 'Latency Tax',
    timeout: 90_000,
    skipInQuick: false,
    prompt: [
      'Goal: create hello file',
      '',
      'flow:',
      '  prompt: Create hello.txt containing exactly: Hello, world!',
    ].join('\n'),
    async evaluate(dir) {
      try {
        const raw = (await readFile(join(dir, 'hello.txt'), 'utf-8')).trim();
        if (raw === 'Hello, world!') {
          return { score: 1, total: 1, detail: 'ok', fields: {} };
        }
        return { score: 0, total: 1, detail: `FAIL("${raw.slice(0, 60)}")`, fields: {} };
      } catch {
        return { score: 0, total: 1, detail: 'FAIL(missing)', fields: {} };
      }
    },
  },
];

// ── Runner ───────────────────────────────────────────────────────────

async function runScenario(scenario, pluginEnabled) {
  const label = pluginEnabled ? 'ON' : 'OFF';
  return withTempDir(async (dir) => {
    if (scenario.setup) await scenario.setup(dir);

    await setPluginEnabled(pluginEnabled);

    const start = Date.now();
    claudeRun(scenario.prompt, dir, scenario.timeout);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    const result = await scenario.evaluate(dir);
    console.log(`  [${label}]  ${result.score}/${result.total}  (${elapsed}s) -- ${result.detail}`);

    return {
      score: result.score,
      total: result.total,
      elapsed: Number(elapsed),
      detail: result.detail,
      fields: result.fields,
    };
  });
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('[ab-eval] A/B Evaluation v4: Final Hypothesis Testing\n');

  // Check claude CLI
  try {
    execSync('claude --version', { encoding: 'utf-8', timeout: 5000 });
  } catch {
    console.log('[ab-eval] SKIP — claude CLI not found.');
    process.exit(0);
  }

  await backupSettings();

  let onScore = 0;
  let onTotal = 0;
  let offScore = 0;
  let offTotal = 0;

  try {
    for (const scenario of scenarios) {
      if (QUICK_MODE && scenario.skipInQuick) {
        console.log(`--- ${scenario.id}: ${scenario.name} ---`);
        console.log('  SKIP  (--quick mode)\n');
        continue;
      }

      console.log(`--- ${scenario.id}: ${scenario.name} ---`);

      const onResult = await runScenario(scenario, true);
      const offResult = await runScenario(scenario, false);

      onScore += onResult.score;
      onTotal += onResult.total;
      offScore += offResult.score;
      offTotal += offResult.total;

      // Delta summary
      const scoreDiff = onResult.score - offResult.score;

      if (scenario.id === 'E7') {
        // Latency tax — primary metric is timing, not score
        const overhead = onResult.elapsed - offResult.elapsed;
        const ratio =
          offResult.elapsed > 0 ? (onResult.elapsed / offResult.elapsed).toFixed(1) : 'N/A';
        console.log(
          `  Latency: ON=${onResult.elapsed}s, OFF=${offResult.elapsed}s, overhead=${overhead.toFixed(1)}s (${ratio}x)`,
        );
      } else if (scoreDiff > 0) {
        console.log(`  Delta: Plugin resolved ${scoreDiff} more fix(es) than vanilla`);
      } else if (scoreDiff === 0) {
        const timeDiff = offResult.elapsed - onResult.elapsed;
        if (Math.abs(timeDiff) > 2) {
          const faster = timeDiff > 0 ? 'plugin' : 'vanilla';
          console.log(`  Delta: Same score, ${faster} ${Math.abs(timeDiff).toFixed(1)}s faster`);
        } else {
          console.log('  Delta: Same score, similar timing');
        }
      } else {
        console.log(`  Delta: Unexpected — vanilla scored ${-scoreDiff} more fix(es)`);
      }
      console.log();
    }
  } finally {
    await restoreSettings();
  }

  console.log(`[ab-eval] Summary: ON=${onScore}/${onTotal}, OFF=${offScore}/${offTotal}`);

  // Verify settings restored
  const restored = await readSettings();
  const pluginState = restored.enabledPlugins?.[PLUGIN_KEY];
  if (pluginState !== true) {
    console.error(`[ab-eval] WARNING: settings.json plugin state is ${pluginState}, expected true`);
  }

  console.log('[ab-eval] DONE');
}

main().catch(async (err) => {
  console.error('[ab-eval] Fatal error:', err.message);
  await restoreSettings();
  process.exit(1);
});
