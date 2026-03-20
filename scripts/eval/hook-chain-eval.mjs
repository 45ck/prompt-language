#!/usr/bin/env node
/**
 * hook-chain-eval.mjs — Hook chain integration test.
 *
 * Verifies the full enforcement loop by piping through all three hooks
 * in sequence, without an API key.
 *
 * 1. Pipe DSL through UserPromptSubmit → state created
 * 2. Pipe through Stop → blocked (exit 2)
 * 3. Pipe through TaskCompleted with failing gate → blocked (exit 2)
 * 4. Manually set gate to passing, pipe through TaskCompleted → allowed (exit 0)
 * 5. Pipe through Stop → allowed (exit 0)
 */

import { execSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SRC_ROOT = resolve(import.meta.dirname, '..', '..');
const HOOKS_DIR = join(SRC_ROOT, 'src', 'presentation', 'hooks');
const USER_PROMPT_HOOK = join(HOOKS_DIR, 'user-prompt-submit.ts');
const STOP_HOOK = join(HOOKS_DIR, 'stop.ts');
const TASK_COMPLETED_HOOK = join(HOOKS_DIR, 'task-completed.ts');

function runHook(script, input, cwd) {
  const opts = {
    input,
    encoding: 'utf-8',
    cwd,
    timeout: 15_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  };
  try {
    const stdout = execSync(`npx tsx "${script}"`, opts);
    return { exitCode: 0, stdout, stderr: '' };
  } catch (error) {
    return {
      exitCode: error.status,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
    };
  }
}

async function main() {
  console.log('[hook-chain-eval] Starting hook chain integration test...\n');

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

  const tempDir = await mkdtemp(join(tmpdir(), 'hook-chain-'));

  try {
    // Step 1: Pipe DSL through UserPromptSubmit → state created
    const dsl = [
      'Goal: run tests',
      '',
      'flow:',
      '  run: npm test',
      '',
      'done when:',
      '  tests_pass',
    ].join('\n');
    const promptInput = JSON.stringify({ prompt: dsl });
    const step1 = runHook(USER_PROMPT_HOOK, promptInput, tempDir);
    const step1Result = JSON.parse(step1.stdout);

    assert(
      'Step 1: UserPromptSubmit creates flow state',
      step1.exitCode === 0 && step1Result.prompt.includes('[prompt-language]'),
      step1.exitCode === 0 ? 'flow context injected' : `exit ${step1.exitCode}`,
    );

    // Verify state file was created
    const stateDir = join(tempDir, '.prompt-language');
    const statePath = join(stateDir, 'session-state.json');
    let stateRaw;
    try {
      stateRaw = await readFile(statePath, 'utf-8');
      assert('Step 1b: State file created', true, 'state file exists');
    } catch {
      assert('Step 1b: State file created', false, 'state file missing');
    }

    // Step 2: Pipe through Stop → blocked (exit 2)
    const step2 = runHook(STOP_HOOK, '{}', tempDir);
    assert(
      'Step 2: Stop hook blocks active flow',
      step2.exitCode === 2,
      step2.exitCode === 2 ? 'blocked as expected' : `exit ${step2.exitCode}`,
    );

    // Step 3: Pipe through TaskCompleted with failing gate → blocked (exit 2)
    const step3 = runHook(TASK_COMPLETED_HOOK, '{}', tempDir);
    assert(
      'Step 3: TaskCompleted blocks with failing gate',
      step3.exitCode === 2,
      step3.exitCode === 2 ? 'blocked as expected' : `exit ${step3.exitCode}`,
    );

    // Step 4: Manually set gate to passing, pipe through TaskCompleted → allowed
    if (stateRaw) {
      const state = JSON.parse(stateRaw);
      // Remove gates to simulate completion (no commands to run, no gate predicates to fail)
      state.flowSpec.completionGates = [];
      await writeFile(statePath, JSON.stringify(state));
    }

    const step4 = runHook(TASK_COMPLETED_HOOK, '{}', tempDir);
    assert(
      'Step 4: TaskCompleted allows when gates pass',
      step4.exitCode === 0,
      step4.exitCode === 0 ? 'allowed as expected' : `exit ${step4.exitCode}`,
    );

    // Step 5: Pipe through Stop → allowed (exit 0) because state is now completed
    const step5 = runHook(STOP_HOOK, '{}', tempDir);
    assert(
      'Step 5: Stop hook allows completed flow',
      step5.exitCode === 0,
      step5.exitCode === 0 ? 'allowed as expected' : `exit ${step5.exitCode}`,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  console.log(`\n[hook-chain-eval] Summary: ${passed}/${passed + failed} passed`);

  if (failed > 0) {
    console.error('[hook-chain-eval] FAIL — some steps did not pass.');
    process.exit(1);
  }

  console.log('[hook-chain-eval] PASS — all steps passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[hook-chain-eval] Fatal error:', err.message);
  process.exit(1);
});
