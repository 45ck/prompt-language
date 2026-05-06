import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  PROVIDER_TELEMETRY_PATH,
  appendProviderTelemetry,
  normalizeClaudeJsonTelemetry,
  normalizeCodexTelemetryFromJsonl,
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
      cacheReadInputTokens: null,
      cacheCreationInputTokens: null,
      reasoningOutputTokens: null,
      estimatedCostUsd: null,
      retryCount: 1,
    });
  });

  it('summarizes Claude-style cache token fields without treating them as API cost', () => {
    const records = parseProviderTelemetryJsonl(
      JSON.stringify({
        timestamp: '2026-05-06T00:00:00.000Z',
        provider: 'claude',
        tokenUsage: {
          inputTokens: 10,
          outputTokens: 4,
          totalTokens: 14,
          cacheReadInputTokens: 20,
          cacheCreationInputTokens: 30,
        },
      }),
    );

    expect(summarizeProviderTelemetry(records)).toEqual({
      records: 1,
      providers: ['claude'],
      inputTokens: 10,
      outputTokens: 4,
      totalTokens: 14,
      cacheReadInputTokens: 20,
      cacheCreationInputTokens: 30,
      reasoningOutputTokens: null,
      estimatedCostUsd: null,
      retryCount: 0,
    });
  });

  it('normalizes Codex JSONL token and timing events without retaining transcripts', () => {
    const telemetry = normalizeCodexTelemetryFromJsonl(
      [
        '{"type":"event_msg","msg":{"type":"agent_message","message":"secret text"}}',
        JSON.stringify({
          type: 'event_msg',
          msg: {
            type: 'token_count',
            payload: {
              info: {
                last_token_usage: {
                  input_tokens: 10,
                  cached_input_tokens: 4,
                  output_tokens: 5,
                  reasoning_output_tokens: 2,
                  total_tokens: 17,
                },
              },
            },
          },
        }),
        JSON.stringify({
          type: 'event_msg',
          msg: {
            type: 'task_complete',
            payload: {
              duration_ms: 1234,
              time_to_first_token_ms: 321,
            },
          },
        }),
      ].join('\n'),
    );

    expect(telemetry).toEqual({
      tokenUsage: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 17,
        cacheReadInputTokens: 4,
        reasoningOutputTokens: 2,
      },
      duration: {
        totalMs: 1234,
        firstTokenMs: 321,
      },
    });
    expect(JSON.stringify(telemetry)).not.toContain('secret text');
  });

  it('normalizes current Codex turn.completed usage events', () => {
    expect(
      normalizeCodexTelemetryFromJsonl(
        JSON.stringify({
          type: 'turn.completed',
          usage: {
            input_tokens: 20,
            cached_input_tokens: 7,
            output_tokens: 5,
            reasoning_output_tokens: 3,
          },
        }),
      ),
    ).toEqual({
      tokenUsage: {
        inputTokens: 20,
        outputTokens: 5,
        totalTokens: 25,
        cacheReadInputTokens: 7,
        reasoningOutputTokens: 3,
      },
    });
  });

  it('normalizes Claude JSON output usage and result metadata without retaining result text', () => {
    const telemetry = normalizeClaudeJsonTelemetry({
      type: 'result',
      result: 'secret answer',
      session_id: 'session-1',
      total_cost_usd: 0.01,
      duration_ms: 900,
      usage: {
        input_tokens: 6,
        output_tokens: 3,
        cache_read_input_tokens: 2,
        cache_creation_input_tokens: 1,
      },
    });

    expect(telemetry).toEqual({
      tokenUsage: {
        inputTokens: 6,
        outputTokens: 3,
        totalTokens: 9,
        cacheReadInputTokens: 2,
        cacheCreationInputTokens: 1,
      },
      duration: {
        totalMs: 900,
      },
      estimatedCostUsd: 0.01,
      metadata: {
        sessionId: 'session-1',
      },
    });
    expect(JSON.stringify(telemetry)).not.toContain('secret answer');
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
