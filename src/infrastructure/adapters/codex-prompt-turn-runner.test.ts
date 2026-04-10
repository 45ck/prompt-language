import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedExecFileSync = vi.fn();
const mockedReadFileSync = vi.fn();
const mockedRmSync = vi.fn();

vi.mock('node:child_process', () => ({
  execFileSync: mockedExecFileSync,
}));

vi.mock('node:fs', () => ({
  readFileSync: mockedReadFileSync,
  rmSync: mockedRmSync,
}));

const { CodexPromptTurnRunner, buildCodexPrompt } = await import('./codex-prompt-turn-runner.js');

describe('CodexPromptTurnRunner', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
    mockedReadFileSync.mockReturnValue('done');

    const result = await runner.run({
      cwd: '/repo',
      model: 'gpt-5.4',
      prompt: 'Fix the bug',
    });

    expect(result).toEqual({
      exitCode: 0,
      assistantText: 'done',
    });
    expect(mockedExecFileSync).toHaveBeenCalledTimes(1);
    expect(mockedExecFileSync.mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({
        cwd: '/repo',
        encoding: 'utf-8',
        input: expect.stringContaining('You are executing a prompt-language flow step'),
        stdio: ['pipe', 'ignore', 'pipe'],
        timeout: 600000,
      }),
    );
    expect(mockedRmSync).toHaveBeenCalledTimes(1);
  });

  it('surfaces captured output when codex exits non-zero', async () => {
    const runner = new CodexPromptTurnRunner();
    const error = Object.assign(new Error('codex failed'), { status: 17 });
    mockedExecFileSync.mockImplementation(() => {
      throw error;
    });
    mockedReadFileSync.mockReturnValue('partial result');

    const result = await runner.run({
      cwd: '/repo',
      prompt: 'Fix the bug',
    });

    expect(result).toEqual({
      exitCode: 17,
      assistantText: 'partial result',
    });
    expect(mockedRmSync).toHaveBeenCalledTimes(1);
  });
});
