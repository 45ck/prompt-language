#!/usr/bin/env node
'use strict';

const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const workspace = process.argv[2] || 'workspace/fscrud-01';
const artifact = process.argv[3];
const attemptRoot = process.cwd();

function fail(message) {
  console.error(message);
  process.exit(1);
}

function read(relativePath) {
  const fullPath = join(attemptRoot, workspace, relativePath);
  if (!existsSync(fullPath)) fail(`missing_${artifact}`);
  return readFileSync(fullPath, 'utf8');
}

function requireTerms(text, terms, prefix) {
  const lower = text.toLowerCase();
  for (const term of terms) {
    if (!lower.includes(term)) fail(`${prefix}_missing:${term}`);
  }
}

if (artifact === 'readme') {
  requireTerms(
    read('README.md'),
    ['npm test', 'npm start', 'deterministic', 'handoff', 'r35', 'local-only'],
    'readme',
  );
  console.log('r35_readme_ok');
} else if (artifact === 'manifest') {
  const raw = read('run-manifest.json');
  try {
    JSON.parse(raw);
  } catch {
    fail('manifest_invalid_json');
  }
  requireTerms(
    raw,
    [
      'r35-pl-handoff-artifacts',
      'local-only',
      'deterministic-domain-kernel',
      'deterministic-ui-skeleton',
      'deterministic-server-integration',
      'local-generated-handoff-artifacts',
      'protectedartifacts',
      'modelownedfiles',
      'claimboundary',
    ],
    'manifest',
  );
  console.log('r35_manifest_ok');
} else if (artifact === 'report') {
  requireTerms(
    read('verification-report.md'),
    [
      'check:domain:exports',
      'check:domain:customer',
      'check:domain:assets',
      'check:domain:work-orders',
      'npm test',
      'hidden verifier',
      'r35',
      'handoff',
    ],
    'report',
  );
  console.log('r35_report_ok');
} else {
  fail('usage: verify-r35-artifact.cjs <workspace> <readme|manifest|report>');
}
