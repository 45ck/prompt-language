#!/usr/bin/env node
'use strict';

const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const workspace = process.argv[2] || 'workspace/fscrud-01';
const checkOnly = process.argv.includes('--check-only');
const attemptRoot = process.cwd();
const workspacePath = join(attemptRoot, workspace);
const responsePath = join(workspacePath, 'senior-plan.risk-response.txt');
const rawPath = join(workspacePath, 'senior-plan.raw.json');
const sourcePath = join(workspacePath, 'handoff-source.json');

const EXPECTED_RANKING = [
  'guard-path-seed-schema-handoff',
  'expand-editable-product-scope',
  'defer-verification-to-manual-review',
];

const ALIASES = new Map([
  ['guard', 'guard-path-seed-schema-handoff'],
  ['path-guard', 'guard-path-seed-schema-handoff'],
  ['path-seed-schema-handoff', 'guard-path-seed-schema-handoff'],
  ['guard-path-seed-schema-handoff', 'guard-path-seed-schema-handoff'],
  ['expand', 'expand-editable-product-scope'],
  ['editable', 'expand-editable-product-scope'],
  ['editable-product-scope', 'expand-editable-product-scope'],
  ['expand-editable-product-scope', 'expand-editable-product-scope'],
  ['manual', 'defer-verification-to-manual-review'],
  ['manual-review', 'defer-verification-to-manual-review'],
  ['defer-verification-to-manual-review', 'defer-verification-to-manual-review'],
]);

const REQUIRED_TOP_RESPONSE_TERMS = [
  ['path', 'root', 'isolation'],
  ['seed', 'integrity'],
  ['schema', 'repair'],
  ['handoff', 'artifacts'],
  ['deterministic', 'verification'],
  ['protected', 'local'],
];

const SECTION_LIBRARY = {
  objective:
    'objective: choose the senior risk response that best preserves FSCRUD-01 correctness under local inference.',
  constraints:
    'constraints: keep product behavior deterministic and protected while the local model owns one bounded risk-response file.',
  architecture:
    'architecture: domain, UI, server, seed data, and handoff rendering remain deterministic protected inputs.',
  implementation:
    'implementation: prioritize path-root isolation, seed integrity, schema repair, and handoff artifact checks before broad editable scope.',
  verification:
    'verification: deterministic checks, npm tests, public gates, and hidden verification remain the authority.',
  risk: 'risk: wrong risk response would expand local edit scope or defer verification, recreating earlier R34-R36 failure modes.',
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readResponse() {
  if (!existsSync(responsePath)) fail('risk_response_source_missing:senior-plan.risk-response.txt');
  const text = readFileSync(responsePath, 'utf8').trim();
  if (!text) fail('risk_response_source_empty');
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

const responseText = readResponse();
const ranking = parseRanking(responseText);
const mismatches = EXPECTED_RANKING.filter((value, index) => ranking[index] !== value);

if (mismatches.length > 0) {
  const detail = EXPECTED_RANKING.map(
    (expected, index) => `${index + 1}:${ranking[index] || 'missing'}!=${expected}`,
  ).join(',');
  fail(`risk_response_ranking_mismatch:${EXPECTED_RANKING.length - mismatches.length}/3:${detail}`);
}

const missingResponseGroups = REQUIRED_TOP_RESPONSE_TERMS.filter(
  (terms) => !includesTermGroup(responseText, terms),
);
if (missingResponseGroups.length > 0) {
  const detail = missingResponseGroups.map((terms) => terms.join('+')).join(',');
  fail(
    `risk_response_terms_missing:${REQUIRED_TOP_RESPONSE_TERMS.length - missingResponseGroups.length}/6:${detail}`,
  );
}

const seniorPlan = {
  ...SECTION_LIBRARY,
  local: 'local-only bounded risk-response ranking; deterministic renderer owns senior plan prose.',
  deterministic:
    'deterministic risk-response library renders senior-plan.raw.json, handoff-source.json, README.md, run-manifest.json, and verification-report.md.',
  domain: 'domain checks stay protected and executable.',
  UI: 'UI surface stays deterministic and protected.',
  server: 'server integration stays deterministic and protected.',
  handoff: 'handoff artifacts are rendered after risk response passes.',
  modelOwnedFile: 'senior-plan.risk-response.txt',
  renderedSourceFile: 'senior-plan.raw.json',
  riskResponseCriteria: {
    pathRootIsolation: 5,
    seedIntegrity: 5,
    schemaRepair: 4,
    handoffArtifacts: 4,
    deterministicVerification: 4,
    protectedLocalScope: 3,
  },
  selectedRiskResponses: ranking,
  riskResponseEvidence: responseText,
};

const canonical = {
  experimentArm: 'r45-pl-risk-response-senior-plan-source',
  provider: 'local-only',
  claimBoundary:
    'R45 measures whether local inference can choose a bounded senior risk response from prior failure modes while deterministic tooling owns scoring, prose, schema repair, rendering, and verification.',
  publicChecks: [
    'npm run check:domain:exports',
    'npm run check:domain:customer',
    'npm run check:domain:assets',
    'npm run check:domain:work-orders',
    'npm test',
  ],
  policyTags: [
    'r45',
    'local-only',
    'risk-response-senior-plan-source',
    'bounded-risk-response',
    'path-root-isolation',
    'seed-schema-handoff-risk',
    'deterministic-risk-library',
    'deterministic-domain-kernel',
    'deterministic-ui-skeleton',
    'deterministic-server-integration',
    'senior-plan-risk-response-score-9-of-9',
  ],
  modelOwnedFiles: ['senior-plan.risk-response.txt'],
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

console.log(checkOnly ? 'r45_risk_response_ok:9/9' : 'r45_risk_response_normalized:9/9');
