#!/usr/bin/env node
// Verify: is it a real project structure (not a single HTML blob)?
import { existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const projectDir = resolve(process.argv[2] || '.');

export function verifyStructure(dir) {
  const result = { name: 'structure', pass: false, details: '', metrics: {} };

  if (!existsSync(resolve(dir, 'package.json'))) {
    result.details = 'No package.json found';
    return result;
  }

  // Count source files recursively (excluding node_modules, .next, dist, .git)
  const skipDirs = new Set(['node_modules', '.next', 'dist', 'out', '.git', '.astro']);
  let sourceFiles = 0;
  let componentFiles = 0;
  let cssFiles = 0;
  let configFiles = 0;
  let directories = 0;

  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        directories++;
        walk(join(d, entry.name));
      } else {
        const name = entry.name;
        if (/\.(tsx?|jsx?|astro|svelte|vue)$/.test(name)) {
          sourceFiles++;
          if (
            /component|section|hero|feature|pricing|nav|footer|card|badge|btn|button/i.test(name)
          ) {
            componentFiles++;
          }
        }
        if (/\.(css|scss|sass|less)$/.test(name)) cssFiles++;
        if (/^(tailwind|postcss|next|astro|vite|tsconfig)/.test(name)) configFiles++;
      }
    }
  }

  walk(dir);

  result.metrics = { sourceFiles, componentFiles, cssFiles, configFiles, directories };

  const checks = [];
  if (sourceFiles >= 5) checks.push(`${sourceFiles} source files`);
  else checks.push(`only ${sourceFiles} source files (need >=5)`);

  if (componentFiles >= 3) checks.push(`${componentFiles} component files`);
  else checks.push(`only ${componentFiles} component files (need >=3)`);

  if (directories >= 3) checks.push(`${directories} directories`);
  else checks.push(`only ${directories} directories (need >=3)`);

  if (configFiles >= 1) checks.push(`${configFiles} config files`);
  else checks.push('no config files found');

  result.pass = sourceFiles >= 5 && componentFiles >= 3 && directories >= 3;
  result.details = checks.join(', ');

  return result;
}

if (process.argv[1] === import.meta.filename) {
  const r = verifyStructure(projectDir);
  console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.name}: ${r.details}`);
  console.log('  Metrics:', JSON.stringify(r.metrics));
  process.exit(r.pass ? 0 : 1);
}
