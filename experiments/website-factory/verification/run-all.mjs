#!/usr/bin/env node
// Run all verification checks and produce a scorecard
import { resolve } from 'node:path';
import { verifyBuild } from './verify-build.mjs';
import { verifyLint } from './verify-lint.mjs';
import { verifyStructure } from './verify-structure.mjs';
import { verifyContent } from './verify-content.mjs';

const projectDir = resolve(process.argv[2] || '.');
const label = process.argv[3] || 'unnamed';

console.log(`\n${'='.repeat(60)}`);
console.log(`  Website Factory Scorecard: ${label}`);
console.log(`  Project: ${projectDir}`);
console.log(`${'='.repeat(60)}\n`);

const checks = [
  verifyBuild(projectDir),
  verifyLint(projectDir),
  verifyStructure(projectDir),
  verifyContent(projectDir),
];

let passed = 0;
let total = checks.length;

for (const check of checks) {
  const icon = check.pass ? 'PASS' : 'FAIL';
  console.log(`  [${icon}] ${check.name.padEnd(12)} ${check.details}`);
  if (check.metrics) {
    console.log(`  ${''.padEnd(16)} Metrics: ${JSON.stringify(check.metrics)}`);
  }
  if (check.sections) {
    const missing = Object.entries(check.sections)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (missing.length > 0) {
      console.log(`  ${''.padEnd(16)} Missing: ${missing.join(', ')}`);
    }
  }
  if (check.pass) passed++;
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`  Score: ${passed}/${total} checks passed`);
console.log(`${'─'.repeat(60)}\n`);

// Output machine-readable JSON
const scorecard = {
  label,
  timestamp: new Date().toISOString(),
  projectDir,
  score: `${passed}/${total}`,
  checks: checks.map((c) => ({ name: c.name, pass: c.pass, details: c.details })),
};

console.log('JSON:', JSON.stringify(scorecard));

process.exit(passed === total ? 0 : 1);
