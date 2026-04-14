#!/usr/bin/env node
// META-5 bootstrap-envelope preflight checker.
// Validates the 8-item envelope that gates meta-factory thesis eligibility.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..', '..');

const INVENTORY_GLOBS = [
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  'eslint.config.js',
  'eslint.config.mjs',
  'vitest.config.ts',
  'tsconfig.json',
  'tsconfig.build.json',
  '.dependency-cruiser.cjs',
  'knip.json',
  'cspell.json',
];

function parseArgs(argv) {
  const out = { bundle: null, json: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--bundle') {
      const val = argv[i + 1];
      if (!val || val.startsWith('--')) return { error: '--bundle requires a directory path' };
      out.bundle = val;
      i += 1;
    } else {
      return { error: `unknown argument: ${a}` };
    }
  }
  return out;
}

function item(id, name, status, detail, extra) {
  return { id, name, status, detail, ...(extra || {}) };
}

function gitHead(cwd) {
  try {
    return execFileSync('git', ['log', '-1', '--format=%H'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function newestCommitTimeMs(cwd) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%ct'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const secs = Number.parseInt(out, 10);
    return Number.isFinite(secs) ? secs * 1000 : null;
  } catch {
    return null;
  }
}

function newestMtimeMs(dir) {
  let newest = 0;
  const walk = (d) => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(d, e.name);
      try {
        const s = statSync(full);
        if (s.mtimeMs > newest) newest = s.mtimeMs;
        if (e.isDirectory()) walk(full);
      } catch {
        // skip
      }
    }
  };
  walk(dir);
  return newest;
}

function checkItem1PinnedRuntime(repoRoot) {
  const distDir = join(repoRoot, 'dist');
  if (!existsSync(distDir)) {
    return item(1, 'pinned runtime', 'blocked', 'dist/ missing — run `npm run build`');
  }
  const stateHash = join(distDir, 'state-hash.js');
  if (!existsSync(stateHash)) {
    return item(1, 'pinned runtime', 'blocked', 'dist/state-hash.js missing (G2 dependency unmet)');
  }
  const sha = gitHead(repoRoot);
  const commitMs = newestCommitTimeMs(repoRoot);
  const distMs = newestMtimeMs(distDir);
  if (commitMs !== null && distMs < commitMs) {
    return item(1, 'pinned runtime', 'blocked', 'dist/ older than HEAD commit — rebuild required', {
      pinnedSha: sha,
    });
  }
  return item(1, 'pinned runtime', 'ready', 'dist present and newer than HEAD', {
    pinnedSha: sha,
  });
}

function checkItem2Sandbox() {
  const v = process.env.PL_META_SANDBOX;
  if (!v || v.trim() === '') {
    return item(
      2,
      'sandbox',
      'warn',
      'PL_META_SANDBOX unset — operator responsibility; no runtime enforcement',
    );
  }
  return item(2, 'sandbox', 'ready', `PL_META_SANDBOX=${v} (soft-declared)`);
}

function checkItem3Inventory(repoRoot, bundleDir) {
  const entries = [];
  for (const rel of INVENTORY_GLOBS) {
    const p = join(repoRoot, rel);
    if (!existsSync(p)) continue;
    try {
      const buf = readFileSync(p);
      entries.push({ path: rel, sha256: createHash('sha256').update(buf).digest('hex') });
    } catch (err) {
      return item(3, 'inventory hash', 'blocked', `read failed for ${rel}: ${String(err)}`);
    }
  }
  if (entries.length === 0) {
    return item(3, 'inventory hash', 'blocked', 'no protected configs found');
  }
  const manifest = {
    builtAt: new Date().toISOString(),
    excludes: ['dist'],
    entries,
  };
  let written = null;
  if (bundleDir) {
    try {
      mkdirSync(bundleDir, { recursive: true });
      const out = join(bundleDir, 'manifest-pre.json');
      writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
      written = out;
    } catch (err) {
      return item(3, 'inventory hash', 'blocked', `bundle write failed: ${String(err)}`);
    }
  }
  return item(
    3,
    'inventory hash',
    'ready',
    `hashed ${entries.length} protected configs${written ? ` → ${written}` : ' (not persisted; pass --bundle)'}`,
    { entryCount: entries.length, manifestPath: written },
  );
}

function checkItem4ResourceCaps() {
  const keys = ['META_WALL_CLOCK_SEC', 'META_TOKEN_CAP', 'META_EVENT_CAP', 'PL_META_DEPTH', 'META_FS_GROWTH_MB'];
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length === 0) {
    return item(4, 'resource caps', 'ready', 'all resource-cap envs set');
  }
  return item(
    4,
    'resource caps',
    'warn',
    `missing env (defaults apply from meta-harness): ${missing.join(', ')}`,
    { missing },
  );
}

