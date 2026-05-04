#!/usr/bin/env node
'use strict';

const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const workspace = process.argv[2] || 'workspace/fscrud-01';
const checkOnly = process.argv.includes('--check-only');
const attemptRoot = process.cwd();
const workspacePath = join(attemptRoot, workspace);
const selectionPath = join(workspacePath, 'senior-plan.selection.txt');
const rawPath = join(workspacePath, 'senior-plan.raw.json');
const sourcePath = join(workspacePath, 'handoff-source.json');

const SECTION_LIBRARY = {
  objective:
    'objective: field service work order workflow for customers and assets; preserve explicit customer, asset, and work order vocabulary.',
  constraints:
    'constraints: protected deterministic product files are local-only; do not edit domain, ui, server, seed, package, contract, or check scripts; final handoff files are deterministic rendered artifacts.',
  architecture:
    'architecture: domain owns customer asset work order rules, ui exposes the CRUD surface, server integrates deterministic routes, and seed data preserves relationships.',
  implementation:
    'implementation: ordered create read edit delete behavior must preserve customer-asset-work-order relationship integrity and avoid nested path writes.',
  verification:
    'verification: run check:domain:exports, check:domain:customer, check:domain:assets, check:domain:work-orders, and npm test before public handoff.',
  risk: 'risk: path isolation, seed integrity, domain behavior, schema repair, and handoff rendering are the core failure modes to guard.',
};

const REQUIRED_SECTIONS = Object.keys(SECTION_LIBRARY);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readSelection() {
  if (!existsSync(selectionPath)) fail('selection_source_missing:senior-plan.selection.txt');
  const text = readFileSync(selectionPath, 'utf8').trim().toLowerCase();
  if (!text) fail('selection_source_empty');
  return text;
}

function parseSelections(text) {
  const tokens = new Set(
    text
      .split(/[^a-z-]+/u)
      .map((token) => token.trim())
      .filter(Boolean),
  );
  return REQUIRED_SECTIONS.filter((section) => tokens.has(section));
}

function scoreSelections(selections) {
  const selected = new Set(selections);
  return REQUIRED_SECTIONS.reduce((score, section) => score + (selected.has(section) ? 1 : 0), 0);
}

const selectionText = readSelection();
const selections = parseSelections(selectionText);
const score = scoreSelections(selections);

if (score < REQUIRED_SECTIONS.length) {
  const missing = REQUIRED_SECTIONS.filter((section) => !selections.includes(section));
  fail(`section_selection_incomplete:${score}/${REQUIRED_SECTIONS.length}:${missing.join(',')}`);
}

const seniorPlan = {
  objective: SECTION_LIBRARY.objective,
  constraints: SECTION_LIBRARY.constraints,
  architecture: SECTION_LIBRARY.architecture,
  implementation: SECTION_LIBRARY.implementation,
  verification: SECTION_LIBRARY.verification,
  risk: SECTION_LIBRARY.risk,
  local: 'local-only bounded section selection; deterministic renderer owns rich senior plan text.',
  deterministic:
    'deterministic section library renders senior-plan.raw.json, handoff-source.json, README.md, run-manifest.json, and verification-report.md.',
  domain: 'domain checks stay protected and executable.',
  UI: 'UI surface stays deterministic and protected.',
  server: 'server integration stays deterministic and protected.',
  handoff: 'handoff artifacts are rendered after section selection passes.',
  modelOwnedFile: 'senior-plan.selection.txt',
  renderedSourceFile: 'senior-plan.raw.json',
};

const canonical = {
  experimentArm: 'r40-pl-section-selected-senior-plan-source',
  provider: 'local-only',
  claimBoundary:
    'R40 measures whether local inference can make bounded senior-plan section selections while deterministic prompt-language tooling owns section prose, schema repair, and final handoff rendering.',
  publicChecks: [
    'npm run check:domain:exports',
    'npm run check:domain:customer',
    'npm run check:domain:assets',
    'npm run check:domain:work-orders',
    'npm test',
  ],
  policyTags: [
    'r40',
    'local-only',
    'section-selected-senior-plan-source',
    'deterministic-section-library',
    'deterministic-domain-kernel',
    'deterministic-ui-skeleton',
    'deterministic-server-integration',
    `senior-plan-section-score-${score}-of-${REQUIRED_SECTIONS.length}`,
  ],
  modelOwnedFiles: ['senior-plan.selection.txt'],
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

console.log(
  checkOnly
    ? `r40_section_selection_ok:${score}/${REQUIRED_SECTIONS.length}`
    : `r40_section_selection_normalized:${score}/${REQUIRED_SECTIONS.length}`,
);
