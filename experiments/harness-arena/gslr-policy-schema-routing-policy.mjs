#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_GSLR_POLICY_SCHEMA_ROUTING_POLICY_PATH = join(
  import.meta.dirname,
  'gslr-policy-schema-routing-policy.v1.json',
);

const TASK_ALIASES = new Map([
  ['gslr2', 'gslr2-policy-schema'],
  ['policy-schema', 'gslr2-policy-schema'],
  ['schema-validator', 'gslr2-policy-schema'],
  ['validator', 'gslr2-policy-schema'],
]);

export function loadGslrPolicySchemaRoutingPolicy(
  policyPath = DEFAULT_GSLR_POLICY_SCHEMA_ROUTING_POLICY_PATH,
) {
  return JSON.parse(readFileSync(policyPath, 'utf8'));
}

export function normalizeGslrPolicySchemaTask(task) {
  const normalized = String(task ?? '').trim();
  if (!normalized) throw new Error('task is required');
  return TASK_ALIASES.get(normalized) ?? normalized;
}

export function resolveGslrPolicySchemaRoute(task, policy = loadGslrPolicySchemaRoutingPolicy()) {
  const normalizedTask = normalizeGslrPolicySchemaTask(task);
  const route = policy.routes.find((entry) => entry.task === normalizedTask);
  if (!route) {
    const available = policy.routes.map((entry) => entry.task).join(', ');
    throw new Error(`unknown GSLR policy-schema task "${task}". Available: ${available}`);
  }

  return {
    decisionRules: policy.decisionRules,
    escalationTriggers: policy.escalationTriggers,
    model: policy.model,
    nextFixtureFamily: policy.nextFixtureFamily,
    policyVersion: policy.policyVersion,
    route,
    runtimeDefaults: policy.runtimeDefaults,
    shouldRunFrontier: route.decision === 'frontier-baseline',
    shouldRunHybrid: route.decision === 'hybrid-required',
    shouldRunLocal: route.decision === 'local-promoted',
    shouldRunLocalScreen: route.decision === 'local-screen',
  };
}

function printUsage() {
  console.error(
    [
      'usage: node experiments/harness-arena/gslr-policy-schema-routing-policy.mjs <task> [--json]',
      '',
      'common tasks: gslr2-policy-schema, policy-schema, schema-validator',
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

  const resolved = resolveGslrPolicySchemaRoute(task);
  if (json) {
    console.log(JSON.stringify(resolved, null, 2));
    return;
  }

  console.log(`${resolved.route.task}: ${resolved.route.decision}`);
  console.log(`owner: ${resolved.route.owner}`);
  console.log(
    `model: ${resolved.route.selectedModel.provider}/${resolved.route.selectedModel.name}`,
  );
  console.log(`fixture: ${resolved.route.fixture}`);
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
