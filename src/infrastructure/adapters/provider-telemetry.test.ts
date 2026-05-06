import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  PROVIDER_TELEMETRY_PATH,
  appendProviderTelemetry,
  normalizeOllamaTelemetry,
  parseProviderTelemetryJsonl,
  readProviderTelemetry,
  summarizeProviderTelemetry,
} from './provider-telemetry.js';

describe('provider telemetry', () => {
  let tempDir = '';

  afterEach(async () => {
    if (!tempDir) return;
    await rm(tempDir, { recursive: true, force: true });
    tempDir = '';
  });

  it('normalizes Ollama token counts and nanosecond durations', () => {
    expect(
      normalizeOllamaTelemetry({
        prompt_eval_count: 11,
        eval_count: 7,
        total_duration: 1_500_000_000,
        load_duration: 100_000_000,
        prompt_eval_duration: 300_000_000,
        eval_duration: 900_000_000,
      }),
    ).toEqual({
      tokenUsage: {
        inputTokens: 11,
        outputTokens: 7,
        totalTokens: 18,
      },
      duration: {
        totalMs: 1500,
        loadMs: 100,
        promptEvalMs: 300,
        evalMs: 900,
      },
    });
  });

  it('appends, reads, and summarizes provider telemetry records', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-provider-telemetry-'));

    await appendProviderTelemetry(tempDir, {
      timestamp: '2026-05-06T00:00:00.000Z',
      provider: 'ollama',
      requestedModel: 'gemma4:31b',
      actualModel: 'gemma4:31b',
      tokenUsage: {
        inputTokens: 3,
        outputTokens: 5,
        totalTokens: 8,
      },
      retryCount: 1,
      estimatedCostUsd: null,
    });

    await expect(readFile(join(tempDir, PROVIDER_TELEMETRY_PATH), 'utf8')).resolves.toContain(
      '"provider":"ollama"',
    );

    const records = await readProviderTelemetry(tempDir);
    expect(records).toHaveLength(1);
    expect(summarizeProviderTelemetry(records)).toEqual({
      records: 1,
      providers: ['ollama'],
      inputTokens: 3,
      outputTokens: 5,
      totalTokens: 8,
      estimatedCostUsd: null,
      retryCount: 1,
    });
  });

  it('skips malformed JSONL rows', () => {
    expect(
      parseProviderTelemetryJsonl(
        [
          '{"timestamp":"now","provider":"ollama","tokenUsage":{"totalTokens":4}}',
          'not-json',
          '{"timestamp":"now"}',
        ].join('\n'),
      ),
    ).toEqual([
      {
        timestamp: 'now',
        provider: 'ollama',
        tokenUsage: {
          totalTokens: 4,
        },
      },
    ]);
  });
});
