// run-meta-experiment.test.mjs — node:test for dry-run mode.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { hashState } from '../../eval/provenance-schema.mjs';

import {
  deriveClaimEligibility,
  deleteRunNonce,
  liveRun,
  main,
  readRunNonce,
  resolveNonceStoreDir,
  summarizeBootstrapPreflight,
  writeRunNonce,
} from './run-meta-experiment.mjs';
import { computeManifest } from './compute-manifest.mjs';
import { diffManifests } from './manifest-diff.mjs';

const HARNESS_SOURCE = readFileSync(new URL('./run-meta-experiment.mjs', import.meta.url), 'utf8');
const META_HARNESS_ATTESTATION_SUPPORT =
  /attest\.mjs/.test(HARNESS_SOURCE) ||
  /attestation\.json/.test(HARNESS_SOURCE) ||
  /require-attestation/.test(HARNESS_SOURCE);
const META_HARNESS_ATTESTATION_REASON =
  'meta harness attestation wiring is not in run-meta-experiment.mjs yet; keep these cases dormant until AP-9 bundle integration lands here';

function skipWithoutMetaHarnessAttestation(t) {
  if (!META_HARNESS_ATTESTATION_SUPPORT) {
    t.skip(META_HARNESS_ATTESTATION_REASON);
    return true;
  }
  return false;
}

function createLiveDeps(bundleDir, overrides = {}) {
  const nonce = 'a'.repeat(64);
  const noncePath = join(bundleDir, 'nonce.txt');
  const verifyCalls = [];
  const defaultVerify = {
    ran: true,
    exitCode: 0,
    stderr: '',
    argsUsed: ['--trace', join(bundleDir, 'provenance.jsonl')],
  };

  const deps = {
    ensureCliInstalledFn: () => ({ installed: true, ranInstall: false }),
    checkShimFn: () => ({ exists: true }),
    checkClaudeAuthFn: () => ({ claudeBin: '/fake/claude', authenticated: true }),
    runBootstrapPreflightFn: () => ({ overall: 'ready', items: [], nextActions: [] }),
    runLiveFn: async () => ({ exitCode: 0, signal: null, timedOut: false }),
    parseFlowTextFn: async () => ({
      nodes: [
        { kind: 'prompt', body: [] },
        { kind: 'run', body: [] },
      ],
    }),
    gitStashFn: () => ({ stashed: false, status: 0, stdout: '' }),
    gitStashPopFn: () => ({ status: 0, stdout: '', stderr: '' }),
    computeManifestFn: () => ({ 'package.json': 'abc'.repeat(21) + 'a' }),
    diffManifestsFn: () => ({
      added: [],
      changed: [],
      removed: [],
      protectedChanged: [],
    }),
    writeRunNonceFn: () => ({ nonce, noncePath }),
    readRunNonceFn: () => nonce,
    deleteRunNonceFn: () => {},
    runVerifyTraceFn: (_targetBundleDir, options) => {
      verifyCalls.push(options);
      return defaultVerify;
    },
    ...overrides,
  };

  return { deps, verifyCalls };
}

test('dry-run against a tiny fake flow parses and reports prerequisites', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'meta-dry-'));
  const flow = join(dir, 'tiny.flow');
  writeFileSync(
    flow,
    `Goal: tiny meta dry run

flow:
  let hello = "world"
  prompt: Say \${hello}.
`,
  );
  // Redirect stdout capture via a simple override
  const origWrite = process.stdout.write.bind(process.stdout);
  let captured = '';
  process.stdout.write = (chunk, ...rest) => {
    captured += typeof chunk === 'string' ? chunk : chunk.toString();
    return origWrite(chunk, ...rest);
  };
  try {
    const result = await main([flow]);
    assert.equal(result.mode, 'dry-run');
    assert.equal(result.parse.ok, true, 'flow must parse');
    assert.ok(result.parse.nodeCount >= 2, 'expected at least 2 nodes');
    assert.ok(Array.isArray(result.imports));
    assert.ok(captured.includes('"mode":"dry-run"'), 'stdout summary present');
  } finally {
    process.stdout.write = origWrite;
  }
});

