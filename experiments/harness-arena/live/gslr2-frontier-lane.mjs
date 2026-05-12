#!/usr/bin/env node

import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function parseArgs(argv) {
  const options = {
    arm: null,
    model: process.env.GSLR2_FRONTIER_MODEL ?? null,
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
  const current = readWorkspaceFile(workspace, 'src/action-policy-schema.mjs');
  const publicGate = readWorkspaceFile(workspace, 'test/public-gate.mjs');
  const advice = readWorkspaceFile(workspace, 'policy/frontier-advice.md');
  const routeDecision = readWorkspaceFile(workspace, 'policy/route-decision.json');

  if (step === 'frontier-advice') {
    return [
      'You are the frontier advice lane for GSLR-2.',
      `Arm: ${arm}`,
      `Step: ${step}`,
      '',
      'Create policy/frontier-advice.md with concise implementation guidance for the local lane.',
      'Do not edit src/action-policy-schema.mjs.',
      'Mention recursive forbidden-key scanning, exact required booleans, allowed enums, non-mutation, and public/private gate separation.',
      '',
      `TASK.md:\n${task}`,
      `Current implementation:\n${current}`,
      `Public gate:\n${publicGate}`,
    ].join('\n\n');
  }

  if (step === 'frontier-classify') {
    return [
      'You are the frontier classifier lane for GSLR-2.',
      `Arm: ${arm}`,
      `Step: ${step}`,
      '',
      'Create policy/route-decision.json.',
      'Do not edit src/action-policy-schema.mjs.',
      'The JSON must include route, risk, reason, expectedLocalFit, and requiredReview fields.',
      'Classify whether this is suitable for a bounded local implementation followed by frontier review.',
      '',
      `TASK.md:\n${task}`,
      `Current implementation:\n${current}`,
      `Public gate:\n${publicGate}`,
    ].join('\n\n');
  }

  if (step === 'frontier-review') {
    return [
      'You are the frontier review lane for GSLR-2.',
      `Arm: ${arm}`,
      `Step: ${step}`,
      '',
      'Inspect src/action-policy-schema.mjs against TASK.md and test/public-gate.mjs.',
      'Run node test/public-gate.mjs.',
      'If the implementation is clearly defective, make the smallest repair to src/action-policy-schema.mjs and rerun the gate.',
      'Treat throwing on null, arrays, or malformed objects as blocking.',
      'Create policy/frontier-review.md.',
      'The review file must contain exactly one "blocking findings:" section.',
      'Use "blocking findings:\\n\\nnone" only if public gate passes and no blocking issue remains.',
      '',
      `TASK.md:\n${task}`,
      `Route decision:\n${routeDecision || '(none)'}`,
      `Current implementation:\n${current}`,
      `Public gate:\n${publicGate}`,
    ].join('\n\n');
  }

  if (step === 'frontier-repair') {
    return [
      'You are the frontier repair lane for GSLR-2 after local public-gate failure.',
      `Arm: ${arm}`,
      `Step: ${step}`,
      '',
      'Make the smallest repair to src/action-policy-schema.mjs.',
      'Run node test/public-gate.mjs and leave it passing.',
      'Do not edit test/public-gate.mjs, TASK.md, README.md, or package.json.',
      'Treat throwing on null, arrays, or malformed objects as blocking.',
      '',
      advice ? `Frontier advice:\n${advice}` : '',
      `TASK.md:\n${task}`,
      `Current implementation:\n${current}`,
      `Public gate:\n${publicGate}`,
    ].join('\n\n');
  }

  return [
    'You are the frontier full-work lane for GSLR-2.',
    `Arm: ${arm}`,
    `Step: ${step}`,
    '',
    'Implement src/action-policy-schema.mjs completely.',
    'Run node test/public-gate.mjs and fix only issues required for that gate.',
    'Do not edit test/public-gate.mjs, TASK.md, README.md, or package.json.',
    'The implementation must be recursive and must not mutate its input.',
    'It must not throw for null, arrays, or malformed objects.',
    '',
    `TASK.md:\n${task}`,
    `Current implementation:\n${current}`,
    `Public gate:\n${publicGate}`,
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
    timeout: 480_000,
  });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`codex exec exited ${result.status}`);
  }
}

const options = parseArgs(process.argv.slice(2));
mkdirSync(join(options.workspace, 'policy'), { recursive: true });
runCodex({ ...options, prompt: codexPrompt(options) });
console.log(`frontier lane completed ${options.step}`);
