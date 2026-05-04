#!/usr/bin/env node
'use strict';

const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const workspace = process.argv[2] || 'workspace/fscrud-01';
const attemptRoot = process.cwd();
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

if (!existsSync(sourcePath)) fail('source_missing:handoff-source.json');

let source;
try {
  source = JSON.parse(readFileSync(sourcePath, 'utf8'));
} catch {
  fail('source_invalid_json');
}

const experimentArm = requireString(source.experimentArm, 'experimentArm').toLowerCase();
const provider = requireString(source.provider, 'provider').toLowerCase();
const claimBoundary = requireString(source.claimBoundary, 'claimBoundary').toLowerCase();

if (experimentArm !== 'r36-pl-structured-handoff-source') {
  fail(`source_wrong_experiment_arm:${source.experimentArm}`);
}
if (provider !== 'local-only') fail(`source_wrong_provider:${source.provider}`);
for (const term of ['domain', 'ui', 'server', 'deterministic', 'handoff']) {
  if (!claimBoundary.includes(term)) fail(`source_claim_boundary_missing:${term}`);
}

requireArray(source.publicChecks, 'publicChecks', [
  'check:domain:exports',
  'check:domain:customer',
  'check:domain:assets',
  'check:domain:work-orders',
  'npm test',
]);
requireArray(source.policyTags, 'policyTags', [
  'r36',
  'local-only',
  'structured-handoff-source',
  'deterministic-domain-kernel',
  'deterministic-ui-skeleton',
  'deterministic-server-integration',
]);
requireArray(source.modelOwnedFiles, 'modelOwnedFiles', ['handoff-source.json']);

console.log('r36_handoff_source_ok');
