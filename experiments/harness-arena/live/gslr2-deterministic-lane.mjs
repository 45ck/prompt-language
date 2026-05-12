#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const SOLUTION = String.raw`
/* cspell:ignore rawpayload sourcepayload studentpayload */
const ALLOWED_REPOS = new Set(['prompt-language', 'Portarium', 'MacquarieCollege']);
const ALLOWED_PROVIDER_CLASSES = new Set(['local', 'frontier', 'hybrid', 'deterministic']);
const ALLOWED_GATE_KINDS = new Set(['public', 'private', 'review']);
const FORBIDDEN_KEYS = new Set([
  'rawpayload',
  'sourcepayload',
  'studentpayload',
  'credential',
  'secret',
  'token',
  'password',
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value, maxLength = Infinity) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function scanForbiddenKeys(value, path, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbiddenKeys(item, path + '[' + index + ']', errors));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) errors.push('forbidden raw or secret key at ' + path + '.' + key);
    scanForbiddenKeys(child, path + '.' + key, errors);
  }
}

export function validateActionPolicyEnvelope(envelope) {
  const errors = [];
  if (!isRecord(envelope)) return { ok: false, errors: ['envelope must be an object'] };

  scanForbiddenKeys(envelope, 'envelope', errors);

  if (envelope.version !== 'gslr.action-policy.v1') errors.push('version must be gslr.action-policy.v1');

  const workItem = envelope.workItem;
  if (!isRecord(workItem)) {
    errors.push('workItem must be an object');
  } else {
    if (!/^bead-\d{4}$/.test(workItem.id) && !/^prompt-language-[a-z0-9]+$/.test(workItem.id)) {
      errors.push('workItem.id is unsupported');
    }
    if (!ALLOWED_REPOS.has(workItem.repo)) errors.push('workItem.repo is unsupported');
    if (!hasText(workItem.intent, 240)) errors.push('workItem.intent is required and must be <= 240 chars');
  }

  const route = envelope.route;
  if (!isRecord(route)) {
    errors.push('route must be an object');
  } else {
    if (!ALLOWED_PROVIDER_CLASSES.has(route.providerClass)) errors.push('route.providerClass is unsupported');
    if (!hasText(route.reason)) errors.push('route.reason is required');
  }

  if (!Array.isArray(envelope.gates) || envelope.gates.length === 0) {
    errors.push('gates must be a non-empty array');
  } else {
    envelope.gates.forEach((gate, index) => {
      if (!isRecord(gate)) {
        errors.push('gates[' + index + '] must be an object');
        return;
      }
      if (!hasText(gate.id)) errors.push('gates[' + index + '].id is required');
      if (!ALLOWED_GATE_KINDS.has(gate.kind)) errors.push('gates[' + index + '].kind is unsupported');
      if (gate.required !== true) errors.push('gates[' + index + '].required must be true');
    });
  }

  const budget = envelope.budget;
  if (!isRecord(budget)) {
    errors.push('budget must be an object');
  } else {
    if (!Number.isInteger(budget.frontierCallLimit) || budget.frontierCallLimit < 0) {
      errors.push('budget.frontierCallLimit must be a non-negative integer');
    }
    if (typeof budget.usdLimit !== 'number' || Number.isNaN(budget.usdLimit) || budget.usdLimit < 0) {
      errors.push('budget.usdLimit must be a non-negative number');
    }
    if (budget.requiresTokenTelemetry !== true) errors.push('budget.requiresTokenTelemetry must be true');
  }

  const evidence = envelope.evidence;
  if (!isRecord(evidence)) {
    errors.push('evidence must be an object');
  } else {
    if (evidence.finalVerdictRequired !== true) errors.push('evidence.finalVerdictRequired must be true');
    if (evidence.blockingReviewDefectsFail !== true) {
      errors.push('evidence.blockingReviewDefectsFail must be true');
    }
    if (
      typeof evidence.manifestRef !== 'string' ||
      !evidence.manifestRef.endsWith('hybrid-routing-manifest.json')
    ) {
      errors.push('evidence.manifestRef must end with hybrid-routing-manifest.json');
    }
  }

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

const { arm, step, workspace } = parseArgs(process.argv.slice(2));
const policyDir = join(workspace, 'policy');
mkdirSync(policyDir, { recursive: true });

if (step === 'frontier-advice') {
  writeFileSync(
    join(policyDir, 'frontier-advice.md'),
    '# Frontier Advice\n\nImplement recursive forbidden-key scanning and keep public/private gates separate.\n',
  );
  console.error('tokens used\n1,024\n');
  console.log(`gslr2 deterministic advice complete for ${arm}`);
  process.exit(0);
}

if (step === 'frontier-classify') {
  writeFileSync(
    join(policyDir, 'route-decision.json'),
    JSON.stringify(
      {
        route: 'local-bulk-with-frontier-review',
        reason: 'Small validator with hidden recursive edge cases.',
      },
      null,
      2,
    ),
  );
  console.error('tokens used\n768\n');
  console.log(`gslr2 deterministic classify complete for ${arm}`);
  process.exit(0);
}

if (step === 'frontier-review') {
  writeFileSync(
    join(policyDir, 'frontier-review.md'),
    '# Frontier Review\n\nblocking findings:\n\nnone\n',
  );
  console.error('tokens used\n1,536\n');
  console.log(`gslr2 deterministic review complete for ${arm}`);
  process.exit(0);
}

if (['local-bulk', 'local-apply', 'frontier-full'].includes(step)) {
  const target = join(workspace, 'src', 'action-policy-schema.mjs');
  if (!existsSync(target)) throw new Error('missing src/action-policy-schema.mjs');
  writeFileSync(target, `${SOLUTION.trim()}\n`, 'utf8');
  const result = spawnSync(process.execPath, ['test/public-gate.mjs'], {
    cwd: workspace,
    encoding: 'utf8',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (step === 'frontier-full') console.error('tokens used\n2,048\n');
  console.log(`gslr2 deterministic implementation complete for ${arm}:${step}`);
  process.exit(0);
}

throw new Error(`unsupported step: ${step}`);
