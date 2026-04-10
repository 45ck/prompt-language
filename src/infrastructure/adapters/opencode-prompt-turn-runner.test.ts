import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// cspell:ignore unstub LOCALAPPDATA USERPROFILE

const mockedSpawn = vi.fn();

vi.mock('node:child_process', () => ({
  spawn: mockedSpawn,
}));

const { OpenCodePromptTurnRunner, buildOpenCodePrompt, summarizeOpenCodeJsonOutput } =
  await import('./opencode-prompt-turn-runner.js');
const { buildOpenCodeEnv, prepareOpenCodeEnv } = await import('./opencode-prompt-turn-runner.js');

class MockStream extends EventEmitter {
  setEncoding(_encoding: string): void {}
}

class MockChild extends EventEmitter {
  readonly stdout = new MockStream();
  readonly stderr = new MockStream();
  readonly kill = vi.fn();
}

describe('OpenCodePromptTurnRunner', () => {
  let tempDir = '';

  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  afterEach(async () => {
    if (!tempDir) return;
    await rm(tempDir, { recursive: true, force: true });
    tempDir = '';
  });

  it('launches opencode run with the expected flags', async () => {
    vi.stubEnv('PROMPT_LANGUAGE_OPENCODE_HOME', '/tmp/opencode-home');

    const runner = new OpenCodePromptTurnRunner();
    const child = new MockChild();
    vi.mocked(mockedSpawn).mockReturnValue(child as never);

    const runPromise = runner.run({
      cwd: '/repo',
      model: 'ollama/gemma4:e2b',
      prompt: 'Fix the bug',
    });

    await Promise.resolve();
    child.emit('close', 0);
    const result = await runPromise;

    expect(result.exitCode).toBe(0);
    expect(mockedSpawn).toHaveBeenCalledWith(
      'opencode',
      [
        'run',
        '--pure',
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
        env: expect.objectContaining({
          HOME: '/tmp/opencode-home',
          USERPROFILE: '/tmp/opencode-home',
        }),
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
      '--pure',
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
      '--pure',
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

  it('creates a workspace-scoped ollama profile when no explicit opencode home is provided', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-opencode-home-'));

    const env = await prepareOpenCodeEnv({
      cwd: tempDir,
      model: 'ollama/gemma4:31b',
      prompt: 'Reply with exactly OK',
    });

    const root = join(tempDir, '.prompt-language', 'opencode-home');
    const configPath = join(root, '.config', 'opencode', 'opencode.json');
    const packagePath = join(root, '.config', 'opencode', 'package.json');
    const configText = await readFile(configPath, 'utf8');
    const pkgText = await readFile(packagePath, 'utf8');

    expect(env).toEqual(
      expect.objectContaining({
        HOME: root,
        USERPROFILE: root,
        OLLAMA_API_KEY: 'ollama-local',
      }),
    );
    expect(configText).toContain('"enabled_providers": [\n    "ollama"\n  ]');
    expect(configText).toContain('"model": "ollama/gemma4:31b"');
    expect(configText).toContain('"small_model": "ollama/gemma4:31b"');
    expect(pkgText).toContain('"@ai-sdk/openai-compatible": "latest"');
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
    vi.stubEnv('PROMPT_LANGUAGE_OPENCODE_HOME', '/tmp/opencode-home');

    const runner = new OpenCodePromptTurnRunner();
    const child = new MockChild();
    vi.mocked(mockedSpawn).mockReturnValue(child as never);

    const runPromise = runner.run({
      cwd: '/repo',
      model: 'ollama/gemma4-cpu:31b',
      prompt: 'Return only OK',
    });

    await Promise.resolve();
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

  it('times out with an ollama-specific hint when opencode never emits output', async () => {
    vi.useFakeTimers();
    vi.stubEnv('PROMPT_LANGUAGE_OPENCODE_TIMEOUT_MS', '10');
    vi.stubEnv('PROMPT_LANGUAGE_OPENCODE_HOME', '/tmp/opencode-home');

    const runner = new OpenCodePromptTurnRunner();
    const child = new MockChild();
    vi.mocked(mockedSpawn).mockReturnValue(child as never);

    const runPromise = runner.run({
      cwd: '/repo',
      model: 'ollama/gemma4:31b',
      prompt: 'Return only OK',
    });

    await vi.advanceTimersByTimeAsync(10);
    const result = await runPromise;

    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(result.exitCode).toBe(124);
    expect(result.assistantText).toContain('local Ollama streaming stall');
    expect(result.madeProgress).toBe(false);
  });

  it('preserves stderr details and still appends the ollama timeout hint', async () => {
    vi.useFakeTimers();
    vi.stubEnv('PROMPT_LANGUAGE_OPENCODE_TIMEOUT_MS', '10');
    vi.stubEnv('PROMPT_LANGUAGE_OPENCODE_HOME', '/tmp/opencode-home');

    const runner = new OpenCodePromptTurnRunner();
    const child = new MockChild();
    vi.mocked(mockedSpawn).mockReturnValue(child as never);

    const runPromise = runner.run({
      cwd: '/repo',
      model: 'ollama/gemma4:31b',
      prompt: 'Return only OK',
    });

    await Promise.resolve();
    child.stderr.emit(
      'data',
      'Performing one time database migration, may take a few minutes... sqlite-migration:done Database migration complete.\n',
    );

    await vi.advanceTimersByTimeAsync(10);
    const result = await runPromise;

    expect(result.assistantText).toContain('Database migration complete.');
    expect(result.assistantText).toContain(
      'OpenCode timed out after 10ms waiting for ollama/gemma4:31b.',
    );
    expect(result.assistantText).toContain('local Ollama streaming stall');
  });
});
