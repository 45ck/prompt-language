import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./claude-session-runner.js', () => {
  return {
    ClaudeSessionRunner: class MockClaudeSessionRunner {
      __type = 'claude-runner';
      cwd: string;
      constructor(cwd: string) {
        this.cwd = cwd;
      }
    },
  };
});

vi.mock('./cli-session-runner.js', () => {
  return {
    CliSessionRunner: class MockCliSessionRunner {
      __type = 'cli-runner';
      cwd: string;
      runner: string;
      cliPath: string;
      constructor(cwd: string, runner: string, cliPath: string) {
        this.cwd = cwd;
        this.runner = runner;
        this.cliPath = cliPath;
      }
    },
  };
});

vi.mock('./runner-backed-process-spawner.js', () => {
  return {
    RunnerBackedProcessSpawner: class MockRunnerBackedProcessSpawner {
      __type = 'runner-backed';
      runner: unknown;
      constructor(runner: unknown) {
        this.runner = runner;
      }
    },
  };
});

const { resolveProcessSpawner } = await import('./resolve-process-spawner.js');

describe('resolveProcessSpawner', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns RunnerBackedProcessSpawner wrapping ClaudeSessionRunner when PL_SPAWN_RUNNER is unset', () => {
    process.env = { ...originalEnv };
    delete process.env['PL_SPAWN_RUNNER'];
    const spawner = resolveProcessSpawner('/repo') as unknown as {
      __type: string;
      runner: { __type: string };
    };
    expect(spawner.__type).toBe('runner-backed');
    expect(spawner.runner.__type).toBe('claude-runner');
  });

  it('returns RunnerBackedProcessSpawner wrapping ClaudeSessionRunner when PL_SPAWN_RUNNER is "claude"', () => {
    process.env = { ...originalEnv, PL_SPAWN_RUNNER: 'claude' };
    const spawner = resolveProcessSpawner('/repo') as unknown as {
      __type: string;
      runner: { __type: string };
    };
    expect(spawner.__type).toBe('runner-backed');
    expect(spawner.runner.__type).toBe('claude-runner');
  });

  it('returns RunnerBackedProcessSpawner wrapping CliSessionRunner when PL_SPAWN_RUNNER is "codex"', () => {
    process.env = { ...originalEnv, PL_SPAWN_RUNNER: 'codex' };
    const spawner = resolveProcessSpawner('/repo') as unknown as {
      __type: string;
      runner: { __type: string; runner: string };
    };
    expect(spawner.__type).toBe('runner-backed');
    expect(spawner.runner.__type).toBe('cli-runner');
    expect(spawner.runner.runner).toBe('codex');
  });

  it('returns CliSessionRunner for each supported runner', () => {
    for (const runner of ['opencode', 'ollama', 'aider']) {
      process.env = { ...originalEnv, PL_SPAWN_RUNNER: runner };
      const spawner = resolveProcessSpawner('/repo') as unknown as {
        __type: string;
        runner: { __type: string; runner: string };
      };
      expect(spawner.__type).toBe('runner-backed');
      expect(spawner.runner.__type).toBe('cli-runner');
      expect(spawner.runner.runner).toBe(runner);
    }
  });

  it('is case-insensitive for runner name', () => {
    process.env = { ...originalEnv, PL_SPAWN_RUNNER: 'Codex' };
    const spawner = resolveProcessSpawner('/repo') as unknown as {
      __type: string;
      runner: { __type: string; runner: string };
    };
    expect(spawner.__type).toBe('runner-backed');
    expect(spawner.runner.__type).toBe('cli-runner');
    expect(spawner.runner.runner).toBe('codex');
  });

  it('falls back to ClaudeSessionRunner for unknown runners', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    process.env = { ...originalEnv, PL_SPAWN_RUNNER: 'unknown-runner' };
    const spawner = resolveProcessSpawner('/repo') as unknown as {
      __type: string;
      runner: { __type: string };
    };
    expect(spawner.__type).toBe('runner-backed');
    expect(spawner.runner.__type).toBe('claude-runner');
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown PL_SPAWN_RUNNER="unknown-runner"'),
    );
  });

  it('uses PL_CLI_PATH when set', () => {
    process.env = { ...originalEnv, PL_SPAWN_RUNNER: 'codex', PL_CLI_PATH: '/custom/cli.mjs' };
    const spawner = resolveProcessSpawner('/repo') as unknown as {
      __type: string;
      runner: { __type: string; cliPath: string };
    };
    expect(spawner.__type).toBe('runner-backed');
    expect(spawner.runner.__type).toBe('cli-runner');
    expect(spawner.runner.cliPath).toBe('/custom/cli.mjs');
  });

  it('trims whitespace from runner name', () => {
    process.env = { ...originalEnv, PL_SPAWN_RUNNER: '  codex  ' };
    const spawner = resolveProcessSpawner('/repo') as unknown as {
      __type: string;
      runner: { __type: string; runner: string };
    };
    expect(spawner.__type).toBe('runner-backed');
    expect(spawner.runner.__type).toBe('cli-runner');
    expect(spawner.runner.runner).toBe('codex');
  });
});
