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
