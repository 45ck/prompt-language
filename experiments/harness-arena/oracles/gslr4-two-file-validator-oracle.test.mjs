import assert from 'node:assert/strict';

/* cspell:ignore hiddenoraclebody oraclecommand rawpayload rawstderr rawstdout sourcepayload studentpayload */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ORACLE = new URL('./gslr4-two-file-validator-oracle.mjs', import.meta.url).pathname;

function tempWorkspace() {
  const workspace = join(tmpdir(), `gslr4-oracle-${process.pid}-${Date.now()}-${Math.random()}`);
  mkdirSync(join(workspace, 'src'), { recursive: true });
  return workspace;
}

function runOracle(workspace) {
  return spawnSync(process.execPath, [ORACLE, '--workspace', workspace], {
    encoding: 'utf8',
  });
}

function writeImplementation(workspace, { actionSource, validatorSource }) {
  writeFileSync(join(workspace, 'src', 'action-boundary-policy.mjs'), actionSource, 'utf8');
  writeFileSync(join(workspace, 'src', 'evidence-card-validator.mjs'), validatorSource, 'utf8');
}

const validActionSource = String.raw`
function reviewDefects(card) {
  return Array.isArray(card?.gates?.blockingReviewDefects)
    ? card.gates.blockingReviewDefects.filter((defect) => typeof defect === 'string' && defect.trim())
    : [];
}

export function deriveActionBoundary(card) {
  const clear =
    card?.gates?.finalVerdict === 'pass' &&
    card?.gates?.privateOracle === 'pass' &&
    reviewDefects(card).length === 0;
  return {
    status: clear ? 'research-only' : 'blocked',
    reason: clear
      ? 'static evidence-card input only; product runtime ingestion remains blocked'
      : 'manifest is not eligible for product action',
  };
}
`;

const validValidatorSource = String.raw`
import { deriveActionBoundary } from './action-boundary-policy.mjs';

const FORBIDDEN_KEYS = new Set([
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
const ROUTE_ARMS = new Set(['local-only', 'frontier-only', 'advisor-only', 'hybrid-router']);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function scanForbiddenKeys(value, path, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbiddenKeys(item, path + '[' + index + ']', errors));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
      errors.push('forbidden raw or secret key at ' + path + '.' + key);
    }
    scanForbiddenKeys(child, path + '.' + key, errors);
  }
}

function requireRecord(value, label, errors) {
  if (!isRecord(value)) {
    errors.push(label + ' must be an object');
    return false;
  }
  return true;
}

function requireString(value, label, errors) {
  if (typeof value !== 'string' || !value.trim()) errors.push(label + ' is required');
}

function requireGate(value, label, errors) {
  if (!['pass', 'fail'].includes(value)) errors.push(label + ' must be pass or fail');
}

function requireNonNegative(value, label, errors) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    errors.push(label + ' must be a non-negative finite number');
  }
}

function validateArtifactRefs(refs, errors) {
  if (!requireRecord(refs, 'artifactRefs', errors)) return;
  for (const [key, value] of Object.entries(refs)) {
    if (value === null) continue;
    if (typeof value !== 'string' || !value.trim()) {
      errors.push('artifactRefs.' + key + ' must be a string or null');
      continue;
    }
    if (value.includes('?') || value.includes('#')) {
      errors.push('artifactRefs.' + key + ' must not include query or fragment text');
    }
  }
}

export function validateEngineeringEvidenceCard(card) {
  const errors = [];
  if (!isRecord(card)) return { ok: false, errors: ['card must be an object'] };

  scanForbiddenKeys(card, 'card', errors);
  if (card.schemaVersion !== 'portarium.evidence-card-input.v1') errors.push('schemaVersion is unsupported');

  if (requireRecord(card.source, 'source', errors)) {
    if (card.source.system !== 'prompt-language') errors.push('source.system is unsupported');
    if (card.source.area !== 'harness-arena') errors.push('source.area is unsupported');
  }
  if (requireRecord(card.workItem, 'workItem', errors)) {
    requireString(card.workItem.id, 'workItem.id', errors);
    requireString(card.workItem.runId, 'workItem.runId', errors);
  }
  if (requireRecord(card.route, 'route', errors) && !ROUTE_ARMS.has(card.route.arm)) {
    errors.push('route.arm is unsupported');
  }
  if (requireRecord(card.gates, 'gates', errors)) {
    requireGate(card.gates.finalVerdict, 'gates.finalVerdict', errors);
    requireGate(card.gates.privateOracle, 'gates.privateOracle', errors);
    if (!Array.isArray(card.gates.blockingReviewDefects)) {
      errors.push('gates.blockingReviewDefects must be an array');
    }
  }
  if (requireRecord(card.cost, 'cost', errors)) {
    for (const field of ['frontierTokensTotal', 'cachedInputTokensTotal', 'providerUsdTotal', 'localWallSecondsTotal']) {
      requireNonNegative(card.cost[field], 'cost.' + field, errors);
    }
  }
  if (requireRecord(card.actionBoundary, 'actionBoundary', errors)) {
    const derived = deriveActionBoundary(card);
    if (!['research-only', 'blocked'].includes(card.actionBoundary.status)) {
      errors.push('actionBoundary.status is unsupported');
    } else if (card.actionBoundary.status !== derived.status) {
      errors.push('actionBoundary.status does not match derived policy');
    }
    requireString(card.actionBoundary.reason, 'actionBoundary.reason', errors);
  }
  validateArtifactRefs(card.artifactRefs, errors);

  return { ok: errors.length === 0, errors };
}
`;

test('GSLR-4 oracle accepts a coupled two-file validator implementation', () => {
  const workspace = tempWorkspace();
  try {
    writeImplementation(workspace, {
      actionSource: validActionSource,
      validatorSource: validValidatorSource,
    });
    const result = runOracle(workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /gslr4 private oracle passed/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('GSLR-4 oracle rejects shallow validators', () => {
  const workspace = tempWorkspace();
  try {
    writeImplementation(workspace, {
      actionSource: validActionSource,
      validatorSource: `
        import { deriveActionBoundary } from './action-boundary-policy.mjs';
        export function validateEngineeringEvidenceCard() {
          deriveActionBoundary({});
          return { ok: true, errors: [] };
        }
      `,
    });
    const result = runOracle(workspace);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /expected ok=false|expected ok=true/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('GSLR-4 oracle rejects validators that ignore the policy helper', () => {
  const workspace = tempWorkspace();
  try {
    writeImplementation(workspace, {
      actionSource: validActionSource,
      validatorSource: `
        export function validateEngineeringEvidenceCard() {
          return { ok: false, errors: ['no helper'] };
        }
      `,
    });
    const result = runOracle(workspace);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must import and use deriveActionBoundary/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
