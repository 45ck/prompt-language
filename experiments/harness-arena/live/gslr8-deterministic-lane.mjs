#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const HOOK_SOLUTION = String.raw`
export function matchesAnyEvidenceTextPattern(value, patterns) {
  return (
    typeof value === 'string' &&
    Array.isArray(patterns) &&
    patterns.some((pattern) => pattern instanceof RegExp && pattern.test(value))
  );
}

export function isRelativeArtifactReference(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (value.includes('?') || value.includes('#')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return false;
  if (value.startsWith('/') || value.startsWith('\\')) return false;
  return !value.split(/[\\/]+/).includes('..');
}
`;

function parseArgs(argv) {
  const options = { arm: null, step: null, workspace: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--workspace') {
      options.workspace = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === '--arm') {
      options.arm = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === '--step') {
      options.step = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  if (!options.workspace) throw new Error('--workspace is required');
  if (!options.arm) throw new Error('--arm is required');
  if (!options.step) throw new Error('--step is required');
  return options;
}

function writeSolution(workspace) {
  const target = join(workspace, 'src', 'route-predicate-hooks.mjs');
  if (!existsSync(target)) throw new Error('missing src/route-predicate-hooks.mjs');
  writeFileSync(target, `${HOOK_SOLUTION.trim()}\n`, 'utf8');
}

function runPublicGate(workspace) {
  const result = spawnSync(process.execPath, ['test/public-gate.mjs'], {
    cwd: workspace,
    encoding: 'utf8',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function writeRouteDecision(workspace, { arm, step }) {
  const policyDir = join(workspace, 'policy');
  mkdirSync(policyDir, { recursive: true });
  writeFileSync(
    join(policyDir, 'route-decision.json'),
    `${JSON.stringify(
      {
        decision: 'local-screen-candidate',
        reason: 'deterministic GSLR-8 compiler scaffold proof',
        arm,
        step,
        productBoundary: 'research-only',
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

const options = parseArgs(process.argv.slice(2));
writeSolution(options.workspace);
runPublicGate(options.workspace);
writeRouteDecision(options.workspace, options);
console.log(`deterministic lane wrote GSLR-8 hook solution for ${options.arm}/${options.step}`);
