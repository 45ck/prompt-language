#!/usr/bin/env node
'use strict';

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const workspace = process.argv[2] || 'workspace/fscrud-01';
const attemptRoot = process.cwd();
const workspacePath = join(attemptRoot, workspace);
const sourcePath = join(workspacePath, 'handoff-source.json');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseSource() {
  if (!existsSync(sourcePath)) fail('source_missing:handoff-source.json');
  try {
    return JSON.parse(readFileSync(sourcePath, 'utf8'));
  } catch {
    fail('source_invalid_json');
  }
}

function asArray(value) {
  return Array.isArray(value) ? value.map(String) : [];
}

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

const source = parseSource();
mkdirSync(workspacePath, { recursive: true });

const publicChecks = asArray(source.publicChecks);
const policyTags = asArray(source.policyTags);
const claimBoundary =
  asString(source.claimBoundary) ||
  'R36 measures structured local handoff source generation while domain, UI, and server are deterministic protected inputs.';

writeFileSync(
  join(workspacePath, 'README.md'),
  [
    '# FSCRUD-01 R36 Structured Handoff',
    '',
    `Experiment arm: ${asString(source.experimentArm) || 'r36-pl-structured-handoff-source'}`,
    `Provider: ${asString(source.provider) || 'local-only'}`,
    '',
    '## Run',
    '',
    '- npm start',
    '',
    '## Verify',
    '',
    '- npm test',
    '',
    '## Deterministic Protected Artifacts',
    '',
    '- src/domain.js',
    '- src/server.js',
    '- public/index.html',
    '- package.json, contracts, seed data, and domain contract tests',
    '',
    '## Claim Boundary',
    '',
    claimBoundary,
    '',
    '## Handoff',
    '',
    'The local model owns handoff-source.json. README.md, run-manifest.json, and verification-report.md are deterministically rendered from that structured handoff source.',
    '',
  ].join('\n'),
  'utf8',
);

writeFileSync(
  join(workspacePath, 'run-manifest.json'),
  `${JSON.stringify(
    {
      experimentArm: asString(source.experimentArm) || 'r36-pl-structured-handoff-source',
      provider: asString(source.provider) || 'local-only',
      policyTags,
      protectedArtifacts: [
        'deterministic-domain-kernel',
        'deterministic-ui-skeleton',
        'deterministic-server-integration',
      ],
      modelOwnedFiles: ['handoff-source.json'],
      deterministicRenderedFiles: ['README.md', 'run-manifest.json', 'verification-report.md'],
      claimBoundary,
      r35CompatibilityTerms: ['r35-pl-handoff-artifacts', 'local-generated-handoff-artifacts'],
    },
    null,
    2,
  )}\n`,
  'utf8',
);

writeFileSync(
  join(workspacePath, 'verification-report.md'),
  [
    '# R36 Verification Report',
    '',
    `Arm: ${asString(source.experimentArm) || 'r36-pl-structured-handoff-source'}`,
    'Compatibility label: R35 handoff artifact public gate',
    'Provider: local-only',
    '',
    '## Public Checks',
    '',
    ...publicChecks.map((check) => `- ${check}`),
    '',
    '## Hidden Verifier',
    '',
    'The hidden verifier runs only after the local-only flow and checks protected deterministic domain, UI, server, seed, and handoff artifacts.',
    '',
    '## Handoff',
    '',
    'handoff-source.json is model-owned. README.md, run-manifest.json, and verification-report.md are deterministic projections from the structured source.',
    '',
  ].join('\n'),
  'utf8',
);

console.log('r36_handoff_artifacts_written');
