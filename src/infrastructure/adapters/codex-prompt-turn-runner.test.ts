import { PassThrough } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedSpawn = vi.fn();
const mockedSpawnSync = vi.fn();
const mockedExistsSync = vi.fn();
const mockedReadFileSync = vi.fn();
const mockedRmSync = vi.fn();

vi.mock('node:child_process', () => ({
  spawn: mockedSpawn,
  spawnSync: mockedSpawnSync,
}));

vi.mock('node:fs', () => ({
  existsSync: mockedExistsSync,
  readFileSync: mockedReadFileSync,
  rmSync: mockedRmSync,
}));

const { CodexPromptTurnRunner, buildCodexPrompt } = await import('./codex-prompt-turn-runner.js');

function createChildProcess() {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdin = new PassThrough();
  return {
    pid: 1234,
    stdin,
    stdout,
    stderr,
    kill: vi.fn(),
    once(event: string, handler: (...args: unknown[]) => void) {
      if (event === 'close') {
        stdout.once('close', () => handler(0));
      }
      if (event === 'error') {
        stderr.once('error', handler as (error: Error) => void);
      }
      return this;
    },
  };
}

describe('CodexPromptTurnRunner', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedSpawnSync.mockReturnValue({
      status: 1,
      stdout: '',
    });
    mockedExistsSync.mockReturnValue(false);
    delete process.env['PROMPT_LANGUAGE_CODEX_REASONING_EFFORT'];
    delete process.env['PROMPT_LANGUAGE_SKILL_PROMPT_WRAPPER'];
    delete process.env['PROMPT_LANGUAGE_CODEX_SKILL_PROMPT_WRAPPER'];
  });

  it('wraps prompts with execution rules', () => {
    const wrapped = buildCodexPrompt('Create hello.txt');

    expect(wrapped).toContain('Work directly in the current workspace');
    expect(wrapped).toContain('If a relevant host or repo skill is already available');
    expect(wrapped).toContain('Create hello.txt');
  });

  it('can disable the skill-aware prompt wrapper globally', () => {
    process.env['PROMPT_LANGUAGE_SKILL_PROMPT_WRAPPER'] = '0';

    expect(buildCodexPrompt('Create hello.txt')).toBe('Create hello.txt');
  });

  it('can disable the skill-aware prompt wrapper just for codex', () => {
    process.env['PROMPT_LANGUAGE_CODEX_SKILL_PROMPT_WRAPPER'] = 'false';

    expect(buildCodexPrompt('Create hello.txt')).toBe('Create hello.txt');
  });

  it('builds codex exec args with workspace, model, and output file', () => {
    const runner = new CodexPromptTurnRunner();

    expect(
      runner.buildArgs(
        {
          cwd: '/repo',
          model: 'gpt-5.4',
          prompt: 'Continue',
        },
        '/tmp/out.txt',
      ),
    ).toEqual([
      'exec',
      '--dangerously-bypass-approvals-and-sandbox',
      '--skip-git-repo-check',
      '--output-last-message',
      '/tmp/out.txt',
      '-C',
      '/repo',
      '--model',
      'gpt-5.4',
      '-',
    ]);
  });

  it('adds configured reasoning effort to codex exec args', () => {
    process.env['PROMPT_LANGUAGE_CODEX_REASONING_EFFORT'] = 'medium';
    const runner = new CodexPromptTurnRunner();

    expect(
      runner.buildArgs(
        {
          cwd: '/repo',
          prompt: 'Continue',
        },
        '/tmp/out.txt',
      ),
    ).toEqual([
      'exec',
      '--dangerously-bypass-approvals-and-sandbox',
      '--skip-git-repo-check',
      '--output-last-message',
      '/tmp/out.txt',
      '-C',
      '/repo',
      '-c',
      'model_reasoning_effort="medium"',
      '-',
    ]);
  });

  it('launches codex exec and reads the final assistant message file', async () => {
    const runner = new CodexPromptTurnRunner();
    const child = createChildProcess();
    mockedSpawn.mockReturnValue(child);
    mockedReadFileSync.mockReturnValue('done');

    const resultPromise = runner.run({
      cwd: '/repo',
      model: 'gpt-5.4',
      prompt: 'Fix the bug',
    });
    child.stdout.end();
    child.stderr.end();
    const result = await resultPromise;

    expect(result).toEqual({
      exitCode: 0,
      assistantText: 'done',
    });
    expect(mockedSpawn).toHaveBeenCalledTimes(1);
    expect(mockedSpawn.mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({
        cwd: '/repo',
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      }),
    );
    expect(child.stdin.read()?.toString('utf-8') ?? '').toContain(
      'You are executing a prompt-language flow step',
    );
    expect(mockedRmSync).toHaveBeenCalledTimes(1);
  });

  it('handles child error events by settling with exit code 1', async () => {
    const runner = new CodexPromptTurnRunner();
    const child = createChildProcess();
    mockedSpawn.mockReturnValue(child);
    mockedReadFileSync.mockImplementation(() => {
      throw new Error('no output file');
    });

    let errorHandler: ((err: Error) => void) | undefined;
    child.once = (event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'error') errorHandler = handler as (e: Error) => void;
      return child;
    };

    const resultPromise = runner.run({ cwd: '/repo', prompt: 'die' });
    // Fire stderr data + error
    child.stderr.write('boom\n');
    errorHandler?.(new Error('spawn-failed'));
    const result = await resultPromise;
    expect(result.exitCode).toBe(1);
    expect(result.assistantText).toContain('boom');
    expect(mockedRmSync).toHaveBeenCalled();
  });

  it('falls back to combined stdout/stderr when output file cannot be read', async () => {
    const runner = new CodexPromptTurnRunner();
    const child = createChildProcess();
    mockedSpawn.mockReturnValue(child);
    mockedReadFileSync.mockImplementation(() => {
      throw new Error('missing');
    });

    const resultPromise = runner.run({ cwd: '/repo', prompt: 'Work' });
    child.stdout.write('stdout-text');
    child.stderr.write('stderr-text');
    child.stdout.end();
    child.stderr.end();
    const result = await resultPromise;

    expect(result.exitCode).toBe(0);
    expect(result.assistantText).toContain('stdout-text');
    expect(result.assistantText).toContain('stderr-text');
  });

  it('treats a timed-out child as exit code 124 with timeout message', async () => {
    vi.useFakeTimers();
    try {
      const runner = new CodexPromptTurnRunner();
      const child = createChildProcess();
      mockedSpawn.mockReturnValue(child);
      mockedReadFileSync.mockImplementation(() => {
        throw new Error('missing');
      });

      let closeHandler: ((code: number | null) => void) | undefined;
      child.once = (event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'close') closeHandler = handler as (c: number | null) => void;
        return child;
      };

      const resultPromise = runner.run({ cwd: '/repo', prompt: 'Slow' });
      // Advance fake time past the default timeout so the timer fires.
      vi.advanceTimersByTime(600_001);
      // Simulate the child closing after being killed.
      closeHandler?.(null);
      const result = await resultPromise;

      expect(result.exitCode).toBe(124);
      expect(result.assistantText).toContain('timed out');
    } finally {
      vi.useRealTimers();
    }
  });

  it('surfaces captured output when codex exits non-zero', async () => {
    const runner = new CodexPromptTurnRunner();
    const child = createChildProcess();
    mockedSpawn.mockReturnValue(child);
    mockedReadFileSync.mockReturnValue('partial result');

    child.once = (event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'close') {
        child.stdout.once('close', () => handler(17));
      }
      if (event === 'error') {
        child.stderr.once('error', handler as (error: Error) => void);
      }
      return child;
    };

    const resultPromise = runner.run({
      cwd: '/repo',
      prompt: 'Fix the bug',
    });
    child.stdout.end();
    child.stderr.end();
    const result = await resultPromise;

    expect(result).toEqual({
      exitCode: 17,
      assistantText: 'partial result',
    });
    expect(mockedRmSync).toHaveBeenCalledTimes(1);
  });
});
