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

function readWorkspaceFile(workspace, relativePath) {
  return readFileSync(join(workspace, ...relativePath.split('/')), 'utf8');
}

function projectionPrompt({ arm, step, workspace }) {
  const task = readWorkspaceFile(workspace, 'TASK.md');
  const source = readWorkspaceFile(workspace, 'src/source-projection.md');
  const checklist = readWorkspaceFile(workspace, 'src/expected-envelope-checklist.md');
  const advicePath = join(workspace, 'projection', 'frontier-advice.md');
  const advice =
    step === 'local-apply' && exists(advicePath) ? readFileSync(advicePath, 'utf8') : '';

  return [
    'You are the local bounded-work lane in the GSLR-1 governed routing experiment.',
    `Arm: ${arm}`,
    `Step: ${step}`,
    '',
    'Create ONLY the markdown body for projection/portarium-evidence-envelope.md.',
    'Do not wrap it in a code fence. Do not mention hidden oracles.',
    'Avoid the words password, credential, secret, token, and cookie, even in negative statements.',
    'Use "solo local ownership" instead of "local-only autonomy" when describing non-goals.',
    'Keep the work read-only, no-mutation, refs-only, and honest about proof boundaries.',
    '',
    advice ? `Frontier advice to consider:\n${advice}\n` : '',
    `TASK.md:\n${task}`,
    `src/source-projection.md:\n${source}`,
    `src/expected-envelope-checklist.md:\n${checklist}`,
  ].join('\n\n');
}

function exists(path) {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}

async function generateWithOllama({ endpoint, model, prompt }) {
  const body = {
    model,
    prompt,
    stream: false,
    options: {
      temperature: 0.1,
      num_ctx: 8192,
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
    timeout: Number(process.env.PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS ?? 600_000),
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

function stripMarkdownFence(value) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  return (fenced ? fenced[1] : trimmed).trim() + '\n';
}

const options = parseArgs(process.argv.slice(2));
const prompt = projectionPrompt(options);
const output = stripMarkdownFence(await generateWithOllama({ ...options, prompt }));
const projectionDir = join(options.workspace, 'projection');
mkdirSync(projectionDir, { recursive: true });
writeFileSync(join(projectionDir, 'portarium-evidence-envelope.md'), output, 'utf8');
console.log(`local lane wrote projection/portarium-evidence-envelope.md using ${options.model}`);
