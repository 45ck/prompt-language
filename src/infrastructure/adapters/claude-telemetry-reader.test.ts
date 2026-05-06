import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { readClaudeProviderTelemetry } from './claude-telemetry-reader.js';

describe('Claude telemetry reader', () => {
  let tempDir = '';

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  async function writeClaudeJsonl(lines: readonly unknown[]): Promise<string> {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-claude-telemetry-'));
    const projectDir = join(tempDir, '.claude', 'projects', 'repo');
    await mkdir(projectDir, { recursive: true });
    const path = join(projectDir, 'session.jsonl');
    await writeFile(
      path,
      lines.map((line) => (typeof line === 'string' ? line : JSON.stringify(line))).join('\n'),
      'utf8',
    );
    return tempDir;
  }

  it('extracts usage fields without retaining message content', async () => {
    const homeDir = await writeClaudeJsonl([
      {
        type: 'assistant',
        cwd: 'C:\\repo',
        timestamp: '2026-05-06T00:00:05.000Z',
        sessionId: 'session-1',
        requestId: 'req-1',
        message: {
          role: 'assistant',
          model: 'claude-sonnet-4-6',
          content: 'secret transcript that must not be stored',
          usage: {
            input_tokens: 11,
            output_tokens: 7,
            cache_read_input_tokens: 13,
            cache_creation_input_tokens: 17,
          },
        },
      },
    ]);

    const telemetry = await readClaudeProviderTelemetry({
      cwd: 'C:\\repo',
      startedAt: Date.parse('2026-05-06T00:00:00.000Z'),
      endedAt: Date.parse('2026-05-06T00:00:10.000Z'),
      homeDir,
    });

    expect(telemetry).toEqual({
      provider: 'claude',
      actualModel: 'claude-sonnet-4-6',
      tokenUsage: {
        inputTokens: 11,
        outputTokens: 7,
        totalTokens: 18,
        cacheReadInputTokens: 13,
        cacheCreationInputTokens: 17,
      },
      estimatedCostUsd: null,
      metadata: {
        attributionConfidence: 'medium',
        candidateCount: 1,
        sessionId: 'session-1',
        requestId: 'req-1',
      },
    });
    expect(JSON.stringify(telemetry)).not.toContain('secret transcript');
  });

  it('ignores malformed, unrelated, and out-of-window JSONL rows', async () => {
    const homeDir = await writeClaudeJsonl([
      'not-json',
      {
        type: 'assistant',
        cwd: 'C:\\other',
        timestamp: '2026-05-06T00:00:05.000Z',
        message: { usage: { input_tokens: 99 } },
      },
      {
        type: 'assistant',
        cwd: 'C:\\repo',
        timestamp: '2026-05-05T00:00:05.000Z',
        message: { usage: { input_tokens: 99 } },
      },
    ]);

    await expect(
      readClaudeProviderTelemetry({
        cwd: 'C:\\repo',
        startedAt: Date.parse('2026-05-06T00:00:00.000Z'),
        endedAt: Date.parse('2026-05-06T00:00:10.000Z'),
        homeDir,
      }),
    ).resolves.toBeUndefined();
  });

  it('marks attribution low when multiple usage candidates match', async () => {
    const homeDir = await writeClaudeJsonl([
      {
        type: 'assistant',
        cwd: 'C:\\repo',
        timestamp: '2026-05-06T00:00:05.000Z',
        message: { model: 'claude-haiku', usage: { input_tokens: 1, output_tokens: 2 } },
      },
      {
        type: 'assistant',
        cwd: 'C:\\repo',
        timestamp: '2026-05-06T00:00:06.000Z',
        message: { model: 'claude-sonnet', usage: { input_tokens: 3, output_tokens: 4 } },
      },
    ]);

    const telemetry = await readClaudeProviderTelemetry({
      cwd: 'C:\\repo',
      startedAt: Date.parse('2026-05-06T00:00:00.000Z'),
      endedAt: Date.parse('2026-05-06T00:00:10.000Z'),
      homeDir,
    });

    expect(telemetry?.actualModel).toBe('claude-sonnet');
    expect(telemetry?.tokenUsage).toEqual({
      inputTokens: 4,
      outputTokens: 6,
      totalTokens: 10,
    });
    expect(telemetry?.metadata).toEqual({
      attributionConfidence: 'low',
      candidateCount: 2,
    });
  });
});
