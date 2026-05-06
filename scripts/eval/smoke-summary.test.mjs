import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildSmokeSummary, parseArgs, renderJson, renderMarkdown } from './smoke-summary.mjs';

async function writeReport(dir, name, body) {
  await writeFile(join(dir, name), `${JSON.stringify(body, null, 2)}\n`, 'utf8');
}

function report(overrides) {
  return {
    timestamp: '2026-05-06T00:00:00.000Z',
    status: 'passed',
    harness: 'codex',
    runnerHarness: 'codex',
    model: 'gpt-5.2',
    only: ['A'],
    duration_ms: 1000,
    passed: 1,
    failed: 0,
    providerMetrics: {
      records: 2,
      providers: ['codex'],
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120,
      cacheReadInputTokens: 80,
      cacheCreationInputTokens: null,
      reasoningOutputTokens: 5,
      estimatedCostUsd: null,
      retryCount: 0,
    },
    providerTelemetry: [
      {
        provider: 'codex',
        prompt: 'do not copy this raw prompt',
        stdout: 'do not copy this raw stdout',
      },
    ],
    tests: [
      {
        name: 'A',
        label: 'Context file relay',
        passed: true,
        duration_ms: 900,
      },
    ],
    ...overrides,
  };
}

test('aggregates pass, fail, blocked, duration, and provider metrics by matrix cell', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pl-smoke-summary-'));
  await writeReport(dir, 'smoke-1.json', report({ timestamp: '2026-05-06T00:00:01.000Z' }));
  await writeReport(
    dir,
    'smoke-2.json',
    report({
      timestamp: '2026-05-06T00:00:02.000Z',
      status: 'failed',
      duration_ms: 3000,
      passed: 0,
      failed: 1,
      providerMetrics: {
        records: 2,
        providers: ['codex'],
        inputTokens: 150,
        outputTokens: 30,
        totalTokens: 180,
        cacheReadInputTokens: 100,
        cacheCreationInputTokens: null,
        reasoningOutputTokens: 7,
        estimatedCostUsd: null,
        retryCount: 1,
      },
      tests: [
        {
          name: 'A',
          label: 'Context file relay',
          passed: false,
          duration_ms: 2800,
        },
      ],
    }),
  );
  await writeReport(
    dir,
    'smoke-3.json',
    report({
      timestamp: '2026-05-06T00:00:03.000Z',
      status: 'blocked',
      blockedReason: 'auth',
      duration_ms: 500,
      passed: 0,
      failed: 0,
      providerMetrics: {
        records: 0,
        providers: ['codex'],
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        estimatedCostUsd: null,
        retryCount: 0,
      },
      tests: [],
    }),
  );

  const summary = await buildSmokeSummary(parseArgs(['--results-dir', dir, '--test', 'A']));

  assert.equal(summary.runs.total, 3);
  assert.equal(summary.runs.passed, 1);
  assert.equal(summary.runs.failed, 1);
  assert.equal(summary.runs.blocked, 1);
  assert.equal(summary.runs.passRateExcludingBlocked, 0.5);
  assert.equal(summary.matrix.length, 1);
  assert.equal(summary.matrix[0].medianDurationMs, 1000);
  assert.equal(summary.matrix[0].providerMetrics.records, 4);
  assert.equal(summary.matrix[0].providerMetrics.inputTokens, 250);
  assert.equal(summary.matrix[0].providerMetrics.estimatedCostUsd, null);
  assert.equal(summary.tests[0].passRate, 0.5);
  assert.equal(summary.tests[0].failureStreak, 1);
  assert.match(summary.evidenceWarnings.join('\n'), /blocked and excluded/);
});

test('filters by harness and preserves provider-reported cost basis', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pl-smoke-summary-'));
  await writeReport(dir, 'smoke-codex.json', report({ timestamp: '2026-05-06T00:00:01.000Z' }));
  await writeReport(
    dir,
    'smoke-claude.json',
    report({
      timestamp: '2026-05-06T00:00:02.000Z',
      harness: 'claude',
      runnerHarness: 'claude',
      model: null,
      providerMetrics: {
        records: 2,
        providers: ['claude'],
        inputTokens: 10,
        outputTokens: 40,
        totalTokens: 50,
        cacheReadInputTokens: 1000,
        cacheCreationInputTokens: 200,
        reasoningOutputTokens: null,
        estimatedCostUsd: 0.123_456,
        retryCount: 0,
      },
      providerTelemetry: [
        {
          provider: 'claude',
          actualModel: 'claude-opus-4-7',
          content: 'do not copy this raw assistant content',
        },
      ],
    }),
  );

  const summary = await buildSmokeSummary(parseArgs(['--results-dir', dir, '--harness', 'claude']));

  assert.equal(summary.source.reportCount, 1);
  assert.equal(summary.matrix[0].harness, 'claude');
  assert.equal(summary.matrix[0].model, 'claude-opus-4-7');
  assert.deepEqual(summary.matrix[0].costBasis, ['provider_reported']);
  assert.equal(summary.matrix[0].providerMetrics.estimatedCostUsd, 0.123_456);
});

test('renders markdown and json without raw provider telemetry fields', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pl-smoke-summary-'));
  await writeReport(dir, 'smoke-1.json', report({ timestamp: '2026-05-06T00:00:01.000Z' }));

  const summary = await buildSmokeSummary(parseArgs(['--results-dir', dir]));
  const markdown = renderMarkdown(summary);
  const json = renderJson(summary);

  assert.match(markdown, /Smoke Evidence Summary/);
  assert.match(markdown, /codex/);
  assert.doesNotMatch(markdown, /do not copy this raw/);
  assert.doesNotMatch(json, /providerTelemetry/);
  assert.doesNotMatch(json, /do not copy this raw/);
});

test('warns on malformed files and zero provider records for prompt-backed smoke', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pl-smoke-summary-'));
  await writeFile(join(dir, 'smoke-bad.json'), '{', 'utf8');
  await writeReport(
    dir,
    'smoke-zero.json',
    report({
      timestamp: '2026-05-06T00:00:01.000Z',
      providerMetrics: {
        records: 0,
        providers: ['codex'],
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        estimatedCostUsd: null,
        retryCount: 0,
      },
    }),
  );

  const summary = await buildSmokeSummary(parseArgs(['--results-dir', dir, '--test', 'A']));

  assert.equal(summary.source.reportCount, 1);
  assert.match(summary.evidenceWarnings.join('\n'), /Skipped malformed smoke report/);
  assert.match(summary.evidenceWarnings.join('\n'), /zero provider records/);
});
