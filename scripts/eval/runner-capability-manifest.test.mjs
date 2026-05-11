import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assessRunnerCapabilityManifest,
  buildRunnerCapabilityManifest,
  classifyRunnerClaimProfile,
} from './runner-capability-manifest.mjs';

function buildLocalLoopbackManifest(overrides = {}) {
  return buildRunnerCapabilityManifest({
    runnerId: 'ollama',
    adapter: 'local-ollama-smoke',
    provider: 'ollama',
    model: 'llama3.1',
    command: 'ollama',
    argv: ['run', 'llama3.1'],
    readRoots: ['/workspace'],
    writeRoots: ['/workspace'],
    outputRoots: ['/workspace/.prompt-language'],
    timeoutMs: 120_000,
    expectedPairCount: 1,
    transportWitness: 'shim',
    networkMode: 'loopback-only',
    sandboxMode: 'workspace',
    shellMode: 'allowlist',
    allowedCommands: ['ollama run llama3.1'],
    envAllowlist: ['PL_TRACE', 'PL_TRACE_STRICT', 'PL_RUN_ID', 'PL_TRACE_DIR'],
    ...overrides,
  });
}

test('local loopback runner manifest can be claim-eligible', () => {
  const manifest = buildLocalLoopbackManifest();
  assert.equal(manifest.safety.claimPosture, 'claim-eligible');
  assert.deepEqual(manifest.safety.recordedOnlyReasons, []);

  const assessment = assessRunnerCapabilityManifest(manifest);
  assert.deepEqual(assessment, {
    status: 'ready',
    blockers: [],
  });
});

test('local runner manifest is recorded-only when shell remains model-directed', () => {
  const manifest = buildLocalLoopbackManifest({
    shellMode: 'model-directed',
    allowedCommands: [],
  });

  assert.equal(manifest.safety.claimPosture, 'recorded-only');
  assert.deepEqual(manifest.safety.recordedOnlyReasons, ['runner-shell-unbounded']);

  const assessment = assessRunnerCapabilityManifest(manifest);
  assert.deepEqual(assessment, {
    status: 'unsafe',
    blockers: ['runner-recorded-only-posture', 'runner-shell-unbounded'],
  });
});

test('claim profile classifier keeps unsafe bypasses recorded-only', () => {
  const profile = classifyRunnerClaimProfile({
    unsafeFlags: ['--dangerously-bypass-approvals-and-sandbox'],
    approvalMode: 'bypassed',
    sandboxMode: 'workspace',
    networkMode: 'loopback-only',
    shellMode: 'allowlist',
    transportWitness: 'shim',
    timeoutMs: 120_000,
  });

  assert.deepEqual(profile, {
    claimPosture: 'recorded-only',
    recordedOnlyReasons: ['runner-unsafe-permission-bypass', 'runner-approval-bypassed'],
  });
});

test('in-process local adapters stay recorded-only without an external process lease', () => {
  const manifest = buildLocalLoopbackManifest({
    externalProcess: false,
  });

  assert.equal(manifest.safety.claimPosture, 'recorded-only');
  assert.deepEqual(manifest.safety.recordedOnlyReasons, ['runner-external-process-missing']);

  const assessment = assessRunnerCapabilityManifest(manifest);
  assert.deepEqual(assessment, {
    status: 'unsafe',
    blockers: ['runner-recorded-only-posture', 'runner-external-process-missing'],
  });
});
