import { describe, it, expect, vi, afterEach } from 'vitest';
import { ShellCommandRunner } from './shell-command-runner.js';

describe('ShellCommandRunner', () => {
  it('runs a successful command', async () => {
    const runner = new ShellCommandRunner();
    const result = await runner.run('echo hello');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
  });

  it('captures non-zero exit code', async () => {
    const runner = new ShellCommandRunner();
    const result = await runner.run('node -e "process.exit(1)"');
    expect(result.exitCode).toBe(1);
  });

  it('captures stderr on failure', async () => {
    const runner = new ShellCommandRunner();
    const result = await runner.run('node -e "process.stderr.write(\'err\'); process.exit(2)"');
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('err');
  });

  it('uses custom timeout from options', async () => {
    const runner = new ShellCommandRunner();
    const result = await runner.run('node -e "setTimeout(() => {}, 5000)"', { timeoutMs: 100 });
    // Command should be killed due to timeout, resulting in non-zero exit
    expect(result.exitCode).not.toBe(0);
  });

  it('returns exitCode 1 when error.code is a string', async () => {
    const runner = new ShellCommandRunner();
    // A command killed by timeout produces error.code = 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' or 'ETIMEDOUT'
    // We use a tiny maxBuffer scenario indirectly; simpler: a non-existent command gives a string code
    const result = await runner.run('__nonexistent_command_xyz_2024__');
    // error.code will be a string (e.g., 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' or shell exit)
    // The important thing: exitCode should be a number, not undefined
    expect(typeof result.exitCode).toBe('number');
    expect(result.exitCode).not.toBe(0);
  });
});

describe('ShellCommandRunner env-var timeout', () => {
  const originalEnv = process.env['PROMPT_LANGUAGE_CMD_TIMEOUT_MS'];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['PROMPT_LANGUAGE_CMD_TIMEOUT_MS'];
    } else {
      process.env['PROMPT_LANGUAGE_CMD_TIMEOUT_MS'] = originalEnv;
    }
    vi.resetModules();
  });

  it('uses PROMPT_LANGUAGE_CMD_TIMEOUT_MS when set to valid number', async () => {
    process.env['PROMPT_LANGUAGE_CMD_TIMEOUT_MS'] = '200';
    vi.resetModules();
    const mod = await import('./shell-command-runner.js');
    const runner = new mod.ShellCommandRunner();
    // A long-sleeping command should be killed quickly with the 200ms timeout
    const result = await runner.run('node -e "setTimeout(() => {}, 10000)"');
    expect(result.exitCode).not.toBe(0);
  });

  it('falls back to 30000 when env var is NaN', async () => {
    process.env['PROMPT_LANGUAGE_CMD_TIMEOUT_MS'] = 'notanumber';
    vi.resetModules();
    const mod = await import('./shell-command-runner.js');
    const runner = new mod.ShellCommandRunner();
    // Should still work with default 30s timeout — a fast command completes fine
    const result = await runner.run('echo ok');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('ok');
  });

  it('falls back to 30000 when env var is zero', async () => {
    process.env['PROMPT_LANGUAGE_CMD_TIMEOUT_MS'] = '0';
    vi.resetModules();
    const mod = await import('./shell-command-runner.js');
    const runner = new mod.ShellCommandRunner();
    const result = await runner.run('echo ok');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('ok');
  });

  it('falls back to 30000 when env var is negative', async () => {
    process.env['PROMPT_LANGUAGE_CMD_TIMEOUT_MS'] = '-500';
    vi.resetModules();
    const mod = await import('./shell-command-runner.js');
    const runner = new mod.ShellCommandRunner();
    const result = await runner.run('echo ok');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('ok');
  });
});

