#!/usr/bin/env node
'use strict';

const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const workspace = process.argv[2] || 'workspace/fscrud-01';
const checkOnly = process.argv.includes('--check-only');
const attemptRoot = process.cwd();
const workspacePath = join(attemptRoot, workspace);
const rawPath = join(workspacePath, 'senior-plan.raw.json');
const sourcePath = join(workspacePath, 'handoff-source.json');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readRaw() {
  if (!existsSync(rawPath)) fail('raw_source_missing:senior-plan.raw.json');
  const text = readFileSync(rawPath, 'utf8').trim();
  if (!text) fail('raw_source_empty');
  return text;
}

function flatten(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(flatten).join('\n');
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, entry]) => `${key}\n${flatten(entry)}`)
      .join('\n');
  }
  return String(value ?? '');
}

function evidenceText(raw) {
  try {
    return flatten(JSON.parse(raw));
  } catch {
    return raw;
  }
}

function requireTerms(text, terms) {
  const lower = text.toLowerCase();
  for (const term of terms) {
    if (!lower.includes(term)) fail(`raw_source_missing_term:${term}`);
  }
}

function scoreTerms(text, terms) {
  const lower = text.toLowerCase();
  return terms.reduce((score, term) => score + (lower.includes(term) ? 1 : 0), 0);
}

function qualityScore(text) {
  const sections = {
    objective: ['field service', 'work order', 'customer', 'asset'],
    constraints: ['protected', 'local-only', 'do not edit', 'deterministic rendered'],
    architecture: ['domain', 'ui', 'server', 'seed'],
    implementation: ['ordered', 'create', 'read', 'edit', 'delete', 'relationship'],
    verification: [
      'check:domain:exports',
      'check:domain:customer',
      'check:domain:assets',
      'check:domain:work-orders',
      'npm test',
    ],
    risk: ['path', 'isolation', 'seed integrity', 'domain behavior', 'schema', 'handoff'],
  };
  const breakdown = Object.fromEntries(
    Object.entries(sections).map(([key, terms]) => [key, scoreTerms(text, terms)]),
  );
  return {
    score: Object.values(breakdown).reduce((sum, value) => sum + value, 0),
    maxScore: Object.values(sections).reduce((sum, terms) => sum + terms.length, 0),
    breakdown,
  };
}

const raw = readRaw();
const evidence = evidenceText(raw);
requireTerms(evidence, ['handoff', 'local', 'deterministic']);
requireTerms(evidence, ['domain', 'ui', 'server']);
requireTerms(evidence, ['objective', 'constraints', 'architecture']);
requireTerms(evidence, ['implementation', 'verification', 'risk']);
requireTerms(evidence, ['senior-plan.raw.json']);

const score = qualityScore(evidence);
if (score.score < 18) {
  fail(`senior_plan_quality_score_too_low:${score.score}/${score.maxScore}`);
}

const canonical = {
  experimentArm: 'r39-pl-quality-scored-senior-plan-source',
  provider: 'local-only',
  claimBoundary:
    'R39 measures whether local model senior-engineering plan intent can pass a deterministic quality scorer while deterministic domain, deterministic UI, deterministic server, and final handoff artifacts are protected or rendered.',
  publicChecks: [
    'npm run check:domain:exports',
    'npm run check:domain:customer',
    'npm run check:domain:assets',
    'npm run check:domain:work-orders',
    'npm test',
  ],
  policyTags: [
    'r39',
    'local-only',
    'quality-scored-senior-plan-source',
    'deterministic-domain-kernel',
    'deterministic-ui-skeleton',
    'deterministic-server-integration',
    'objective-constraints-architecture-implementation-verification-risk',
    `senior-plan-quality-score-${score.score}-of-${score.maxScore}`,
  ],
  modelOwnedFiles: ['senior-plan.raw.json'],
  deterministicRenderedFiles: [
    'handoff-source.json',
    'README.md',
    'run-manifest.json',
    'verification-report.md',
  ],
};

if (!checkOnly) {
  writeFileSync(sourcePath, `${JSON.stringify(canonical, null, 2)}\n`, 'utf8');
}

console.log(
  checkOnly
    ? `r39_senior_plan_raw_source_quality_ok:${score.score}/${score.maxScore}`
    : `r39_senior_plan_source_normalized:${score.score}/${score.maxScore}`,
);