test('manifest diff detects protected-config changes', () => {
  const pre = { 'package.json': 'aaa', 'src/x.ts': 'hhh' };
  const post = { 'package.json': 'bbb', 'src/x.ts': 'hhh', 'src/new.ts': 'ccc' };
  const d = diffManifests(pre, post);
  assert.deepEqual(d.changed, ['package.json']);
  assert.deepEqual(d.added, ['src/new.ts']);
  assert.deepEqual(d.removed, []);
  assert.ok(d.protectedChanged.includes('package.json'));
});

test('computeManifest returns SHA-256 entries and skips node_modules', () => {
  const dir = mkdtempSync(join(tmpdir(), 'meta-mf-'));
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'a.ts'), 'export const a = 1;');
  writeFileSync(join(dir, 'package.json'), '{"name":"t"}');
  mkdirSync(join(dir, 'node_modules'));
  writeFileSync(join(dir, 'node_modules', 'ignored'), 'x');
  const m = computeManifest(dir);
  assert.ok('src/a.ts' in m);
  assert.ok('package.json' in m);
  assert.ok(!Object.keys(m).some((k) => k.startsWith('node_modules')));
  assert.match(m['package.json'], /^[0-9a-f]{64}$/);
});

test('writeRunNonce uses a private nonce store and 64-hex nonce content', () => {
  const dir = mkdtempSync(join(tmpdir(), 'meta-nonce-'));
  const prev = process.env.PL_META_NONCE_DIR;
  process.env.PL_META_NONCE_DIR = dir;

  try {
    assert.equal(resolveNonceStoreDir(), dir);
    const { nonce, noncePath } = writeRunNonce('run-1');

    assert.equal(noncePath.startsWith(dir), true, 'nonce must live under configured store');
    assert.match(nonce, /^[0-9a-f]{64}$/);
    assert.match(basename(noncePath), /^[0-9a-f]{64}\.nonce$/);
    assert.equal(readRunNonce(noncePath), nonce);
    assert.equal(existsSync(noncePath), true);

    if (process.platform !== 'win32') {
      const storeMode = statSync(dir).mode & 0o777;
      const fileMode = statSync(noncePath).mode & 0o777;
      assert.equal(storeMode, 0o700);
      assert.equal(fileMode, 0o600);
    }

    deleteRunNonce(noncePath);
    assert.equal(existsSync(noncePath), false, 'nonce file should be deleted');
  } finally {
    if (prev === undefined) delete process.env.PL_META_NONCE_DIR;
    else process.env.PL_META_NONCE_DIR = prev;
  }
});

test('summarizeBootstrapPreflight extracts blocked and warning items', () => {
  const summary = summarizeBootstrapPreflight({
    overall: 'blocked',
    items: [
      { id: 1, name: 'pinned runtime', status: 'blocked', detail: 'rebuild required' },
      { id: 4, name: 'resource caps', status: 'warn', detail: 'defaults apply' },
      { id: 8, name: 'post-run verifier', status: 'unchecked', detail: 'post-run only' },
    ],
    nextActions: ['do the thing'],
  });

  assert.equal(summary.overall, 'blocked');
  assert.deepEqual(summary.blockedItems, [
    { id: 1, name: 'pinned runtime', detail: 'rebuild required' },
  ]);
  assert.deepEqual(summary.warningItems, [
    { id: 4, name: 'resource caps', detail: 'defaults apply' },
  ]);
  assert.deepEqual(summary.nextActions, ['do the thing']);
});

test('deriveClaimEligibility marks degraded preflight as ineligible even when the run otherwise passes', () => {
  const eligibility = deriveClaimEligibility({
    bootstrapOverall: 'degraded',
    verifyOk: true,
    ruleWeakening: false,
    timedOut: false,
    errorStr: null,
    nonceMismatch: false,
    attestationPresent: true,
    attestationRole: 'operator',
  });

  assert.deepEqual(eligibility, {
    eligible: false,
    status: 'ineligible',
    blockers: ['bootstrap-preflight-degraded'],
  });
});

