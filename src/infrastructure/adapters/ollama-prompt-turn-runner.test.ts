import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// cspell:ignore fscrud unstub

import {
  OllamaPromptTurnRunner,
  parseActionEnvelope,
  simplifyPromptLanguageEnvelope,
} from './ollama-prompt-turn-runner.js';

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

describe('simplifyPromptLanguageEnvelope', () => {
  it('compacts prompt-language headless envelopes for local models', () => {
    const original = [
      '[prompt-language] Flow: test let/var | Status: active',
      '',
      '~ let greeting = "hello world"  [= hello world]',
      '~ let ver = run "node -v"  [= v25.6.1]',
      '~ prompt: Write the greeting "${greeting}" and node version "${ver}" to result.txt',
      '',
      'Variables:',
      '  greeting = hello world',
      '  ver = v25.6.1',
      '',
      'Write the greeting "hello world" and node version "v25.6.1" to result.txt',
      '',
      '[prompt-language: step 0/3 "done", vars: 7]',
    ].join('\n');

    expect(simplifyPromptLanguageEnvelope(original)).toBe(
      [
        'Context:',
        'Flow: test let/var | Status: active',
        '',
        'Variables:',
        '  greeting = hello world',
        '  ver = v25.6.1',
        '',
        'Current task:',
        'Write the greeting "hello world" and node version "v25.6.1" to result.txt',
      ].join('\n'),
    );
  });

  it('leaves non-envelope prompts unchanged', () => {
    expect(simplifyPromptLanguageEnvelope('Create hello.txt containing OK')).toBe(
      'Create hello.txt containing OK',
    );
  });

  it('preserves prior prompt history when it carries recall context', () => {
    const original = [
      '[prompt-language] Flow: recall test | Status: active',
      '',
      '~ prompt: The code is "alpha-bravo-99". Acknowledge it.',
      '~ prompt: Create recall.txt containing the code from the previous step.',
      '',
      'Create a file called recall.txt containing exactly the code from the previous step, nothing else.',
      '',
      '[prompt-language: step 0/2 "done", vars: 2]',
    ].join('\n');

    expect(simplifyPromptLanguageEnvelope(original)).toBe(
      [
        'Context:',
        'Flow: recall test | Status: active',
        '',
        '~ prompt: The code is "alpha-bravo-99". Acknowledge it.',
        '',
        'Current task:',
        'Create a file called recall.txt containing exactly the code from the previous step, nothing else.',
      ].join('\n'),
    );
  });

  it('drops the current marked prompt line when compacting an active step envelope', () => {
    const original = [
      '[prompt-language] Flow: recall test | Status: active',
      '',
      '~ prompt: The code is "alpha-bravo-99". Acknowledge it.',
      '> prompt: Create a file called recall.txt containing exactly the code from the previous step, nothing else.  <-- current',
      '',
      'The code is "alpha-bravo-99". Acknowledge it.',
      '',
      '[prompt-language: step 2/2 "prompt: Create recall...", vars: 0]',
    ].join('\n');

    expect(simplifyPromptLanguageEnvelope(original)).toBe(
      [
        'Context:',
        'Flow: recall test | Status: active',
        '',
        'Current task:',
        'The code is "alpha-bravo-99". Acknowledge it.',
      ].join('\n'),
    );
  });

  it('compacts capture envelopes to the current task and capture instruction', () => {
    const original = [
      '[prompt-language] Flow: test let-prompt capture | Status: active',
      '',
      '> let items = prompt "List exactly three colors: red, green, blue. One per line, no bullets."  [awaiting response...]  <-- current',
      '  foreach item in ${items}',
      '    run: echo ${item} >> colors.txt',
      '  end',
      '',
      '[Capture active: write response to .prompt-language/vars/items using Write tool]',
      '',
      'List exactly three colors: red, green, blue. One per line, no bullets.',
      '',
      '[Internal — prompt-language variable capture: After completing the task above, save your answer to `.prompt-language/vars/items` using the Write tool.]',
      '',
      '[prompt-language: step 1/3 "let items", vars: 0]',
    ].join('\n');

    expect(simplifyPromptLanguageEnvelope(original)).toBe(
      [
        'List exactly three colors: red, green, blue. One per line, no bullets.',
        '',
        '[Internal — prompt-language variable capture: After completing the task above, save your answer to `.prompt-language/vars/items` using the Write tool.]',
        '',
        'Do not execute future flow steps. Do not create or edit workspace files during capture.',
      ].join('\n'),
    );
  });

  it('leaves resumed envelopes unchanged so recovery context is not compacted away', () => {
    const original = [
      '[prompt-language] Flow: resume flow | Status: active',
      '',
      '~ prompt: Rebuild the auth module.',
      '> run: npm test  <-- current',
      '',
      '[resumed from [prompt-language: step 2/2 "run: npm test", vars: 1]]',
      'Continue from the restored step.',
      '',
      '[prompt-language: step 2/2 "run: npm test", vars: 1]',
    ].join('\n');

    expect(simplifyPromptLanguageEnvelope(original)).toBe(original);
  });

  it('leaves pending-gate envelopes unchanged so gate uncertainty stays visible', () => {
    const original = [
      '[prompt-language] Flow: gated flow | Status: active',
      '',
      '> prompt: Keep going  <-- current',
      '',
      'done when:',
      '  tests_pass  [pending]',
      '  lint_pass  [pass]',
      '',
      'Continue.',
      '',
      '[prompt-language: step 1/1 "prompt: Keep going", vars: 0, gates: 1/2 passed]',
    ].join('\n');

    expect(simplifyPromptLanguageEnvelope(original)).toBe(original);
  });

  it('leaves resumed spawn/await envelopes unchanged so child recovery stays inspectable', () => {
    const original = [
      '[prompt-language] Flow: spawn flow | Status: active',
      '',
      '~ spawn "fix-auth"  [running]',
      '> await all  <-- current',
      '',
      '[resumed from [prompt-language: step 2/3 "await all", vars: 1]]',
      'Continue after restore.',
      '',
      '[prompt-language: step 2/3 "await all", vars: 1]',
    ].join('\n');

    expect(simplifyPromptLanguageEnvelope(original)).toBe(original);
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

  it('treats a compacted first-step acknowledgement as progress even when the raw envelope contains later file work', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-ollama-runner-'));
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: '{"actions":[{"type":"done","message":"Code alpha-bravo-99 acknowledged."}]}',
        },
      }),
    });

    const runner = new OllamaPromptTurnRunner();
    const result = await runner.run({
      cwd: tempDir,
      model: 'ollama/gemma4:31b',
      prompt: [
        '[prompt-language] Flow: recall test | Status: active',
        '',
        '~ prompt: The code is "alpha-bravo-99". Acknowledge it.',
        '~ prompt: Create a file called recall.txt containing exactly the code from the previous step, nothing else.',
        '',
        'The code is "alpha-bravo-99". Acknowledge it.',
        '',
        '[prompt-language: step 0/2 "done", vars: 0]',
      ].join('\n'),
    });

    expect(result).toEqual({
      exitCode: 0,
      assistantText: 'Code alpha-bravo-99 acknowledged.',
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

  it('retries transient fetch failures before failing the turn', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-ollama-runner-'));
    vi.stubEnv('PROMPT_LANGUAGE_OLLAMA_RETRY_DELAY_MS', '1');
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce({
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
      model: 'ollama/qwen3-opencode-big:30b',
      prompt: 'Create a file named hello.txt containing exactly OK',
    });

    expect(result).toEqual({
      exitCode: 0,
      assistantText: 'created',
      madeProgress: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect(readFile(join(tempDir, 'hello.txt'), 'utf8')).resolves.toBe('OK');
  });

  it('retries Ollama cold-start model runner crashes', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-ollama-runner-'));
    vi.stubEnv('PROMPT_LANGUAGE_OLLAMA_RETRY_DELAY_MS', '1');
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error:
            'model runner has unexpectedly stopped, this may be due to resource limitations or an internal error',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: {
            content: '{"actions":[{"type":"done","message":"ready"}]}',
          },
        }),
      });

    const runner = new OllamaPromptTurnRunner();
    const result = await runner.run({
      cwd: tempDir,
      model: 'ollama/qwen3-opencode-big:30b',
      prompt: 'Acknowledge the task.',
    });

    expect(result).toEqual({
      exitCode: 0,
      assistantText: 'ready',
      madeProgress: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('feeds file action failures back to the model instead of aborting the turn', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-ollama-runner-'));
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: {
            content: '{"actions":[{"type":"read_file","path":"package.json"}]}',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: {
            content:
              '{"actions":[{"type":"write_file","path":"workspace/fscrud-01/package.json","content":"{\\"scripts\\":{\\"test\\":\\"node --test\\"}}"},{"type":"done","message":"repaired"}]}',
          },
        }),
      });

    const runner = new OllamaPromptTurnRunner();
    const result = await runner.run({
      cwd: tempDir,
      model: 'ollama/qwen3-opencode-big:30b',
      prompt: 'Repair package.json only under workspace/fscrud-01.',
    });

    expect(result).toEqual({
      exitCode: 0,
      assistantText: 'repaired',
      madeProgress: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondPrompt = JSON.stringify(fetchMock.mock.calls[1]?.[1]);
    expect(secondPrompt).toContain('read_file(package.json) failed');
    await expect(
      readFile(join(tempDir, 'workspace', 'fscrud-01', 'package.json'), 'utf8'),
    ).resolves.toContain('node --test');
  });

  it('roots relative file actions under the declared workspace variable', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-ollama-runner-'));
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content:
            '{"actions":[{"type":"write_file","path":"src/domain.js","content":"module.exports = {};"},{"type":"done","message":"domain created"}]}',
        },
      }),
    });

    const runner = new OllamaPromptTurnRunner();
    const result = await runner.run({
      cwd: tempDir,
      model: 'ollama/qwen3-opencode-big:30b',
      prompt: [
        'Variables:',
        '  fscrud_workspace = workspace/fscrud-01',
        '',
        'Current task:',
        'Repair src/domain.js only.',
      ].join('\n'),
    });

    expect(result).toEqual({
      exitCode: 0,
      assistantText: 'domain created',
      madeProgress: true,
    });
    await expect(readFile(join(tempDir, 'src', 'domain.js'), 'utf8')).rejects.toThrow();
    await expect(
      readFile(join(tempDir, 'workspace', 'fscrud-01', 'src', 'domain.js'), 'utf8'),
    ).resolves.toBe('module.exports = {};');
  });

  it('rejects workspace writes during capture turns', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-ollama-runner-'));
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: {
            content:
              '{"actions":[{"type":"write_file","path":"workspace/app.js","content":"bad"}]}',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: {
            content:
              '{"actions":[{"type":"write_file","path":".prompt-language/vars/items","content":"{\\"ok\\":true}"},{"type":"done","message":"captured"}]}',
          },
        }),
      });

    const runner = new OllamaPromptTurnRunner();
    const result = await runner.run({
      cwd: tempDir,
      model: 'ollama/qwen3-opencode-big:30b',
      prompt: [
        '[prompt-language] Flow: capture | Status: active',
        '',
        '> let items = prompt "Return JSON."  [awaiting response...]  <-- current',
        '  prompt: Create workspace/app.js',
        '',
        '[Capture active: write response to .prompt-language/vars/items using Write tool]',
        '',
        'Return JSON.',
        '',
        '[Internal — prompt-language variable capture: After completing the task above, save your answer to `.prompt-language/vars/items` using the Write tool.]',
        '',
        '[prompt-language: step 1/2 "let items", vars: 0]',
      ].join('\n'),
    });

    expect(result).toEqual({
      exitCode: 0,
      assistantText: 'Captured .prompt-language/vars/items',
      madeProgress: true,
    });
    await expect(readFile(join(tempDir, 'workspace', 'app.js'), 'utf8')).rejects.toThrow();
    await expect(
      readFile(join(tempDir, '.prompt-language', 'vars', 'items'), 'utf8'),
    ).resolves.toBe('{"ok":true}');
  });

  it('rejects commands during capture turns and accepts equivalent capture paths', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-ollama-runner-'));
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: {
            content:
              '{"actions":[{"type":"run_command","command":"Set-Content leaked.txt bad"},{"type":"done","message":"not captured"}]}',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: {
            content:
              '{"actions":[{"type":"write_file","path":"./.prompt-language/vars/items","content":"done"}]}',
          },
        }),
      });

    const runner = new OllamaPromptTurnRunner();
    const result = await runner.run({
      cwd: tempDir,
      model: 'ollama/qwen3-opencode-big:30b',
      prompt: [
        '[prompt-language] Flow: capture | Status: active',
        '',
        '> let items = prompt "Return text."  [awaiting response...]  <-- current',
        '',
        '[Capture active: write response to .prompt-language/vars/items using Write tool]',
        '',
        'Return text.',
        '',
        '[Internal — prompt-language variable capture: After completing the task above, save your answer to `.prompt-language/vars/items` using the Write tool.]',
      ].join('\n'),
    });

    expect(result).toEqual({
      exitCode: 0,
      assistantText: 'Captured .prompt-language/vars/items',
      madeProgress: true,
    });
    await expect(readFile(join(tempDir, 'leaked.txt'), 'utf8')).rejects.toThrow();
    await expect(
      readFile(join(tempDir, '.prompt-language', 'vars', 'items'), 'utf8'),
    ).resolves.toBe('done');
  });

  it('detects JSON capture instructions as capture turns', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-ollama-runner-'));
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: {
            content: '{"actions":[{"type":"done","message":"Frame completed."}]}',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: {
            content:
              '{"actions":[{"type":"write_file","path":".prompt-language/vars/senior_frame","content":"{\\"objective\\":\\"ship\\"}"}]}',
          },
        }),
      });

    const runner = new OllamaPromptTurnRunner();
    const result = await runner.run({
      cwd: tempDir,
      model: 'ollama/qwen3-opencode-big:30b',
      prompt: [
        '[prompt-language] Flow: capture | Status: active',
        '',
        '> let senior_frame = prompt "Return strict JSON only." as json { ... }  [awaiting response...]  <-- current',
        '',
        '[Capture active: write response to .prompt-language/vars/senior_frame using Write tool]',
        '',
        'Return strict JSON only.',
        '',
        '[Internal — prompt-language JSON capture: Respond with a JSON object that matches this schema:',
        '```',
        '"objective": "string"',
        '```',
        'Save your JSON answer to `.prompt-language/vars/senior_frame` using the Write tool. Respond with ONLY valid JSON — no explanation, no markdown fences, just the JSON object. Maximum 2000 characters.]',
      ].join('\n'),
    });

    expect(result).toEqual({
      exitCode: 0,
      assistantText: 'Captured .prompt-language/vars/senior_frame',
      madeProgress: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect(
      readFile(join(tempDir, '.prompt-language', 'vars', 'senior_frame'), 'utf8'),
    ).resolves.toBe('{"objective":"ship"}');
  });
});
