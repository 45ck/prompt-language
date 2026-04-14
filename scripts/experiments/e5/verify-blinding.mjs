#!/usr/bin/env node
// E5 blinding verifier.
//
// Checks a stripped workspace tree for PL-lane identity leaks that would
// compromise a blind maintenance handoff. Exits 0 when clean, non-zero when
// any violation is found. With --json, emits the full report to stdout.
//
// Violation classes:
//   - forbidden-filename    : a file whose basename matches a banned pattern
//                             (e.g. "*.flow", "project.flow")
//   - forbidden-directory   : a directory whose basename matches a banned
//                             top-level name (e.g. "prompt-language",
//                             "phases", "flow-packs", ".prompt-language",
//                             "trace", "factory-trace")
//   - forbidden-content     : file content matches a banned identity regex
//   - broken-readme-link    : README references a path that no longer exists
//                             in the stripped tree (warning only — does not
//                             fail the verification)

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const FORBIDDEN_FILE_PATTERNS = [
  { kind: 'suffix', value: '.flow' },
  { kind: 'exact', value: 'project.flow' },
];

const FORBIDDEN_DIR_NAMES = new Set([
  'prompt-language',
  'phases',
  'flow-packs',
  '.prompt-language',
  'trace',
  'factory-trace',
]);

const FORBIDDEN_CONTENT_REGEXES = [
  /prompt-language/i,
  /prompt_language/i,
  /promptlanguage/i,
  /\.flow\b/i,
  /pl-first/i,
  /codex-first/i,
  /factory-lane/i,
  /flow pack/i,
  /PL_RUN_ID/,
  /PL_TRACE/,
  /\.prompt-language\//i,
  /project\.flow/i,
  /phase-1-discovery/i,
  /phase-2-build/i,
  /phase-3-release/i,
];

// Binary-ish extensions we skip for content scanning.
const BINARY_EXT = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.pdf',
  '.zip',
  '.gz',
  '.tar',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.mp3',
  '.mp4',
  '.wav',
]);

function matchesForbiddenFilename(name) {
  for (const p of FORBIDDEN_FILE_PATTERNS) {
    if (p.kind === 'suffix' && name.toLowerCase().endsWith(p.value)) return p;
    if (p.kind === 'exact' && name === p.value) return p;
  }
  return null;
}

function isBinaryPath(path) {
  const lower = path.toLowerCase();
  for (const ext of BINARY_EXT) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

async function walk(root) {
  const out = { files: [], dirs: [] };
  async function recur(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip .git internals from content scanning to reduce noise.
        if (entry.name === '.git') {
          out.dirs.push({ full, name: entry.name, skippedContent: true });
          continue;
        }
        out.dirs.push({ full, name: entry.name, skippedContent: false });
        await recur(full);
      } else if (entry.isFile()) {
        out.files.push({ full, name: entry.name });
      }
    }
  }
  await recur(root);
  return out;
}

export async function verifyBlinding(treeRoot) {
  if (!existsSync(treeRoot)) {
    throw new Error(`verify-blinding: tree not found: ${treeRoot}`);
  }
  const s = await stat(treeRoot);
  if (!s.isDirectory()) {
    throw new Error(`verify-blinding: not a directory: ${treeRoot}`);
  }

  const violations = [];
  const warnings = [];
  const { files, dirs } = await walk(treeRoot);

  // 1. Forbidden directory names (anywhere, but .git is excluded above).
  for (const d of dirs) {
    if (FORBIDDEN_DIR_NAMES.has(d.name)) {
      violations.push({
        kind: 'forbidden-directory',
        path: relative(treeRoot, d.full) || d.name,
        reason: `directory name "${d.name}" is banned`,
      });
    }
  }

  // 2. Forbidden filenames + content scan.
  const readmeFiles = [];
  for (const f of files) {
    const rel = relative(treeRoot, f.full);
    // Skip files inside .git.
    if (rel.split(/[\\/]/).includes('.git')) continue;

    const hit = matchesForbiddenFilename(f.name);
    if (hit) {
      violations.push({
        kind: 'forbidden-filename',
        path: rel,
        reason: `file name matches ${hit.kind} "${hit.value}"`,
      });
    }

    if (isBinaryPath(f.full)) continue;

    let content;
    try {
      content = await readFile(f.full, 'utf8');
    } catch {
      continue;
    }

    for (const rx of FORBIDDEN_CONTENT_REGEXES) {
      const m = content.match(rx);
      if (m) {
        violations.push({
          kind: 'forbidden-content',
          path: rel,
          reason: `content matches ${rx}`,
          sample: m[0].slice(0, 80),
        });
        break; // one hit per file is enough for a violation.
      }
    }

    if (/^readme(\.|$)/i.test(f.name)) {
      readmeFiles.push({ full: f.full, rel, content });
    }
  }

  // 3. Broken README link detection (warning only).
  const LINK_RE = /\[[^\]]+\]\(([^)]+)\)/g;
  for (const readme of readmeFiles) {
    let match;
    while ((match = LINK_RE.exec(readme.content)) !== null) {
      const target = match[1].trim();
      if (/^[a-z]+:/i.test(target)) continue; // external URL
      if (target.startsWith('#')) continue; // in-page anchor
      const cleanTarget = target.split('#')[0].split('?')[0];
      if (!cleanTarget) continue;
      const resolved = join(readme.full, '..', cleanTarget);
      if (!existsSync(resolved)) {
        warnings.push({
          kind: 'broken-readme-link',
          path: readme.rel,
          target,
        });
      }
    }
  }

  return {
    tree: treeRoot,
    clean: violations.length === 0,
    violationCount: violations.length,
    warningCount: warnings.length,
    violations,
    warnings,
  };
}

// CLI
if (process.argv[1]?.endsWith('verify-blinding.mjs')) {
  const args = process.argv.slice(2);
  let tree = null;
  let asJson = false;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--tree') {
      tree = args[++i];
    } else if (args[i] === '--json') {
      asJson = true;
    }
  }
  if (!tree) {
    process.stderr.write('Usage: node verify-blinding.mjs --tree <path> [--json]\n');
    process.exit(2);
  }
  try {
    const report = await verifyBlinding(tree);
    if (asJson) {
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else if (!report.clean) {
      process.stderr.write(`blinding verifier: ${report.violationCount} violation(s) in ${tree}\n`);
      for (const v of report.violations) {
        process.stderr.write(`  - [${v.kind}] ${v.path}: ${v.reason}\n`);
      }
    } else {
      process.stdout.write(`blinding verifier: clean (${tree})\n`);
    }
    process.exit(report.clean ? 0 : 1);
  } catch (err) {
    process.stderr.write(`[verify-blinding] ${err.message}\n`);
    process.exit(2);
  }
}
