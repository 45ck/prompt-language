#!/usr/bin/env node
'use strict';

const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const workspace = process.argv[2] || 'workspace/fscrud-01';
const attemptRoot = process.cwd();
const decisionsPath = join(attemptRoot, workspace, 'senior-plan.decisions.txt');
const rawPath = join(attemptRoot, workspace, 'senior-plan.raw.json');
const sourcePath = join(attemptRoot, workspace, 'handoff-source.json');

function fail(message) {
  console.error(message);
  process.exit(1);
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

function parseJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    fail(`${label}_invalid_json`);
  }
}

if (!existsSync(decisionsPath)) fail('decision_source_missing:senior-plan.decisions.txt');
if (!existsSync(rawPath)) fail('raw_source_missing:senior-plan.raw.json');
if (!existsSync(sourcePath)) fail('source_missing:handoff-source.json');

const raw = parseJson(rawPath, 'raw_source');
const source = parseJson(sourcePath, 'source');

const experimentArm = requireString(source.experimentArm, 'experimentArm').toLowerCase();
const provider = requireString(source.provider, 'provider').toLowerCase();
const claimBoundary = requireString(source.claimBoundary, 'claimBoundary').toLowerCase();

if (experimentArm !== 'r42-pl-rubric-decision-senior-plan-source') {
  fail(`source_wrong_experiment_arm:${source.experimentArm}`);
}
if (provider !== 'local-only') fail(`source_wrong_provider:${source.provider}`);
for (const term of ['rubric', 'decision', 'deterministic', 'schema', 'verification']) {
  if (!claimBoundary.includes(term)) fail(`source_claim_boundary_missing:${term}`);
}

for (const key of [
  'objective',
  'constraints',
  'architecture',
  'implementation',
  'verification',
  'risk',
]) {
  const value = requireString(raw[key], `raw.${key}`).toLowerCase();
  if (!value.includes(key)) fail(`raw_section_missing_label:${key}`);
}

requireArray(source.publicChecks, 'publicChecks', [
  'check:domain:exports',
  'check:domain:customer',
  'check:domain:assets',
  'check:domain:work-orders',
  'npm test',
]);
requireArray(source.policyTags, 'policyTags', [
  'r42',
  'local-only',
  'rubric-decision-senior-plan-source',
  'rubric-described-options',
  'senior-plan-rubric-decision-score-6-of-6',
]);
requireArray(source.modelOwnedFiles, 'modelOwnedFiles', ['senior-plan.decisions.txt']);
requireArray(source.deterministicRenderedFiles, 'deterministicRenderedFiles', [
  'senior-plan.raw.json',
  'handoff-source.json',
  'readme.md',
]);

console.log('r42_rubric_decision_source_ok');
