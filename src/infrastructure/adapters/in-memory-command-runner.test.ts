import { describe, it, expect } from 'vitest';
import { InMemoryCommandRunner } from './in-memory-command-runner.js';

describe('InMemoryCommandRunner', () => {
  it('returns default success result for unknown commands', async () => {
    const runner = new InMemoryCommandRunner();
    const result = await runner.run('anything');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  it('returns pre-programmed result', async () => {
    const runner = new InMemoryCommandRunner();
    runner.setResult('npm test', {
      exitCode: 1,
      stdout: 'FAIL',
      stderr: 'error',
    });

    const result = await runner.run('npm test');
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('FAIL');
    expect(result.stderr).toBe('error');
  });

  it('tracks executed commands', async () => {
    const runner = new InMemoryCommandRunner();
    await runner.run('cmd1');
    await runner.run('cmd2');
    await runner.run('cmd1');
    expect(runner.executedCommands).toEqual(['cmd1', 'cmd2', 'cmd1']);
  });
});
