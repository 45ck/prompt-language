#!/usr/bin/env node
/**
 * Integration tests for PL_TRACE_DIR env resolution.
 *
 * Spawns a child Node process that instantiates FileTraceLogger from the
 * built dist/ under varying PL_TRACE_DIR settings and asserts the on-disk
 * path. This validates the live behavior that the hook entry points rely
 * on (they construct FileTraceLogger with process.cwd() and no stateDir).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..', '..');
const LOGGER_PATH = join(ROOT, 'dist', 'infrastructure', 'adapters', 'file-trace-logger.js');

function makeTemp() {
  return mkdtempSync(join(tmpdir(), 'pl-trace-env-'));
}

function runChild({ cwd, traceDir }) {
  const loggerUrl = pathToFileURL(LOGGER_PATH).href;
  const code = `
    import('${loggerUrl}').then(({ FileTraceLogger }) => {
      const logger = new FileTraceLogger(process.cwd());
      logger.log({
        runId: 'child-run',
        seq: 0,
        timestamp: '2024-01-01T00:00:00.000Z',
        event: 'node_advance',
        source: 'runtime',
        pid: process.pid,
      });
    }).catch((err) => { console.error(err); process.exit(1); });
  `;
  const env = { ...process.env };
  if (traceDir === undefined) {
    delete env.PL_TRACE_DIR;
  } else {
    env.PL_TRACE_DIR = traceDir;
  }
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd,
    env,
    encoding: 'utf-8',
  });
  if (result.status !== 0) {
    throw new Error(`child failed: ${result.stderr}`);
  }
}

test('PL_TRACE_DIR absolute: provenance.jsonl written at exact path', () => {
  if (!existsSync(LOGGER_PATH)) {
    // Build artifact missing — skip rather than fail so the test suite stays
    // usable before the first `npm run build`.
    return;
  }
  const cwd = makeTemp();
  const traceDir = join(makeTemp(), 'abs-bundle');
  try {
    assert.ok(isAbsolute(traceDir));
    runChild({ cwd, traceDir });
    const file = join(traceDir, 'provenance.jsonl');
    assert.ok(existsSync(file), `expected ${file} to exist`);
    const content = readFileSync(file, 'utf-8');
    assert.match(content, /"child-run"/);
    // And nothing under the cwd's default .prompt-language dir.
    assert.ok(!existsSync(join(cwd, '.prompt-language', 'provenance.jsonl')));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    rmSync(traceDir, { recursive: true, force: true });
  }
});

test('PL_TRACE_DIR relative: resolved against child cwd', () => {
  if (!existsSync(LOGGER_PATH)) return;
  const cwd = makeTemp();
  try {
    runChild({ cwd, traceDir: 'rel-bundle' });
    const file = join(cwd, 'rel-bundle', 'provenance.jsonl');
    assert.ok(existsSync(file), `expected ${file} to exist`);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('PL_TRACE_DIR unset: defaults to <cwd>/.prompt-language (legacy)', () => {
  if (!existsSync(LOGGER_PATH)) return;
  const cwd = makeTemp();
  try {
    runChild({ cwd, traceDir: undefined });
    const file = join(cwd, '.prompt-language', 'provenance.jsonl');
    assert.ok(existsSync(file), `expected ${file} to exist`);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
