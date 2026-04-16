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

// F3 / NF4: accepted signer roles. 'dev' is intentionally absent; callers
// that want to experiment locally must pass --allow-dev-role explicitly to
// verify-trace, which widens ACCEPTED_ROLES via `extraAllowedRoles`.
export const ACCEPTED_ROLES = Object.freeze(['ci', 'operator']);
export const DEV_ROLE = 'dev';

export const ED25519_RAW_SIGNATURE_BYTES = 64;
export const ED25519_RAW_PUBLIC_KEY_BYTES = 32;

// NF1 / NF5: stable error classes surfaced by sign/verify. Callers can
// match on substrings to distinguish encoding errors from payload drift
// without depending on free-form messages.
export const ERR_INVALID_SIGNATURE_LENGTH = 'attestation-invalid-signature-length';
export const ERR_INVALID_SIGNATURE = 'attestation-invalid-signature';
export const ERR_PAYLOAD_MISMATCH = 'attestation-payload-mismatch';
export const ERR_ALGORITHM_REJECTED = 'attestation-algorithm-rejected';
export const ERR_ROLE_REJECTED = 'attestation-role-rejected';
export const ERR_SIGNER_REVOKED = 'attestation-signer-revoked';
export const ERR_SIGNER_UNTRUSTED = 'attestation-signer-untrusted';
export const ERR_SCHEMA = 'attestation-schema-invalid';
export const ERR_FRESHNESS = 'attestation-freshness-window-exceeded';

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

function isRoleAccepted(role, extraAllowedRoles = []) {
  if (ACCEPTED_ROLES.includes(role)) return true;
  if (Array.isArray(extraAllowedRoles) && extraAllowedRoles.includes(role)) return true;
  return false;
}

export function validateAttestationShape(attestation, { extraAllowedRoles = [] } = {}) {
  ensureExactKeys(attestation, OUTER_ATTESTATION_KEYS, 'attestation');
  if (attestation.version !== ATTESTATION_VERSION) {
    throw new Error(`${ERR_SCHEMA}: attestation.version must be ${ATTESTATION_VERSION}`);
  }
  if (attestation.algorithm !== 'ed25519') {
    throw new Error(
      `${ERR_ALGORITHM_REJECTED}: attestation.algorithm must be ed25519, got ${attestation.algorithm}`,
    );
  }
  if (typeof attestation.signer !== 'string' || !attestation.signer.trim()) {
    throw new Error(`${ERR_SCHEMA}: attestation.signer must be a non-empty string`);
  }
  if (!isRoleAccepted(attestation.signerRole, extraAllowedRoles)) {
    const allowed = [...ACCEPTED_ROLES, ...extraAllowedRoles].join(', ');
    throw new Error(
      `${ERR_ROLE_REJECTED}: attestation.signerRole must be one of {${allowed}}, got ${attestation.signerRole}`,
    );
  }
  const signedAtMs = parseTimestamp(attestation.signedAt, 'attestation.signedAt');
  if (typeof attestation.signature !== 'string' || !attestation.signature.trim()) {
    throw new Error(`${ERR_SCHEMA}: attestation.signature must be a non-empty base64 string`);
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(attestation.signature)) {
    throw new Error(`${ERR_INVALID_SIGNATURE_LENGTH}: attestation.signature is not valid base64`);
  }
  const signature = Buffer.from(attestation.signature, 'base64');
  if (signature.length !== ED25519_RAW_SIGNATURE_BYTES) {
    throw new Error(
      `${ERR_INVALID_SIGNATURE_LENGTH}: attestation.signature must decode to ${ED25519_RAW_SIGNATURE_BYTES} bytes, got ${signature.length}`,
    );
  }

  ensureExactKeys(attestation.payload, PAYLOAD_KEYS, 'attestation.payload');
  const payload = attestation.payload;
  if (payload.version !== ATTESTATION_VERSION) {
    throw new Error(`${ERR_SCHEMA}: attestation.payload.version must be ${ATTESTATION_VERSION}`);
  }
  if (typeof payload.runId !== 'string' || !payload.runId.trim()) {
    throw new Error(`${ERR_SCHEMA}: attestation.payload.runId must be a non-empty string`);
  }
  if (typeof payload.commitSha !== 'string' || !payload.commitSha.trim()) {
    throw new Error(`${ERR_SCHEMA}: attestation.payload.commitSha must be a non-empty string`);
  }
  if (typeof payload.manifestHash !== 'string' || !payload.manifestHash.trim()) {
    throw new Error(`${ERR_SCHEMA}: attestation.payload.manifestHash must be a non-empty string`);
  }
  if (typeof payload.finalStateHash !== 'string' || !payload.finalStateHash.trim()) {
    throw new Error(`${ERR_SCHEMA}: attestation.payload.finalStateHash must be a non-empty string`);
  }
  if (!Number.isInteger(payload.pairCount) || payload.pairCount < 0) {
    throw new Error(`${ERR_SCHEMA}: attestation.payload.pairCount must be a non-negative integer`);
  }
  if (typeof payload.runtimeFamily !== 'string' || !payload.runtimeFamily.trim()) {
    throw new Error(`${ERR_SCHEMA}: attestation.payload.runtimeFamily must be a non-empty string`);
  }
  if (typeof payload.reviewerFamily !== 'string' || !payload.reviewerFamily.trim()) {
    throw new Error(`${ERR_SCHEMA}: attestation.payload.reviewerFamily must be a non-empty string`);
  }
  const createdAtMs = parseTimestamp(payload.createdAt, 'attestation.payload.createdAt');
  if (signedAtMs < createdAtMs) {
    throw new Error(`${ERR_SCHEMA}: attestation.signedAt must be >= attestation.payload.createdAt`);
  }
}

