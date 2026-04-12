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
  });

  it('wraps prompts with execution rules', () => {
    const wrapped = buildCodexPrompt('Create hello.txt');

    expect(wrapped).toContain('Work directly in the current workspace');
    expect(wrapped).toContain('Create hello.txt');
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
