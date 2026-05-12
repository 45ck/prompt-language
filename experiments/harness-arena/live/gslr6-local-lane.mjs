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

function sanitizerPrompt({ arm, step, workspace }) {
  const task = readWorkspaceFile(workspace, 'TASK.md');
  const sanitizerCurrent = readWorkspaceFile(workspace, 'src/evidence-card-sanitizer.mjs');
  const publicGate = readWorkspaceFile(workspace, 'test/public-gate.mjs');

  return [
    'You are the local bounded implementation lane for GSLR-6.',
    `Arm: ${arm}`,
    `Step: ${step}`,
    '',
    'Implement exactly this file:',
    '- src/evidence-card-sanitizer.mjs',
    '',
    'Return only this sentinel format, with no markdown fences and no commentary:',
    'BEGIN_FILE: src/evidence-card-sanitizer.mjs',
    '<complete file content>',
    'END_FILE',
    '',
    'Do not modify tests, package.json, task files, README files, or the private oracle.',
    'The implementation file must be self-contained. Do not import from ./evidence-card-sanitizer.mjs, ../src/evidence-card-sanitizer.mjs, or the public gate.',
    'Do not paste import lines from test/public-gate.mjs into src/evidence-card-sanitizer.mjs.',
    'Do not declare any helper more than once.',
    'Do not collapse the solution into one large free-form sanitizer. Preserve and use these exact exported helper boundaries:',
    '- export function normalizeEvidenceKey(value)',
    '- export function isForbiddenRawKey(key)',
    '- export function containsRawPayloadText(value)',
    '- export function isSafeArtifactRef(ref)',
    '- export function deriveActionBoundary(gates)',
    '- export function sanitizeEvidenceCardInput(input)',
    'The public gate imports all six functions by name, so each one must be a top-level named export.',
    '',
    'Helper requirements:',
    '- normalizeEvidenceKey must be case-insensitive and separator-insensitive by lowercasing and removing non-alphanumeric separators.',
    '- isForbiddenRawKey must reject rawPayload, sourcePayload, studentPayload, credential, secret, token, password, apiKey, oracleCommand, rawStdout, rawStderr, hiddenOracleBody, transcript, studentRecord, and rawDump after normalization.',
    '- containsRawPayloadText must reject strings exposing raw payload boundaries, student identifiers or records, raw transcripts, oracle commands, passwords, API keys, and hidden oracle bodies.',
    '- isSafeArtifactRef must accept repository-relative evidence refs such as hybrid-routing-manifest.json, private/oracle/stdout.txt, and artifacts/steps/01-local-bulk/stdout.txt.',
    '- isSafeArtifactRef must reject refs with ? or #, absolute paths, URL schemes, any path segment exactly .., and raw dump names such as rawdump, raw-dump, or raw_dump in any path segment or filename.',
    '- Do not validate safe relative refs by constructing a URL, because URL parsing converts them into absolute paths.',
    '- deriveActionBoundary must return research-only only when finalVerdict and privateOracle are pass and blockingReviewDefects is an empty array; otherwise return blocked.',
    '',
    'Sanitizer composition requirements:',
    '- Do not throw on null, arrays, malformed cards, missing nested objects, or unsupported schema versions.',
    '- Do not mutate input cards.',
    '- Reject null, arrays, missing objects, and unsupported schema versions.',
    '- Require source.system === "prompt-language" and source.area === "harness-arena".',
    '- Require workItem.id and workItem.runId to be non-empty strings.',
    '- Require route.arm to be local-only, frontier-only, advisor-only, or hybrid-router.',
    '- In gates, finalVerdict and privateOracle must be pass or fail; blockingReviewDefects must be an array and must not be validated as a pass/fail gate value.',
    '- Reject negative or non-finite cost fields.',
    '- Reject forbidden raw or secret payload keys recursively in nested objects and arrays.',
    '- Scan every string value recursively for raw payload text.',
    '- Preserve only allowed top-level fields in the returned card: schemaVersion, source, workItem, route, gates, cost, actionBoundary, and artifactRefs.',
    '- Recompute actionBoundary in the returned card from gates; do not trust caller-supplied actionBoundary.',
    '- Return { ok: false, errors: [...], card: null } on validation failure and { ok: true, errors: [], card } on success.',
    '',
    `TASK.md:\n${task}`,
    `Current src/evidence-card-sanitizer.mjs:\n${sanitizerCurrent}`,
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
const prompt = sanitizerPrompt(options);
const output = await generateWithOllama({ ...options, prompt });
mkdirSync(join(options.workspace, 'src'), { recursive: true });
writeFileSync(
  join(options.workspace, 'src', 'evidence-card-sanitizer.mjs'),
  parseFileBlock(output, 'src/evidence-card-sanitizer.mjs'),
  'utf8',
);
runPublicGate(options.workspace);
console.log(`local lane wrote GSLR-6 scaffolded sanitizer using ${options.model}`);