test('deriveClaimEligibility requires an operator attestation once verification ran', () => {
  const missing = deriveClaimEligibility({
    bootstrapOverall: 'ready',
    verifyOk: true,
    ruleWeakening: false,
    timedOut: false,
    errorStr: null,
    nonceMismatch: false,
    attestationPresent: false,
    attestationRole: null,
  });
  assert.deepEqual(missing.blockers, ['attestation-missing']);

  const ciOnly = deriveClaimEligibility({
    bootstrapOverall: 'ready',
    verifyOk: true,
    ruleWeakening: false,
    timedOut: false,
    errorStr: null,
    nonceMismatch: false,
    attestationPresent: true,
    attestationRole: 'ci',
  });
  assert.deepEqual(ciOnly.blockers, ['attestation-role-not-operator']);
});

test('liveRun short-circuits on blocked bootstrap preflight and persists the report', async () => {
  const bundleDir = mkdtempSync(join(tmpdir(), 'meta-live-blocked-'));
  let launchAttempted = false;
  const bootstrapReport = {
    overall: 'blocked',
    items: [{ id: 6, name: 'cross-family reviewer', status: 'blocked', detail: 'same family' }],
    nextActions: ['pick a cross-family reviewer'],
  };

  const result = await liveRun(
    {
      flowText: 'Goal: blocked live run',
      runId: 'meta-test-blocked',
      wallClockSec: 1,
      bundleDirOverride: bundleDir,
    },
    {
      ensureCliInstalledFn: () => ({ installed: true, ranInstall: false }),
      checkShimFn: () => ({ exists: true }),
      checkClaudeAuthFn: () => ({ claudeBin: '/fake/claude', authenticated: true }),
      runBootstrapPreflightFn: () => bootstrapReport,
      runLiveFn: async () => {
        launchAttempted = true;
        return { exitCode: 0, signal: null, timedOut: false };
      },
    },
  );

  assert.equal(result.success, false);
  assert.equal(result.reason, 'bootstrap-preflight-blocked');
  assert.equal(result.launch.attempted, false);
  assert.equal(launchAttempted, false, 'claude launch must not be attempted');
  assert.deepEqual(result.claimEligibility, {
    eligible: false,
    status: 'ineligible',
    blockers: ['bootstrap-preflight-blocked'],
  });

  const persisted = JSON.parse(readFileSync(join(bundleDir, 'bootstrap-preflight.json'), 'utf8'));
  assert.deepEqual(persisted, bootstrapReport);
  const summary = JSON.parse(readFileSync(join(bundleDir, 'report.json'), 'utf8'));
  assert.equal(summary.reason, 'bootstrap-preflight-blocked');
  assert.deepEqual(summary.launch.blockedBy, [
    { id: 6, name: 'cross-family reviewer', detail: 'same family' },
  ]);
});

function encodeEd25519PublicKey(publicKey) {
  const der = publicKey.export({ format: 'der', type: 'spki' });
  return der.subarray(der.length - 32).toString('base64');
}

function makeAttestationFixture(bundleDir, runId) {
  const state = {
    sessionId: `${runId}-session`,
    status: 'completed',
    currentNodePath: [],
    variables: {},
    nodeProgress: {},
    transitionSeq: 0,
    spawnedChildren: {},
    gateResults: {},
    flowSpec: { goal: 'fixture', nodes: [] },
  };
  const stateHash = hashState(state);
  mkdirSync(join(bundleDir, '.prompt-language'), { recursive: true });
  writeFileSync(
    join(bundleDir, '.prompt-language', 'session-state.json'),
    `${JSON.stringify(state)}\n`,
  );
  writeFileSync(
    join(bundleDir, '.prompt-language', 'provenance.jsonl'),
    `${JSON.stringify({
      timestamp: '2026-01-15T00:00:00.000Z',
      runId,
      event: 'agent_invocation_begin',
      stateAfterHash: stateHash,
    })}\n`,
  );
}

