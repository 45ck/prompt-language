#!/usr/bin/env node
'use strict';

const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const workspace = process.argv[2] || 'workspace/fscrud-01';
const checkOnly = process.argv.includes('--check-only');
const attemptRoot = process.cwd();
const workspacePath = join(attemptRoot, workspace);
const decisionsPath = join(workspacePath, 'senior-plan.decisions.txt');
const rawPath = join(workspacePath, 'senior-plan.raw.json');
const sourcePath = join(workspacePath, 'handoff-source.json');

const EXPECTED = {
  objective: 'field-service-work-orders',
  constraints: 'protected-local-only',
  architecture: 'domain-ui-server-seed',
  implementation: 'ordered-crud-relationships',
  verification: 'domain-checks-and-tests',
  risk: 'path-seed-schema-handoff',
};

const ORDERED_KEYS = [
  'objective',
  'constraints',
  'architecture',
  'implementation',
  'verification',
  'risk',
];

const VALUE_ALIASES = new Map([
  ['field-service-crud', 'field-service-work-orders'],
  ['field-service-work-orders-crud', 'field-service-work-orders'],
]);

const SECTION_LIBRARY = {
  objective:
    'objective: choose field service work orders because FSCRUD-01 manages customers, assets, and work orders.',
  constraints:
    'constraints: choose protected local-only work because deterministic product files must not be edited by the model.',
  architecture:
    'architecture: choose domain-ui-server-seed because the product boundary spans executable domain behavior, browser surface, server routes, and seed integrity.',
  implementation:
    'implementation: choose ordered CRUD relationships because customers, assets, and work orders require relationship-preserving create read edit delete flows.',
  verification:
    'verification: choose domain checks and tests because public checks and npm test are the executable gates.',
  risk: 'risk: choose path, seed, schema, and handoff because prior local runs failed on path isolation, seed integrity, schema fidelity, and artifact handoff.',
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readDecisions() {
  if (!existsSync(decisionsPath)) fail('decision_source_missing:senior-plan.decisions.txt');
  const text = readFileSync(decisionsPath, 'utf8').trim();
  if (!text) fail('decision_source_empty');
  return text;
}

function normalizeToken(value) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[`"',]/gu, '')
    .replace(/\s+/gu, '-');
  return VALUE_ALIASES.get(normalized) || normalized;
}

function parseDecisions(text) {
  const decisions = {};
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = /^(?<key>[a-z]+)\s*[:=]\s*(?<value>[a-z0-9 -]+)$/iu.exec(trimmed);
    if (!match?.groups) continue;
    decisions[normalizeToken(match.groups.key)] = normalizeToken(match.groups.value);
  }
  if (Object.keys(decisions).length === 0) {
    const orderedValues = text
      .split(/[,\r\n]+/u)
      .map((value) => normalizeToken(value))
      .filter(Boolean);
    for (const [index, key] of ORDERED_KEYS.entries()) {
      if (orderedValues[index]) decisions[key] = orderedValues[index];
    }
  }
  return decisions;
}

const decisions = parseDecisions(readDecisions());
const mismatches = Object.entries(EXPECTED).filter(([key, value]) => decisions[key] !== value);

if (mismatches.length > 0) {
  const detail = mismatches
    .map(([key, expected]) => `${key}:${decisions[key] || 'missing'}!=${expected}`)
    .join(',');
  fail(`rubric_decision_mismatch:${Object.keys(EXPECTED).length - mismatches.length}/6:${detail}`);
}

const seniorPlan = {
  ...SECTION_LIBRARY,
  local: 'local-only rubric decision matrix; deterministic renderer owns senior plan prose.',
  deterministic:
    'deterministic rubric decision library renders senior-plan.raw.json, handoff-source.json, README.md, run-manifest.json, and verification-report.md.',
  domain: 'domain checks stay protected and executable.',
  UI: 'UI surface stays deterministic and protected.',
  server: 'server integration stays deterministic and protected.',
  handoff: 'handoff artifacts are rendered after rubric decision selection passes.',
  modelOwnedFile: 'senior-plan.decisions.txt',
  renderedSourceFile: 'senior-plan.raw.json',
  selectedDecisions: decisions,
};

const canonical = {
  experimentArm: 'r42-pl-rubric-decision-senior-plan-source',
  provider: 'local-only',
  claimBoundary:
    'R42 measures whether local inference can select task-appropriate options from a rubric-described decision matrix while deterministic tooling owns scoring, prose, schema repair, rendering, and verification.',
  publicChecks: [
    'npm run check:domain:exports',
    'npm run check:domain:customer',
    'npm run check:domain:assets',
    'npm run check:domain:work-orders',
    'npm test',
  ],
  policyTags: [
    'r42',
    'local-only',
    'rubric-decision-senior-plan-source',
    'bounded-option-selection',
    'rubric-described-options',
    'deterministic-decision-library',
    'deterministic-domain-kernel',
    'deterministic-ui-skeleton',
    'deterministic-server-integration',
    'senior-plan-rubric-decision-score-6-of-6',
  ],
  modelOwnedFiles: ['senior-plan.decisions.txt'],
  deterministicRenderedFiles: [
    'senior-plan.raw.json',
    'handoff-source.json',
    'README.md',
    'run-manifest.json',
    'verification-report.md',
  ],
};

if (!checkOnly) {
  writeFileSync(rawPath, `${JSON.stringify(seniorPlan, null, 2)}\n`, 'utf8');
  writeFileSync(sourcePath, `${JSON.stringify(canonical, null, 2)}\n`, 'utf8');
}

console.log(checkOnly ? 'r42_rubric_decision_ok:6/6' : 'r42_rubric_decision_normalized:6/6');
