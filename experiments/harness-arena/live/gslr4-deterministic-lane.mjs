#!/usr/bin/env node

/* cspell:ignore hiddenoraclebody oraclecommand rawpayload rawstderr rawstdout sourcepayload studentpayload */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ACTION_BOUNDARY_SOLUTION = String.raw`
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

const VALIDATOR_SOLUTION = String.raw`
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

function parseArgs(argv) {
  const options = { arm: null, step: null, workspace: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--workspace') {
      options.workspace = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === '--arm') {
      options.arm = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === '--step') {
      options.step = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  if (!options.workspace) throw new Error('--workspace is required');
  if (!options.arm) throw new Error('--arm is required');
  if (!options.step) throw new Error('--step is required');
  return options;
}

function writeSolution(workspace) {
  const actionTarget = join(workspace, 'src', 'action-boundary-policy.mjs');
  const validatorTarget = join(workspace, 'src', 'evidence-card-validator.mjs');
  if (!existsSync(actionTarget)) throw new Error('missing src/action-boundary-policy.mjs');
  if (!existsSync(validatorTarget)) throw new Error('missing src/evidence-card-validator.mjs');
  writeFileSync(actionTarget, `${ACTION_BOUNDARY_SOLUTION.trim()}\n`, 'utf8');
  writeFileSync(validatorTarget, `${VALIDATOR_SOLUTION.trim()}\n`, 'utf8');
}

function runPublicGate(workspace) {
  const result = spawnSync(process.execPath, ['test/public-gate.mjs'], {
    cwd: workspace,
    encoding: 'utf8',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const { arm, step, workspace } = parseArgs(process.argv.slice(2));
const policyDir = join(workspace, 'policy');
mkdirSync(policyDir, { recursive: true });

if (step === 'frontier-advice') {
  writeFileSync(
    join(policyDir, 'frontier-advice.md'),
    '# Frontier Advice\n\nCoordinate the validator and action-boundary helper. Keep raw payload keys rejected recursively. Accept blocked evidence cards when policy derives a blocked boundary.\n',
  );
  console.error('tokens used\n1,300\ncached tokens\n256\n');
  console.log(`gslr4 deterministic advice complete for ${arm}`);
  process.exit(0);
}

if (step === 'frontier-classify') {
  writeFileSync(
    join(policyDir, 'route-decision.json'),
    JSON.stringify(
      {
        route: 'advisor-only',
        reason:
          'Two-file validator with cross-module action-boundary policy; harder than GSLR-2, narrower than GSLR-3 transform.',
      },
      null,
      2,
    ),
  );
  console.error('tokens used\n950\ncached tokens\n128\n');
  console.log(`gslr4 deterministic classify complete for ${arm}`);
  process.exit(0);
}

if (step === 'frontier-review') {
  writeFileSync(
    join(policyDir, 'frontier-review.md'),
    '# Frontier Review\n\nblocking findings:\n\nnone\n',
  );
  console.error('tokens used\n1,600\ncached tokens\n320\n');
  console.log(`gslr4 deterministic review complete for ${arm}`);
  process.exit(0);
}

if (['local-bulk', 'local-apply', 'frontier-full'].includes(step)) {
  writeSolution(workspace);
  runPublicGate(workspace);
  if (step === 'frontier-full') console.error('tokens used\n2,500\ncached tokens\n512\n');
  console.log(`gslr4 deterministic implementation complete for ${arm}:${step}`);
  process.exit(0);
}

throw new Error(`Unsupported step: ${step}`);
