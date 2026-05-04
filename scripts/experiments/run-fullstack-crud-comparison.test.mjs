// cspell:ignore FSCRUD fscrud

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  classifyTimeoutPhase,
  classifyRunOutcome,
  createExperimentLock,
  isOllamaBackedRun,
  manifestBase,
  releaseExperimentLock,
  resolveArms,
  summarizeVerifierOutput,
} from './run-fullstack-crud-comparison.mjs';

function context(overrides = {}) {
  return {
    arm: 'solo-local-crud',
    repeatId: 'r01',
    options: {
      arms: 'smoke',
      repeats: 1,
      runner: 'aider',
      model: 'ollama_chat/qwen3-opencode:30b',
      runId: 'unit-test',
      dryRun: false,
    },
    modelDigest: 'sha256:abc',
    repoCommit: 'abc123',
    repoStatusAtStart: '',
    taskSha256: 'task-sha',
    hardware: { source: 'test', raw: '' },
    experimentLock: {
      runId: 'unit-test',
      lockPath: 'experiments/results/fullstack-crud-comparison/.run.lock',
    },
    ...overrides,
  };
}

test('detects Ollama-backed FSCRUD runs for native and aider local models', () => {
  assert.equal(
    isOllamaBackedRun({ runner: 'aider', model: 'ollama_chat/qwen3-opencode:30b' }),
    true,
  );
  assert.equal(isOllamaBackedRun({ runner: 'ollama', model: 'qwen3-opencode:30b' }), true);
  assert.equal(isOllamaBackedRun({ runner: 'codex', model: 'gpt-5' }), false);
});

test('resolves the micro-contract diagnostic arm group', () => {
  assert.deepEqual(resolveArms('micro'), ['solo-local-crud', 'pl-local-crud-micro-contract']);
});

test('resolves the micro-contract v2 diagnostic arm group', () => {
  assert.deepEqual(resolveArms('micro-v2'), ['solo-local-crud', 'pl-local-crud-micro-contract-v2']);
});

test('resolves the R30 local domain-control arm groups', () => {
  assert.deepEqual(resolveArms('r30-domain-control'), [
    'r30-solo-local',
    'r29-static-export-control',
    'r30-pl-domain-control',
  ]);
  assert.deepEqual(resolveArms('r30-local'), [
    'r30-solo-local',
    'r29-static-export-control',
    'r30-pl-domain-control',
    'r30-pl-senior-domain',
  ]);
});

test('resolves the R31 deterministic domain-kernel control group', () => {
  assert.deepEqual(resolveArms('r31-domain-kernel'), [
    'r30-solo-local',
    'r31-static-domain-kernel-control',
    'r31-pl-domain-kernel-bulk',
  ]);
});

test('resolves the R32 UI surface-control group', () => {
  assert.deepEqual(resolveArms('r32-ui-surface'), [
    'r30-solo-local',
    'r31-static-domain-kernel-control',
    'r32-pl-ui-surface-control',
  ]);
});

test('resolves the R33 deterministic UI skeleton group', () => {
  assert.deepEqual(resolveArms('r33-ui-skeleton'), [
    'r30-solo-local',
    'r31-static-domain-kernel-control',
    'r33-pl-ui-skeleton-integration',
  ]);
});

test('resolves the R34 server-only integration group', () => {
  assert.deepEqual(resolveArms('r34-server-only'), [
    'r30-solo-local',
    'r31-static-domain-kernel-control',
    'r34-pl-server-only-integration',
  ]);
});

test('resolves the R35 handoff-artifacts group', () => {
  assert.deepEqual(resolveArms('r35-handoff-artifacts'), [
    'r30-solo-local',
    'r31-static-domain-kernel-control',
    'r35-pl-handoff-artifacts',
  ]);
});

test('resolves the R36 structured handoff-source group', () => {
  assert.deepEqual(resolveArms('r36-structured-handoff'), [
    'r30-solo-local',
    'r31-static-domain-kernel-control',
    'r36-pl-structured-handoff-source',
  ]);
});

