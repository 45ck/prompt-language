#!/usr/bin/env node
/**
 * ab-eval.mjs — A/B evaluation: plugin enabled vs disabled.
 *
 * Compares Claude's behavior with the prompt-language plugin ON vs OFF
 * on identical prompts, to demonstrate where the plugin's enforcement
 * mechanisms (gate checking, auto-execution, stop prevention) measurably
 * improve outcomes vs vanilla Claude.
 *
 * Toggles `enabledPlugins["prompt-language@prompt-language-local"]` in
 * `~/.claude/settings.json` between true/false for each run.
 *
 * Usage:
 *   node scripts/eval/ab-eval.mjs          # all tests (T1-T4)
 *   node scripts/eval/ab-eval.mjs --quick  # skip gate test (T2-T4)
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

const scenarios = [
  {
    id: 'T1',
    name: 'Gate Enforcement',
    timeout: 120_000,
    skipInQuick: true,
    prompt: [
      'Goal: fix app',
      '',
      'flow:',
      '  prompt: Fix app.js so it exits 0 instead of 1',
      '  run: node app.js',
      '',
      'done when:',
      '  tests_pass',
    ].join('\n'),
    async setup(dir) {
      await writeFile(join(dir, 'app.js'), 'process.exit(1)\n');
      await writeFile(
        join(dir, 'package.json'),
        JSON.stringify({ name: 'gate-test', scripts: { test: 'node app.js' } }),
      );
    },
    async evaluate(dir) {
      let exitCode = 1;
      try {
        execSync(`node "${join(dir, 'app.js')}"`, { timeout: 5000 });
        exitCode = 0;
      } catch {
        /* still fails */
      }
      return {
        pass: exitCode === 0,
        detail: exitCode === 0 ? 'app.js exits 0' : 'app.js still exits non-zero',
      };
    },
  },
  {
    id: 'T2',
    name: 'Run Auto-Execution',
    timeout: 60_000,
    skipInQuick: false,
    prompt: [
      'Goal: test run auto-exec and relay',
      '',
      'flow:',
      '  run: echo SECRET-TOKEN-42 > artifact.txt',
      '  prompt: Read artifact.txt, write its exact contents to final.txt',
    ].join('\n'),
    async evaluate(dir) {
      let artifact = '';
      let final = '';
      try {
        artifact = (await readFile(join(dir, 'artifact.txt'), 'utf-8')).trim();
      } catch {
        /* missing */
      }
      try {
        final = (await readFile(join(dir, 'final.txt'), 'utf-8')).trim();
      } catch {
        /* missing */
      }
      const artifactOk = artifact.includes('SECRET-TOKEN-42');
      const finalOk = final.includes('SECRET-TOKEN-42');
      const parts = [];
      parts.push(`artifact=${artifactOk ? 'ok' : 'missing'}`);
      parts.push(`final=${finalOk ? 'ok' : 'missing'}`);
      return {
        pass: artifactOk && finalOk,
        detail: parts.join(', '),
      };
    },
  },
  {
    id: 'T3',
    name: 'Stop Prevention / Multi-Step',
    timeout: 90_000,
    skipInQuick: false,
    prompt: [
      'Goal: multi-step file creation',
      '',
      'flow:',
      '  prompt: Create step1.txt containing exactly "alpha"',
      '  prompt: Create step2.txt containing exactly "bravo"',
      '  prompt: Read step1.txt and step2.txt, create step3.txt containing both values separated by a space',
    ].join('\n'),
    async evaluate(dir) {
      let s1 = '';
      let s2 = '';
      let s3 = '';
      try {
        s1 = (await readFile(join(dir, 'step1.txt'), 'utf-8')).trim();
      } catch {
        /* missing */
      }
      try {
        s2 = (await readFile(join(dir, 'step2.txt'), 'utf-8')).trim();
      } catch {
        /* missing */
      }
      try {
        s3 = (await readFile(join(dir, 'step3.txt'), 'utf-8')).trim();
      } catch {
        /* missing */
      }
      const s1ok = s1.includes('alpha');
      const s2ok = s2.includes('bravo');
      const s3ok = s3.includes('alpha') && s3.includes('bravo');
      const parts = [];
      parts.push(`step1=${s1ok ? 'ok' : 'missing'}`);
      parts.push(`step2=${s2ok ? 'ok' : 'missing'}`);
      parts.push(`step3=${s3ok ? 'ok' : 'missing'}`);
      return {
        pass: s1ok && s2ok && s3ok,
        detail: parts.join(', '),
      };
    },
  },
  {
    id: 'T4',
    name: 'Variable Interpolation',
    timeout: 60_000,
    skipInQuick: false,
    prompt: [
      'Goal: test let/var interpolation',
      '',
      'flow:',
      '  var greeting = "EXACT-PHRASE-7734"',
      '  let ver = run "node -v"',
      '  prompt: Write the greeting "${greeting}" and node version "${ver}" to output.txt',
    ].join('\n'),
    async evaluate(dir) {
      let content = '';
      try {
        content = (await readFile(join(dir, 'output.txt'), 'utf-8')).trim();
      } catch {
        /* missing */
      }
      const hasPhrase = content.includes('EXACT-PHRASE-7734');
      const hasVersion = /v\d+/.test(content);
      const parts = [];
      parts.push(`phrase=${hasPhrase ? 'ok' : 'missing'}`);
      parts.push(`version=${hasVersion ? 'ok' : 'missing'}`);
      return {
        pass: hasPhrase && hasVersion,
        detail: parts.join(', '),
      };
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
    const status = result.pass ? 'PASS' : 'FAIL';
    console.log(`  [${label}]  ${status}  (${elapsed}s) -- ${result.detail}`);

    return { pass: result.pass, elapsed: Number(elapsed), detail: result.detail };
  });
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('[ab-eval] A/B Evaluation: plugin ON vs OFF\n');

  // Check claude CLI
  try {
    execSync('claude --version', { encoding: 'utf-8', timeout: 5000 });
  } catch {
    console.log('[ab-eval] SKIP — claude CLI not found.');
    process.exit(0);
  }

  await backupSettings();

  let onPass = 0;
  let onTotal = 0;
  let offPass = 0;
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

      onTotal++;
      offTotal++;
      if (onResult.pass) onPass++;
      if (offResult.pass) offPass++;

      // Delta summary
      if (onResult.pass && !offResult.pass) {
        console.log('  Delta: Plugin enforcement required');
      } else if (onResult.pass && offResult.pass) {
        const diff = offResult.elapsed - onResult.elapsed;
        if (diff > 2) {
          console.log(`  Delta: Both pass, plugin ${diff.toFixed(1)}s faster`);
        } else {
          console.log('  Delta: Both pass, similar timing');
        }
      } else if (!onResult.pass && offResult.pass) {
        console.log('  Delta: Unexpected — OFF passed but ON failed');
      } else {
        console.log('  Delta: Both failed');
      }
      console.log();
    }
  } finally {
    await restoreSettings();
  }

  console.log(`[ab-eval] Summary: ON=${onPass}/${onTotal}, OFF=${offPass}/${offTotal}`);

  // Verify settings restored
  const restored = await readSettings();
  const pluginState = restored.enabledPlugins?.[PLUGIN_KEY];
  if (pluginState !== true) {
    console.error(`[ab-eval] WARNING: settings.json plugin state is ${pluginState}, expected true`);
  }

  if (onPass < onTotal) {
    console.error('[ab-eval] FAIL — some plugin-ON tests did not pass.');
    process.exit(1);
  }

  console.log('[ab-eval] DONE — plugin-ON tests all passed.');
}

main().catch(async (err) => {
  console.error('[ab-eval] Fatal error:', err.message);
  await restoreSettings();
  process.exit(1);
});
