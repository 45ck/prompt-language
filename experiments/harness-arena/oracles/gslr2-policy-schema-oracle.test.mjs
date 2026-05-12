import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ORACLE = new URL('./gslr2-policy-schema-oracle.mjs', import.meta.url).pathname;

function tempWorkspace() {
  const workspace = join(tmpdir(), `gslr2-oracle-${process.pid}-${Date.now()}-${Math.random()}`);
  mkdirSync(join(workspace, 'src'), { recursive: true });
  return workspace;
}

function runOracle(workspace) {
  return spawnSync(process.execPath, [ORACLE, '--workspace', workspace], {
    encoding: 'utf8',
  });
}

function writeImplementation(workspace, source) {
  writeFileSync(join(workspace, 'src', 'action-policy-schema.mjs'), source, 'utf8');
}

const validImplementation = String.raw`
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

function visitForbiddenKeys(value, path, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitForbiddenKeys(item, path + '[' + index + ']', errors));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) errors.push('forbidden raw or secret key at ' + path + '.' + key);
    visitForbiddenKeys(child, path + '.' + key, errors);
  }
}

export function validateActionPolicyEnvelope(envelope) {
  const errors = [];
  if (!isRecord(envelope)) {
    return { ok: false, errors: ['envelope must be an object'] };
  }

  visitForbiddenKeys(envelope, 'envelope', errors);

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

test('GSLR-2 private oracle passes a complete recursive validator', () => {
  const workspace = tempWorkspace();
  try {
    writeImplementation(workspace, validImplementation);
    const result = runOracle(workspace);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /gslr2 private oracle passed/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('GSLR-2 private oracle rejects shallow validators', () => {
  const workspace = tempWorkspace();
  try {
    writeImplementation(
      workspace,
      'export function validateActionPolicyEnvelope() { return { ok: true, errors: [] }; }\n',
    );
    const result = runOracle(workspace);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /expected ok=false|pass result returned errors/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