describe('ShellCommandRunner edge cases (real commands)', () => {
  it('captures both stdout and stderr from a single command', async () => {
    const runner = new ShellCommandRunner();
    const result = await runner.run(
      "node -e \"process.stdout.write('out'); process.stderr.write('err')\"",
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('out');
    expect(result.stderr).toBe('err');
  });

  it('returns empty stdout for a command that produces no output', async () => {
    const runner = new ShellCommandRunner();
    const result = await runner.run('node -e ""');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('captures large output within maxBuffer', async () => {
    const runner = new ShellCommandRunner();
    const result = await runner.run('node -e "process.stdout.write(\'x\'.repeat(10000))"');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toHaveLength(10000);
  });

  it('captures stderr but still exits 0', async () => {
    const runner = new ShellCommandRunner();
    const result = await runner.run('node -e "process.stderr.write(\'warning\')"');
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('warning');
  });

  it('captures multiline output', async () => {
    const runner = new ShellCommandRunner();
    const result = await runner.run("node -e \"console.log('line1'); console.log('line2')\"");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('line1');
    expect(result.stdout).toContain('line2');
  });

  it('preserves special characters in output', async () => {
    const runner = new ShellCommandRunner();
    const result = await runner.run('node -e "console.log(\'hello\\\\nworld\\\\ttab\')"');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello');
    expect(result.stdout).toContain('tab');
  });

  it('handles a fast-exiting command', async () => {
    const runner = new ShellCommandRunner();
    const result = await runner.run('node -e "process.exit(0)"');
    expect(result.exitCode).toBe(0);
  });

  it('returns a numeric exit code for high exit codes', async () => {
    const runner = new ShellCommandRunner();
    const result = await runner.run('node -e "process.exit(42)"');
    expect(result.exitCode).toBe(42);
    expect(typeof result.exitCode).toBe('number');
  });
});

describe('ShellCommandRunner (mocked exec)', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('falls back to exitCode 1 when error.code is undefined', async () => {
    vi.doMock('node:child_process', () => ({
      exec: vi.fn(
        (
          _cmd: string,
          _opts: Record<string, unknown>,
          cb: (err: Error | null, stdout: string | null, stderr: string | null) => void,
        ) => {
          const err = new Error('something failed');
          // error.code is undefined (not set)
          cb(err, 'partial', 'errmsg');
        },
      ),
    }));
    const mod = await import('./shell-command-runner.js');
    const runner = new mod.ShellCommandRunner();
    const result = await runner.run('anything');
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('partial');
    expect(result.stderr).toBe('errmsg');
  });

  it('falls back to exitCode 1 when error.code is a string like ETIMEDOUT', async () => {
    vi.doMock('node:child_process', () => ({
      exec: vi.fn(
        (
          _cmd: string,
          _opts: Record<string, unknown>,
          cb: (err: Error | null, stdout: string | null, stderr: string | null) => void,
        ) => {
          const err = new Error('timed out') as Error & { code: string };
          err.code = 'ETIMEDOUT';
          cb(err, '', '');
        },
      ),
    }));
    const mod = await import('./shell-command-runner.js');
    const runner = new mod.ShellCommandRunner();
    const result = await runner.run('anything');
    expect(result.exitCode).toBe(1);
  });

  it('returns empty string when stdout is null on success', async () => {
    vi.doMock('node:child_process', () => ({
      exec: vi.fn(
        (
          _cmd: string,
          _opts: Record<string, unknown>,
          cb: (err: Error | null, stdout: string | null, stderr: string | null) => void,
        ) => {
          cb(null, null, null);
        },
      ),
    }));
    const mod = await import('./shell-command-runner.js');
    const runner = new mod.ShellCommandRunner();
    const result = await runner.run('anything');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  it('returns empty strings when stdout and stderr are null on error', async () => {
    vi.doMock('node:child_process', () => ({
      exec: vi.fn(
        (
          _cmd: string,
          _opts: Record<string, unknown>,
          cb: (err: Error | null, stdout: string | null, stderr: string | null) => void,
        ) => {
          const err = new Error('fail') as Error & { code: number };
          err.code = 3;
          cb(err, null, null);
        },
      ),
    }));
    const mod = await import('./shell-command-runner.js');
    const runner = new mod.ShellCommandRunner();
    const result = await runner.run('anything');
    expect(result.exitCode).toBe(3);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  it('passes maxBuffer of 4MB to exec', async () => {
    let capturedOpts: Record<string, unknown> = {};
    vi.doMock('node:child_process', () => ({
      exec: vi.fn(
        (
          _cmd: string,
          opts: Record<string, unknown>,
          cb: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          capturedOpts = opts;
          cb(null, '', '');
        },
      ),
    }));
    const mod = await import('./shell-command-runner.js');
    const runner = new mod.ShellCommandRunner();
    await runner.run('anything');
    expect(capturedOpts['maxBuffer']).toBe(4 * 1024 * 1024);
  });

  it('passes encoding utf-8 and timeout to exec', async () => {
    let capturedOpts: Record<string, unknown> = {};
    vi.doMock('node:child_process', () => ({
      exec: vi.fn(
        (
          _cmd: string,
          opts: Record<string, unknown>,
          cb: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          capturedOpts = opts;
          cb(null, '', '');
        },
      ),
    }));
    const mod = await import('./shell-command-runner.js');
    const runner = new mod.ShellCommandRunner();
    await runner.run('anything', { timeoutMs: 5000 });
    expect(capturedOpts['encoding']).toBe('utf-8');
    expect(capturedOpts['timeout']).toBe(5000);
  });

  it('includes shell: bash on win32', async () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    let capturedOpts: Record<string, unknown> = {};
    vi.doMock('node:child_process', () => ({
      exec: vi.fn(
        (
          _cmd: string,
          opts: Record<string, unknown>,
          cb: (err: Error | null, stdout: string, stderr: string) => void,
        ) => {
          capturedOpts = opts;
          cb(null, '', '');
        },
      ),
    }));
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      const mod = await import('./shell-command-runner.js');
      const runner = new mod.ShellCommandRunner();
      await runner.run('anything');
      expect(capturedOpts['shell']).toBe('bash');
    } finally {
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    }
  });
});