test('resolves the R37 schema-repaired handoff-source group', () => {
  assert.deepEqual(resolveArms('r37-schema-repaired-handoff'), [
    'r30-solo-local',
    'r31-static-domain-kernel-control',
    'r37-pl-schema-repaired-handoff-source',
  ]);
});

test('resolves the R38 senior-plan repaired handoff-source group', () => {
  assert.deepEqual(resolveArms('r38-senior-plan-repaired-handoff'), [
    'r30-solo-local',
    'r31-static-domain-kernel-control',
    'r38-pl-senior-plan-repaired-handoff-source',
  ]);
});

test('resolves the R39 quality-scored senior-plan group', () => {
  assert.deepEqual(resolveArms('r39-quality-scored-senior-plan'), [
    'r30-solo-local',
    'r31-static-domain-kernel-control',
    'r39-pl-quality-scored-senior-plan-source',
  ]);
});

test('resolves the R40 section-selected senior-plan group', () => {
  assert.deepEqual(resolveArms('r40-section-selected-senior-plan'), [
    'r30-solo-local',
    'r31-static-domain-kernel-control',
    'r40-pl-section-selected-senior-plan-source',
  ]);
});

test('resolves the R41 decision-matrix senior-plan group', () => {
  assert.deepEqual(resolveArms('r41-decision-matrix-senior-plan'), [
    'r30-solo-local',
    'r31-static-domain-kernel-control',
    'r41-pl-decision-matrix-senior-plan-source',
  ]);
});

test('classifies failed flows separately from verifier product failures', () => {
  assert.equal(classifyRunOutcome({ skipped: true }), 'dry_run_skipped');
  assert.equal(
    classifyRunOutcome({
      skipped: false,
      runnerExitCode: 1,
      runnerTimedOut: false,
      verifierPassed: false,
    }),
    'flow_failed',
  );
  assert.equal(
    classifyRunOutcome({
      skipped: false,
      runnerExitCode: 124,
      runnerTimedOut: true,
      verifierPassed: false,
    }),
    'timeout_partial',
  );
  assert.equal(
    classifyRunOutcome({
      skipped: false,
      runnerExitCode: 0,
      runnerTimedOut: false,
      timeoutClassification: { phase: 'verifier' },
      verifierPassed: false,
    }),
    'timeout_partial',
  );
  assert.equal(
    classifyRunOutcome({
      skipped: false,
      runnerExitCode: 0,
      runnerTimedOut: false,
      verifierPassed: false,
    }),
    'verifier_failed',
  );
  assert.equal(
    classifyRunOutcome({
      skipped: false,
      runnerExitCode: 0,
      runnerTimedOut: false,
      verifierPassed: true,
    }),
    'verified_pass',
  );
});

test('summarizes verifier stdout for run summaries without exposing full hidden output', () => {
  const summary = summarizeVerifierOutput(
    JSON.stringify({
      passed: false,
      score: 80,
      maxScore: 100,
      hardFailures: ['domain_behavior_failed'],
      checks: { npmTestPassed: null, domainBehavior: false },
    }),
  );

  assert.deepEqual(summary, {
    verifierScore: 80,
    verifierMaxScore: 100,
    hardFailures: ['domain_behavior_failed'],
    primaryFailure: 'domain_behavior_failed',
    publicGatePassed: false,
    hiddenOraclePassed: false,
    domainBehaviorPassed: false,
  });
  assert.equal(summarizeVerifierOutput('not json').verifierScore, null);
});

test('classifies the first timed-out phase with bounded diagnostic detail', () => {
  const timeout = classifyTimeoutPhase({
    runner: { timedOut: false, timeoutMs: 1000 },
    verifier: {
      timedOut: true,
      timeoutMs: 360000,
      signal: 'SIGTERM',
      exitCode: 124,
      stderrTail: 'verifier timed out',
    },
  });

  assert.deepEqual(timeout, {
    phase: 'verifier',
    timeoutMs: 360000,
    signal: 'SIGTERM',
    exitCode: 124,
    stderrTail: 'verifier timed out',
  });
  assert.equal(classifyTimeoutPhase({ runner: { timedOut: false } }), null);
});

