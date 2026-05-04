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

const SECTION_LIBRARY = {
  objective:
    'objective: deliver a field service work order CRUD handoff for customers, assets, and work orders.',
  constraints:
    'constraints: keep deterministic protected product files local-only and do not edit domain, ui, server, seed, package, contract, or check scripts.',
  architecture:
    'architecture: domain owns customer asset work order behavior, ui exposes the CRUD surface, server integrates deterministic routes, and seed data anchors relationships.',
  implementation:
    'implementation: ordered create read edit delete flows preserve customer-to-asset-to-work-order relationship integrity.',
  verification:
    'verification: run check:domain:exports, check:domain:customer, check:domain:assets, check:domain:work-orders, and npm test.',
  risk: 'risk: guard path isolation, seed integrity, domain behavior, schema repair, and deterministic handoff rendering.',
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
  return value
    .trim()
    .toLowerCase()
    .replace(/[`"',]/gu, '')
    .replace(/\s+/gu, '-');
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
  return decisions;
}

const decisions = parseDecisions(readDecisions());
const mismatches = Object.entries(EXPECTED).filter(([key, value]) => decisions[key] !== value);

if (mismatches.length > 0) {
  const detail = mismatches
    .map(([key, expected]) => `${key}:${decisions[key] || 'missing'}!=${expected}`)
    .join(',');
  fail(`decision_matrix_mismatch:${Object.keys(EXPECTED).length - mismatches.length}/6:${detail}`);
}

const seniorPlan = {
  ...SECTION_LIBRARY,
  local: 'local-only bounded decision matrix; deterministic renderer owns senior plan prose.',
  deterministic:
    'deterministic decision library renders senior-plan.raw.json, handoff-source.json, README.md, run-manifest.json, and verification-report.md.',
  domain: 'domain checks stay protected and executable.',
  UI: 'UI surface stays deterministic and protected.',
  server: 'server integration stays deterministic and protected.',
  handoff: 'handoff artifacts are rendered after the decision matrix passes.',
  modelOwnedFile: 'senior-plan.decisions.txt',
  renderedSourceFile: 'senior-plan.raw.json',
  selectedDecisions: decisions,
};

const canonical = {
  experimentArm: 'r41-pl-decision-matrix-senior-plan-source',
  provider: 'local-only',
  claimBoundary:
    'R41 measures whether local inference can select task-appropriate senior-plan options from a bounded decision matrix while deterministic tooling owns prose, schema repair, rendering, and verification.',
  publicChecks: [
    'npm run check:domain:exports',
    'npm run check:domain:customer',
    'npm run check:domain:assets',
    'npm run check:domain:work-orders',
    'npm test',
  ],
  policyTags: [
    'r41',
    'local-only',
    'decision-matrix-senior-plan-source',
    'bounded-option-selection',
    'deterministic-decision-library',
    'deterministic-domain-kernel',
    'deterministic-ui-skeleton',
    'deterministic-server-integration',
    'senior-plan-decision-score-6-of-6',
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

console.log(checkOnly ? 'r41_decision_matrix_ok:6/6' : 'r41_decision_matrix_normalized:6/6');
