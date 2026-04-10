import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// cspell:ignore unstub

import { OllamaPromptTurnRunner, parseActionEnvelope } from './ollama-prompt-turn-runner.js';

describe('parseActionEnvelope', () => {
  it('parses a strict json action envelope', () => {
    expect(
      parseActionEnvelope(
        '{"actions":[{"type":"write_file","path":"hello.txt","content":"Hello"}]}',
      ),
    ).toEqual({
      actions: [{ type: 'write_file', path: 'hello.txt', content: 'Hello' }],
    });
  });

  it('extracts json from fenced content', () => {
    expect(
      parseActionEnvelope('```json\n{"actions":[{"type":"done","message":"ok"}]}\n```'),
    ).toEqual({
      actions: [{ type: 'done', message: 'ok' }],
    });
  });

  it('rejects invalid action shapes', () => {
    expect(parseActionEnvelope('{"actions":[{"type":"write_file"}]}')).toBeUndefined();
  });
});

describe('OllamaPromptTurnRunner', () => {
  let tempDir = '';
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.unstubAllEnvs();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    if (!tempDir) return;
    await rm(tempDir, { recursive: true, force: true });
    tempDir = '';
  });

  it('writes files requested by the model and reports progress', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-ollama-runner-'));
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content:
            '{"actions":[{"type":"write_file","path":"hello.txt","content":"Hello, world!"},{"type":"done","message":"created"}]}',
        },
      }),
    });

    const runner = new OllamaPromptTurnRunner();
    const result = await runner.run({
      cwd: tempDir,
      model: 'ollama/gemma4:31b',
      prompt: 'Create hello.txt containing exactly Hello, world!',
    });

    expect(result).toEqual({
      exitCode: 0,
      assistantText: 'created',
      madeProgress: true,
    });
    await expect(readFile(join(tempDir, 'hello.txt'), 'utf8')).resolves.toBe('Hello, world!');
    await expect(
      readFile(join(tempDir, '.prompt-language', 'ollama-turns.jsonl'), 'utf8'),
    ).resolves.toContain('"workspaceActions":1');
  });

  it('allows done-only acknowledgements for non-workspace prompts', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-ollama-runner-'));
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: '{"actions":[{"type":"done","message":"Acknowledged"}]}',
        },
      }),
    });

    const runner = new OllamaPromptTurnRunner();
    const result = await runner.run({
      cwd: tempDir,
      model: 'ollama/gemma4:31b',
      prompt: 'The code is alpha-bravo-99. Acknowledge it.',
    });

    expect(result).toEqual({
      exitCode: 0,
      assistantText: 'Acknowledged',
      madeProgress: true,
    });
  });

  it('marks done-only workspace prompts as no observable progress', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-ollama-runner-'));
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: '{"actions":[{"type":"done","message":"OK"}]}',
        },
      }),
    });

    const runner = new OllamaPromptTurnRunner();
    const result = await runner.run({
      cwd: tempDir,
      model: 'ollama/gemma4:31b',
      prompt: 'Create secret.txt containing exactly "magic-unicorn-42"',
    });

    expect(result).toEqual({
      exitCode: 0,
      assistantText: 'OK',
      madeProgress: false,
    });
  });

  it('falls back to gemma4-cpu:31b when gemma4:31b fails to load', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-ollama-runner-'));
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error:
            'model failed to load, this may be due to resource limitations or an internal error, check ollama server logs for details',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: {
            content:
              '{"actions":[{"type":"write_file","path":"hello.txt","content":"OK"},{"type":"done","message":"created"}]}',
          },
        }),
      });

    const runner = new OllamaPromptTurnRunner();
    const result = await runner.run({
      cwd: tempDir,
      model: 'ollama/gemma4:31b',
      prompt: 'Create a file named hello.txt containing exactly OK',
    });

    expect(result).toEqual({
      exitCode: 0,
      assistantText: 'created',
      madeProgress: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://127.0.0.1:11434/api/chat');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://127.0.0.1:11434/api/chat');
    await expect(
      readFile(join(tempDir, '.prompt-language', 'ollama-turns.jsonl'), 'utf8'),
    ).resolves.toContain('"actualModel":"gemma4-cpu:31b"');
  });
});
