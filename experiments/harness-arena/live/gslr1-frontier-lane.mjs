#!/usr/bin/env node

import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function parseArgs(argv) {
  const options = {
    arm: null,
    model: process.env.GSLR1_FRONTIER_MODEL ?? null,
    step: null,
    workspace: process.cwd(),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--arm') {
      options.arm = argv[++index] ?? null;
      continue;
    }
    if (arg === '--model') {
      options.model = argv[++index] ?? null;
      continue;
    }
    if (arg === '--step') {
      options.step = argv[++index] ?? null;
      continue;
    }
    if (arg === '--workspace') {
      options.workspace = argv[++index] ?? null;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  if (!options.arm) throw new Error('--arm is required');
  if (!options.step) throw new Error('--step is required');
  if (!options.workspace) throw new Error('--workspace is required');
  return options;
}

function readWorkspaceFile(workspace, relativePath, fallback = '') {
  try {
    return readFileSync(join(workspace, ...relativePath.split('/')), 'utf8');
  } catch {
    return fallback;
  }
}

function codexPrompt({ arm, step, workspace }) {
  const task = readWorkspaceFile(workspace, 'TASK.md');
  const source = readWorkspaceFile(workspace, 'src/source-projection.md');
  const checklist = readWorkspaceFile(workspace, 'src/expected-envelope-checklist.md');
  const projection = readWorkspaceFile(
    workspace,
    'projection/portarium-evidence-envelope.md',
    '(projection not present yet)',
  );

  if (step === 'frontier-advice' || step === 'frontier-classify') {
    return [
      'You are the frontier classification/advice lane for GSLR-1.',
      `Arm: ${arm}`,
      `Step: ${step}`,
      '',
      'Do not create the final projection unless this is frontier-full.',
      'Write concise guidance to projection/frontier-advice.md.',
      'The guidance must keep the task read-only, no-mutation, refs-only, and local-bulk bounded by gates.',
      'Avoid the words password, credential, secret, token, cookie, and hidden oracle.',
      'Use "solo local ownership" instead of "local-only autonomy" when describing non-goals.',
      '',
      `TASK.md:\n${task}`,
      `src/source-projection.md:\n${source}`,
      `src/expected-envelope-checklist.md:\n${checklist}`,
    ].join('\n\n');
  }

  if (step === 'frontier-review') {
    return [
      'You are the frontier review lane for GSLR-1.',
      `Arm: ${arm}`,
      `Step: ${step}`,
      '',
      'Read projection/portarium-evidence-envelope.md.',
      'Write projection/frontier-review.md with either "blocking findings: none" or specific blocking findings.',
      'Do not rewrite the projection unless needed to remove unsafe content or satisfy the public gate.',
      'Avoid the words password, credential, secret, token, cookie, and hidden oracle.',
      'Use "solo local ownership" instead of "local-only autonomy" when describing non-goals.',
      '',
      `Current projection:\n${projection}`,
      `Checklist:\n${checklist}`,
    ].join('\n\n');
  }

  return [
    'You are the frontier full-work lane for GSLR-1.',
    `Arm: ${arm}`,
    `Step: ${step}`,
    '',
    'Create projection/portarium-evidence-envelope.md.',
    'Keep it read-only, no-mutation, refs-only, and honest about proof boundaries.',
    'Avoid the words password, credential, secret, token, cookie, and hidden oracle.',
    'Use "solo local ownership" instead of "local-only autonomy" when describing non-goals.',
    'Then run node test/public-gate.mjs and fix only issues required for that gate.',
    '',
    `TASK.md:\n${task}`,
    `src/source-projection.md:\n${source}`,
    `src/expected-envelope-checklist.md:\n${checklist}`,
  ].join('\n\n');
}

function runCodex({ model, prompt, workspace }) {
  const args = ['exec', '--cd', workspace, '--skip-git-repo-check', '--sandbox', 'workspace-write'];
  if (model) args.push('--model', model);
  args.push(prompt);
  const result = spawnSync('codex', args, {
    cwd: workspace,
    encoding: 'utf8',
    env: process.env,
    timeout: 240_000,
  });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`codex exec exited ${result.status}`);
  }
}

const options = parseArgs(process.argv.slice(2));
mkdirSync(join(options.workspace, 'projection'), { recursive: true });
runCodex({ ...options, prompt: codexPrompt(options) });
console.log(`frontier lane completed ${options.step}`);
