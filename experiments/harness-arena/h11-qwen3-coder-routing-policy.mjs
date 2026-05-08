#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_H11_QWEN_CODER_POLICY_PATH = join(
  import.meta.dirname,
  'h11-qwen3-coder-routing-policy.v1.json',
);

const TASK_ALIASES = new Map([
  ['h11', 'h11-multi-file-refactor'],
  ['multi-file', 'h11-multi-file-refactor'],
  ['multi-file-refactor', 'h11-multi-file-refactor'],
  ['refactor', 'h11-multi-file-refactor'],
  ['rename', 'h11-multi-file-refactor'],
]);

export function loadH11QwenCoderRoutingPolicy(policyPath = DEFAULT_H11_QWEN_CODER_POLICY_PATH) {
  return JSON.parse(readFileSync(policyPath, 'utf8'));
}

export function normalizeH11QwenCoderTask(task) {
  const normalized = String(task ?? '').trim();
  if (!normalized) throw new Error('task is required');
  return TASK_ALIASES.get(normalized) ?? normalized;
}

export function resolveH11QwenCoderRoute(task, policy = loadH11QwenCoderRoutingPolicy()) {
  const normalizedTask = normalizeH11QwenCoderTask(task);
  const route = policy.routes.find((entry) => entry.task === normalizedTask);
  if (!route) {
    const available = policy.routes.map((entry) => entry.task).join(', ');
    throw new Error(`unknown H11 qwen3-coder task "${task}". Available: ${available}`);
  }

  return {
    escalationTriggers: policy.escalationTriggers,
    localDraftModel: route.localDraftModel,
    model: policy.model,
    policyVersion: policy.policyVersion,
    route,
    runtimeDefaults: policy.runtimeDefaults,
    shouldRunFrontier: route.decision === 'frontier-baseline',
    shouldRunHybrid: route.decision === 'hybrid-required',
    shouldRunLocal: route.decision === 'local-promoted',
    shouldRunLocalScreen:
      route.decision === 'local-screen' || route.decision === 'local-screen-candidate',
  };
}

function printUsage() {
  console.error(
    [
      'usage: node experiments/harness-arena/h11-qwen3-coder-routing-policy.mjs <task> [--json]',
      '',
      'common tasks: h11-multi-file-refactor, multi-file-refactor, refactor, rename',
    ].join('\n'),
  );
}

function main(argv) {
  const json = argv.includes('--json');
  const task = argv.find((arg) => arg !== '--json');
  if (!task) {
    printUsage();
    process.exit(2);
  }

  const resolved = resolveH11QwenCoderRoute(task);
  if (json) {
    console.log(JSON.stringify(resolved, null, 2));
    return;
  }

  console.log(`${resolved.route.task}: ${resolved.route.decision}`);
  console.log(`owner: ${resolved.route.owner}`);
  console.log(
    `local draft model: ${resolved.localDraftModel.provider}/${resolved.localDraftModel.name}`,
  );
  console.log(`flow: ${resolved.route.flow}`);
  console.log(`oracle: ${resolved.route.oracle}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
