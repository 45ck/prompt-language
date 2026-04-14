#!/usr/bin/env node
// Verify: is the project lint-clean?
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const projectDir = resolve(process.argv[2] || '.');

export function verifyLint(dir) {
  const result = { name: 'lint', pass: false, details: '' };

  if (!existsSync(resolve(dir, 'package.json'))) {
    result.details = 'No package.json found';
    return result;
  }

  // Check if eslint is available
  const hasEslint =
    existsSync(resolve(dir, 'node_modules/.bin/eslint')) ||
    existsSync(resolve(dir, '.eslintrc.json')) ||
    existsSync(resolve(dir, '.eslintrc.js')) ||
    existsSync(resolve(dir, 'eslint.config.mjs')) ||
    existsSync(resolve(dir, 'eslint.config.js'));

  if (!hasEslint) {
    result.details = 'No ESLint configuration found';
    return result;
  }

  try {
    execSync('npx eslint . --max-warnings 0', {
      cwd: dir,
      stdio: 'pipe',
      timeout: 60_000,
    });
    result.pass = true;
    result.details = 'Lint clean (0 warnings, 0 errors)';
  } catch (err) {
    const stdout = err.stdout?.toString() || '';
    const errorCount = stdout.match(/(\d+) error/)?.[1] || '?';
    const warnCount = stdout.match(/(\d+) warning/)?.[1] || '?';
    result.details = `Lint failed: ${errorCount} errors, ${warnCount} warnings`;
  }

  return result;
}

if (process.argv[1] === import.meta.filename) {
  const r = verifyLint(projectDir);
  console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.name}: ${r.details}`);
  process.exit(r.pass ? 0 : 1);
}
