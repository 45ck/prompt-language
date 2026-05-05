#!/usr/bin/env node
'use strict';

const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const workspace = process.argv[2] || 'workspace/fscrud-01';
const attemptRoot = process.cwd();
const rankingPath = join(attemptRoot, workspace, 'senior-plan.ranking.txt');
const rawPath = join(attemptRoot, workspace, 'senior-plan.raw.json');
const sourcePath = join(attemptRoot, workspace, 'handoff-source.json');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    fail(`${label}_invalid_json`);
  }
}

function requireString(value, key) {
  if (typeof value !== 'string' || value.trim() === '') fail(`source_missing_string:${key}`);
  return value;
}

function requireArray(value, key, terms) {
  if (!Array.isArray(value)) fail(`source_missing_array:${key}`);
  const joined = value.join('\n').toLowerCase();
  for (const term of terms) {
    if (!joined.includes(term)) fail(`source_${key}_missing:${term}`);
  }
}

if (!existsSync(rankingPath)) fail('ranking_source_missing:senior-plan.ranking.txt');
if (!existsSync(rawPath)) fail('raw_source_missing:senior-plan.raw.json');
if (!existsSync(sourcePath)) fail('source_missing:handoff-source.json');

const raw = parseJson(rawPath, 'raw_source');
const source = parseJson(sourcePath, 'source');

if (
  requireString(source.experimentArm, 'experimentArm') !==
  'r43-pl-weighted-ranking-senior-plan-source'
) {
  fail(`source_wrong_experiment_arm:${source.experimentArm}`);
}
if (requireString(source.provider, 'provider') !== 'local-only') {
  fail(`source_wrong_provider:${source.provider}`);
}

const claimBoundary = requireString(source.claimBoundary, 'claimBoundary').toLowerCase();
for (const term of ['rank', 'weighted', 'criteria', 'deterministic', 'verification']) {
  if (!claimBoundary.includes(term)) fail(`source_claim_boundary_missing:${term}`);
}

requireArray(raw.selectedRanking, 'selectedRanking', [
  'bravo-protected-crud-kernel',
  'charlie-editable-manual-plan',
  'alpha-frontend-notes-plan',
]);
requireArray(source.publicChecks, 'publicChecks', [
  'check:domain:exports',
  'check:domain:customer',
  'check:domain:assets',
  'check:domain:work-orders',
  'npm test',
]);
requireArray(source.policyTags, 'policyTags', [
  'r43',
  'local-only',
  'weighted-ranking-senior-plan-source',
  'ranked-criteria-selection',
  'senior-plan-weighted-ranking-score-3-of-3',
]);
requireArray(source.modelOwnedFiles, 'modelOwnedFiles', ['senior-plan.ranking.txt']);
requireArray(source.deterministicRenderedFiles, 'deterministicRenderedFiles', [
  'senior-plan.raw.json',
  'handoff-source.json',
  'readme.md',
]);

console.log('r43_weighted_ranking_source_ok');
