#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..', '..');

const SUPPORTED_HARNESSES = [
  {
    name: 'claude',
    docNeedle: '| Claude',
    level: 'native-flow-runner',
    fullSmokeScript: 'eval:smoke',
    quickSmokeScript: 'eval:smoke:quick',
    flowLabel: 'prompt-language ci --runner claude',
    promptLabel: 'claude -p',
    flowFunction: 'function execClaudeFlow(',
    promptFunction: 'function execClaude(',
  },
  {
    name: 'codex',
    docNeedle: '| Codex',
    level: 'native-flow-runner',
    fullSmokeScript: 'eval:smoke:codex',
    quickSmokeScript: 'eval:smoke:codex:quick',
    flowLabel: 'prompt-language ci --runner codex',
    promptLabel: 'codex exec',
    flowFunction: 'function execCodexFlow(',
    promptFunction: 'function execCodex(',
  },
  {
    name: 'opencode',
    docNeedle: '| OpenCode',
    level: 'native-flow-runner',
    fullSmokeScript: 'eval:smoke:opencode',
    quickSmokeScript: 'eval:smoke:opencode:quick',
    flowLabel: 'prompt-language ci --runner opencode',
    promptLabel: 'opencode run',
    flowFunction: 'function execOpenCodeFlow(',
    promptFunction: 'function execOpenCode(',
  },
  {
    name: 'ollama',
    docNeedle: '| Ollama',
    level: 'native-flow-runner',
    fullSmokeScript: 'eval:smoke:ollama',
    quickSmokeScript: 'eval:smoke:ollama:quick',
    flowLabel: 'prompt-language ci --runner ollama',
    promptLabel: 'ollama run',
    flowFunction: 'function execOllamaFlow(',
    promptFunction: 'function execOllama(',
  },
  {
    name: 'aider',
    docNeedle: '| Aider',
    level: 'native-flow-runner',
    fullSmokeScript: 'eval:smoke:aider',
    quickSmokeScript: 'eval:smoke:aider:quick',
    flowLabel: 'prompt-language ci --runner aider',
    promptLabel: 'python -m aider --message',
    flowFunction: 'function execAiderFlow(',
    promptFunction: 'function execAider(',
  },
  {
    name: 'gemini',
    docNeedle: '| Gemini',
    level: 'prompt-template-only',
    fullSmokeScript: 'eval:smoke:gemini',
    quickSmokeScript: 'eval:smoke:gemini:quick',
    flowLabel: 'gemini -p --yolo',
    promptLabel: 'gemini -p --yolo',
    flowFunction: null,
    promptFunction: 'function execGemini(',
  },
];

const SMOKE_FEATURE_FAMILIES = [
  { family: 'context-file-relay', ids: ['A'] },
  { family: 'context-recall', ids: ['B'] },
  { family: 'variables-and-interpolation', ids: ['C', 'K', 'Z'] },
  { family: 'gates', ids: ['D', 'M', 'R', 'AS'] },
  { family: 'run-node', ids: ['E'] },
  { family: 'foreach-and-lists', ids: ['F', 'Q', 'S', 'T', 'Z1'] },
  { family: 'captures', ids: ['G', 'N', 'Z3', 'Z4'] },
  { family: 'branching', ids: ['H', 'U', 'V'] },
  { family: 'try-catch-finally', ids: ['I', 'W', 'AU'] },
  { family: 'while-until-looping', ids: ['J', 'O', 'Y', 'AK', 'AL'] },
  { family: 'retry-and-backoff', ids: ['L', 'AR'] },
  { family: 'break-and-continue', ids: ['P', 'X', 'AI', 'AW'] },
  { family: 'approve-review-memory', ids: ['AA', 'AB', 'AC', 'AJ'] },
  { family: 'spawn-swarm-race-ipc', ids: ['AD', 'AE', 'AF', 'AM', 'AN', 'AP', 'AQ'] },
  { family: 'imports-and-includes', ids: ['AG', 'AH', 'AO'] },
  { family: 'snapshot-state', ids: ['AX', 'BA'] },
  { family: 'agent-profile-skills', ids: ['AY', 'AZ'] },
];

const SMOKE_REPORT_FIELDS = [
  'harness: getEvidenceHarnessName()',
  'runnerHarness: getHarnessName()',
  'harnessLabel: getHarnessLabel()',
  'flowCommandLabel: getFlowCommandLabel()',
  'model: getEffectiveModel()',
  'timeoutMs: TIMEOUT',
  'traceEnabled: TRACE_ENABLED',
  'only: ONLY_FILTERS',
  "status: 'blocked'",
];

const REQUIRED_PACKAGE_SCRIPTS = [
  'eval:harness:adapter:test',
  'harness:conformance',
  'harness:conformance:test',
];

