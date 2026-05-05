#!/usr/bin/env node
'use strict';

const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const workspace = process.argv[2] || 'workspace/fscrud-01';
const checkOnly = process.argv.includes('--check-only');
const attemptRoot = process.cwd();
const workspacePath = join(attemptRoot, workspace);
const rankingPath = join(workspacePath, 'senior-plan.ranking.txt');
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
  ['best', 'bravo-protected-crud-kernel'],
  ['charlie', 'charlie-editable-manual-plan'],
  ['c', 'charlie-editable-manual-plan'],
  ['editable-manual-plan', 'charlie-editable-manual-plan'],
  ['alpha', 'alpha-frontend-notes-plan'],
  ['a', 'alpha-frontend-notes-plan'],
  ['frontend-notes-plan', 'alpha-frontend-notes-plan'],
]);

const SECTION_LIBRARY = {
  objective:
    'objective: rank candidate senior-plan strategies for FSCRUD-01 field service work orders.',
  constraints:
    'constraints: prefer protected local-only deterministic product files over editable product files.',
  architecture:
    'architecture: prefer the candidate covering domain, UI, server, seed data, and executable checks.',
  implementation:
    'implementation: prefer ordered CRUD relationships for customers, assets, and work orders.',
  verification: 'verification: prefer domain checks and npm tests over manual inspection.',
  risk: 'risk: prefer explicit path isolation, seed integrity, schema repair, and handoff coverage.',
};

function fail(message) {
  console.error(message);
  process.exit(1);
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

function readRanking() {
  if (!existsSync(rankingPath)) fail('ranking_source_missing:senior-plan.ranking.txt');
  const text = readFileSync(rankingPath, 'utf8').trim();
  if (!text) fail('ranking_source_empty');
  return text;
}

function parseRanking(text) {
  const tokens = [];
  for (const rawLine of text.split(/[\r\n,;>]+/u)) {
    const token = normalizeToken(rawLine);
    if (!token) continue;
    const known = ALIASES.get(token) || token;
    if (EXPECTED_RANKING.includes(known) && !tokens.includes(known)) tokens.push(known);
  }
  return tokens;
}

const ranking = parseRanking(readRanking());
const mismatches = EXPECTED_RANKING.filter((value, index) => ranking[index] !== value);

if (mismatches.length > 0) {
  const detail = EXPECTED_RANKING.map(
    (expected, index) => `${index + 1}:${ranking[index] || 'missing'}!=${expected}`,
  ).join(',');
  fail(`weighted_ranking_mismatch:${EXPECTED_RANKING.length - mismatches.length}/3:${detail}`);
}

const seniorPlan = {
  ...SECTION_LIBRARY,
  local: 'local-only weighted criteria ranking; deterministic renderer owns senior plan prose.',
  deterministic:
    'deterministic weighted ranking library renders senior-plan.raw.json, handoff-source.json, README.md, run-manifest.json, and verification-report.md.',
  domain: 'domain checks stay protected and executable.',
  UI: 'UI surface stays deterministic and protected.',
  server: 'server integration stays deterministic and protected.',
  handoff: 'handoff artifacts are rendered after weighted ranking passes.',
  modelOwnedFile: 'senior-plan.ranking.txt',
  renderedSourceFile: 'senior-plan.raw.json',
  weightedCriteria: {
    protectedLocalOnly: 5,
    productCoverage: 5,
    orderedCrudRelationships: 4,
    executableVerification: 4,
    pathSeedSchemaHandoffRisk: 3,
  },
  selectedRanking: ranking,
};

const canonical = {
  experimentArm: 'r43-pl-weighted-ranking-senior-plan-source',
  provider: 'local-only',
  claimBoundary:
    'R43 measures whether local inference can rank candidate senior-plan strategies by weighted criteria while deterministic tooling owns scoring, prose, schema repair, rendering, and verification.',
  publicChecks: [
    'npm run check:domain:exports',
    'npm run check:domain:customer',
    'npm run check:domain:assets',
    'npm run check:domain:work-orders',
    'npm test',
  ],
  policyTags: [
    'r43',
    'local-only',
    'weighted-ranking-senior-plan-source',
    'ranked-criteria-selection',
    'deterministic-ranking-library',
    'deterministic-domain-kernel',
    'deterministic-ui-skeleton',
    'deterministic-server-integration',
    'senior-plan-weighted-ranking-score-3-of-3',
  ],
  modelOwnedFiles: ['senior-plan.ranking.txt'],
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

console.log(checkOnly ? 'r43_weighted_ranking_ok:3/3' : 'r43_weighted_ranking_normalized:3/3');
