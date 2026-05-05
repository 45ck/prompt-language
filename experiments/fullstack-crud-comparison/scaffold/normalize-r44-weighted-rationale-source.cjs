#!/usr/bin/env node
'use strict';

const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const workspace = process.argv[2] || 'workspace/fscrud-01';
const checkOnly = process.argv.includes('--check-only');
const attemptRoot = process.cwd();
const workspacePath = join(attemptRoot, workspace);
const rationalePath = join(workspacePath, 'senior-plan.rationale.txt');
const rawPath = join(workspacePath, 'senior-plan.raw.json');
const sourcePath = join(workspacePath, 'handoff-source.json');

const EXPECTED_RANKING = [
  'bravo-protected-crud-kernel',
  'charlie-editable-manual-plan',
  'alpha-frontend-notes-plan',
];

const ALIASES = new Map([
  ['bravo', 'bravo-protected-crud-kernel'],
  ['b', 'bravo-protected-crud-kernel'],
  ['protected-crud-kernel', 'bravo-protected-crud-kernel'],
  ['charlie', 'charlie-editable-manual-plan'],
  ['c', 'charlie-editable-manual-plan'],
  ['editable-manual-plan', 'charlie-editable-manual-plan'],
  ['alpha', 'alpha-frontend-notes-plan'],
  ['a', 'alpha-frontend-notes-plan'],
  ['frontend-notes-plan', 'alpha-frontend-notes-plan'],
]);

const REQUIRED_TOP_RATIONALE_TERMS = [
  ['protected', 'local'],
  ['domain', 'ui', 'server', 'seed'],
  ['ordered', 'crud'],
  ['domain', 'checks', 'tests'],
  ['path', 'seed', 'schema', 'handoff'],
];

const SECTION_LIBRARY = {
  objective:
    'objective: rank candidate senior-plan strategies and justify the top choice for FSCRUD-01 field service work orders.',
  constraints:
    'constraints: top rationale preserves protected local-only deterministic product files.',
  architecture:
    'architecture: top rationale covers domain, UI, server, seed data, and executable checks.',
  implementation:
    'implementation: top rationale prefers ordered CRUD relationships for customers, assets, and work orders.',
  verification:
    'verification: top rationale names domain checks, npm tests, and deterministic verification.',
  risk: 'risk: top rationale covers path isolation, seed integrity, schema repair, and handoff risk.',
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readRationale() {
  if (!existsSync(rationalePath)) fail('rationale_source_missing:senior-plan.rationale.txt');
  const text = readFileSync(rationalePath, 'utf8').trim();
  if (!text) fail('rationale_source_empty');
  return text;
}

function normalizeToken(value) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[`"']/gu, '')
    .replace(/^[#*\-\s]+/u, '')
    .replace(/^(rank|choice|option|first|second|third|1|2|3)\s*[:=.)-]\s*/u, '')
    .replace(/\s+/gu, '-')
    .replace(/[^a-z0-9-]/gu, '');
  return ALIASES.get(normalized) || normalized;
}

function parseRanking(text) {
  const tokens = [];
  for (const rawLine of text.split(/[\r\n,;>]+/u)) {
    const beforeReason = rawLine.split(/\b(?:because|reason|rationale)\b/iu)[0] || rawLine;
    const token = normalizeToken(beforeReason);
    if (!token) continue;
    const known = ALIASES.get(token) || token;
    if (EXPECTED_RANKING.includes(known) && !tokens.includes(known)) tokens.push(known);
  }
  return tokens;
}

function includesTermGroup(text, terms) {
  const lower = text.toLowerCase();
  return terms.every((term) => lower.includes(term));
}

const rationaleText = readRationale();
const ranking = parseRanking(rationaleText);
const mismatches = EXPECTED_RANKING.filter((value, index) => ranking[index] !== value);

if (mismatches.length > 0) {
  const detail = EXPECTED_RANKING.map(
    (expected, index) => `${index + 1}:${ranking[index] || 'missing'}!=${expected}`,
  ).join(',');
  fail(
    `weighted_rationale_ranking_mismatch:${EXPECTED_RANKING.length - mismatches.length}/3:${detail}`,
  );
}

const missingRationaleGroups = REQUIRED_TOP_RATIONALE_TERMS.filter(
  (terms) => !includesTermGroup(rationaleText, terms),
);
if (missingRationaleGroups.length > 0) {
  const detail = missingRationaleGroups.map((terms) => terms.join('+')).join(',');
  fail(
    `weighted_rationale_terms_missing:${REQUIRED_TOP_RATIONALE_TERMS.length - missingRationaleGroups.length}/5:${detail}`,
  );
}

const seniorPlan = {
  ...SECTION_LIBRARY,
  local:
    'local-only weighted ranking plus bounded rationale; deterministic renderer owns senior plan prose.',
  deterministic:
    'deterministic rationale library renders senior-plan.raw.json, handoff-source.json, README.md, run-manifest.json, and verification-report.md.',
  domain: 'domain checks stay protected and executable.',
  UI: 'UI surface stays deterministic and protected.',
  server: 'server integration stays deterministic and protected.',
  handoff: 'handoff artifacts are rendered after weighted rationale passes.',
  modelOwnedFile: 'senior-plan.rationale.txt',
  renderedSourceFile: 'senior-plan.raw.json',
  weightedCriteria: {
    protectedLocalOnly: 5,
    productCoverage: 5,
    orderedCrudRelationships: 4,
    executableVerification: 4,
    pathSeedSchemaHandoffRisk: 3,
  },
  selectedRanking: ranking,
  rationaleEvidence: rationaleText,
};

const canonical = {
  experimentArm: 'r44-pl-weighted-rationale-senior-plan-source',
  provider: 'local-only',
  claimBoundary:
    'R44 measures whether local inference can rank candidate senior-plan strategies by weighted criteria and attach a bounded criteria-grounded rationale while deterministic tooling owns scoring, prose, schema repair, rendering, and verification.',
  publicChecks: [
    'npm run check:domain:exports',
    'npm run check:domain:customer',
    'npm run check:domain:assets',
    'npm run check:domain:work-orders',
    'npm test',
  ],
  policyTags: [
    'r44',
    'local-only',
    'weighted-rationale-senior-plan-source',
    'ranked-criteria-selection',
    'bounded-rationale',
    'deterministic-rationale-library',
    'deterministic-domain-kernel',
    'deterministic-ui-skeleton',
    'deterministic-server-integration',
    'senior-plan-weighted-rationale-score-8-of-8',
  ],
  modelOwnedFiles: ['senior-plan.rationale.txt'],
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

console.log(checkOnly ? 'r44_weighted_rationale_ok:8/8' : 'r44_weighted_rationale_normalized:8/8');
