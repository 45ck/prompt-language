import {
  isRelativeArtifactReference,
  matchesAnyEvidenceTextPattern,
} from './route-predicate-hooks.mjs';

const UNSAFE_EVIDENCE_KEYS = new Set([
  'rawpayload',
  'sourcepayload',
  'studentpayload',
  'credential',
  'secret',
  'token',
  'password',
  'apikey',
  'oraclecommand',
  'rawstdout',
  'rawstderr',
  'hiddenoraclebody',
  'transcript',
  'studentrecord',
  'rawdump',
]);

const UNSAFE_TEXT_PATTERNS = Object.freeze([
  /begin\s+raw\s+payload/i,
  /student\s+id(?:entifier)?/i,
  /student\s+record/i,
  /raw\s+transcript/i,
  /oracle\s+command/i,
  /password/i,
  /api\s+key/i,
  /hidden\s+oracle\s+body/i,
]);

const ROUTE_ARMS = new Set(['local-only', 'frontier-only', 'advisor-only', 'hybrid-router']);

const ESCALATION_REASON_ORDER = Object.freeze([
  'public-gate-failure',
  'private-oracle-failure',
  'blocking-review-defects',
  'frontier-budget-used',
  'local-wall-time-high',
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return structuredClone(value);
}

export function normalizeRouteKey(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function isUnsafeEvidenceKey(key) {
  return UNSAFE_EVIDENCE_KEYS.has(normalizeRouteKey(key));
}

export function containsUnsafeEvidenceText(value) {
  return matchesAnyEvidenceTextPattern(value, UNSAFE_TEXT_PATTERNS);
}

export function isSafeEvidenceRef(ref) {
  if (!isRelativeArtifactReference(ref)) return false;
  if (/raw[-_ ]?dump/i.test(ref)) return false;
  return true;
}

export function deriveEscalationReasons(input) {
  const present = new Set();
  if (input?.gates?.finalVerdict !== 'pass') present.add('public-gate-failure');
  if (input?.gates?.privateOracle !== 'pass') present.add('private-oracle-failure');
  if (
    Array.isArray(input?.gates?.blockingReviewDefects) &&
    input.gates.blockingReviewDefects.length > 0
  ) {
    present.add('blocking-review-defects');
  }
  if ((input?.cost?.frontierTokensTotal ?? 0) > 0 || (input?.cost?.providerUsdTotal ?? 0) > 0) {
    present.add('frontier-budget-used');
  }
  if ((input?.cost?.localWallSecondsTotal ?? 0) > 900) present.add('local-wall-time-high');
  return ESCALATION_REASON_ORDER.filter((reason) => present.has(reason));
}

export function selectRouteDecision(input) {
  const reviewDefects = Array.isArray(input?.gates?.blockingReviewDefects)
    ? input.gates.blockingReviewDefects
    : [];
  if (input?.gates?.privateOracle === 'fail') {
    return {
      decision: 'frontier-baseline',
      reason: 'private oracle failed; frontier owns the next route',
    };
  }
  if (input?.route?.arm !== 'local-only') {
    return {
      decision: 'frontier-baseline',
      reason: 'non-local route-record evidence remains frontier baseline',
    };
  }
  if (input?.gates?.finalVerdict !== 'pass' || reviewDefects.length > 0) {
    return {
      decision: 'advisor-escalate',
      reason: 'local screen failed a gate; request frontier advisor diagnosis',
    };
  }
  if ((input?.cost?.frontierTokensTotal ?? 0) === 0 && (input?.cost?.providerUsdTotal ?? 0) === 0) {
    return {
      decision: 'local-screen',
      reason: 'PL-owned scaffold passed local gates with zero frontier budget',
    };
  }
  return {
    decision: 'advisor-escalate',
    reason: 'passing route record used frontier budget and needs route review',
  };
}

function scanEvidence(value, path, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanEvidence(item, `${path}[${index}]`, errors));
    return;
  }
  if (typeof value === 'string') {
    if (containsUnsafeEvidenceText(value)) errors.push(`unsafe evidence text at ${path}`);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (isUnsafeEvidenceKey(key)) errors.push(`unsafe evidence key at ${path}.${key}`);
    scanEvidence(child, `${path}.${key}`, errors);
  }
}

function requireRecord(value, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object`);
    return false;
  }
  return true;
}

function requireString(value, label, errors) {
  if (typeof value !== 'string' || !value.trim()) errors.push(`${label} is required`);
}

function requireGate(value, label, errors) {
  if (value !== 'pass' && value !== 'fail') errors.push(`${label} must be pass or fail`);
}

function requireNonNegative(value, label, errors) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    errors.push(`${label} must be a non-negative finite number`);
  }
}

function validateArtifactRefs(refs, errors) {
  if (!requireRecord(refs, 'artifactRefs', errors)) return;
  for (const [key, value] of Object.entries(refs)) {
    if (!isSafeEvidenceRef(value)) errors.push(`artifactRefs.${key} is unsafe`);
  }
}

function buildSelectedRoute(input) {
  const selected = selectRouteDecision(input);
  return {
    arm: input.route.arm,
    decision: selected.decision,
    reason: selected.reason,
    selectedModel: input.route.selectedModel ?? null,
    selectedProvider: input.route.selectedProvider ?? null,
  };
}

function buildSanitizedRecord(input) {
  return {
    schemaVersion: 'portarium.route-decision-record.v1',
    source: clone(input.source),
    workItem: clone(input.workItem),
    selectedRoute: buildSelectedRoute(input),
    gates: clone(input.gates),
    cost: clone(input.cost),
    escalationReasons: deriveEscalationReasons(input),
    artifactRefs: clone(input.artifactRefs),
  };
}

export function buildRouteDecisionRecord(input) {
  const errors = [];
  if (!isRecord(input)) return { ok: false, errors: ['input must be an object'], record: null };

  scanEvidence(input, 'input', errors);

  if (input.schemaVersion !== 'harness.route-input.v1') errors.push('schemaVersion is unsupported');
  if (requireRecord(input.source, 'source', errors)) {
    if (input.source.system !== 'prompt-language') errors.push('source.system is unsupported');
    if (input.source.area !== 'harness-arena') errors.push('source.area is unsupported');
  }
  if (requireRecord(input.workItem, 'workItem', errors)) {
    requireString(input.workItem.id, 'workItem.id', errors);
    requireString(input.workItem.runId, 'workItem.runId', errors);
    requireString(input.workItem.policyVersion, 'workItem.policyVersion', errors);
  }
  if (requireRecord(input.route, 'route', errors) && !ROUTE_ARMS.has(input.route.arm)) {
    errors.push('route.arm is unsupported');
  }
  if (requireRecord(input.gates, 'gates', errors)) {
    requireGate(input.gates.finalVerdict, 'gates.finalVerdict', errors);
    requireGate(input.gates.privateOracle, 'gates.privateOracle', errors);
    if (!Array.isArray(input.gates.blockingReviewDefects)) {
      errors.push('gates.blockingReviewDefects must be an array');
    }
  }
  if (requireRecord(input.cost, 'cost', errors)) {
    for (const field of ['frontierTokensTotal', 'providerUsdTotal', 'localWallSecondsTotal']) {
      requireNonNegative(input.cost[field], `cost.${field}`, errors);
    }
  }
  validateArtifactRefs(input.artifactRefs, errors);

  if (errors.length > 0) return { ok: false, errors, record: null };
  return { ok: true, errors: [], record: buildSanitizedRecord(input) };
}
