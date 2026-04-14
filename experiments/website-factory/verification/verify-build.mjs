#!/usr/bin/env node
// Verify: does the project build?
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const projectDir = resolve(process.argv[2] || '.');

export function verifyBuild(dir) {
  const result = { name: 'build', pass: false, details: '' };

  if (!existsSync(resolve(dir, 'package.json'))) {
    result.details = 'No package.json found';
    return result;
  }

  try {
    execSync('npm run build', { cwd: dir, stdio: 'pipe', timeout: 120_000 });
    result.pass = true;
    result.details = 'Build succeeded';
  } catch (err) {
    result.details = `Build failed: ${err.stderr?.toString().slice(0, 500) || err.message}`;
  }

  return result;
}

if (process.argv[1] === import.meta.filename) {
  const r = verifyBuild(projectDir);
  console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.name}: ${r.details}`);
  process.exit(r.pass ? 0 : 1);
}
