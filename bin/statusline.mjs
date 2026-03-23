#!/usr/bin/env node

/**
 * Status line entry point for Claude Code.
 *
 * Claude Code pipes session JSON to stdin. This script reads the working
 * directory from it, loads .prompt-language/session-state.json, and outputs
 * a compact one-line summary to stdout.
 *
 * Configured in ~/.claude/settings.json:
 *   { "statusLine": { "type": "command", "command": "node <path>/statusline.mjs" } }
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDomain = join(__dirname, '..', 'dist', 'domain');

// Dynamic imports — dist/ only exists after build
const { renderStatusLine } = await import(join(distDomain, 'render-status-line.js'));
const { colorizeStatusLine } = await import(join(distDomain, 'colorize-status-line.js'));

let cwd = process.cwd();

// Read Claude Code session JSON from stdin
if (!process.stdin.isTTY) {
  try {
    const input = readFileSync(process.stdin.fd, 'utf8');
    const session = JSON.parse(input);
    // Claude Code provides workspace.current_dir in the session JSON
    if (session.workspace?.current_dir) {
      cwd = session.workspace.current_dir;
    }
  } catch {
    // No valid session JSON — fall back to process.cwd()
  }
}

const statePath = join(cwd, '.prompt-language', 'session-state.json');

let state;
try {
  const raw = readFileSync(statePath, 'utf8');
  state = JSON.parse(raw);
} catch {
  // No state file — no active flow
  const fallback = '[PL] No active flow';
  process.stdout.write(process.env.NO_COLOR ? fallback : colorizeStatusLine(fallback));
  process.exit(0);
}

const line = renderStatusLine(state);
const colored = process.env.NO_COLOR ? line : colorizeStatusLine(line);
process.stdout.write(colored);
