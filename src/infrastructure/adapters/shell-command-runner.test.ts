import { describe, it, expect } from 'vitest';
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
});
