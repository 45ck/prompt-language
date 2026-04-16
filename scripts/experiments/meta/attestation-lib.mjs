import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as signBytes,
  verify as verifyBytes,
} from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJSON, hashState } from '../../eval/provenance-schema.mjs';
import { validateFamilySeparation } from './cross-family-review.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..', '..');

const ED25519_PUBLIC_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const ED25519_PRIVATE_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');
const OUTER_ATTESTATION_KEYS = [
  'algorithm',
  'payload',
  'signature',
  'signedAt',
  'signer',
  'signerRole',
  'version',
];
const PAYLOAD_KEYS = [
  'commitSha',
  'createdAt',
  'finalStateHash',
  'manifestHash',
  'pairCount',
  'reviewerFamily',
  'runId',
  'runtimeFamily',
  'version',
];

export const ATTESTATION_VERSION = 1;
export const DEFAULT_TRUSTED_SIGNERS_PATH = resolve(
  REPO_ROOT,
  'docs',
  'security',
  'trusted-signers.json',
);
export const DEFAULT_REVOKED_SIGNERS_PATH = resolve(
  REPO_ROOT,
  'docs',
  'security',
  'revoked-signers.json',
);

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function parseTimestamp(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty RFC3339 timestamp`);
  }
  const millis = Date.parse(value);
  if (Number.isNaN(millis)) {
    throw new Error(`${label} is not a valid RFC3339 timestamp: ${value}`);
  }
  return millis;
}

function ensureObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function ensureExactKeys(value, expectedKeys, label) {
  const actualKeys = Object.keys(ensureObject(value, label)).sort();
  const expected = [...expectedKeys].sort();
  const actualJoined = actualKeys.join(',');
  const expectedJoined = expected.join(',');
  if (actualJoined !== expectedJoined) {
    throw new Error(`${label} keys mismatch: expected [${expectedJoined}] got [${actualJoined}]`);
  }
}

function readJsonFile(filePath, label) {
  if (!existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`${label} is not valid JSON: ${err.message}`);
  }
}

function findBootstrapItem(report, id) {
  const items = Array.isArray(report?.items) ? report.items : [];
  return items.find((item) => item?.id === id) ?? null;
}

function readBootstrapReport(bundleDir, report) {
  const bootstrapPath = join(bundleDir, 'bootstrap-preflight.json');
  if (existsSync(bootstrapPath)) {
    return readJsonFile(bootstrapPath, 'bootstrap preflight');
  }
  if (report?.preflight?.bootstrapEnvelope) {
    return report.preflight.bootstrapEnvelope;
  }
  return null;
}

function readOptionalJson(bundleDir, fileName) {
  const filePath = join(bundleDir, fileName);
  if (!existsSync(filePath)) return null;
  return readJsonFile(filePath, fileName);
}

export function loadTraceEntries(tracePath) {
  if (!existsSync(tracePath)) {
    throw new Error(`trace file not found: ${tracePath}`);
  }
  const raw = readFileSync(tracePath, 'utf8');
  const entries = [];
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    try {
      entries.push(JSON.parse(line));
    } catch (err) {
      throw new Error(`trace line ${i + 1} is not valid JSON: ${err.message}`);
    }
  }
  return entries;
}

export function countRuntimePairs(entries) {
  return entries.filter((entry) => entry?.event === 'agent_invocation_begin').length;
}

export function findLastStateAfterHash(entries) {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const value = entries[i]?.stateAfterHash;
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

export function sha256File(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`file not found for sha256: ${filePath}`);
  }
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function resolveCommitSha(bundleDir, report, bootstrapReport) {
  const item1 = findBootstrapItem(bootstrapReport, 1);
  const commitSha = firstString(
    item1?.pinnedSha,
    report?.commitSha,
    report?.git?.commitSha,
    report?.preflight?.git?.commitSha,
  );
  if (!commitSha) {
    throw new Error(
      `bundle is missing commitSha evidence: ${join(bundleDir, 'bootstrap-preflight.json')}`,
    );
  }
  return commitSha;
}

function resolveFamilies(bundleDir, report, bootstrapReport, crossFamilyReview) {
  const item6 = findBootstrapItem(bootstrapReport, 6);
  const runtimeFamily = firstString(
    crossFamilyReview?.factoryFamily,
    report?.factoryFamily,
    report?.live?.factoryFamily,
    item6?.factoryFamily,
  );
  const reviewerFamily = firstString(
    crossFamilyReview?.reviewerFamily,
    report?.reviewerFamily,
    report?.live?.reviewerFamily,
    item6?.reviewerFamily,
  );
  if (!runtimeFamily || !reviewerFamily) {
    throw new Error(
      `bundle is missing runtime/reviewer family evidence: ${join(bundleDir, 'cross-family-review.json')}`,
    );
  }
  return { runtimeFamily, reviewerFamily };
}

export function buildBundlePayload({
  bundleDir,
  tracePath = join(bundleDir, 'provenance.jsonl'),
  statePath = join(bundleDir, 'session-state.json'),
} = {}) {
  if (!bundleDir) {
    throw new Error('bundleDir is required');
  }

  const entries = loadTraceEntries(tracePath);
  if (entries.length === 0) {
    throw new Error('trace is empty');
  }

  const runIds = new Set(entries.map((entry) => entry?.runId).filter(Boolean));
  if (runIds.size !== 1) {
    throw new Error(`bundle trace must contain exactly one runId, got ${runIds.size}`);
  }
  const [runId] = [...runIds];
  const createdAt = entries[0]?.timestamp;
  parseTimestamp(createdAt, 'payload.createdAt');

  const manifestPath = join(bundleDir, 'manifest-pre.json');
  const manifestHash = sha256File(manifestPath);

  const claimedFinalStateHash = findLastStateAfterHash(entries);
  let finalStateHash = claimedFinalStateHash;
  if (existsSync(statePath)) {
    const state = readJsonFile(statePath, 'session state');
    const computedStateHash = hashState(state);
    if (claimedFinalStateHash && claimedFinalStateHash !== computedStateHash) {
      throw new Error(
        `bundle finalStateHash mismatch: trace claims ${claimedFinalStateHash}, state hashes to ${computedStateHash}`,
      );
    }
    finalStateHash = computedStateHash;
  }
  if (!finalStateHash) {
    throw new Error('bundle is missing finalStateHash evidence in trace/state');
  }

  const report = readOptionalJson(bundleDir, 'report.json');
  const bootstrapReport = readBootstrapReport(bundleDir, report);
  const crossFamilyReview = readOptionalJson(bundleDir, 'cross-family-review.json');
  const commitSha = resolveCommitSha(bundleDir, report, bootstrapReport);
  const { runtimeFamily, reviewerFamily } = resolveFamilies(
    bundleDir,
    report,
    bootstrapReport,
    crossFamilyReview,
  );

  return {
    payload: {
      version: ATTESTATION_VERSION,
      runId,
      commitSha,
      manifestHash,
      finalStateHash,
      pairCount: countRuntimePairs(entries),
      runtimeFamily,
      reviewerFamily,
      createdAt,
    },
    entries,
    bundleDir,
    tracePath,
    statePath: existsSync(statePath) ? statePath : null,
  };
}

export function validateAttestationShape(attestation) {
  ensureExactKeys(attestation, OUTER_ATTESTATION_KEYS, 'attestation');
  if (attestation.version !== ATTESTATION_VERSION) {
    throw new Error(`attestation.version must be ${ATTESTATION_VERSION}`);
  }
  if (attestation.algorithm !== 'ed25519') {
    throw new Error(`attestation.algorithm must be ed25519, got ${attestation.algorithm}`);
  }
  if (typeof attestation.signer !== 'string' || !attestation.signer.trim()) {
    throw new Error('attestation.signer must be a non-empty string');
  }
  if (attestation.signerRole !== 'operator' && attestation.signerRole !== 'ci') {
    throw new Error(`attestation.signerRole must be operator or ci, got ${attestation.signerRole}`);
  }
  parseTimestamp(attestation.signedAt, 'attestation.signedAt');
  if (typeof attestation.signature !== 'string' || !attestation.signature.trim()) {
    throw new Error('attestation.signature must be a non-empty base64 string');
  }
  const signature = Buffer.from(attestation.signature, 'base64');
  if (signature.length !== 64) {
    throw new Error(`attestation.signature must decode to 64 bytes, got ${signature.length}`);
  }

  ensureExactKeys(attestation.payload, PAYLOAD_KEYS, 'attestation.payload');
  const payload = attestation.payload;
  if (payload.version !== ATTESTATION_VERSION) {
    throw new Error(`attestation.payload.version must be ${ATTESTATION_VERSION}`);
  }
  if (typeof payload.runId !== 'string' || !payload.runId.trim()) {
    throw new Error('attestation.payload.runId must be a non-empty string');
  }
  if (typeof payload.commitSha !== 'string' || !payload.commitSha.trim()) {
    throw new Error('attestation.payload.commitSha must be a non-empty string');
  }
  if (typeof payload.manifestHash !== 'string' || !payload.manifestHash.trim()) {
    throw new Error('attestation.payload.manifestHash must be a non-empty string');
  }
  if (typeof payload.finalStateHash !== 'string' || !payload.finalStateHash.trim()) {
    throw new Error('attestation.payload.finalStateHash must be a non-empty string');
  }
  if (!Number.isInteger(payload.pairCount) || payload.pairCount < 0) {
    throw new Error('attestation.payload.pairCount must be a non-negative integer');
  }
  if (typeof payload.runtimeFamily !== 'string' || !payload.runtimeFamily.trim()) {
    throw new Error('attestation.payload.runtimeFamily must be a non-empty string');
  }
  if (typeof payload.reviewerFamily !== 'string' || !payload.reviewerFamily.trim()) {
    throw new Error('attestation.payload.reviewerFamily must be a non-empty string');
  }
  parseTimestamp(payload.createdAt, 'attestation.payload.createdAt');
}

export function loadTrustedSignerRegistry(filePath = DEFAULT_TRUSTED_SIGNERS_PATH) {
  const registry = readJsonFile(filePath, 'trusted signers registry');
  if (registry.version !== 1) {
    throw new Error(`trusted signers registry version must be 1, got ${registry.version}`);
  }
  if (!Array.isArray(registry.signers)) {
    throw new Error('trusted signers registry must contain a signers array');
  }
  const signers = new Map();
  for (const entry of registry.signers) {
    ensureObject(entry, 'trusted signer');
    const signerId = firstString(entry.signerId);
    if (!signerId) throw new Error('trusted signer missing signerId');
    if (entry.role !== 'operator' && entry.role !== 'ci') {
      throw new Error(`trusted signer ${signerId} has invalid role ${entry.role}`);
    }
    const publicKey = Buffer.from(firstString(entry.publicKey) ?? '', 'base64');
    if (publicKey.length !== 32) {
      throw new Error(`trusted signer ${signerId} publicKey must decode to 32 bytes`);
    }
    parseTimestamp(entry.validFrom, `trusted signer ${signerId} validFrom`);
    if (entry.validUntil !== null && entry.validUntil !== undefined) {
      parseTimestamp(entry.validUntil, `trusted signer ${signerId} validUntil`);
    }
    signers.set(signerId, entry);
  }
  return { filePath, signers };
}

export function loadRevokedSignerRegistry(filePath = DEFAULT_REVOKED_SIGNERS_PATH) {
  if (!existsSync(filePath)) {
    return { filePath, revoked: new Map() };
  }
  const registry = readJsonFile(filePath, 'revoked signers registry');
  if (registry.version !== 1) {
    throw new Error(`revoked signers registry version must be 1, got ${registry.version}`);
  }
  if (!Array.isArray(registry.revoked)) {
    throw new Error('revoked signers registry must contain a revoked array');
  }
  const revoked = new Map();
  for (const entry of registry.revoked) {
    ensureObject(entry, 'revoked signer');
    const signerId = firstString(entry.signerId);
    if (!signerId) throw new Error('revoked signer missing signerId');
    parseTimestamp(entry.revokedAt, `revoked signer ${signerId} revokedAt`);
    revoked.set(signerId, entry);
  }
  return { filePath, revoked };
}

function createEd25519PublicKey(publicKeyBase64) {
  const raw = Buffer.from(publicKeyBase64, 'base64');
  if (raw.length !== 32) {
    throw new Error(`trusted signer public key must decode to 32 bytes, got ${raw.length}`);
  }
  return createPublicKey({
    key: Buffer.concat([ED25519_PUBLIC_SPKI_PREFIX, raw]),
    format: 'der',
    type: 'spki',
  });
}

export function loadEd25519PrivateKey(keyPath) {
  if (!keyPath) throw new Error('private key path is required');
  if (!existsSync(keyPath)) throw new Error(`private key not found: ${keyPath}`);
  const raw = readFileSync(keyPath);
  const text = raw.toString('utf8').trim();

  if (text.includes('BEGIN PRIVATE KEY')) {
    return createPrivateKey({ key: text, format: 'pem' });
  }

  try {
    return createPrivateKey({ key: raw, format: 'der', type: 'pkcs8' });
  } catch {
    /* continue */
  }

  if (/^[A-Za-z0-9+/=\s]+$/.test(text)) {
    const decoded = Buffer.from(text.replace(/\s+/g, ''), 'base64');
    if (decoded.length === 32) {
      return createPrivateKey({
        key: Buffer.concat([ED25519_PRIVATE_PKCS8_PREFIX, decoded]),
        format: 'der',
        type: 'pkcs8',
      });
    }
    try {
      return createPrivateKey({ key: decoded, format: 'der', type: 'pkcs8' });
    } catch {
      /* continue */
    }
  }

  if (raw.length === 32) {
    return createPrivateKey({
      key: Buffer.concat([ED25519_PRIVATE_PKCS8_PREFIX, raw]),
      format: 'der',
      type: 'pkcs8',
    });
  }

  throw new Error(`unsupported Ed25519 private key format at ${keyPath}`);
}

export function signPayloadDetached(payload, keyPath) {
  const privateKey = loadEd25519PrivateKey(keyPath);
  return signBytes(null, Buffer.from(canonicalJSON(payload)), privateKey).toString('base64');
}

export function verifyPayloadDetached(payload, signatureBase64, publicKeyBase64) {
  const publicKey = createEd25519PublicKey(publicKeyBase64);
  const signature = Buffer.from(signatureBase64, 'base64');
  return verifyBytes(null, Buffer.from(canonicalJSON(payload)), publicKey, signature);
}

export function comparePayloads(actual, expected) {
  const mismatches = [];
  for (const key of PAYLOAD_KEYS) {
    if (actual[key] !== expected[key]) {
      mismatches.push({
        field: key,
        expected: expected[key],
        actual: actual[key],
      });
    }
  }
  return mismatches;
}

export function buildAttestationRecord({
  payload,
  signerId,
  signerRole,
  keyPath,
  signedAt = new Date().toISOString(),
}) {
  parseTimestamp(signedAt, 'attestation.signedAt');
  const signedAtMs = Date.parse(signedAt);
  const createdAtMs = parseTimestamp(payload?.createdAt, 'attestation.payload.createdAt');
  if (signedAtMs < createdAtMs) {
    throw new Error('attestation.signedAt must be >= attestation.payload.createdAt');
  }
  const signature = signPayloadDetached(payload, keyPath);
  const attestation = {
    version: ATTESTATION_VERSION,
    signer: signerId,
    signerRole,
    signedAt,
    algorithm: 'ed25519',
    signature,
    payload,
  };
  validateAttestationShape(attestation);
  return attestation;
}

export function verifyAttestationAgainstBundle({
  attestation,
  bundlePayload,
  trustedSignersPath = DEFAULT_TRUSTED_SIGNERS_PATH,
  revokedSignersPath = DEFAULT_REVOKED_SIGNERS_PATH,
  requireRole = null,
  expectedRunId = null,
  expectedPairCount = null,
  freshnessWindowMs = null,
  now = Date.now(),
}) {
  validateAttestationShape(attestation);

  const { signers } = loadTrustedSignerRegistry(trustedSignersPath);
  const signerEntry = signers.get(attestation.signer);
  if (!signerEntry) {
    throw new Error(`attestation signer missing from trusted registry: ${attestation.signer}`);
  }
  if (signerEntry.role !== attestation.signerRole) {
    throw new Error(
      `attestation signerRole mismatch: attestation=${attestation.signerRole}, registry=${signerEntry.role}`,
    );
  }

  const { revoked } = loadRevokedSignerRegistry(revokedSignersPath);
  if (revoked.has(attestation.signer)) {
    throw new Error(`attestation signer revoked: ${attestation.signer}`);
  }

  const validFromMs = parseTimestamp(
    signerEntry.validFrom,
    `trusted signer ${attestation.signer} validFrom`,
  );
  const validUntilMs =
    signerEntry.validUntil === null || signerEntry.validUntil === undefined
      ? null
      : parseTimestamp(signerEntry.validUntil, `trusted signer ${attestation.signer} validUntil`);
  if (now < validFromMs || (validUntilMs !== null && now > validUntilMs)) {
    throw new Error(`attestation signer not currently valid: ${attestation.signer}`);
  }

  if (requireRole && attestation.signerRole !== requireRole) {
    throw new Error(
      `attestation role mismatch: bundle signed by ${attestation.signerRole}, require-role=${requireRole}`,
    );
  }

  const signedAtMs = parseTimestamp(attestation.signedAt, 'attestation.signedAt');
  const createdAtMs = parseTimestamp(
    attestation.payload.createdAt,
    'attestation.payload.createdAt',
  );
  if (signedAtMs < createdAtMs) {
    throw new Error('attestation.signedAt must be >= attestation.payload.createdAt');
  }

  if (!verifyPayloadDetached(attestation.payload, attestation.signature, signerEntry.publicKey)) {
    throw new Error('attestation invalid signature');
  }

  const mismatches = comparePayloads(attestation.payload, bundlePayload);
  if (mismatches.length > 0) {
    const mismatch = mismatches[0];
    throw new Error(
      `attestation payload mismatch: ${mismatch.field} expected ${mismatch.expected} got ${mismatch.actual}`,
    );
  }

  if (expectedRunId !== null && attestation.payload.runId !== expectedRunId) {
    throw new Error(
      `attestation payload mismatch: runId expected ${expectedRunId} got ${attestation.payload.runId}`,
    );
  }
  if (expectedPairCount !== null && attestation.payload.pairCount !== expectedPairCount) {
    throw new Error(
      `attestation payload mismatch: pairCount expected ${expectedPairCount} got ${attestation.payload.pairCount}`,
    );
  }
  if (freshnessWindowMs !== null && Number.isFinite(freshnessWindowMs) && freshnessWindowMs > 0) {
    const delta = Math.abs(now - createdAtMs);
    if (delta > freshnessWindowMs) {
      throw new Error(
        `attestation freshness-window-exceeded: payload.createdAt is ${delta}ms from now (window=${freshnessWindowMs}ms)`,
      );
    }
  }
  if (requireRole === 'operator') {
    const separation = validateFamilySeparation(
      attestation.payload.runtimeFamily,
      attestation.payload.reviewerFamily,
    );
    if (!separation.valid) {
      throw new Error(`attestation operator cross-family requirement failed: ${separation.error}`);
    }
  }

  return {
    signer: attestation.signer,
    signerRole: attestation.signerRole,
    signedAt: attestation.signedAt,
  };
}