export function loadTrustedSignerRegistry(
  filePath = DEFAULT_TRUSTED_SIGNERS_PATH,
  { extraAllowedRoles = [] } = {},
) {
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
    if (!isRoleAccepted(entry.role, extraAllowedRoles)) {
      const allowed = [...ACCEPTED_ROLES, ...extraAllowedRoles].join(', ');
      throw new Error(
        `trusted signer ${signerId} has invalid role ${entry.role}; accepted roles: {${allowed}}`,
      );
    }
    const publicKey = Buffer.from(firstString(entry.publicKey) ?? '', 'base64');
    if (publicKey.length !== ED25519_RAW_PUBLIC_KEY_BYTES) {
      throw new Error(
        `trusted signer ${signerId} publicKey must decode to ${ED25519_RAW_PUBLIC_KEY_BYTES} bytes`,
      );
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

/**
 * Import an Ed25519 public key from a base64-encoded raw 32-byte value.
 *
 * The trusted-signers registry stores each public key as
 * `base64(rawPublicKey)` (32 bytes). This helper reconstructs a DER SPKI
 * envelope by prepending the fixed Ed25519 SPKI header
 * (`302a300506032b6570032100`, see RFC 8410 §7) and imports it via
 * node:crypto.createPublicKey.
 *
 * Rationale for raw-base64 on disk instead of PEM: the registry is
 * hand-edited JSON and a single-line base64 value is simpler to review
 * than a multi-line PEM block. The SPKI prefix is fixed for Ed25519,
 * so no information is lost.
 */
function createEd25519PublicKey(publicKeyBase64) {
  const raw = Buffer.from(publicKeyBase64, 'base64');
  if (raw.length !== ED25519_RAW_PUBLIC_KEY_BYTES) {
    throw new Error(
      `trusted signer public key must decode to ${ED25519_RAW_PUBLIC_KEY_BYTES} bytes, got ${raw.length}`,
    );
  }
  return createPublicKey({
    key: Buffer.concat([ED25519_PUBLIC_SPKI_PREFIX, raw]),
    format: 'der',
    type: 'spki',
  });
}

/**
 * Export an Ed25519 public KeyObject to the base64 raw-32-byte encoding
 * used by the trusted-signers registry. Round-trip inverse of
 * `createEd25519PublicKey`.
 */
export function exportEd25519PublicKeyBase64(publicKey) {
  const spki = publicKey.export({ format: 'der', type: 'spki' });
  const prefixLen = ED25519_PUBLIC_SPKI_PREFIX.length;
  const raw = spki.subarray(prefixLen);
  if (raw.length !== ED25519_RAW_PUBLIC_KEY_BYTES) {
    throw new Error(
      `exported public key is ${raw.length} bytes, expected ${ED25519_RAW_PUBLIC_KEY_BYTES}`,
    );
  }
  return raw.toString('base64');
}

/**
 * Load an Ed25519 private key from disk.
 *
 * Preferred format: PEM PKCS#8 (`-----BEGIN PRIVATE KEY-----`), produced
 * by `openssl genpkey -algorithm ed25519 -out op.key`. The loader also
 * accepts raw DER PKCS#8 and a raw 32-byte seed for interoperability
 * with test fixtures; production operators should use PEM only.
 */
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
  const rawSig = signBytes(null, Buffer.from(canonicalJSON(payload)), privateKey);
  // NF1: Ed25519 detached signatures are defined as 64 raw bytes. Assert
  // the invariant here so a buggy key object or future Node change cannot
  // silently produce a differently-shaped signature.
  if (!Buffer.isBuffer(rawSig) || rawSig.length !== ED25519_RAW_SIGNATURE_BYTES) {
    throw new Error(
      `${ERR_INVALID_SIGNATURE_LENGTH}: expected ${ED25519_RAW_SIGNATURE_BYTES}-byte signature, got ${
        Buffer.isBuffer(rawSig) ? rawSig.length : typeof rawSig
      }`,
    );
  }
  return rawSig.toString('base64');
}

export function verifyPayloadDetached(payload, signatureBase64, publicKeyBase64) {
  if (typeof signatureBase64 !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(signatureBase64)) {
    throw new Error(`${ERR_INVALID_SIGNATURE_LENGTH}: signature is not valid base64`);
  }
  const signature = Buffer.from(signatureBase64, 'base64');
  if (signature.length !== ED25519_RAW_SIGNATURE_BYTES) {
    throw new Error(
      `${ERR_INVALID_SIGNATURE_LENGTH}: signature must decode to ${ED25519_RAW_SIGNATURE_BYTES} bytes, got ${signature.length}`,
    );
  }
  const publicKey = createEd25519PublicKey(publicKeyBase64);
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
  extraAllowedRoles = [],
}) {
  parseTimestamp(signedAt, 'attestation.signedAt');
  const signedAtMs = Date.parse(signedAt);
  const createdAtMs = parseTimestamp(payload?.createdAt, 'attestation.payload.createdAt');
  if (signedAtMs < createdAtMs) {
    throw new Error(`${ERR_SCHEMA}: attestation.signedAt must be >= attestation.payload.createdAt`);
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
  validateAttestationShape(attestation, { extraAllowedRoles });
  return attestation;
}

/**
 * Verify an attestation record against its bundle.
 *
 * NF5 / design §6.2 — the checks are ordered (a)..(i) so the
 * earliest-detectable failure fires first and so signature verification
 * precedes any expensive disk recomputation. This prevents an oracle
 * where an attacker with workspace-write learns whether a tampered disk
 * layout matches a signed payload (payload-mismatch would leak that)
 * separate from whether the signature is valid.
 *
 * Order:
 *   (a) schema check (validateAttestationShape)
 *   (b) signer registry lookup (must exist, role must match registry)
 *   (c) revocation check
 *   (d) signer validity window (validFrom/validUntil vs now)
 *   (e) role gating (--require-role)
 *   (f) signature verify over canonicalJSON(payload)
 *   (g) payload recompute vs on-disk bundle (PAYLOAD_KEYS comparison)
 *   (h) cross-check --expected-* flags vs payload
 *   (i) freshness window on payload.createdAt, plus cross-family gate
 *       when role=operator
 */
export function verifyAttestationAgainstBundle({
  attestation,
  bundlePayload,
  trustedSignersPath = DEFAULT_TRUSTED_SIGNERS_PATH,
  revokedSignersPath = DEFAULT_REVOKED_SIGNERS_PATH,
  requireRole = null,
  expectedRunId = null,
  expectedPairCount = null,
  freshnessWindowMs = null,
  extraAllowedRoles = [],
  now = Date.now(),
}) {
  // (a) schema
  validateAttestationShape(attestation, { extraAllowedRoles });

  // (b) signer registry lookup
  const { signers } = loadTrustedSignerRegistry(trustedSignersPath, { extraAllowedRoles });
  const signerEntry = signers.get(attestation.signer);
  if (!signerEntry) {
    throw new Error(
      `${ERR_SIGNER_UNTRUSTED}: attestation signer missing from trusted registry: ${attestation.signer}`,
    );
  }
  if (signerEntry.role !== attestation.signerRole) {
    throw new Error(
      `${ERR_ROLE_REJECTED}: attestation signerRole mismatch: attestation=${attestation.signerRole}, registry=${signerEntry.role}`,
    );
  }

  // (c) revocation
  const { revoked } = loadRevokedSignerRegistry(revokedSignersPath);
  if (revoked.has(attestation.signer)) {
    throw new Error(`${ERR_SIGNER_REVOKED}: attestation signer revoked: ${attestation.signer}`);
  }

  // (d) validity window of the signer
  const validFromMs = parseTimestamp(
    signerEntry.validFrom,
    `trusted signer ${attestation.signer} validFrom`,
  );
  const validUntilMs =
    signerEntry.validUntil === null || signerEntry.validUntil === undefined
      ? null
      : parseTimestamp(signerEntry.validUntil, `trusted signer ${attestation.signer} validUntil`);
  if (now < validFromMs || (validUntilMs !== null && now > validUntilMs)) {
    throw new Error(
      `${ERR_SIGNER_UNTRUSTED}: attestation signer not currently valid: ${attestation.signer}`,
    );
  }

  // (e) --require-role gate (note: 'operator' also enforces cross-family below)
  if (requireRole && attestation.signerRole !== requireRole) {
    throw new Error(
      `${ERR_ROLE_REJECTED}: attestation role mismatch: bundle signed by ${attestation.signerRole}, require-role=${requireRole}`,
    );
  }

  // (f) signature verify BEFORE any payload recomputation. The
  // schema check already enforced signedAt >= createdAt; we re-surface
  // it here via the shape validator.
  let sigOk;
  try {
    sigOk = verifyPayloadDetached(
      attestation.payload,
      attestation.signature,
      signerEntry.publicKey,
    );
  } catch (err) {
    if (
      err &&
      typeof err.message === 'string' &&
      err.message.startsWith(ERR_INVALID_SIGNATURE_LENGTH)
    ) {
      throw err;
    }
    throw new Error(`${ERR_INVALID_SIGNATURE}: ${err.message}`);
  }
  if (!sigOk) {
    throw new Error(`${ERR_INVALID_SIGNATURE}: signature did not verify`);
  }

  // (g) payload recompute vs on-disk bundle
  const mismatches = comparePayloads(attestation.payload, bundlePayload);
  if (mismatches.length > 0) {
    const mismatch = mismatches[0];
    throw new Error(
      `${ERR_PAYLOAD_MISMATCH}: ${mismatch.field} expected ${mismatch.expected} got ${mismatch.actual}`,
    );
  }

  // (h) caller-supplied cross-checks
  if (expectedRunId !== null && attestation.payload.runId !== expectedRunId) {
    throw new Error(
      `${ERR_PAYLOAD_MISMATCH}: runId expected ${expectedRunId} got ${attestation.payload.runId}`,
    );
  }
  if (expectedPairCount !== null && attestation.payload.pairCount !== expectedPairCount) {
    throw new Error(
      `${ERR_PAYLOAD_MISMATCH}: pairCount expected ${expectedPairCount} got ${attestation.payload.pairCount}`,
    );
  }

  // (i) freshness + cross-family for operator
  const createdAtMs = parseTimestamp(
    attestation.payload.createdAt,
    'attestation.payload.createdAt',
  );
  if (freshnessWindowMs !== null && Number.isFinite(freshnessWindowMs) && freshnessWindowMs > 0) {
    const delta = Math.abs(now - createdAtMs);
    if (delta > freshnessWindowMs) {
      throw new Error(
        `${ERR_FRESHNESS}: payload.createdAt is ${delta}ms from now (window=${freshnessWindowMs}ms)`,
      );
    }
  }
  if (requireRole === 'operator') {
    const separation = validateFamilySeparation(
      attestation.payload.runtimeFamily,
      attestation.payload.reviewerFamily,
    );
    if (!separation.valid) {
      throw new Error(
        `${ERR_PAYLOAD_MISMATCH}: operator cross-family requirement failed: ${separation.error}`,
      );
    }
  }

  return {
    signer: attestation.signer,
    signerRole: attestation.signerRole,
    signedAt: attestation.signedAt,
  };
}
