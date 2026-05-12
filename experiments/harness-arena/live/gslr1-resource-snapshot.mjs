#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const endpoint = process.argv.includes('--endpoint')
  ? process.argv[process.argv.indexOf('--endpoint') + 1]
  : (process.env.PROMPT_LANGUAGE_OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434');

try {
  const response = await fetch(new URL('/api/ps', endpoint)).catch((error) => {
    if (process.env.PROMPT_LANGUAGE_OLLAMA_TRANSPORT === 'powershell') {
      return fetchViaPowerShell(endpoint);
    }
    throw error;
  });
  if (typeof response === 'string') {
    console.log(response);
    process.exit(0);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  console.log(JSON.stringify(payload, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function fetchViaPowerShell(endpoint) {
  const url = new URL('/api/ps', endpoint);
  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1') {
    url.hostname = '127.0.0.1';
  }
  const command = [
    `$result = Invoke-RestMethod -Uri '${String(url)}' -Method Get;`,
    '$result | ConvertTo-Json -Depth 20 -Compress',
  ].join(' ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], {
    encoding: 'utf8',
    timeout: 30_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Ollama PowerShell snapshot failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}
