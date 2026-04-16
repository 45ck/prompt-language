import { createHash } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// cspell:ignore aider qwen PYTHONUTF unstub

import { NULL_TRACE_LOGGER, type TraceLogger } from '../../application/ports/trace-logger.js';
import { TracedPromptTurnRunner } from './traced-prompt-turn-runner.js';

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

// -----------------------------------------------------------------------------
// Security-audit additions (docs/security/aider-adapter-audit.md)
// -----------------------------------------------------------------------------
describe('AiderPromptTurnRunner — security audit coverage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('forwards PL_RUN_ID / PL_TRACE / PL_TRACE_DIR / PL_TRACE_STRICT to the child env (parity with claude-process-spawner)', () => {
    vi.stubEnv('PL_RUN_ID', 'run-abc-123');
    vi.stubEnv('PL_TRACE', '1');
    vi.stubEnv('PL_TRACE_DIR', '/tmp/pl-trace');
    vi.stubEnv('PL_TRACE_STRICT', '1');

    const env = buildAiderEnv();

    // ClaudeProcessSpawner forwards exactly these trace-chain env vars to
    // every spawned child. The aider adapter forwards them by inheritance
    // via { ...process.env, ... }. That is strictly a superset of the
    // reference pattern — this test locks that behavior in.
    expect(env['PL_RUN_ID']).toBe('run-abc-123');
    expect(env['PL_TRACE']).toBe('1');
    expect(env['PL_TRACE_DIR']).toBe('/tmp/pl-trace');
    expect(env['PL_TRACE_STRICT']).toBe('1');
  });

  it('invokes the python binary by bare name so PATH shims can intercept', async () => {
    // A shim on PATH must be able to intercept the python binary lookup
    // (e.g. for test isolation, sandboxing, or deterministic replay). If
    // the adapter hard-coded an absolute interpreter path, shim semantics
    // would break. Assert the first arg to execFileSync is literal "python".
    mockedExecFileSync.mockReturnValue('ok');

    const runner = new AiderPromptTurnRunner();
    await runner.run({ cwd: '/repo', prompt: 'shim check' });

    expect(mockedExecFileSync).toHaveBeenCalledTimes(1);
    const firstCall = mockedExecFileSync.mock.calls[0];
    expect(firstCall).toBeDefined();
    const command = firstCall?.[0];
    expect(command).toBe('python');
  });

  it('produces non-empty sha256 stdin/stdout digests when wrapped with TracedPromptTurnRunner', async () => {
    // Lock in that the aider adapter correctly participates in the shared
    // trace-chain stdin/stdout hashing envelope. stdinSha256 must equal
    // sha256(input.prompt) because that prompt is passed verbatim as
    // `--message <prompt>`; stdoutSha256 must equal sha256(assistantText).
    const prompt = 'Fix the bug in parse.ts';
    const stdoutText = 'Patched parse.ts successfully.';
    mockedExecFileSync.mockReturnValue(stdoutText);

    const captured: Record<string, unknown>[] = [];
    const capturingLogger: TraceLogger = {
      log: (entry) => {
        captured.push(entry as unknown as Record<string, unknown>);
      },
    };

    const runId = 'audit-run-xgav-14';
    const previousRunId = process.env['PL_RUN_ID'];
    process.env['PL_RUN_ID'] = runId;
    try {
      const traced = new TracedPromptTurnRunner(new AiderPromptTurnRunner(), capturingLogger);
      const result = await traced.run({ cwd: '/repo', prompt });

      expect(result.exitCode).toBe(0);
      expect(captured).toHaveLength(2);

      const begin = captured[0];
      const end = captured[1];
      expect(begin?.['event']).toBe('agent_invocation_begin');
      expect(end?.['event']).toBe('agent_invocation_end');

      const expectedStdin = createHash('sha256').update(prompt, 'utf-8').digest('hex');
      const expectedStdout = createHash('sha256').update(stdoutText, 'utf-8').digest('hex');
      expect(begin?.['stdinSha256']).toBe(expectedStdin);
      expect(begin?.['stdinSha256']).toMatch(/^[a-f0-9]{64}$/);
      expect(end?.['stdoutSha256']).toBe(expectedStdout);
      expect(end?.['stdoutSha256']).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      if (previousRunId === undefined) {
        delete process.env['PL_RUN_ID'];
      } else {
        process.env['PL_RUN_ID'] = previousRunId;
      }
    }
  });

  it('NULL_TRACE_LOGGER short-circuit still runs the adapter without emitting trace entries', async () => {
    // Complementary guarantee: when tracing is OFF, no trace entries fire,
    // but the adapter must still execute normally. This prevents a
    // regression where tracing wrapping could silently break aider.
    mockedExecFileSync.mockReturnValue('ack');

    const traced = new TracedPromptTurnRunner(new AiderPromptTurnRunner(), NULL_TRACE_LOGGER);
    const result = await traced.run({ cwd: '/repo', prompt: 'no-trace' });

    expect(result.exitCode).toBe(0);
    expect(result.assistantText).toBe('ack');
  });

  // TODO(bead-followup prompt-xgav.11.1): aider passes the full prompt on argv
  // via `--message <prompt>`, making it visible to any local user via
  // `ps -ef` / `/proc/<pid>/cmdline` / Process Explorer. Codex sends the
  // prompt over stdin instead. Until the adapter migrates to stdin
  // (`--message-file -` or piped stdin), this test is skipped. Re-enable
  // after the stdin-migration bead lands.
  it.skip('TODO(bead-followup): does NOT pass the raw prompt on argv (ps-visibility fix)', async () => {
    mockedExecFileSync.mockReturnValue('ok');

    const runner = new AiderPromptTurnRunner();
    const sensitivePrompt = 'SECRET_TOKEN=ghp_exampleSensitiveValue please fix';
    await runner.run({ cwd: '/repo', prompt: sensitivePrompt });

    const firstCall = mockedExecFileSync.mock.calls[0];
    const argv = firstCall?.[1] as readonly string[] | undefined;
    expect(argv).toBeDefined();
    // The fix should ensure the prompt body never appears in argv — it must
    // be delivered over stdin (or a temp file) so it does not leak into OS
    // process listings.
    expect(argv?.some((arg) => arg === sensitivePrompt)).toBe(false);
  });
});