function checkItem5AllowList(repoRoot) {
  const p = join(repoRoot, 'scripts', 'experiments', 'meta', '.binary-allow-list.json');
  if (!existsSync(p)) {
    return item(5, 'allow-list / deny-list', 'warn', '.binary-allow-list.json absent (post-G1 artifact)');
  }
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8'));
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.entries) ? raw.entries : [];
    if (list.length === 0) {
      return item(5, 'allow-list / deny-list', 'warn', 'allow-list present but empty');
    }
    return item(5, 'allow-list / deny-list', 'ready', `allow-list has ${list.length} entries`);
  } catch (err) {
    return item(5, 'allow-list / deny-list', 'warn', `allow-list unreadable: ${String(err)}`);
  }
}

function checkItem6Reviewer() {
  const reviewer = process.env.PL_REVIEWER_FAMILY;
  const factory = process.env.PL_FACTORY_FAMILY;
  if (!reviewer || !factory) {
    const missing = [];
    if (!reviewer) missing.push('PL_REVIEWER_FAMILY');
    if (!factory) missing.push('PL_FACTORY_FAMILY');
    return item(6, 'cross-family reviewer', 'warn', `unset: ${missing.join(', ')}`);
  }
  if (reviewer.trim().toLowerCase() === factory.trim().toLowerCase()) {
    return item(
      6,
      'cross-family reviewer',
      'blocked',
      `factory and reviewer families identical (${reviewer}) — cross-family requirement violated`,
    );
  }
  return item(6, 'cross-family reviewer', 'ready', `factory=${factory} reviewer=${reviewer}`);
}

function checkItem7Approvals() {
  const v = process.env.PL_APPROVE_DESTRUCTIVE;
  if (!v) {
    return item(7, 'approvals', 'warn', 'PL_APPROVE_DESTRUCTIVE unset — externally visible actions unguarded');
  }
  return item(7, 'approvals', 'ready', `PL_APPROVE_DESTRUCTIVE=${v}`);
}

function checkItem8PostRunVerifier() {
  return item(
    8,
    'post-run verifier',
    'unchecked',
    'cannot pre-check; run `verify-trace --state --json` under pinned binary after the experiment and archive bundle atomically',
  );
}

export function runPreflight({ repoRoot = REPO_ROOT, bundleDir = null, env = process.env } = {}) {
  const prevEnv = process.env;
  if (env !== process.env) process.env = env;
  try {
    const items = [
      checkItem1PinnedRuntime(repoRoot),
      checkItem2Sandbox(),
      checkItem3Inventory(repoRoot, bundleDir),
      checkItem4ResourceCaps(),
      checkItem5AllowList(repoRoot),
      checkItem6Reviewer(),
      checkItem7Approvals(),
      checkItem8PostRunVerifier(),
    ];
    const blocked = items.filter((i) => i.status === 'blocked');
    const warn = items.filter((i) => i.status === 'warn');
    let overall;
    if (blocked.length > 0) overall = 'blocked';
    else if (warn.length > 0) overall = 'degraded';
    else overall = 'ready';
    const nextActions = [];
    for (const it of items) {
      if (it.status === 'blocked') nextActions.push(`[blocked #${it.id}] ${it.name}: ${it.detail}`);
      else if (it.status === 'warn') nextActions.push(`[warn #${it.id}] ${it.name}: ${it.detail}`);
    }
    if (overall !== 'blocked') {
      nextActions.push('[reminder #8] run `verify-trace --state --json` post-run under the pinned pre-run binary');
    }
    return { overall, items, nextActions };
  } finally {
    if (env !== prevEnv) process.env = prevEnv;
  }
}

function renderText(report) {
  const lines = [];
  lines.push(`bootstrap-envelope preflight: ${report.overall.toUpperCase()}`);
  for (const it of report.items) {
    lines.push(`  [${it.status.padEnd(9)}] #${it.id} ${it.name} — ${it.detail}`);
  }
  if (report.nextActions.length > 0) {
    lines.push('next actions:');
    for (const a of report.nextActions) lines.push(`  - ${a}`);
  }
  return lines.join('\n');
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) {
    process.stderr.write(`bootstrap-envelope: ${parsed.error}\n`);
    process.exit(2);
  }
  if (parsed.help) {
    process.stdout.write(
      'Usage: node scripts/experiments/meta/bootstrap-envelope.mjs [--bundle <dir>] [--json]\n',
    );
    process.exit(0);
  }
  const bundleDir = parsed.bundle ? resolve(process.cwd(), parsed.bundle) : null;
  const report = runPreflight({ bundleDir });
  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderText(report)}\n`);
  }
  process.exit(report.overall === 'blocked' ? 1 : 0);
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