function readText(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function readPackageJson() {
  return JSON.parse(readText('package.json'));
}

function requireContains({ text, needle, label, failures }) {
  if (!text.includes(needle)) {
    failures.push(`${label}: expected to find ${JSON.stringify(needle)}`);
  }
}

function extractTimedSmokeIds(smokeSource) {
  return new Set([...smokeSource.matchAll(/timed\('([^']+)'/g)].map((match) => match[1]));
}

function verifyHarnessCoverage() {
  const failures = [];
  const packageJson = readPackageJson();
  const scripts = packageJson.scripts ?? {};
  const harnessSource = readText('scripts/eval/harness.mjs');
  const smokeSource = readText('scripts/eval/smoke-test.mjs');
  const contractTestSource = readText('src/infrastructure/adapters/eval-harness-contract.test.ts');
  const selectionTestSource = readText(
    'src/infrastructure/adapters/eval-harness-selection.test.ts',
  );
  const conformanceDoc = readText('docs/evaluation/harness-conformance-matrix.md');
  const liveMatrixDoc = readText('docs/evaluation/live-inference-test-matrix.md');

  for (const scriptName of REQUIRED_PACKAGE_SCRIPTS) {
    if (!scripts[scriptName]) {
      failures.push(`package scripts: missing ${scriptName}`);
    }
  }
  requireContains({
    text: scripts.ci ?? '',
    needle: 'npm run eval:harness:adapter:test',
    label: 'ci harness adapter tests',
    failures,
  });

  for (const harness of SUPPORTED_HARNESSES) {
    requireContains({
      text: harnessSource,
      needle: `raw === '${harness.name}'`,
      label: `${harness.name} selection`,
      failures,
    });
    requireContains({
      text: harnessSource,
      needle: harness.promptFunction,
      label: `${harness.name} prompt adapter`,
      failures,
    });
    requireContains({
      text: harnessSource,
      needle: harness.promptLabel,
      label: `${harness.name} prompt label`,
      failures,
    });
    requireContains({
      text: harnessSource,
      needle: harness.flowLabel,
      label: `${harness.name} flow label`,
      failures,
    });
    if (harness.flowFunction) {
      requireContains({
        text: harnessSource,
        needle: harness.flowFunction,
        label: `${harness.name} flow adapter`,
        failures,
      });
    }

    const fullScript = scripts[harness.fullSmokeScript];
    const quickScript = scripts[harness.quickSmokeScript];
    if (!fullScript) {
      failures.push(`${harness.name}: missing npm script ${harness.fullSmokeScript}`);
    }
    if (!quickScript) {
      failures.push(`${harness.name}: missing npm script ${harness.quickSmokeScript}`);
    }
    if (harness.name !== 'claude') {
      requireContains({
        text: fullScript ?? '',
        needle: `--harness ${harness.name}`,
        label: `${harness.name} full smoke script`,
        failures,
      });
      requireContains({
        text: quickScript ?? '',
        needle: `--harness ${harness.name} --quick`,
        label: `${harness.name} quick smoke script`,
        failures,
      });
    } else {
      requireContains({
        text: quickScript ?? '',
        needle: '--quick',
        label: 'claude quick smoke script',
        failures,
      });
    }

    requireContains({
      text: contractTestSource,
      needle: harness.name,
      label: `${harness.name} contract test coverage`,
      failures,
    });
    requireContains({
      text: conformanceDoc,
      needle: harness.docNeedle,
      label: `${harness.name} conformance documentation`,
      failures,
    });
  }

  for (const harness of ['codex', 'gemini', 'opencode', 'ollama', 'aider']) {
    requireContains({
      text: selectionTestSource,
      needle: harness,
      label: `${harness} selection test coverage`,
      failures,
    });
  }

  const smokeIds = extractTimedSmokeIds(smokeSource);
  for (const feature of SMOKE_FEATURE_FAMILIES) {
    const missingIds = feature.ids.filter((id) => !smokeIds.has(id));
    if (missingIds.length > 0) {
      failures.push(`${feature.family}: missing smoke scenario id(s) ${missingIds.join(', ')}`);
    }
  }

  for (const field of SMOKE_REPORT_FIELDS) {
    requireContains({
      text: smokeSource,
      needle: field,
      label: 'smoke report telemetry',
      failures,
    });
  }

  for (const requiredTerm of [
    'Codex',
    'Claude',
    'Ollama',
    'Aider',
    'OpenCode',
    'Gemini',
    'AI_CMD',
    'token',
    'cost',
    'wall time',
    'GPU',
    'blocked',
  ]) {
    requireContains({
      text: liveMatrixDoc,
      needle: requiredTerm,
      label: 'live inference matrix',
      failures,
    });
  }

  return {
    ok: failures.length === 0,
    failures,
    harnesses: SUPPORTED_HARNESSES.map(({ name, level }) => ({ name, level })),
    smokeFeatureFamilies: SMOKE_FEATURE_FAMILIES.map(({ family, ids }) => ({
      family,
      ids,
    })),
    smokeReportFields: SMOKE_REPORT_FIELDS,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyHarnessCoverage();

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    console.log(
      `[harness-conformance] PASS - ${result.harnesses.length} harnesses and ${result.smokeFeatureFamilies.length} feature families covered.`,
    );
  } else {
    console.error('[harness-conformance] FAIL');
    for (const failure of result.failures) {
      console.error(`- ${failure}`);
    }
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
}

export { verifyHarnessCoverage };
