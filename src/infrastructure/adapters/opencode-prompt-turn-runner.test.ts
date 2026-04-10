import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// cspell:ignore unstub LOCALAPPDATA USERPROFILE

const mockedSpawn = vi.fn();

vi.mock('node:child_process', () => ({
  spawn: mockedSpawn,
}));

const { OpenCodePromptTurnRunner, buildOpenCodePrompt, summarizeOpenCodeJsonOutput } =
  await import('./opencode-prompt-turn-runner.js');
const { buildOpenCodeEnv } = await import('./opencode-prompt-turn-runner.js');

class MockStream extends EventEmitter {
  setEncoding(_encoding: string): void {}
}

class MockChild extends EventEmitter {
  readonly stdout = new MockStream();
  readonly stderr = new MockStream();
  readonly kill = vi.fn();
}

describe('OpenCodePromptTurnRunner', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('launches opencode run with the expected flags', async () => {
    const runner = new OpenCodePromptTurnRunner();
    const child = new MockChild();
    vi.mocked(mockedSpawn).mockReturnValue(child as never);

    const runPromise = runner.run({
      cwd: '/repo',
      model: 'ollama/gemma4:e2b',
      prompt: 'Fix the bug',
    });

    child.emit('close', 0);
    const result = await runPromise;

    expect(result.exitCode).toBe(0);
    expect(mockedSpawn).toHaveBeenCalledWith(
      'opencode',
      [
        'run',
        '--format',
        'json',
        '--dangerously-skip-permissions',
        '--dir',
        '/repo',
        '--model',
        'ollama/gemma4:e2b',
        expect.stringContaining('You are executing a prompt-language flow step'),
      ],
      {
        cwd: '/repo',
        env: undefined,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
  });

  it('omits the model flag when one is not provided', () => {
    const runner = new OpenCodePromptTurnRunner();

    expect(
      runner.buildArgs({
        cwd: '/repo',
        prompt: 'Continue',
      }),
    ).toEqual([
      'run',
      '--format',
      'json',
      '--dangerously-skip-permissions',
      '--dir',
      '/repo',
      buildOpenCodePrompt('Continue'),
    ]);
  });

  it('adds agent and variant flags from environment overrides', () => {
    vi.stubEnv('PROMPT_LANGUAGE_OPENCODE_AGENT', 'build');
    vi.stubEnv('PROMPT_LANGUAGE_OPENCODE_VARIANT', 'minimal');

    const runner = new OpenCodePromptTurnRunner();

    expect(
      runner.buildArgs({
        cwd: '/repo',
        prompt: 'Continue',
      }),
    ).toEqual([
      'run',
      '--format',
      'json',
      '--dangerously-skip-permissions',
      '--dir',
      '/repo',
      '--agent',
      'build',
      '--variant',
      'minimal',
      buildOpenCodePrompt('Continue'),
    ]);
  });

  it('builds an isolated opencode environment from PROMPT_LANGUAGE_OPENCODE_HOME', () => {
    vi.stubEnv('PROMPT_LANGUAGE_OPENCODE_HOME', '/tmp/opencode-home');

    expect(buildOpenCodeEnv()).toEqual(
      expect.objectContaining({
        HOME: '/tmp/opencode-home',
        USERPROFILE: '/tmp/opencode-home',
        APPDATA: join('/tmp/opencode-home', 'AppData', 'Roaming'),
        LOCALAPPDATA: join('/tmp/opencode-home', 'AppData', 'Local'),
        XDG_CONFIG_HOME: join('/tmp/opencode-home', '.config'),
        XDG_DATA_HOME: join('/tmp/opencode-home', '.local', 'share'),
      }),
    );
  });

  it('wraps prompts with execution rules', () => {
    const wrapped = buildOpenCodePrompt('Create hello.txt');

    expect(wrapped).toContain('Preserve exact fixture strings, filenames, and file contents');
    expect(wrapped).toContain('Create hello.txt');
  });

  it('detects when the workspace snapshot did not change', () => {
    expect(
      summarizeOpenCodeJsonOutput(
        [
          '{"type":"step_start","part":{"snapshot":"same"}}',
          '{"type":"text","part":{"text":"I can certainly do that."}}',
          '{"type":"step_finish","part":{"snapshot":"same"}}',
        ].join('\n'),
      ),
    ).toEqual({
      assistantText: 'I can certainly do that.',
      madeProgress: false,
    });
  });

  it('detects when the workspace snapshot changed', () => {
    expect(
      summarizeOpenCodeJsonOutput(
        [
          '{"type":"step_start","part":{"snapshot":"before"}}',
          '{"type":"step_finish","part":{"snapshot":"after"}}',
        ].join('\n'),
      ),
    ).toEqual({
      assistantText: undefined,
      madeProgress: true,
    });
  });

  it('treats missing snapshot events as no progress', () => {
    expect(
      summarizeOpenCodeJsonOutput(['{"type":"text","part":{"text":"OK"}}'].join('\n')),
    ).toEqual({
      assistantText: 'OK',
      madeProgress: false,
    });
  });

  it('settles after step_finish even if the opencode process does not close', async () => {
    vi.useFakeTimers();

    const runner = new OpenCodePromptTurnRunner();
    const child = new MockChild();
    vi.mocked(mockedSpawn).mockReturnValue(child as never);

    const runPromise = runner.run({
      cwd: '/repo',
      model: 'ollama/gemma4-cpu:31b',
      prompt: 'Return only OK',
    });

    child.stdout.emit(
      'data',
      [
        '{"type":"step_start","part":{"snapshot":"same"}}',
        '{"type":"text","part":{"text":"OK"}}',
        '{"type":"step_finish","part":{"snapshot":"same"}}',
      ].join('\n'),
    );

    await vi.advanceTimersByTimeAsync(1_000);
    const result = await runPromise;

    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      exitCode: 0,
      assistantText: 'OK',
      madeProgress: false,
    });
  });
});
