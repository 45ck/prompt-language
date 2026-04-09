#!/usr/bin/env node
/**
 * e2e-eval.mjs — Layer 3: E2E hook-pipe eval.
 *
 * Phase A: Deterministic hook pipe-through (no API key needed).
 *   Pipes JSON into the UserPromptSubmit hook via execSync and validates output.
 *
 * Phase B (--full flag): Optional AI harness roundtrip.
 *   Runs the configured harness with the plugin installed, feeds response
 *   through parseFlow(). Best-effort — skips gracefully if the configured harness is unavailable.
 *
 * Usage:
 *   node scripts/eval/e2e-eval.mjs          # Phase A only
 *   node scripts/eval/e2e-eval.mjs --full   # Phase A + Phase B
 */

import { execSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseFlow } from '../../dist/application/parse-flow.js';
import {
  checkHarnessVersion,
  getCommandLabel,
  getHarnessLabel,
  runHarnessPrompt,
} from './harness.mjs';

const SRC_ROOT = resolve(import.meta.dirname, '..', '..');
const HOOK_SCRIPT = join(SRC_ROOT, 'src', 'presentation', 'hooks', 'user-prompt-submit.ts');
const FULL_MODE = process.argv.includes('--full');

// ── Helpers ──────────────────────────────────────────────────────────

function runHook(input, cwd) {
  return execSync(`npx tsx "${HOOK_SCRIPT}"`, {
    input,
    encoding: 'utf-8',
    cwd,
    timeout: 15_000,
  });
}

function makeActiveState(goal = 'Build feature') {
  return {
    sessionId: 'eval-session',
    flowSpec: {
      goal,
      nodes: [],
      completionGates: [],
      defaults: { maxIterations: 5, maxAttempts: 3 },
      warnings: [],
    },
    currentNodePath: [0],
    nodeProgress: {},
    variables: {},
    gateResults: {},
    lastStep: null,
    status: 'active',
    warnings: [],
  };
}

// ── Phase A: Hook pipe-through ───────────────────────────────────────

