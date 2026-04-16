/**
 * AP-9 attestation coverage for verify-trace.mjs.
 *
 * These tests self-gate off `verify-trace --help` so they can be backported
 * safely, but on the current branch the AP-9 flag surface is present and the
 * cases should run normally.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync, createHash, sign as signDetached } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJSON, hashEvent, hashState } from './provenance-schema.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERIFIER = join(HERE, 'verify-trace.mjs');
const ATTEST = join(HERE, '..', 'experiments', 'meta', 'attest.mjs');
const NODE_EXE = process.execPath;
const HELP_OUTPUT = spawnSync(NODE_EXE, [VERIFIER, '--help'], { encoding: 'utf8' });
const SUPPORTS_AP9 =
  /--attestation/.test(HELP_OUTPUT.stdout) &&
  /--require-attestation/.test(HELP_OUTPUT.stdout) &&
  /--trusted-signers/.test(HELP_OUTPUT.stdout) &&
  /--revoked-signers/.test(HELP_OUTPUT.stdout) &&
  /--require-role/.test(HELP_OUTPUT.stdout);
const AP9_PENDING_REASON =
  'AP-9 attestation flags are unavailable on this branch; skip the attestation suite until verify-trace exposes them.';

function maybeSkipAttestation(t) {
  if (!SUPPORTS_AP9) {
    t.skip(AP9_PENDING_REASON);
    return true;
  }
  return false;
}

function combinedOutput(result) {
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

function buildEntry(runId, seq, prevHash, overrides) {
  const base = {
    runId,
    seq,
    timestamp: `2026-04-15T00:00:${String(seq).padStart(2, '0')}.000Z`,
    pid: 4512,
    prevEventHash: prevHash,
    ...overrides,
  };
  base.eventHash = hashEvent(base);
  return base;
}

function makeValidChain(runId, stateObj) {
  const argv = ['-p', 'attestation coverage'];
  const stdinSha256 = 'a'.repeat(64);
  const stateAfterHash = hashState(stateObj);
  const e0 = buildEntry(runId, 0, null, {
    event: 'shim_invocation_begin',
    source: 'shim',
    argv,
    cwd: 'C:/tmp/pl-ap9',
    stdinSha256,
    binaryPath: 'C:/bin/claude.exe',
    binarySha256: 'b'.repeat(64),
  });
  const e1 = buildEntry(runId, 1, e0.eventHash, {
    event: 'agent_invocation_begin',
    source: 'runtime',
    argv,
    stdinSha256,
    nodeId: 'n-root',
    nodeKind: 'prompt',
  });
  const e2 = buildEntry(runId, 2, e1.eventHash, {
    event: 'node_advance',
    source: 'runtime',
    nodeId: 'n-review',
    nodeKind: 'run',
    stateBeforeHash: 'c'.repeat(64),
    stateAfterHash,
  });
  const e3 = buildEntry(runId, 3, e2.eventHash, {
    event: 'agent_invocation_end',
    source: 'runtime',
    argv,
    stdinSha256,
    stdoutSha256: 'd'.repeat(64),
    exitCode: 0,
    durationMs: 15,
  });
  const e4 = buildEntry(runId, 4, e3.eventHash, {
    event: 'shim_invocation_end',
    source: 'shim',
    argv,
    cwd: 'C:/tmp/pl-ap9',
    stdinSha256,
    stdoutSha256: 'd'.repeat(64),
    binaryPath: 'C:/bin/claude.exe',
    binarySha256: 'b'.repeat(64),
    exitCode: 0,
    durationMs: 15,
  });
  return [e0, e1, e2, e3, e4];
}

function writeTrace(path, entries) {
  writeFileSync(path, entries.map((entry) => canonicalJSON(entry)).join('\n') + '\n', 'utf8');
}

function base64UrlToBase64(value) {
  const replaced = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (replaced.length % 4)) % 4;
  return replaced + '='.repeat(padding);
}

function rawEd25519PublicKeyBase64(publicKey) {
  const jwk = publicKey.export({ format: 'jwk' });
  return Buffer.from(base64UrlToBase64(jwk.x), 'base64').toString('base64');
}

function createAttestationFixture(label, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), `pl-attestation-${label}-`));
  const tracePath = join(dir, 'provenance.jsonl');
  const statePath = join(dir, 'session-state.json');
  const manifestPath = join(dir, 'manifest-pre.json');
  const attestationPath = join(dir, 'attestation.json');
  const trustedSignersPath = join(dir, 'trusted-signers.json');
  const revokedSignersPath = join(dir, 'revoked-signers.json');
  const bootstrapPreflightPath = join(dir, 'bootstrap-preflight.json');
  const runId = `run-attestation-${label}`;
  const state = {
    flow: { id: 'f-ap9' },
    variables: { status: 'ok' },
    cursor: { nodeId: 'n-review' },
  };
  const entries = makeValidChain(runId, state);
  const manifest = {
    'package.json': sha256Hex('{"name":"prompt-language"}'),
    'scripts/eval/verify-trace.mjs': sha256Hex(readFileSync(VERIFIER)),
  };

  writeTrace(tracePath, entries);
  writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const privateKeyPath = join(dir, 'signer.key');
  const signerId = options.signerId ?? `operator-${label}`;
  const signerRole = options.signerRole ?? 'operator';
  const payload = {
    version: 1,
    runId,
    commitSha: '1'.repeat(40),
    manifestHash: sha256Hex(readFileSync(manifestPath)),
    finalStateHash: hashState(state),
    pairCount: 1,
    runtimeFamily: 'anthropic',
    reviewerFamily: 'openai',
    createdAt: entries[0].timestamp,
    ...(options.payloadOverrides ?? {}),
  };
  const signaturePayload = canonicalJSON(payload);
  const attestation = {
    version: 1,
    signer: signerId,
    signerRole,
    signedAt: options.signedAt ?? '2026-04-15T00:01:00.000Z',
    algorithm: 'ed25519',
    signature: signDetached(null, Buffer.from(signaturePayload), privateKey).toString('base64'),
    payload,
  };
  writeFileSync(attestationPath, JSON.stringify(attestation, null, 2), 'utf8');
  writeFileSync(privateKeyPath, privateKey.export({ format: 'pem', type: 'pkcs8' }), 'utf8');
  writeFileSync(
    bootstrapPreflightPath,
    JSON.stringify(
      {
        overall: 'ready',
        items: [
          {
            id: 1,
            name: 'pinned runtime',
            status: 'ready',
            detail: 'fixture runtime pinned',
            pinnedSha: payload.commitSha,
          },
          {
            id: 6,
            name: 'cross-family reviewer',
            status: 'ready',
            detail: `factory=${payload.runtimeFamily} reviewer=${payload.reviewerFamily}`,
            factoryFamily: payload.runtimeFamily,
            reviewerFamily: payload.reviewerFamily,
          },
        ],
        nextActions: [],
      },
      null,
      2,
    ),
    'utf8',
  );

  const trustedSigners = {
    version: 1,
    signers: [
      {
        signerId,
        role: signerRole,
        publicKey: rawEd25519PublicKeyBase64(publicKey),
        validFrom: '2026-04-01T00:00:00Z',
        validUntil: null,
      },
    ],
  };
  writeFileSync(trustedSignersPath, JSON.stringify(trustedSigners, null, 2), 'utf8');

  const revokedSigners = {
    version: 1,
    revoked: [],
  };
  writeFileSync(revokedSignersPath, JSON.stringify(revokedSigners, null, 2), 'utf8');

  return {
    dir,
    tracePath,
    statePath,
    manifestPath,
    attestationPath,
    trustedSignersPath,
    revokedSignersPath,
    bootstrapPreflightPath,
    signerId,
    signerRole,
    privateKeyPath,
    payload,
  };
}

function runVerifier(args) {
  return spawnSync(NODE_EXE, [VERIFIER, ...args], {
    encoding: 'utf8',
  });
}

test('AP-9 attestation-required: absent attestation is rejected', (t) => {
  if (maybeSkipAttestation(t)) return;
  const fixture = createAttestationFixture('required-absent');
  const result = runVerifier([
    '--trace',
    fixture.tracePath,
    '--state',
    fixture.statePath,
    '--require-attestation',
    '--trusted-signers',
    fixture.trustedSignersPath,
    '--revoked-signers',
    fixture.revokedSignersPath,
  ]);

  assert.notEqual(
    result.status,
    0,
    'expected non-zero exit when attestation is required but absent',
  );
  assert.match(
    combinedOutput(result),
    /attestation required but absent/i,
    `expected attestation-required diagnostic; out=${combinedOutput(result)}`,
  );
});

test('AP-9 invalid signer: untrusted signer is rejected', (t) => {
  if (maybeSkipAttestation(t)) return;
  const fixture = createAttestationFixture('invalid-signer');
  writeFileSync(
    fixture.trustedSignersPath,
    JSON.stringify({ version: 1, signers: [] }, null, 2),
    'utf8',
  );

  const result = runVerifier([
    '--trace',
    fixture.tracePath,
    '--state',
    fixture.statePath,
    '--attestation',
    fixture.attestationPath,
    '--trusted-signers',
    fixture.trustedSignersPath,
    '--revoked-signers',
    fixture.revokedSignersPath,
    '--require-attestation',
  ]);

  assert.notEqual(result.status, 0, 'expected non-zero exit for untrusted signer');
  assert.match(
    combinedOutput(result),
    /attestation .*signer.*(not trusted|unknown|missing)/i,
    `expected invalid-signer diagnostic; out=${combinedOutput(result)}`,
  );
});

test('AP-9 revoked signer: revoked signer is rejected', (t) => {
  if (maybeSkipAttestation(t)) return;
  const fixture = createAttestationFixture('revoked-signer');
  writeFileSync(
    fixture.revokedSignersPath,
    JSON.stringify(
      {
        version: 1,
        revoked: [
          { signerId: fixture.signerId, revokedAt: '2026-04-16T00:00:00Z', reason: 'test' },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  const result = runVerifier([
    '--trace',
    fixture.tracePath,
    '--state',
    fixture.statePath,
    '--attestation',
    fixture.attestationPath,
    '--trusted-signers',
    fixture.trustedSignersPath,
    '--revoked-signers',
    fixture.revokedSignersPath,
    '--require-attestation',
  ]);

  assert.notEqual(result.status, 0, 'expected non-zero exit for revoked signer');
  assert.match(
    combinedOutput(result),
    /attestation signer revoked/i,
    `expected revoked-signer diagnostic; out=${combinedOutput(result)}`,
  );
});

test('AP-9 role mismatch: signer role must satisfy --require-role', (t) => {
  if (maybeSkipAttestation(t)) return;
  const fixture = createAttestationFixture('role-mismatch', { signerRole: 'ci' });

  const result = runVerifier([
    '--trace',
    fixture.tracePath,
    '--state',
    fixture.statePath,
    '--attestation',
    fixture.attestationPath,
    '--trusted-signers',
    fixture.trustedSignersPath,
    '--revoked-signers',
    fixture.revokedSignersPath,
    '--require-attestation',
    '--require-role',
    'operator',
  ]);

  assert.notEqual(result.status, 0, 'expected non-zero exit for attestation role mismatch');
  assert.match(
    combinedOutput(result),
    /attestation .*role.*mismatch|require-role/i,
    `expected role-mismatch diagnostic; out=${combinedOutput(result)}`,
  );
});

test('AP-9 payload mismatch: signed payload must still match bundle contents', (t) => {
  if (maybeSkipAttestation(t)) return;
  const fixture = createAttestationFixture('payload-mismatch');
  writeFileSync(
    fixture.manifestPath,
    JSON.stringify({ 'package.json': sha256Hex('{"name":"tampered"}') }, null, 2),
    'utf8',
  );

  const result = runVerifier([
    '--trace',
    fixture.tracePath,
    '--state',
    fixture.statePath,
    '--attestation',
    fixture.attestationPath,
    '--trusted-signers',
    fixture.trustedSignersPath,
    '--revoked-signers',
    fixture.revokedSignersPath,
    '--require-attestation',
  ]);

  assert.notEqual(result.status, 0, 'expected non-zero exit for payload mismatch');
  assert.match(
    combinedOutput(result),
    /attestation payload mismatch/i,
    `expected payload-mismatch diagnostic; out=${combinedOutput(result)}`,
  );
});

test('AP-9 passing path: valid signed operator bundle passes verification', (t) => {
  if (maybeSkipAttestation(t)) return;
  const fixture = createAttestationFixture('passing');
  const attestResult = spawnSync(
    NODE_EXE,
    [
      ATTEST,
      '--bundle',
      fixture.dir,
      '--signer',
      fixture.signerId,
      '--key',
      fixture.privateKeyPath,
      '--trusted-signers',
      fixture.trustedSignersPath,
      '--force-replace',
      '--json',
    ],
    { encoding: 'utf8' },
  );
  assert.equal(
    attestResult.status,
    0,
    `expected attest.mjs to sign the fixture bundle; out=${combinedOutput(attestResult)}`,
  );

  const result = runVerifier([
    '--trace',
    fixture.tracePath,
    '--state',
    fixture.statePath,
    '--attestation',
    fixture.attestationPath,
    '--trusted-signers',
    fixture.trustedSignersPath,
    '--revoked-signers',
    fixture.revokedSignersPath,
    '--require-attestation',
    '--require-role',
    'operator',
  ]);

  assert.equal(
    result.status,
    0,
    `expected exit 0 for valid attestation; out=${combinedOutput(result)}`,
  );
  assert.match(
    combinedOutput(result),
    /attested-by=.*role=operator|verify-trace OK/i,
    `expected attested success output; out=${combinedOutput(result)}`,
  );
});
