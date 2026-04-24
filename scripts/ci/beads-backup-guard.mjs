#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const CONFIG_PATH = '.beads/backup/config.jsonl';
const STATE_PATH = '.beads/backup/backup_state.json';
const EXPECTED_PREFIX = 'prompt-language';
const MIN_SCHEMA_VERSION = 9;

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' });
}

function fail(message) {
  console.error(`[beads-backup-guard] FAIL - ${message}`);
  process.exit(1);
}

function readGitText(spec) {
  try {
    return git(['show', spec]);
  } catch {
    return undefined;
  }
}

function isPathStaged(path) {
  const staged = git(['diff', '--cached', '--name-only', '--', path])
    .split(/\r?\n/)
    .filter(Boolean);
  return staged.includes(path);
}

function readProtectedPath(path) {
  const staged = isPathStaged(path);
  const text = readGitText(staged ? `:${path}` : `HEAD:${path}`);
  if (text === undefined) {
    fail(`cannot read ${staged ? 'staged' : 'committed'} ${path}`);
  }
  return { staged, text };
}

function parseJsonLine(line, path) {
  try {
    return JSON.parse(line);
  } catch (error) {
    fail(`invalid JSON in ${path}: ${error.message}`);
  }
}

function parseConfig(text) {
  const config = new Map();
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const entry = parseJsonLine(line, `${CONFIG_PATH}:${index + 1}`);
    if (typeof entry?.key !== 'string') {
      fail(`missing string key in ${CONFIG_PATH}:${index + 1}`);
    }
    config.set(entry.key, entry.value);
  }
  return config;
}

function parseState(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`invalid JSON in ${label}: ${error.message}`);
  }
}

function validateConfig(config) {
  const prefix = config.get('issue_prefix');
  if (prefix !== EXPECTED_PREFIX) {
    fail(`issue_prefix must remain "${EXPECTED_PREFIX}", found "${prefix}"`);
  }

  const schemaVersion = Number(config.get('schema_version'));
  if (!Number.isInteger(schemaVersion) || schemaVersion < MIN_SCHEMA_VERSION) {
    fail(
      `schema_version must be >= ${MIN_SCHEMA_VERSION}, found "${config.get('schema_version')}"`,
    );
  }
}

function validateEventCount(stagedStateText) {
  if (stagedStateText === undefined) {
    return;
  }

  const headStateText = readGitText(`HEAD:${STATE_PATH}`);
  if (headStateText === undefined) {
    return;
  }

  const stagedEvents = Number(parseState(stagedStateText, `staged ${STATE_PATH}`).counts?.events);
  const headEvents = Number(parseState(headStateText, `committed ${STATE_PATH}`).counts?.events);
  if (Number.isFinite(stagedEvents) && Number.isFinite(headEvents) && stagedEvents < headEvents) {
    fail(`events count must not decrease (${headEvents} -> ${stagedEvents})`);
  }
}

const protectedConfig = readProtectedPath(CONFIG_PATH);
validateConfig(parseConfig(protectedConfig.text));

if (isPathStaged(STATE_PATH)) {
  validateEventCount(readGitText(`:${STATE_PATH}`));
}

console.log('[beads-backup-guard] PASS - protected Beads backup identity is intact.');
