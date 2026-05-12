#!/usr/bin/env node

/* cspell:ignore apikey rawdump rawpayload rawstderr rawstdout sourcepayload studentpayload */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROUTE_RECORD_SOLUTION = String.raw`
const UNSAFE_KEYS = new Set([
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

export function normalizeRouteKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isUnsafeEvidenceKey(key) {
  return UNSAFE_KEYS.has(normalizeRouteKey(key));
}

export function containsUnsafeEvidenceText(value) {
  return typeof value === 'string' && RAW_TEXT_PATTERNS.some((pattern) => pattern.test(value));
}

export function isSafeEvidenceRef(ref) {
  if (typeof ref !== 'string' || !ref.trim()) return false;
  if (ref.includes('?') || ref.includes('#')) return false;
  if (ref.startsWith('/') || /^[a-z]+:/i.test(ref)) return false;
  if (ref.split(/[\\/]+/).includes('..')) return false;
  if (/raw[-_ ]?dump/i.test(ref)) return false;
  return true;
}

export function deriveEscalationReasons(input) {
  const reasons = [];
  if (input?.gates?.finalVerdict !== 'pass') reasons.push('public-gate-failure');
  if (input?.gates?.privateOracle !== 'pass') reasons.push('private-oracle-failure');
  if (
    Array.isArray(input?.gates?.blockingReviewDefects) &&
    input.gates.blockingReviewDefects.length > 0
  ) {
    reasons.push('blocking-review-defects');
  }
  if ((input?.cost?.frontierTokensTotal ?? 0) > 0 || (input?.cost?.providerUsdTotal ?? 0) > 0) {
    reasons.push('frontier-budget-used');
  }
  if ((input?.cost?.localWallSecondsTotal ?? 0) > 900) reasons.push('local-wall-time-high');
  return [...new Set(reasons)];
}

export function selectRouteDecision(input) {
  const defects = Array.isArray(input?.gates?.blockingReviewDefects)
    ? input.gates.blockingReviewDefects
    : [];
  if (input?.gates?.privateOracle === 'fail') {
    return {
      decision: 'frontier-baseline',
      reason: 'private oracle failed; use frontier baseline before product action',
    };
  }
  if (input?.route?.arm !== 'local-only') {
    return {
      decision: 'frontier-baseline',
      reason: 'non-local arm evidence remains frontier baseline for this record',
    };
  }
  if (input?.gates?.finalVerdict !== 'pass' || defects.length > 0) {
    return {
      decision: 'advisor-escalate',
      reason: 'local screen failed public or review gate; request advisor diagnosis',
    };
  }
  if ((input?.cost?.frontierTokensTotal ?? 0) === 0) {
    return {
      decision: 'local-screen',
      reason: 'local-only passed public and private gates with zero frontier tokens',
    };
  }
  return {
    decision: 'advisor-escalate',
    reason: 'passing record used frontier budget and needs route review',
  };
}

function scan(value, path, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scan(item, path + '[' + index + ']', errors));
    return;
  }
  if (typeof value === 'string') {
    if (containsUnsafeEvidenceText(value)) errors.push('unsafe evidence text at ' + path);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (isUnsafeEvidenceKey(key)) errors.push('unsafe evidence key at ' + path + '.' + key);
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
    if (!isSafeEvidenceRef(value)) errors.push('artifactRefs.' + key + ' is unsafe');
  }
}

function sanitizedRecord(input) {
  const selected = selectRouteDecision(input);
  return {
    schemaVersion: 'portarium.route-decision-record.v1',
    source: structuredClone(input.source),
    workItem: structuredClone(input.workItem),
    selectedRoute: {
      arm: input.route.arm,
      decision: selected.decision,
      reason: selected.reason,
      selectedModel: input.route.selectedModel ?? null,
      selectedProvider: input.route.selectedProvider ?? null,
    },
    gates: structuredClone(input.gates),
    cost: structuredClone(input.cost),
    escalationReasons: deriveEscalationReasons(input),
    artifactRefs: structuredClone(input.artifactRefs),
  };
}

export function buildRouteDecisionRecord(input) {
  const errors = [];
  if (!isRecord(input)) return { ok: false, errors: ['input must be an object'], record: null };

  scan(input, 'input', errors);
  if (input.schemaVersion !== 'harness.route-input.v1') errors.push('schemaVersion is unsupported');
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
    for (const field of ['frontierTokensTotal', 'providerUsdTotal', 'localWallSecondsTotal']) {
      requireNonNegative(input.cost[field], 'cost.' + field, errors);
    }
  }
  validateArtifactRefs(input.artifactRefs, errors);

  if (errors.length > 0) return { ok: false, errors, record: null };
  return { ok: true, errors: [], record: sanitizedRecord(input) };
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
  const target = join(workspace, 'src', 'route-decision-record.mjs');
  if (!existsSync(target)) throw new Error('missing src/route-decision-record.mjs');
  writeFileSync(target, `${ROUTE_RECORD_SOLUTION.trim()}\n`, 'utf8');
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

function writeRouteDecision(workspace, { arm, step }) {
  const policyDir = join(workspace, 'policy');
  mkdirSync(policyDir, { recursive: true });
  writeFileSync(
    join(policyDir, 'route-decision.json'),
    `${JSON.stringify(
      {
        decision: 'local-screen',
        reason: 'deterministic GSLR-7 scaffold proof',
        arm,
        step,
        productBoundary: 'research-only',
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

const options = parseArgs(process.argv.slice(2));
writeSolution(options.workspace);
runPublicGate(options.workspace);
writeRouteDecision(options.workspace, options);
console.log(
  `deterministic lane wrote GSLR-7 route-decision record for ${options.arm}/${options.step}`,
);
