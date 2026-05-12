#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_ENDPOINT = process.env.PROMPT_LANGUAGE_OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';

function parseArgs(argv) {
  const options = {
    arm: null,
    endpoint: DEFAULT_ENDPOINT,
    model: process.env.EVAL_MODEL?.replace(/^ollama\//, '') ?? 'qwen3-coder:30b',
    step: null,
    workspace: process.cwd(),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--arm') {
      options.arm = argv[++index] ?? null;
      continue;
    }
    if (arg === '--endpoint') {
      options.endpoint = argv[++index] ?? null;
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

function routeRecordPrompt({ arm, step, workspace }) {
  const task = readWorkspaceFile(workspace, 'TASK.md');
  const current = readWorkspaceFile(workspace, 'src/route-decision-record.mjs');
  const publicGate = readWorkspaceFile(workspace, 'test/public-gate.mjs');

  return [
    'You are the local bounded implementation lane for GSLR-7.',
    `Arm: ${arm}`,
    `Step: ${step}`,
    '',
    'Implement exactly this file:',
    '- src/route-decision-record.mjs',
    '',
    'Return only this sentinel format, with no markdown fences and no commentary:',
    'BEGIN_FILE: src/route-decision-record.mjs',
    '<complete file content>',
    'END_FILE',
    '',
    'Do not modify tests, package.json, task files, README files, or the private oracle.',
    'The implementation file must be self-contained. Do not import from ./route-decision-record.mjs, ../src/route-decision-record.mjs, or the public gate.',
    'Do not paste import lines from test/public-gate.mjs into src/route-decision-record.mjs.',
    'Do not declare any helper more than once.',
    'Do not collapse the solution into one large free-form builder. Preserve and use these exact exported helper boundaries:',
    '- export function normalizeRouteKey(value)',
    '- export function isUnsafeEvidenceKey(key)',
    '- export function containsUnsafeEvidenceText(value)',
    '- export function isSafeEvidenceRef(ref)',
    '- export function deriveEscalationReasons(input)',
    '- export function selectRouteDecision(input)',
    '- export function buildRouteDecisionRecord(input)',
    'The public gate imports all seven functions by name, so each one must be a top-level named export.',
    '',
    'Helper requirements:',
    '- normalizeRouteKey must be case-insensitive and separator-insensitive by lowercasing and removing non-alphanumeric separators.',
    '- isUnsafeEvidenceKey must reject rawPayload, sourcePayload, studentPayload, credential, secret, token, password, apiKey, oracleCommand, rawStdout, rawStderr, hiddenOracleBody, transcript, studentRecord, and rawDump after normalization.',
    '- containsUnsafeEvidenceText must reject strings exposing raw payload boundaries, student identifiers or records, raw transcripts, oracle commands, passwords, API keys, and hidden oracle bodies.',
    '- isSafeEvidenceRef must accept repository-relative evidence refs such as hybrid-routing-manifest.json, private/oracle/stdout.txt, and artifacts/steps/01-local-bulk/stdout.txt.',
    '- isSafeEvidenceRef must reject refs with ? or #, absolute paths, URL schemes, any path segment exactly .., and raw dump names such as rawdump, raw-dump, or raw_dump in any path segment or filename.',
    '- Do not validate safe relative refs by constructing a URL, because URL parsing converts them into absolute paths.',
    '- deriveEscalationReasons must return stable reason codes in this order when present: public-gate-failure, private-oracle-failure, blocking-review-defects, frontier-budget-used, local-wall-time-high.',
    '- selectRouteDecision must return local-screen only for clean local-only evidence with zero frontier tokens; private oracle failure returns frontier-baseline; public-gate or review-defect failure returns advisor-escalate; non-local arms return frontier-baseline.',
    '- selectRouteDecision may return only decision and reason; buildRouteDecisionRecord must wrap it into selectedRoute with arm, decision, reason, selectedModel, and selectedProvider.',
    '',
    'Builder composition requirements:',
    '- Do not throw on null, arrays, malformed records, missing nested objects, or unsupported schema versions.',
    '- Do not mutate input records.',
    '- Require schemaVersion === "harness.route-input.v1".',
    '- Require source.system === "prompt-language" and source.area === "harness-arena".',
    '- Require workItem.id and workItem.runId to be non-empty strings.',
    '- Require route.arm to be local-only, frontier-only, advisor-only, or hybrid-router.',
    '- In gates, finalVerdict and privateOracle must be pass or fail; blockingReviewDefects must be an array and must not be validated as a pass/fail gate value.',
    '- Reject negative or non-finite cost fields.',
    '- Reject unsafe evidence keys recursively in nested objects and arrays.',
    '- Scan every string value recursively for unsafe evidence text.',
    '- Validate repository-relative refs only inside artifactRefs. Do not treat ordinary strings such as schemaVersion, route.arm, selectedModel, or selectedProvider as artifact refs.',
    '- selectedRoute in the returned record must include arm from input.route.arm, decision, reason, selectedModel from input.route.selectedModel or null, and selectedProvider from input.route.selectedProvider or null.',
    '- Preserve only allowed top-level fields in the returned record: schemaVersion, source, workItem, selectedRoute, gates, cost, escalationReasons, and artifactRefs.',
    '- Return { ok: false, errors: [...], record: null } on validation failure and { ok: true, errors: [], record } on success.',
    '',
    `TASK.md:\n${task}`,
    `Current src/route-decision-record.mjs:\n${current}`,
    `Public gate:\n${publicGate}`,
  ].join('\n\n');
}

async function generateWithOllama({ endpoint, model, prompt }) {
  const body = {
    model,
    prompt,
    stream: false,
    options: {
      temperature: 0,
      num_ctx: 20000,
    },
  };

  const response = await fetch(new URL('/api/generate', endpoint), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).catch((error) => {
    if (process.env.PROMPT_LANGUAGE_OLLAMA_TRANSPORT === 'powershell') {
      return generateWithPowerShellBridge({ body, endpoint });
    }
    throw error;
  });
  if (typeof response === 'string') return response;
  if (!response.ok) {
    throw new Error(`Ollama generate failed: HTTP ${response.status} ${await response.text()}`);
  }
  const payload = await response.json();
  if (!payload.response || typeof payload.response !== 'string') {
    throw new Error('Ollama response missing text');
  }
  return payload.response;
}

function generateWithPowerShellBridge({ body, endpoint }) {
  const uri = localWindowsOllamaUri(endpoint);
  const command = [
    '$body = [Console]::In.ReadToEnd();',
    `$result = Invoke-RestMethod -Uri '${uri}' -Method Post -ContentType 'application/json' -Body $body;`,
    '$result | ConvertTo-Json -Depth 20 -Compress',
  ].join(' ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], {
    encoding: 'utf8',
    input: JSON.stringify(body),
    timeout: Number(process.env.PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS ?? 900_000),
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Ollama PowerShell bridge failed: ${result.stderr || result.stdout}`);
  }
  const payload = JSON.parse(result.stdout);
  if (!payload.response || typeof payload.response !== 'string') {
    throw new Error('Ollama PowerShell bridge response missing text');
  }
  return payload.response;
}

function localWindowsOllamaUri(endpoint) {
  const url = new URL('/api/generate', endpoint);
  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1') {
    url.hostname = '127.0.0.1';
  }
  return String(url);
}

function parseFileBlock(output, relativePath) {
  const withoutThinking = output.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const pattern = new RegExp(
    `BEGIN_FILE:\\s*${relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n([\\s\\S]*?)\\nEND_FILE`,
    'i',
  );
  const match = withoutThinking.match(pattern);
  if (!match) throw new Error(`missing sentinel block for ${relativePath}`);
  return (
    match[1]
      .replace(/```(?:js|javascript|mjs)?\s*\n?/gi, '')
      .replace(/```/g, '')
      .trim() + '\n'
  );
}

function runPublicGate(workspace) {
  const result = spawnSync(process.execPath, ['test/public-gate.mjs'], {
    cwd: workspace,
    encoding: 'utf8',
    timeout: 60_000,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`public gate failed with exit ${result.status}`);
  }
}

const options = parseArgs(process.argv.slice(2));
const prompt = routeRecordPrompt(options);
const output = await generateWithOllama({ ...options, prompt });
mkdirSync(join(options.workspace, 'src'), { recursive: true });
writeFileSync(
  join(options.workspace, 'src', 'route-decision-record.mjs'),
  parseFileBlock(output, 'src/route-decision-record.mjs'),
  'utf8',
);
runPublicGate(options.workspace);
console.log(`local lane wrote GSLR-7 scaffolded route record using ${options.model}`);
