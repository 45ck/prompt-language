// compute-manifest.mjs — SHA-256 manifest for a fixed scope of files.
// Pure node stdlib.

import { createHash } from 'node:crypto';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join, relative, sep, posix } from 'node:path';

const DEFAULT_ROOTS = ['src', 'scripts'];
const DEFAULT_TOP_FILES = [
  'package.json',
  'eslint.config.mjs',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  'vitest.config.ts',
  'vitest.config.js',
  'vitest.config.mjs',
  'tsconfig.json',
  'tsconfig.build.json',
  '.dependency-cruiser.js',
  '.dependency-cruiser.cjs',
  '.dependency-cruiser.mjs',
];

function toPosix(p) {
  return p.split(sep).join(posix.sep);
}

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name === 'node_modules' || ent.name === '.git') continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(full, out);
    } else if (ent.isFile()) {
      out.push(full);
    }
  }
}

function sha256(filePath) {
  const h = createHash('sha256');
  h.update(readFileSync(filePath));
  return h.digest('hex');
}

/**
 * Compute a manifest of { relPosixPath: sha256 } under rootDir.
 * Covers:
 *   - All files in src/** and scripts/**
 *   - Top-level config files in DEFAULT_TOP_FILES that exist.
 */
export function computeManifest(rootDir, opts = {}) {
  const roots = opts.roots ?? DEFAULT_ROOTS;
  const topFiles = opts.topFiles ?? DEFAULT_TOP_FILES;
  const collected = [];
  for (const r of roots) {
    const full = join(rootDir, r);
    try {
      if (statSync(full).isDirectory()) walk(full, collected);
    } catch {
      /* missing dir, skip */
    }
  }
  for (const name of topFiles) {
    const full = join(rootDir, name);
    try {
      if (statSync(full).isFile()) collected.push(full);
    } catch {
      /* skip */
    }
  }
  const manifest = {};
  for (const file of collected) {
    const rel = toPosix(relative(rootDir, file));
    manifest[rel] = sha256(file);
  }
  return manifest;
}

/** Protected-config patterns per META-5 MR-2 rule-weakening guard. */
export const PROTECTED_PATTERNS = [
  /^package\.json$/,
  /^\.eslintrc($|\.)/,
  /^eslint\.config\./,
  /^vitest\.config\./,
  /^tsconfig($|\..*\.json$|\.json$)/,
  /^\.dependency-cruiser($|\.)/,
];

export function isProtectedPath(relPosix) {
  return PROTECTED_PATTERNS.some((re) => re.test(relPosix));
}
