#!/usr/bin/env node

/* cspell:ignore apikey rawdump rawpayload rawstderr rawstdout sourcepayload studentpayload */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const SANITIZER_SOLUTION = String.raw`
const FORBIDDEN_KEYS = new Set([
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
const ROUTE_ARMS = new Set(['local-only', 'frontier-only', 'advisor-only', 'hybrid-router']);
const ALLOWED_TOP_LEVEL = [
  'schemaVersion',
  'source',
  'workItem',
  'route',
  'gates',
  'cost',
  'actionBoundary',
  'artifactRefs',
];
const RAW_TEXT_PATTERNS = [
  /begin\s+raw\s+payload/i,
  /student\s+id(?:entifier)?/i,
  /student\s+record/i,
  /raw\s+transcript/i,
  /oracle\s+command/i,
  /password/i,
  /api\s+key/i,
  /hidden\s+oracle\s+body/i,
];

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function scan(value, path, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scan(item, path + '[' + index + ']', errors));
    return;
  }
  if (typeof value === 'string') {
    if (RAW_TEXT_PATTERNS.some((pattern) => pattern.test(value))) {
      errors.push('raw or secret payload text at ' + path);
    }
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(normalizeKey(key))) {
      errors.push('forbidden raw or secret key at ' + path + '.' + key);
    }
    scan(child, path + '.' + key, errors);
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
    if (typeof value !== 'string' || !value.trim()) {
      errors.push('artifactRefs.' + key + ' must be a non-empty string');
      continue;
    }
    if (
      value.includes('?') ||
      value.includes('#') ||
      value.startsWith('/') ||
      value.includes('..') ||
      /raw[-_ ]?dump/i.test(value)
    ) {
      errors.push('artifactRefs.' + key + ' is unsafe');
    }
  }
}

function actionBoundaryFor(card) {
  const defects = Array.isArray(card?.gates?.blockingReviewDefects)
    ? card.gates.blockingReviewDefects.filter((defect) => typeof defect === 'string' && defect.trim())
    : [];
  const clear =
    card?.gates?.finalVerdict === 'pass' &&
    card?.gates?.privateOracle === 'pass' &&
    defects.length === 0;
  return {
    status: clear ? 'research-only' : 'blocked',
    reason: clear
      ? 'static evidence-card input only; product runtime ingestion remains blocked'
      : 'manifest is not eligible for product action',
  };
}

function sanitizedCard(input) {
  const card = {};
  for (const field of ALLOWED_TOP_LEVEL) {
    if (field === 'actionBoundary') continue;
    card[field] = structuredClone(input[field]);
  }
  card.actionBoundary = actionBoundaryFor(input);
  return card;
}

export function sanitizeEvidenceCardInput(input) {
  const errors = [];
  if (!isRecord(input)) return { ok: false, errors: ['input must be an object'], card: null };

  scan(input, 'input', errors);
  if (input.schemaVersion !== 'portarium.evidence-card-input.v1') errors.push('schemaVersion is unsupported');
  if (requireRecord(input.source, 'source', errors)) {
    if (input.source.system !== 'prompt-language') errors.push('source.system is unsupported');
    if (input.source.area !== 'harness-arena') errors.push('source.area is unsupported');
  }
  if (requireRecord(input.workItem, 'workItem', errors)) {
    requireString(input.workItem.id, 'workItem.id', errors);
    requireString(input.workItem.runId, 'workItem.runId', errors);
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
    for (const field of ['frontierTokensTotal', 'cachedInputTokensTotal', 'providerUsdTotal', 'localWallSecondsTotal']) {
      requireNonNegative(input.cost[field], 'cost.' + field, errors);
    }
  }
  validateArtifactRefs(input.artifactRefs, errors);

  if (errors.length > 0) return { ok: false, errors, card: null };
  return { ok: true, errors: [], card: sanitizedCard(input) };
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
  const target = join(workspace, 'src', 'evidence-card-sanitizer.mjs');
  if (!existsSync(target)) throw new Error('missing src/evidence-card-sanitizer.mjs');
  writeFileSync(target, `${SANITIZER_SOLUTION.trim()}\n`, 'utf8');
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
    '# Frontier Advice\n\nTreat this as privacy-sensitive evidence sanitization. Reject separator-insensitive raw payload keys, raw transcript text, unsafe artifact refs, malformed input, and stale action-boundary claims. Preserve only allowed evidence-card fields.\n',
  );
  console.error('tokens used\n1,700\ncached tokens\n320\n');
  console.log(`gslr5 deterministic advice complete for ${arm}`);
  process.exit(0);
}

if (step === 'frontier-classify') {
  writeFileSync(
    join(policyDir, 'route-decision.json'),
    JSON.stringify(
      {
        route: 'frontier-baseline',
        risk: 'privacy-sensitive raw-payload ambiguity',
        reason: 'The task contains adversarial raw payload and school/person-data leakage traps.',
        expectedLocalFit: 'low until local-only proves hidden-oracle pass',
        requiredReview: true,
      },
      null,
      2,
    ),
  );
  console.error('tokens used\n1,100\ncached tokens\n160\n');
  console.log(`gslr5 deterministic classify complete for ${arm}`);
  process.exit(0);
}

if (step === 'frontier-review') {
  writeFileSync(
    join(policyDir, 'frontier-review.md'),
    '# Frontier Review\n\nblocking findings:\n\nnone\n',
  );
  console.error('tokens used\n1,900\ncached tokens\n360\n');
  console.log(`gslr5 deterministic review complete for ${arm}`);
  process.exit(0);
}

if (['local-bulk', 'local-apply', 'frontier-full'].includes(step)) {
  writeSolution(workspace);
  runPublicGate(workspace);
  if (step === 'frontier-full') console.error('tokens used\n3,200\ncached tokens\n640\n');
  console.log(`gslr5 deterministic implementation complete for ${arm}:${step}`);
  process.exit(0);
}

throw new Error(`unsupported step: ${step}`);
