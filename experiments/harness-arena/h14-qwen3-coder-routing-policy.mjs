#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_POLICY_PATH = join(
  import.meta.dirname,
  'h14-qwen3-coder-routing-policy.v1.json',
);

const SUBROLE_ALIASES = new Map([
  ['api-preservation', 'h14-api-preserving-implementation'],
  ['api-preserving-implementation', 'h14-api-preserving-implementation'],
  ['full-h14', 'h14-full-tdd'],
  ['full-tdd', 'h14-full-tdd'],
  ['impl-from-tests', 'h14-implementation-from-tests'],
  ['implementation-from-tests', 'h14-implementation-from-tests'],
  ['test-authoring', 'h14-test-authoring'],
  ['tests', 'h14-test-authoring'],
]);

export function loadH14QwenCoderRoutingPolicy(policyPath = DEFAULT_POLICY_PATH) {
  return JSON.parse(readFileSync(policyPath, 'utf8'));
}

export function normalizeH14QwenCoderSubrole(subrole) {
  const normalized = String(subrole ?? '').trim();
  if (!normalized) throw new Error('subrole is required');
  return SUBROLE_ALIASES.get(normalized) ?? normalized;
}

export function resolveH14QwenCoderRoute(subrole, policy = loadH14QwenCoderRoutingPolicy()) {
  const normalizedSubrole = normalizeH14QwenCoderSubrole(subrole);
  const route = policy.routes.find((entry) => entry.subrole === normalizedSubrole);
  if (!route) {
    const available = policy.routes.map((entry) => entry.subrole).join(', ');
    throw new Error(`unknown H14 qwen3-coder subrole "${subrole}". Available: ${available}`);
  }

  return {
    escalationTriggers: policy.escalationTriggers,
    model: policy.model,
    policyVersion: policy.policyVersion,
    route,
    runtimeDefaults: policy.runtimeDefaults,
    shouldRunLocal: route.decision === 'local-promoted',
  };
}

function printUsage() {
  console.error(
    [
      'usage: node experiments/harness-arena/h14-qwen3-coder-routing-policy.mjs <subrole> [--json]',
      '',
      'common subroles: implementation-from-tests, api-preservation, test-authoring, full-tdd',
    ].join('\n'),
  );
}

function main(argv) {
  const json = argv.includes('--json');
  const subrole = argv.find((arg) => arg !== '--json');
  if (!subrole) {
    printUsage();
    process.exit(2);
  }

  const resolved = resolveH14QwenCoderRoute(subrole);
  if (json) {
    console.log(JSON.stringify(resolved, null, 2));
    return;
  }

  console.log(`${resolved.route.subrole}: ${resolved.route.decision}`);
  console.log(`owner: ${resolved.route.owner}`);
  console.log(`model: ${resolved.model.provider}/${resolved.model.name}`);
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
