#!/usr/bin/env node
// Helper: read raw model output from stdin or env, extract the function
// declaration, and replace the named stub in the workspace. Used by the
// .flow runner — flow can't write files directly so this bridges the gap.
//
// Usage:
//   node replace-stub.mjs <fnName> < raw-model-output
//   PL_RAW=<raw> node replace-stub.mjs <fnName>

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(HERE, 'workspace', 'rpncalc.mjs');

const fnName = process.argv[2];
if (!fnName) {
  console.error('usage: replace-stub.mjs <fnName>');
  process.exit(2);
}

let raw;
if (process.env.PL_RAW) {
  raw = process.env.PL_RAW;
} else {
  raw = readFileSync(0, 'utf8');
}

let s = raw.trim();
s = s.replace(/^```(?:javascript|js)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
const m = raw.match(/```(?:javascript|js)?\s*\n([\s\S]*?)\n```/);
if (m) s = m[1].trim();
const idx = s.indexOf('export function');
if (idx === -1) {
  console.error('no export function found in input');
  process.exit(1);
}
const code = s.slice(idx).trim();

const src = readFileSync(WORKSPACE, 'utf8');
const stubRe = new RegExp(
  `export function ${fnName}\\([^)]*\\)\\s*\\{[\\s\\S]*?NOT_IMPLEMENTED:${fnName}[\\s\\S]*?\\}`,
  'm',
);
if (!stubRe.test(src)) {
  console.error(`stub for ${fnName} not found`);
  process.exit(1);
}
writeFileSync(WORKSPACE, src.replace(stubRe, code));
console.log(`replaced ${fnName} (${code.length} chars)`);
