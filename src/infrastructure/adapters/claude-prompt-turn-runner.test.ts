import { PassThrough } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// cspell:ignore xhigh

const mockedSpawn = vi.fn();
const mockedSpawnSync = vi.fn();

vi.mock('node:child_process', () => ({
  spawn: mockedSpawn,
  spawnSync: mockedSpawnSync,
}));

const { ClaudePromptTurnRunner } = await import('./claude-prompt-turn-runner.js');

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

describe('ClaudePromptTurnRunner', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env['PROMPT_LANGUAGE_CLAUDE_EFFORT'];
    delete process.env['PROMPT_LANGUAGE_CLAUDE_TIMEOUT_MS'];
  });

  it('builds claude print args with model and configured effort', () => {
    process.env['PROMPT_LANGUAGE_CLAUDE_EFFORT'] = 'medium';
    const runner = new ClaudePromptTurnRunner();

    expect(
      runner.buildArgs({
        cwd: '/repo',
        model: 'claude-sonnet-4-6',
        prompt: 'Continue',
      }),
    ).toEqual([
      '-p',
      '--dangerously-skip-permissions',
      '--model',
      'claude-sonnet-4-6',
      '--effort',
      'medium',
    ]);
  });

  it('ignores unsupported effort values', () => {
    process.env['PROMPT_LANGUAGE_CLAUDE_EFFORT'] = 'xhigh';
    const runner = new ClaudePromptTurnRunner();

    expect(
      runner.buildArgs({
        cwd: '/repo',
        prompt: 'Continue',
      }),
    ).toEqual(['-p', '--dangerously-skip-permissions']);
  });

  it('launches claude and returns stdout as assistant text', async () => {
    const runner = new ClaudePromptTurnRunner();
    const child = createChildProcess();
    mockedSpawn.mockReturnValue(child);

    const resultPromise = runner.run({
      cwd: '/repo',
      model: 'claude-sonnet-4-6',
      prompt: 'Fix the bug',
    });
    child.stdout.write('done');
    child.stdout.end();
    child.stderr.end();
    const result = await resultPromise;

    expect(result).toEqual({
      exitCode: 0,
      assistantText: 'done',
    });
    const [command, args, options] = mockedSpawn.mock.calls[0] ?? [];
    expect(String(command)).toMatch(/(?:cmd\.exe|claude(?:\.cmd)?)$/);
    expect(args).toEqual(
      expect.arrayContaining([
        '-p',
        '--dangerously-skip-permissions',
        '--model',
        'claude-sonnet-4-6',
      ]),
    );
    expect(options).toEqual(
      expect.objectContaining({
        cwd: '/repo',
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      }),
    );
    expect(child.stdin.read()?.toString('utf-8')).toContain('Fix the bug');
  });

  it('settles with exit code 1 on child error', async () => {
    const runner = new ClaudePromptTurnRunner();
    const child = createChildProcess();
    mockedSpawn.mockReturnValue(child);

    let errorHandler: ((err: Error) => void) | undefined;
    child.once = (event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'error') errorHandler = handler as (e: Error) => void;
      return child;
    };

    const resultPromise = runner.run({ cwd: '/repo', prompt: 'die' });
    child.stderr.write('boom\n');
    errorHandler?.(new Error('spawn-failed'));
    const result = await resultPromise;

    expect(result.exitCode).toBe(1);
    expect(result.assistantText).toContain('boom');
  });

  it('treats a timed-out child as exit code 124', async () => {
    vi.useFakeTimers();
    try {
      const runner = new ClaudePromptTurnRunner();
      const child = createChildProcess();
      mockedSpawn.mockReturnValue(child);

      let closeHandler: ((code: number | null) => void) | undefined;
      child.once = (event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'close') closeHandler = handler as (c: number | null) => void;
        return child;
      };

      const resultPromise = runner.run({ cwd: '/repo', prompt: 'Slow' });
      vi.advanceTimersByTime(600_001);
      closeHandler?.(null);
      const result = await resultPromise;

      expect(result.exitCode).toBe(124);
      expect(result.assistantText).toContain('timed out');
    } finally {
      vi.useRealTimers();
    }
  });
});