function makeSignerMaterial(dir) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const keyPath = join(dir, 'operator.key');
  const trustedPath = join(dir, 'trusted-signers.json');
  const revokedPath = join(dir, 'revoked-signers.json');
  writeFileSync(keyPath, privateKey.export({ format: 'pem', type: 'pkcs8' }));
  writeFileSync(
    trustedPath,
    `${JSON.stringify(
      {
        version: 1,
        signers: [
          {
            signerId: 'operator-test',
            role: 'operator',
            publicKey: encodeEd25519PublicKey(publicKey),
            validFrom: '2026-01-01T00:00:00.000Z',
            validUntil: null,
            notes: 'test signer',
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(revokedPath, `${JSON.stringify({ version: 1, revoked: [] }, null, 2)}\n`);
  return { keyPath, trustedPath, revokedPath };
}

test('liveRun auto-signs a bundle when attestation signer config is present', async () => {
  const bundleDir = mkdtempSync(join(tmpdir(), 'meta-live-attest-'));
  const { keyPath, trustedPath, revokedPath } = makeSignerMaterial(bundleDir);
  let verifyOptions = null;

  const result = await liveRun(
    {
      flowText: 'Goal: live attestation\n\nflow:\n  prompt: hi\n',
      runId: 'meta-test-attest',
      wallClockSec: 1,
      bundleDirOverride: bundleDir,
    },
    {
      env: {
        ...process.env,
        PL_ATTEST_SIGNER_ID: 'operator-test',
        PL_ATTEST_KEY_PATH: keyPath,
        PL_ATTEST_TRUSTED_SIGNERS_PATH: trustedPath,
        PL_ATTEST_REVOKED_SIGNERS_PATH: revokedPath,
      },
      ensureCliInstalledFn: () => ({ installed: true, ranInstall: false }),
      checkShimFn: () => ({ exists: true }),
      checkClaudeAuthFn: () => ({ claudeBin: '/fake/claude', authenticated: true }),
      runBootstrapPreflightFn: () => ({
        overall: 'ready',
        items: [
          { id: 1, name: 'pinned runtime', status: 'ok', pinnedSha: 'abc123' },
          {
            id: 6,
            name: 'cross-family reviewer',
            status: 'ok',
            factoryFamily: 'gemini',
            reviewerFamily: 'claude',
          },
        ],
        nextActions: [],
      }),
      parseFlowTextFn: async () => ({ nodes: [{ kind: 'prompt' }] }),
      gitStashFn: () => ({ stashed: false, status: 0, stdout: '' }),
      gitStashPopFn: () => ({ status: 0, stdout: '', stderr: '' }),
      computeManifestFn: () => ({ 'package.json': 'hash' }),
      diffManifestsFn: () => ({ added: [], removed: [], changed: [], protectedChanged: [] }),
      writeRunNonceFn: () => ({ nonce: 'nonce-123', noncePath: join(bundleDir, 'nonce.txt') }),
      readRunNonceFn: () => 'nonce-123',
      deleteRunNonceFn: () => {},
      runLiveFn: async ({ bundleDir: liveBundleDir, runId }) => {
        writeFileSync(
          join(liveBundleDir, 'manifest-pre.json'),
          `${JSON.stringify({ ok: true })}\n`,
        );
        makeAttestationFixture(liveBundleDir, runId);
        return { exitCode: 0, signal: null, timedOut: false };
      },
      runVerifyTraceFn: (verifyBundleDir, options) => {
        verifyOptions = { verifyBundleDir, options };
        return { ran: true, exitCode: 0, stderr: '', argsUsed: [] };
      },
    },
  );

  assert.equal(result.success, true);
  assert.equal(result.claimEligibility.eligible, true);
  assert.equal(result.attestation.signer, 'operator-test');
  assert.equal(result.attestation.signerRole, 'operator');
  assert.equal(result.attestation.verified, true);
  assert.ok(result.attestation.path);
  assert.equal(existsSync(result.attestation.path), true);
  assert.deepEqual(verifyOptions?.options.attestationPath, result.attestation.path);
  assert.equal(verifyOptions?.options.trustedSignersPath, trustedPath);
  assert.equal(verifyOptions?.options.revokedSignersPath, revokedPath);

  const persisted = JSON.parse(readFileSync(join(bundleDir, 'report.json'), 'utf8'));
  assert.equal(persisted.attestation.signer, 'operator-test');
  assert.equal(persisted.claimEligibility.eligible, true);
});

test('liveRun stays recorded-only when no attestation signer config is present', async () => {
  const bundleDir = mkdtempSync(join(tmpdir(), 'meta-live-unattested-'));

  const result = await liveRun(
    {
      flowText: 'Goal: live unattested\n\nflow:\n  prompt: hi\n',
      runId: 'meta-test-unattested',
      wallClockSec: 1,
      bundleDirOverride: bundleDir,
    },
    {
      env: { ...process.env },
      ensureCliInstalledFn: () => ({ installed: true, ranInstall: false }),
      checkShimFn: () => ({ exists: true }),
      checkClaudeAuthFn: () => ({ claudeBin: '/fake/claude', authenticated: true }),
      runBootstrapPreflightFn: () => ({
        overall: 'ready',
        items: [
          { id: 1, name: 'pinned runtime', status: 'ok', pinnedSha: 'abc123' },
          {
            id: 6,
            name: 'cross-family reviewer',
            status: 'ok',
            factoryFamily: 'gemini',
            reviewerFamily: 'claude',
          },
        ],
        nextActions: [],
      }),
      parseFlowTextFn: async () => ({ nodes: [{ kind: 'prompt' }] }),
      gitStashFn: () => ({ stashed: false, status: 0, stdout: '' }),
      gitStashPopFn: () => ({ status: 0, stdout: '', stderr: '' }),
      computeManifestFn: () => ({ 'package.json': 'hash' }),
      diffManifestsFn: () => ({ added: [], removed: [], changed: [], protectedChanged: [] }),
      writeRunNonceFn: () => ({ nonce: 'nonce-123', noncePath: join(bundleDir, 'nonce.txt') }),
      readRunNonceFn: () => 'nonce-123',
      deleteRunNonceFn: () => {},
      runLiveFn: async ({ bundleDir: liveBundleDir, runId }) => {
        writeFileSync(
          join(liveBundleDir, 'manifest-pre.json'),
          `${JSON.stringify({ ok: true })}\n`,
        );
        makeAttestationFixture(liveBundleDir, runId);
        return { exitCode: 0, signal: null, timedOut: false };
      },
      runVerifyTraceFn: () => ({ ran: true, exitCode: 0, stderr: '', argsUsed: [] }),
    },
  );

  assert.equal(result.success, true);
  assert.equal(result.attestation.path, null);
  assert.deepEqual(result.claimEligibility.blockers, ['attestation-missing']);
});

test('liveRun records attestation-required verifier failures as non-claim-eligible', async () => {
  const bundleDir = mkdtempSync(join(tmpdir(), 'meta-live-attestation-fail-'));
  const verifyResult = {
    ran: true,
    exitCode: 1,
    stderr: 'attestation required but absent',
    argsUsed: [
      '--trace',
      join(bundleDir, 'provenance.jsonl'),
      '--attestation',
      join(bundleDir, 'attestation.json'),
      '--require-attestation',
      '--require-role',
      'operator',
    ],
  };
  const { deps } = createLiveDeps(bundleDir, {
    runVerifyTraceFn: (_targetBundleDir, options) => {
      return {
        ...verifyResult,
        optionsSeen: options,
      };
    },
  });

  const result = await liveRun(
    {
      flowText: 'Goal: attestation required failure',
      runId: 'meta-test-attestation-fail',
      wallClockSec: 1,
      bundleDirOverride: bundleDir,
    },
    deps,
  );

  assert.equal(result.success, false);
  assert.equal(result.reason, 'verify-trace-failed');
  assert.deepEqual(result.claimEligibility, {
    eligible: false,
    status: 'ineligible',
    blockers: ['verify-trace-failed'],
  });
  assert.equal(result.verify.stderr, 'attestation required but absent');
  assert.ok(
    result.verify.argsUsed.includes('--require-attestation'),
    'report should preserve verifier attestation flags',
  );

  const persisted = JSON.parse(readFileSync(join(bundleDir, 'report.json'), 'utf8'));
  assert.equal(persisted.reason, 'verify-trace-failed');
  assert.equal(persisted.verify.stderr, 'attestation required but absent');
  assert.deepEqual(persisted.claimEligibility, result.claimEligibility);
  assert.deepEqual(persisted.verify.argsUsed, verifyResult.argsUsed);
});

test('liveRun preserves attested verify metadata in report when verification succeeds', async () => {
  const bundleDir = mkdtempSync(join(tmpdir(), 'meta-live-attestation-pass-'));
  const verifyResult = {
    ran: true,
    exitCode: 0,
    stderr: '',
    argsUsed: [
      '--trace',
      join(bundleDir, 'provenance.jsonl'),
      '--attestation',
      join(bundleDir, 'attestation.json'),
      '--trusted-signers',
      join(bundleDir, 'trusted-signers.json'),
      '--revoked-signers',
      join(bundleDir, 'revoked-signers.json'),
      '--require-role',
      'operator',
    ],
    signer: 'operator-test',
    signerRole: 'operator',
  };
  const { deps } = createLiveDeps(bundleDir, {
    runVerifyTraceFn: () => verifyResult,
  });

  const result = await liveRun(
    {
      flowText: 'Goal: attested pass',
      runId: 'meta-test-attestation-pass',
      wallClockSec: 1,
      bundleDirOverride: bundleDir,
    },
    deps,
  );

  assert.equal(result.success, true);
  assert.deepEqual(result.claimEligibility, {
    eligible: true,
    status: 'eligible',
    blockers: [],
  });
  assert.equal(result.verify.signer, 'operator-test');
  assert.equal(result.verify.signerRole, 'operator');
  assert.ok(
    result.verify.argsUsed.includes('--attestation'),
    'report should preserve attestation verification metadata',
  );

  const persisted = JSON.parse(readFileSync(join(bundleDir, 'report.json'), 'utf8'));
  assert.equal(persisted.success, true);
  assert.deepEqual(persisted.claimEligibility, result.claimEligibility);
  assert.equal(persisted.verify.signer, 'operator-test');
  assert.deepEqual(persisted.verify.argsUsed, verifyResult.argsUsed);
});

test('liveRun can request optional signing without blocking when attestation is not yet wired', async (t) => {
  if (skipWithoutMetaHarnessAttestation(t)) return;

  const bundleDir = mkdtempSync(join(tmpdir(), 'meta-live-attestation-optional-'));
  const attestCalls = [];
  const { deps } = createLiveDeps(bundleDir, {
    runAttestBundleFn: async (options) => {
      attestCalls.push(options);
      throw new Error('signer unavailable');
    },
  });

  const result = await liveRun(
    {
      flowText: 'Goal: optional attestation',
      runId: 'meta-test-attestation-optional',
      wallClockSec: 1,
      bundleDirOverride: bundleDir,
      attestation: {
        mode: 'optional',
        signer: 'operator-test',
        keyPath: join(bundleDir, 'operator.key'),
      },
    },
    deps,
  );

  assert.equal(attestCalls.length, 1, 'optional signing should invoke the signer seam once');
  assert.equal(result.success, true, 'optional signing failure should not block the run');
  assert.ok(
    !result.claimEligibility.blockers.includes('attestation-required'),
    'optional signing should not introduce an attestation-required blocker',
  );
});

test('liveRun propagates attestation requirements into verify options when configured', async (t) => {
  if (skipWithoutMetaHarnessAttestation(t)) return;

  const bundleDir = mkdtempSync(join(tmpdir(), 'meta-live-attestation-propagation-'));
  const { deps, verifyCalls } = createLiveDeps(bundleDir, {
    runAttestBundleFn: async () => ({
      attestationPath: join(bundleDir, 'attestation.json'),
      signer: 'operator-test',
      signerRole: 'operator',
    }),
  });

  await liveRun(
    {
      flowText: 'Goal: required attestation propagation',
      runId: 'meta-test-attestation-propagation',
      wallClockSec: 1,
      bundleDirOverride: bundleDir,
      attestation: {
        mode: 'required',
        signer: 'operator-test',
        keyPath: join(bundleDir, 'operator.key'),
        trustedSignersPath: join(bundleDir, 'trusted-signers.json'),
        revokedSignersPath: join(bundleDir, 'revoked-signers.json'),
        requireRole: 'operator',
      },
    },
    deps,
  );

  assert.equal(verifyCalls.length, 1, 'verify-trace should still run exactly once');
  assert.equal(
    verifyCalls[0]?.requireAttestation,
    true,
    'required attestation should propagate to verify-trace options',
  );
  assert.equal(verifyCalls[0]?.requireRole, 'operator');
  assert.equal(verifyCalls[0]?.trustedSignersPath, join(bundleDir, 'trusted-signers.json'));
  assert.equal(verifyCalls[0]?.revokedSignersPath, join(bundleDir, 'revoked-signers.json'));
  assert.equal(verifyCalls[0]?.attestationPath, join(bundleDir, 'attestation.json'));
});
