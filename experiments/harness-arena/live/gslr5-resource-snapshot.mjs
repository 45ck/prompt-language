#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', 'ollama ps'], {
  encoding: 'utf8',
  timeout: 30_000,
});

if (result.error) throw result.error;
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 0);
