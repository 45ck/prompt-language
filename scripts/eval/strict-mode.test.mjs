#!/usr/bin/env node
/**
 * Sanity tests for PL_TRACE_STRICT behavior in verifyTraceForCwd.
 *
 * These tests exercise the decision branches directly — no Claude binary,
 * no shim, no runtime emission. They re-import the harness module with
 * different env var combinations because TRACE_ENABLED is captured at
 * module load time.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const harnessPath = resolve(import.meta.dirname, 'harness.mjs');

function makeTempCwd() {
  return mkdtempSync(join(tmpdir(), 'pl-strict-'));
}

async function importHarnessFresh() {
  // Append a unique query string to bust the ESM cache so TRACE_ENABLED
  // re-evaluates against the currently-set env vars.
  const url = pathToFileURL(harnessPath).href + `?t=${Date.now()}-${Math.random()}`;
  return import(url);
}

test('PL_TRACE=1, strict unset: missing trace file skips silently', async () => {
  process.env.PL_TRACE = '1';
  delete process.env.PL_TRACE_STRICT;
  const cwd = makeTempCwd();
  try {
    const { verifyTraceForCwd } = await importHarnessFresh();
    const result = verifyTraceForCwd(cwd);
    assert.equal(result.ok, true);
    assert.equal(result.skipped, true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('PL_TRACE=1, PL_TRACE_STRICT=1: missing trace file fails with expected message', async () => {
  process.env.PL_TRACE = '1';
  process.env.PL_TRACE_STRICT = '1';
  const cwd = makeTempCwd();
  try {
    const { verifyTraceForCwd } = await importHarnessFresh();
    const result = verifyTraceForCwd(cwd);
    assert.equal(result.ok, false);
    assert.match(
      result.message,
      /PL_TRACE_STRICT: expected \.prompt-language\/provenance\.jsonl in .* but none was written/,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    delete process.env.PL_TRACE_STRICT;
  }
});

test('PL_TRACE unset: verifier is a no-op regardless of strict', async () => {
  delete process.env.PL_TRACE;
  process.env.PL_TRACE_STRICT = '1';
  const cwd = makeTempCwd();
  try {
    const { verifyTraceForCwd } = await importHarnessFresh();
    const result = verifyTraceForCwd(cwd);
    assert.equal(result.ok, true);
    assert.equal(result.skipped, true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    delete process.env.PL_TRACE_STRICT;
  }
});
