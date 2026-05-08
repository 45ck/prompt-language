#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_H15_QWEN_CODER_POLICY_PATH = join(
  import.meta.dirname,
  'h15-qwen3-coder-routing-policy.v1.json',
);

const TASK_ALIASES = new Map([
  ['api', 'h15-api-endpoint'],
  ['api-endpoint', 'h15-api-endpoint'],
  ['endpoint', 'h15-api-endpoint'],
  ['h15', 'h15-api-endpoint'],
  ['patch', 'h15-api-endpoint'],
  ['patch-contact', 'h15-api-endpoint'],
]);

export function loadH15QwenCoderRoutingPolicy(policyPath = DEFAULT_H15_QWEN_CODER_POLICY_PATH) {
  return JSON.parse(readFileSync(policyPath, 'utf8'));
}

export function normalizeH15QwenCoderTask(task) {
  const normalized = String(task ?? '').trim();
  if (!normalized) throw new Error('task is required');
  return TASK_ALIASES.get(normalized) ?? normalized;
}

export function resolveH15QwenCoderRoute(task, policy = loadH15QwenCoderRoutingPolicy()) {
  const normalizedTask = normalizeH15QwenCoderTask(task);
  const route = policy.routes.find((entry) => entry.task === normalizedTask);
  if (!route) {
    const available = policy.routes.map((entry) => entry.task).join(', ');
    throw new Error(`unknown H15 qwen3-coder task "${task}". Available: ${available}`);
  }

  return {
    escalationTriggers: policy.escalationTriggers,
    localDraftModel: route.localDraftModel,
    model: policy.model,
    policyVersion: policy.policyVersion,
    route,
    runtimeDefaults: policy.runtimeDefaults,
    shouldRunHybrid: route.decision === 'hybrid-required',
    shouldRunLocal: route.decision === 'local-promoted',
  };
}

function printUsage() {
  console.error(
    [
      'usage: node experiments/harness-arena/h15-qwen3-coder-routing-policy.mjs <task> [--json]',
      '',
      'common tasks: h15-api-endpoint, api-endpoint, patch-contact',
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

  const resolved = resolveH15QwenCoderRoute(task);
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
