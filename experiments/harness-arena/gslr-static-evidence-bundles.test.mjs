import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const bundleRoot = join(here, 'bundles', 'gslr-static-evidence-bundles');
const bundleRefs = [
  'experiments/harness-arena/bundles/gslr-static-evidence-bundles/gslr8-route-record-compiler.bundle.json',
  'experiments/harness-arena/bundles/gslr-static-evidence-bundles/gslr7-scaffolded-route-record.bundle.json',
];

const forbiddenKeys = new Set([
  'rawpayload',
  'sourcepayload',
  'studentpayload',
  'credential',
  'secret',
  'token',
  'password',
  'oraclecommand',
  'rawstdout',
  'rawstderr',
  'hiddenoraclebody',
]);

function readJson(ref) {
  return JSON.parse(readFileSync(join(repoRoot, ref), 'utf8'));
}

function canonicalizeJson(value) {
  return JSON.stringify(normalizeJson(value));
}

function normalizeJson(value) {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite number in bundle payload');
    return value;
  }
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([key, child]) => [key, normalizeJson(child)]));
  }
  throw new Error(`Unsupported value in bundle payload: ${typeof value}`);
}

function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

function bundlePayload(bundle) {
  return {
    schemaVersion: bundle.schemaVersion,
    bundleId: bundle.bundleId,
    createdAtIso: bundle.createdAtIso,
    source: bundle.source,
    subject: bundle.subject,
    evidence: bundle.evidence,
    artifactHashes: bundle.artifactHashes,
    constraints: bundle.constraints,
  };
}

function collectForbiddenKeys(value, path = 'bundle', out = []) {
  if (value === null || typeof value !== 'object') return out;
  for (const [key, child] of Object.entries(value)) {
    const childPath = Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`;
    if (forbiddenKeys.has(key.toLowerCase())) out.push(childPath);
    collectForbiddenKeys(child, childPath, out);
  }
  return out;
}

function assertArtifactRef(ref) {
  assert.equal(ref.startsWith('/'), false, `${ref} must be repository-relative`);
  assert.equal(/^[a-z][a-z0-9+.-]*:/i.test(ref), false, `${ref} must not include a scheme`);
  assert.equal(ref.includes('?'), false, `${ref} must not include query data`);
  assert.equal(ref.includes('#'), false, `${ref} must not include fragment data`);
  assert.equal(ref.split(/[\\/]+/).includes('..'), false, `${ref} must not traverse parents`);
}

function assertBundleMatchesContract(bundle) {
  assert.equal(bundle.schemaVersion, 'portarium.gslr-evidence-bundle.v1');
  assert.equal(bundle.source.system, 'prompt-language');
  assert.equal(bundle.source.repo, '45ck/prompt-language');
  assert.match(bundle.source.commit, /^[0-9a-f]{40}$/);
  assert.deepEqual(bundle.constraints, {
    importMode: 'manual-static-only',
    runtimeAuthority: 'none',
    actionControls: 'absent',
  });
  assert.equal(
    bundle.evidence.schemaVersion,
    'portarium.gslr-engineering-evidence-card-projection-input.v1',
  );
  assert.equal(bundle.subject.task, bundle.evidence.route.task);
  assert.equal(bundle.subject.policyVersion, bundle.evidence.policyVersion);
  assert.equal(bundle.source.runId, bundle.evidence.route.selectedRun.runId);
  assert.equal(bundle.source.runGroupId, bundle.evidence.route.selectedRun.runGroupId);
  assert.deepEqual(collectForbiddenKeys(bundle), []);

  for (const artifact of bundle.artifactHashes) {
    assertArtifactRef(artifact.ref);
    const path = join(repoRoot, artifact.ref);
    assert.ok(existsSync(path), `missing artifact ${artifact.ref}`);
    assert.equal(sha256Hex(readFileSync(path)), artifact.sha256);
  }
}

test('checked-in GSLR bundle index points at both static bundle fixtures', () => {
  const index = readJson(
    'experiments/harness-arena/bundles/gslr-static-evidence-bundles/index.json',
  );

  assert.equal(index.schemaVersion, 'prompt-language.gslr-static-evidence-bundle-index.v1');
  assert.deepEqual(index.bundles.map((entry) => entry.bundleRef).sort(), bundleRefs.toSorted());
  assert.ok(existsSync(bundleRoot));
});

test('GSLR bundle fixtures match Portarium GslrEvidenceBundleV1 hash and signature contract', () => {
  for (const ref of bundleRefs) {
    const bundle = readJson(ref);

    assertBundleMatchesContract(bundle);
    const canonicalPayload = canonicalizeJson(bundlePayload(bundle));
    assert.equal(bundle.verification.payloadHashSha256, sha256Hex(canonicalPayload));
    assert.equal(
      bundle.verification.signatureBase64,
      Buffer.from(`sig:${canonicalPayload.length}`).toString('base64'),
    );
    assert.equal(bundle.verification.signer.algorithm, 'test-ed25519');
    assert.equal(
      Date.parse(bundle.createdAtIso) >= Date.parse(bundle.verification.notBeforeIso),
      true,
    );
    assert.equal(
      Date.parse(bundle.createdAtIso) <= Date.parse(bundle.verification.expiresAtIso),
      true,
    );
  }
});

test('GSLR-8 and GSLR-7 fixtures preserve the positive and negative route decisions', () => {
  const gslr8 = readJson(bundleRefs[0]);
  const gslr7 = readJson(bundleRefs[1]);

  assert.equal(gslr8.evidence.route.task, 'gslr8-route-record-compiler');
  assert.equal(gslr8.evidence.route.policyDecision, 'local-screen');
  assert.equal(gslr8.evidence.route.selectedRun.finalVerdict, 'pass');
  assert.equal(gslr8.evidence.route.selectedRun.privateOracle, 'pass');
  assert.deepEqual(gslr8.evidence.route.selectedRun.blockingReviewDefects, []);

  assert.equal(gslr7.evidence.route.task, 'gslr7-scaffolded-route-record');
  assert.equal(gslr7.evidence.route.policyDecision, 'frontier-baseline');
  assert.equal(gslr7.evidence.route.selectedRun.finalVerdict, 'fail');
  assert.equal(gslr7.evidence.route.selectedRun.privateOracle, 'fail');
  assert.equal(gslr7.evidence.route.selectedRun.blockingReviewDefects.length, 1);
});