test('run manifest records explicit timeout retry env runtime and artifact fields', () => {
  const manifest = manifestBase(
    context(),
    join(process.cwd(), 'experiments', 'results', 'fullstack-crud-comparison', 'unit', 'r01'),
    join(
      process.cwd(),
      'experiments',
      'results',
      'fullstack-crud-comparison',
      'unit',
      'r01',
      'workspace',
      'fscrud-01',
    ),
  );

  assert.equal(manifest.timeouts.runnerWallClockMs, 90 * 60_000);
  assert.equal(manifest.timeouts.aiderTurnMs, 600_000);
  assert.equal(manifest.timeouts.ollamaTurnMs, 600_000);
  assert.equal(manifest.timeouts.installMs, 600_000);
  assert.equal(manifest.timeouts.testMs, 300_000);
  assert.equal(manifest.timeouts.verifierMs, 360_000);
  assert.equal(manifest.retries.ollamaAttempts, 3);
  assert.equal(manifest.retries.ollamaDelayMs, 1_000);
  assert.equal(manifest.retries.ollamaActionRounds, 8);
  assert.equal(manifest.environment.PROMPT_LANGUAGE_AIDER_TIMEOUT_MS, '600000');
  assert.equal(manifest.environment.FSCRUD_RUNNER, 'aider');
  assert.equal(manifest.environment.FSCRUD_MODEL, 'ollama_chat/qwen3-opencode:30b');
  assert.equal(manifest.runtime.ollamaBacked, true);
  assert.equal(manifest.runtimeArtifacts.ollamaPsBeforeRunner, null);
  assert.equal(manifest.runtimeArtifacts.ollamaPsAfterRunner, null);
});

test('R30 solo baseline keeps the solo wall-clock timeout policy', () => {
  const manifest = manifestBase(
    context({ arm: 'r30-solo-local' }),
    join(process.cwd(), 'experiments', 'results', 'fullstack-crud-comparison', 'unit', 'r01'),
    join(
      process.cwd(),
      'experiments',
      'results',
      'fullstack-crud-comparison',
      'unit',
      'r01',
      'workspace',
      'fscrud-01',
    ),
  );

  assert.equal(manifest.timeouts.runnerWallClockMs, 90 * 60_000);
  assert.equal(manifest.timeouts.runnerWallClockMinutes, 90);
});

test('run manifest records Ollama ps artifact refs when supplied by the runner', () => {
  const manifest = manifestBase(
    context(),
    join(process.cwd(), 'experiments', 'results', 'fullstack-crud-comparison', 'unit', 'r01'),
    join(process.cwd(), 'experiments', 'results', 'fullstack-crud-comparison', 'unit', 'workspace'),
    {
      ollamaPsBeforeRunner: { json: 'ollama-ps-before-runner.json', exitCode: 0 },
      ollamaPsAfterRunner: { json: 'ollama-ps-after-runner.json', exitCode: 0 },
    },
  );

  assert.deepEqual(manifest.runtimeArtifacts.ollamaPsBeforeRunner, {
    json: 'ollama-ps-before-runner.json',
    exitCode: 0,
  });
  assert.deepEqual(manifest.runtimeArtifacts.ollamaPsAfterRunner, {
    json: 'ollama-ps-after-runner.json',
    exitCode: 0,
  });
});

test('experiment lock prevents a second concurrent FSCRUD run and releases cleanly', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'fscrud-lock-'));
  const lockPath = join(tempDir, '.run.lock');
  const options = {
    runId: 'unit-lock',
    runner: 'aider',
    model: 'ollama_chat/qwen3-opencode:30b',
  };

  try {
    const lock = createExperimentLock(options, lockPath);
    const owner = JSON.parse(readFileSync(join(lockPath, 'owner.json'), 'utf8'));

    assert.equal(owner.runId, 'unit-lock');
    assert.equal(existsSync(lockPath), true);
    assert.throws(() => createExperimentLock(options, lockPath), /Another FSCRUD experiment/);

    releaseExperimentLock(lock);
    assert.equal(existsSync(lockPath), false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
