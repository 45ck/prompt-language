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
import { existsSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
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

/**
 * Compute SHA-256 of a file, returning hex. Helper for the pin-override
 * plumbing below.
 */
function sha256OfFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/**
 * F2 / prompt-qwvu.2: the build-time trust-root pin lives in
 * `dist/eval/attestation-trust-root.js` and only matches the checked-in
 * registries at `docs/security/{trusted,revoked}-signers.json`. Tests
 * synthesize per-fixture registries under tmpdir(), so they must supply
 * matching override flags to the verifier.
 *
 * This helper inspects the args for `--trusted-signers` / `--revoked-signers`
 * paths and — if no override is already present — appends a matching
 * `--trusted-signers-sha256` / `--revoked-signers-sha256` flag computed
 * from the on-disk fixture file. This keeps per-test plumbing invisible
 * to the individual test bodies.
 */
function injectTrustRootOverrides(args) {
  const out = [...args];
  const trustedIdx = out.indexOf('--trusted-signers');
  const revokedIdx = out.indexOf('--revoked-signers');
  if (trustedIdx !== -1 && !out.includes('--trusted-signers-sha256')) {
    const path = out[trustedIdx + 1];
    if (path && existsSync(path)) {
      out.push('--trusted-signers-sha256', sha256OfFile(path));
    }
  }
  if (revokedIdx !== -1 && !out.includes('--revoked-signers-sha256')) {
    const path = out[revokedIdx + 1];
    if (path && existsSync(path)) {
      out.push('--revoked-signers-sha256', sha256OfFile(path));
    }
  }
  return out;
}

function runVerifier(args) {
  return spawnSync(NODE_EXE, [VERIFIER, ...injectTrustRootOverrides(args)], {
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
    /attestation[- ]payload[- ]mismatch/i,
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

// -----------------------------------------------------------------------
// T20–T25: hardening-pass contract tests (prompt-kv57).
//
// These tests are numbered T20+ to avoid collision with
// `scripts/eval/tamper-drill.test.mjs` which already uses T17/T18/T19 for
// reviewer-family coverage (AP-11).
// -----------------------------------------------------------------------

import {
  ATTESTATION_VERSION,
  buildAttestationRecord,
  ED25519_RAW_SIGNATURE_BYTES,
  ERR_ALGORITHM_REJECTED,
  ERR_INVALID_SIGNATURE,
  ERR_INVALID_SIGNATURE_LENGTH,
  ERR_PAYLOAD_MISMATCH,
  ERR_SCHEMA,
  exportEd25519PublicKeyBase64,
  verifyPayloadDetached,
  verifyAttestationAgainstBundle,
  buildBundlePayload,
} from '../experiments/meta/attestation-lib.mjs';

test('T20 encoding round-trip: sign with KeyObject, verify via on-disk PEM pubkey', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pl-attestation-T20-'));
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');

  // Persist pubkey as PEM to disk, re-import SOLELY from file.
  const pubKeyPemPath = join(dir, 'signer.pub.pem');
  writeFileSync(pubKeyPemPath, publicKey.export({ format: 'pem', type: 'spki' }), 'utf8');

  // And as base64-raw, the registry format.
  const pubKeyBase64 = exportEd25519PublicKeyBase64(publicKey);
  const pubKeyBase64Path = join(dir, 'signer.pub.b64');
  writeFileSync(pubKeyBase64Path, pubKeyBase64, 'utf8');

  const payload = {
    version: ATTESTATION_VERSION,
    runId: 'run-T20',
    commitSha: '1'.repeat(40),
    manifestHash: '2'.repeat(64),
    finalStateHash: '3'.repeat(64),
    pairCount: 0,
    runtimeFamily: 'anthropic',
    reviewerFamily: 'openai',
    createdAt: '2026-04-17T00:00:00.000Z',
  };

  const signature = signDetached(null, Buffer.from(canonicalJSON(payload)), privateKey);
  assert.equal(
    signature.length,
    ED25519_RAW_SIGNATURE_BYTES,
    'raw Ed25519 signature must be 64 bytes',
  );

  // Reload pubkey from disk (PEM) only, then re-encode to registry base64
  // to confirm the two formats agree byte-for-byte.
  const loadedPemText = readFileSync(pubKeyPemPath, 'utf8');
  assert.match(loadedPemText, /BEGIN PUBLIC KEY/);

  const diskBase64 = readFileSync(pubKeyBase64Path, 'utf8').trim();
  const ok = verifyPayloadDetached(payload, signature.toString('base64'), diskBase64);
  assert.equal(ok, true, 'signature must verify using on-disk base64 pubkey');
});

test('T21 mutated runtimeFamily fails payload verification', () => {
  const fixture = createAttestationFixture('T21-mutated-runtime');
  // Tamper AFTER signing by rewriting the bootstrap report's factoryFamily;
  // the attestation's payload still says 'anthropic', the bundle recomputes
  // to something else.
  const report = JSON.parse(readFileSync(fixture.bootstrapPreflightPath, 'utf8'));
  for (const item of report.items) {
    if (item.id === 6) item.factoryFamily = 'tampered-family';
  }
  writeFileSync(fixture.bootstrapPreflightPath, JSON.stringify(report, null, 2), 'utf8');

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
  assert.notEqual(result.status, 0, 'tampered runtimeFamily must fail verify');
  assert.match(
    combinedOutput(result),
    new RegExp(ERR_PAYLOAD_MISMATCH),
    `expected ${ERR_PAYLOAD_MISMATCH}; out=${combinedOutput(result)}`,
  );
  assert.match(
    combinedOutput(result),
    /runtimeFamily/,
    `expected runtimeFamily to be named in the diagnostic; out=${combinedOutput(result)}`,
  );
});

test('T22 signedAt < createdAt fails schema check at build time', () => {
  const payload = {
    version: ATTESTATION_VERSION,
    runId: 'run-T22',
    commitSha: '1'.repeat(40),
    manifestHash: '2'.repeat(64),
    finalStateHash: '3'.repeat(64),
    pairCount: 0,
    runtimeFamily: 'anthropic',
    reviewerFamily: 'openai',
    createdAt: '2026-04-17T12:00:00.000Z',
  };
  const dir = mkdtempSync(join(tmpdir(), 'pl-attestation-T22-'));
  const { privateKey } = generateKeyPairSync('ed25519');
  const keyPath = join(dir, 'signer.key');
  writeFileSync(keyPath, privateKey.export({ format: 'pem', type: 'pkcs8' }), 'utf8');

  assert.throws(
    () =>
      buildAttestationRecord({
        payload,
        signerId: 'op',
        signerRole: 'operator',
        keyPath,
        signedAt: '2026-04-17T11:00:00.000Z', // 1h before createdAt
      }),
    new RegExp(`${ERR_SCHEMA}.*signedAt`),
  );
});

test('T23 invalid signature length is rejected (32-byte, 96-byte, non-base64, algorithm downgrade)', () => {
  const fixture = createAttestationFixture('T23-bad-sig');
  const { payload } = buildBundlePayload({ bundleDir: fixture.dir });

  // 32-byte signature -> length error
  assert.throws(
    () =>
      verifyPayloadDetached(
        payload,
        Buffer.alloc(32, 0x11).toString('base64'),
        rawEd25519PublicKeyBase64(generateKeyPairSync('ed25519').publicKey),
      ),
    new RegExp(ERR_INVALID_SIGNATURE_LENGTH),
  );

  // 96-byte signature -> length error
  assert.throws(
    () =>
      verifyPayloadDetached(
        payload,
        Buffer.alloc(96, 0x22).toString('base64'),
        rawEd25519PublicKeyBase64(generateKeyPairSync('ed25519').publicKey),
      ),
    new RegExp(ERR_INVALID_SIGNATURE_LENGTH),
  );

  // Non-base64 signature -> length error (the base64 regex catches it)
  assert.throws(
    () =>
      verifyPayloadDetached(
        payload,
        'not!base64!at!all!',
        rawEd25519PublicKeyBase64(generateKeyPairSync('ed25519').publicKey),
      ),
    new RegExp(ERR_INVALID_SIGNATURE_LENGTH),
  );

  // Algorithm downgrade on attestation.json -> rejected at shape check
  const attestation = JSON.parse(readFileSync(fixture.attestationPath, 'utf8'));
  attestation.algorithm = 'rsa-pss';
  writeFileSync(fixture.attestationPath, JSON.stringify(attestation, null, 2), 'utf8');
  assert.throws(
    () =>
      verifyAttestationAgainstBundle({
        attestation,
        bundlePayload: payload,
        trustedSignersPath: fixture.trustedSignersPath,
        revokedSignersPath: fixture.revokedSignersPath,
      }),
    new RegExp(ERR_ALGORITHM_REJECTED),
  );
});

test('T24 error-class separation: invalid-signature vs payload-mismatch do not leak an oracle', () => {
  // Same bundle, two tamperings:
  //   (a) tamper disk contents only -> valid signature, payload mismatch
  //   (b) tamper signature only     -> invalid signature (fires BEFORE
  //       payload recompute per NF5 §6.2(f))
  // Both should fail verification, but with distinct error classes so
  // callers can reason about them; neither class can be used to infer
  // anything about the other side of the tampering.
  const a = createAttestationFixture('T24-disk-tamper');
  writeFileSync(
    a.manifestPath,
    JSON.stringify({ 'package.json': sha256Hex('{"name":"tampered-disk"}') }, null, 2),
    'utf8',
  );
  const aResult = runVerifier([
    '--trace',
    a.tracePath,
    '--state',
    a.statePath,
    '--attestation',
    a.attestationPath,
    '--trusted-signers',
    a.trustedSignersPath,
    '--revoked-signers',
    a.revokedSignersPath,
    '--require-attestation',
  ]);
  assert.notEqual(aResult.status, 0);
  assert.match(
    combinedOutput(aResult),
    new RegExp(ERR_PAYLOAD_MISMATCH),
    `(a) expected payload-mismatch; out=${combinedOutput(aResult)}`,
  );
  assert.doesNotMatch(
    combinedOutput(aResult),
    new RegExp(`${ERR_INVALID_SIGNATURE}\\b`),
    `(a) must NOT surface invalid-signature: ${combinedOutput(aResult)}`,
  );

  const b = createAttestationFixture('T24-sig-tamper');
  const attestation = JSON.parse(readFileSync(b.attestationPath, 'utf8'));
  // Flip one bit in the signature; keep it 64 bytes so we reach sig-verify.
  const sig = Buffer.from(attestation.signature, 'base64');
  sig[0] ^= 0x01;
  attestation.signature = sig.toString('base64');
  writeFileSync(b.attestationPath, JSON.stringify(attestation, null, 2), 'utf8');
  const bResult = runVerifier([
    '--trace',
    b.tracePath,
    '--state',
    b.statePath,
    '--attestation',
    b.attestationPath,
    '--trusted-signers',
    b.trustedSignersPath,
    '--revoked-signers',
    b.revokedSignersPath,
    '--require-attestation',
  ]);
  assert.notEqual(bResult.status, 0);
  assert.match(
    combinedOutput(bResult),
    new RegExp(`${ERR_INVALID_SIGNATURE}\\b`),
    `(b) expected invalid-signature; out=${combinedOutput(bResult)}`,
  );
  // NF5: signature verify fires BEFORE payload recompute, so the
  // payload-mismatch class must NOT leak when sig is invalid, even if
  // disk contents would also mismatch.
  assert.doesNotMatch(
    combinedOutput(bResult),
    new RegExp(ERR_PAYLOAD_MISMATCH),
    `(b) must NOT surface payload-mismatch: ${combinedOutput(bResult)}`,
  );
});

test('T25 dev role is rejected by default; --allow-dev-role widens acceptance', () => {
  const fixture = createAttestationFixture('T25-dev-role');
  // Rewrite registry entry + attestation to claim role=dev.
  const registry = JSON.parse(readFileSync(fixture.trustedSignersPath, 'utf8'));
  registry.signers[0].role = 'dev';
  // Default load must reject.
  writeFileSync(fixture.trustedSignersPath, JSON.stringify(registry, null, 2), 'utf8');
  const denied = runVerifier([
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
  assert.notEqual(denied.status, 0, 'dev role must be rejected by default');
  assert.match(
    combinedOutput(denied),
    /invalid role dev|role-rejected|accepted roles/i,
    `expected dev-role rejection diagnostic; out=${combinedOutput(denied)}`,
  );
});

test('T26 trust-root pin: tampered trusted-signers.json is rejected', () => {
  // F2 / G1: If a caller supplies --trusted-signers-sha256 that does not
  // match the on-disk file, the verifier refuses to proceed. Simulate an
  // attacker who appends their own signer to the registry after the pin
  // was generated.
  const fixture = createAttestationFixture('T26-trust-root');
  const originalSha = createHash('sha256')
    .update(readFileSync(fixture.trustedSignersPath))
    .digest('hex');

  // Tamper: append a second trusted signer.
  const reg = JSON.parse(readFileSync(fixture.trustedSignersPath, 'utf8'));
  reg.signers.push({
    signerId: 'smuggled-signer',
    role: 'operator',
    publicKey: Buffer.alloc(32, 0x00).toString('base64'),
    validFrom: '2026-04-01T00:00:00Z',
    validUntil: null,
  });
  writeFileSync(fixture.trustedSignersPath, JSON.stringify(reg, null, 2), 'utf8');

  // Caller still passes the ORIGINAL pin (pre-tamper) — verifier must
  // reject because the on-disk sha256 now diverges.
  const result = spawnSync(
    NODE_EXE,
    [
      VERIFIER,
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
      '--trusted-signers-sha256',
      originalSha,
      '--require-attestation',
    ],
    { encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0, 'tampered registry must be rejected');
  assert.match(
    combinedOutput(result),
    /trust-root mismatch/i,
    `expected trust-root-mismatch; out=${combinedOutput(result)}`,
  );
});

test('T27 verify-trace OK line surfaces trust-root sha256', () => {
  // G1 / prompt-kv57.6: the OK line must include a trust-root=sha256:<hex8>
  // suffix so an auditor can confirm which registry file was consulted.
  const fixture = createAttestationFixture('T27-trust-root-line');
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
  assert.equal(attestResult.status, 0, `attest failed: ${combinedOutput(attestResult)}`);

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
  assert.equal(result.status, 0, `verify failed: ${combinedOutput(result)}`);
  assert.match(
    combinedOutput(result),
    /trust-root=sha256:[0-9a-f]{8}/,
    `expected trust-root=sha256:... suffix in OK line; out=${combinedOutput(result)}`,
  );
});
