import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// cspell:ignore aider qwen PYTHONUTF unstub

const mockedExecFileSync = vi.fn();

vi.mock('node:child_process', () => ({
  execFileSync: mockedExecFileSync,
}));

const { AiderPromptTurnRunner, buildAiderArgs, buildAiderEnv } =
  await import('./aider-prompt-turn-runner.js');

describe('buildAiderArgs', () => {
  it('builds args with the default model when none is provided', () => {
    const args = buildAiderArgs({ cwd: '/repo', prompt: 'Fix the bug' }, ['app.ts']);

    expect(args).toEqual([
      '-m',
      'aider',
      '--model',
      'ollama_chat/qwen3-opencode:30b',
      '--no-auto-commits',
      '--no-stream',
      '--yes',
      '--no-show-model-warnings',
      '--map-tokens',
      '1024',
      '--edit-format',
      'whole',
      '--message',
      'Fix the bug',
      'app.ts',
    ]);
  });

  it('uses the provided model instead of the default', () => {
    const args = buildAiderArgs(
      { cwd: '/repo', prompt: 'Continue', model: 'ollama_chat/custom:7b' },
      [],
    );

    expect(args[3]).toBe('ollama_chat/custom:7b');
  });

  it('appends multiple files at the end', () => {
    const args = buildAiderArgs({ cwd: '/repo', prompt: 'Refactor' }, ['a.ts', 'b.ts', 'c.ts']);

    expect(args.slice(-3)).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });
});

describe('buildAiderEnv', () => {
  it('sets PYTHONUTF8 and OLLAMA_API_BASE', () => {
    const env = buildAiderEnv();

    expect(env['PYTHONUTF8']).toBe('1');
    expect(env['OLLAMA_API_BASE']).toBe('http://127.0.0.1:11434');
  });

  it('preserves existing process env vars', () => {
    const env = buildAiderEnv();

    expect(env['PATH']).toBe(process.env['PATH']);
  });
});

describe('AiderPromptTurnRunner', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('calls python with aider args and returns stdout on success', async () => {
    mockedExecFileSync.mockReturnValue('File updated successfully.');

    const runner = new AiderPromptTurnRunner();
    const result = await runner.run({
      cwd: '/repo',
      prompt: 'Fix the bug',
    });

    expect(result).toEqual({
      exitCode: 0,
      assistantText: 'File updated successfully.',
      madeProgress: true,
    });

    expect(mockedExecFileSync).toHaveBeenCalledWith(
      'python',
      expect.arrayContaining(['aider', '--message', 'Fix the bug']),
      expect.objectContaining({
        cwd: '/repo',
        encoding: 'utf8',
        env: expect.objectContaining({
          PYTHONUTF8: '1',
          OLLAMA_API_BASE: 'http://127.0.0.1:11434',
        }),
      }),
    );
  });

  it('returns undefined assistantText when stdout is empty', async () => {
    mockedExecFileSync.mockReturnValue('   ');

    const runner = new AiderPromptTurnRunner();
    const result = await runner.run({ cwd: '/repo', prompt: 'Noop' });

    expect(result.assistantText).toBeUndefined();
    expect(result.exitCode).toBe(0);
    expect(result.madeProgress).toBe(true);
  });

  it('captures non-zero exit code from execFileSync error', async () => {
    const err = new Error('aider failed') as Error & {
      status: number;
      stdout: string;
      stderr: string;
    };
    err.status = 2;
    err.stdout = 'partial output';
    err.stderr = 'error details';
    mockedExecFileSync.mockImplementation(() => {
      throw err;
    });

    const runner = new AiderPromptTurnRunner();
    const result = await runner.run({ cwd: '/repo', prompt: 'Fix it' });

    expect(result.exitCode).toBe(2);
    expect(result.assistantText).toContain('partial output');
    expect(result.assistantText).toContain('error details');
    expect(result.madeProgress).toBe(true);
  });

  it('returns exitCode 124 when the process is killed by timeout', async () => {
    const err = new Error('TIMEOUT') as Error & {
      killed: boolean;
      stdout: string;
      stderr: string;
    };
    err.killed = true;
    err.stdout = '';
    err.stderr = '';
    mockedExecFileSync.mockImplementation(() => {
      throw err;
    });

    const runner = new AiderPromptTurnRunner();
    const result = await runner.run({ cwd: '/repo', prompt: 'Slow task' });

    expect(result.exitCode).toBe(124);
    expect(result.assistantText).toContain('timed out');
    expect(result.madeProgress).toBe(false);
  });

  it('falls back to exitCode 1 when error has no numeric status', async () => {
    const err = new Error('unknown failure') as Error & {
      stdout: string;
      stderr: string;
    };
    err.stdout = '';
    err.stderr = 'crash';
    mockedExecFileSync.mockImplementation(() => {
      throw err;
    });

    const runner = new AiderPromptTurnRunner();
    const result = await runner.run({ cwd: '/repo', prompt: 'Crash' });

    expect(result.exitCode).toBe(1);
    expect(result.assistantText).toBe('crash');
    expect(result.madeProgress).toBe(false);
  });

  it('uses the custom timeout from environment variable', async () => {
    vi.stubEnv('PROMPT_LANGUAGE_AIDER_TIMEOUT_MS', '5000');
    mockedExecFileSync.mockReturnValue('ok');

    const runner = new AiderPromptTurnRunner();
    await runner.run({ cwd: '/repo', prompt: 'Quick' });

    expect(mockedExecFileSync).toHaveBeenCalledWith(
      'python',
      expect.anything(),
      expect.objectContaining({ timeout: 5000 }),
    );
  });

  it('uses the default timeout when the env var is invalid', async () => {
    vi.stubEnv('PROMPT_LANGUAGE_AIDER_TIMEOUT_MS', 'notanumber');
    mockedExecFileSync.mockReturnValue('ok');

    const runner = new AiderPromptTurnRunner();
    await runner.run({ cwd: '/repo', prompt: 'Quick' });

    expect(mockedExecFileSync).toHaveBeenCalledWith(
      'python',
      expect.anything(),
      expect.objectContaining({ timeout: 600_000 }),
    );
  });

  it('truncates long output to MAX_OUTPUT_LENGTH', async () => {
    mockedExecFileSync.mockReturnValue('x'.repeat(15_000));

    const runner = new AiderPromptTurnRunner();
    const result = await runner.run({ cwd: '/repo', prompt: 'Verbose' });

    expect(result.assistantText?.length).toBeLessThanOrEqual(12_003);
    expect(result.assistantText).toContain('...');
  });

  it('resolveFiles returns an empty array by default', () => {
    const runner = new AiderPromptTurnRunner();

    expect(runner.resolveFiles('/repo')).toEqual([]);
  });
});