async function phaseA() {
  console.log('[e2e-eval] Phase A: Deterministic hook pipe-through\n');

  let passed = 0;
  let failed = 0;
  let tempDir;

  async function setup() {
    tempDir = await mkdtemp(join(tmpdir(), 'e2e-eval-'));
  }

  async function teardown() {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  }

  function assert(label, condition, detail = '') {
    if (condition) {
      passed++;
      console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`);
    } else {
      failed++;
      console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    }
  }

  // Case 1: NL input triggers meta-prompt injection
  await setup();
  try {
    const input = JSON.stringify({ prompt: 'Run tests until they pass, max 5' });
    const output = runHook(input, tempDir);
    const result = JSON.parse(output);
    // H#40: NL-to-DSL now shows confirmation prompt instead of immediate DSL reference
    assert(
      'A1: NL input triggers meta-prompt',
      result.prompt.includes('[prompt-language]') && result.prompt.includes('control-flow intent'),
      result.prompt.includes('control-flow intent')
        ? 'confirmation prompt'
        : 'missing NL detection',
    );
  } catch (err) {
    assert('A1: NL input triggers meta-prompt', false, err.message);
  } finally {
    await teardown();
  }

  // Case 2: Plain prompt passes through unchanged
  await setup();
  try {
    const input = JSON.stringify({ prompt: 'Hello world' });
    const output = runHook(input, tempDir);
    const result = JSON.parse(output);
    assert(
      'A2: Plain prompt passes through',
      result.prompt === 'Hello world',
      result.prompt === 'Hello world' ? 'unchanged' : `got: ${result.prompt.slice(0, 50)}...`,
    );
  } catch (err) {
    assert('A2: Plain prompt passes through', false, err.message);
  } finally {
    await teardown();
  }

  // Case 3: DSL input parses directly (flow block detected)
  await setup();
  try {
    const dsl = `Goal: Run tests\n\nflow:\n  run: npm test\n\ndone when:\n  tests_pass`;
    const input = JSON.stringify({ prompt: dsl });
    const output = runHook(input, tempDir);
    const result = JSON.parse(output);
    assert(
      'A3: DSL input parses directly',
      result.prompt.includes('[prompt-language]') && result.prompt.includes('Run tests'),
      result.prompt.includes('Flow:') ? 'flow context injected' : 'unexpected output',
    );
  } catch (err) {
    assert('A3: DSL input parses directly', false, err.message);
  } finally {
    await teardown();
  }

  // Case 4: Active flow injects context (not meta-prompt)
  await setup();
  try {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(join(stateDir, 'session-state.json'), JSON.stringify(makeActiveState()));

    const input = JSON.stringify({ prompt: 'Next step please' });
    const output = runHook(input, tempDir);
    const result = JSON.parse(output);
    assert(
      'A4: Active flow injects context',
      result.prompt.includes('Flow:') && result.prompt.includes('Next step please'),
      result.prompt.includes('Flow:') ? 'context injected' : 'missing context',
    );
  } catch (err) {
    assert('A4: Active flow injects context', false, err.message);
  } finally {
    await teardown();
  }

  // Case 5: Corrupted state file fails open
  await setup();
  try {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(join(stateDir, 'session-state.json'), '{{corrupted garbage');

    const input = JSON.stringify({ prompt: 'Hello world' });
    const output = runHook(input, tempDir);
    const result = JSON.parse(output);
    assert(
      'A5: Corrupted state fails open',
      result.prompt === 'Hello world',
      result.prompt === 'Hello world' ? 'passed through' : `got: ${result.prompt.slice(0, 50)}...`,
    );
  } catch (err) {
    assert('A5: Corrupted state fails open', false, err.message);
  } finally {
    await teardown();
  }

  // Case 6: Non-JSON input passes through raw
  await setup();
  try {
    const input = 'not json at all';
    const output = runHook(input, tempDir);
    assert(
      'A6: Non-JSON input passes through raw',
      output === 'not json at all',
      output === 'not json at all' ? 'raw pass-through' : `got: ${output.slice(0, 50)}`,
    );
  } catch (err) {
    assert('A6: Non-JSON input passes through raw', false, err.message);
  } finally {
    await teardown();
  }

  console.log(`\n[e2e-eval] Phase A: ${passed}/${passed + failed} passed`);
  return { passed, failed };
}

// ── Phase B: Claude CLI roundtrip ────────────────────────────────────

async function phaseB() {
  console.log(`\n[e2e-eval] Phase B: ${getCommandLabel()} roundtrip\n`);

  // Check if harness CLI is available
  try {
    const version = checkHarnessVersion();
    console.log(`  Harness: ${getHarnessLabel()} ${version}`);
  } catch {
    console.log(`  SKIP  ${getHarnessLabel()} not found — skipping Phase B.`);
    return { passed: 0, failed: 0, skipped: true };
  }

  let passed = 0;
  let failed = 0;

  const cases = [
    {
      label: 'B1: NL → DSL via CLI',
      input: 'Run tests until they pass, max 5 tries',
      expectedTopNode: 'until',
    },
    {
      label: 'B2: Retry via CLI',
      input: 'Retry the build up to 3 times',
      expectedTopNode: 'retry',
    },
    {
      label: 'B3: If/else via CLI',
      input: 'If tests fail fix them, otherwise move on',
      expectedTopNode: 'if',
    },
  ];

  for (const testCase of cases) {
    try {
      const output = runHarnessPrompt(testCase.input, {
        cwd: process.cwd(),
        timeout: 30_000,
      });

      // Strip markdown fences if present
      const cleaned = output
        .replace(/^```[\w-]*\n?/m, '')
        .replace(/\n?```\s*$/m, '')
        .trim();

      const spec = parseFlow(cleaned);
      const topKind = spec.nodes[0]?.kind;
      const expectedKinds = testCase.expectedTopNode.split('|');
      const pass = spec.nodes.length > 0 && expectedKinds.includes(topKind);

      if (pass) {
        passed++;
        console.log(`  PASS  ${testCase.label} — top node: ${topKind}`);
      } else {
        failed++;
        console.log(`  FAIL  ${testCase.label} — got ${topKind ?? 'no nodes'}`);
      }
    } catch (err) {
      failed++;
      console.log(`  FAIL  ${testCase.label} — ${err.message}`);
    }
  }

  console.log(`\n[e2e-eval] Phase B: ${passed}/${passed + failed} passed`);
  return { passed, failed, skipped: false };
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('[e2e-eval] Starting E2E evaluation...\n');

  const phaseAResult = await phaseA();

  let phaseBResult = { passed: 0, failed: 0, skipped: true };
  if (FULL_MODE) {
    phaseBResult = await phaseB();
  } else {
    console.log('\n[e2e-eval] Phase B skipped (use --full to enable).');
  }

  // Summary
  const totalPassed = phaseAResult.passed + phaseBResult.passed;
  const totalFailed = phaseAResult.failed + phaseBResult.failed;
  const total = totalPassed + totalFailed;

  console.log(`\n[e2e-eval] Summary: ${totalPassed}/${total} passed`);

  if (totalFailed > 0) {
    console.error('[e2e-eval] FAIL — some cases did not pass.');
    process.exit(1);
  }

  console.log('[e2e-eval] PASS — all cases passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[e2e-eval] Fatal error:', err.message);
  process.exit(1);
});
