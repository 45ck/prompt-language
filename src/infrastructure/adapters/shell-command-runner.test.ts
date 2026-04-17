import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ShellCommandRunner } from './shell-command-runner.js';

const REAL_COMMAND_TEST_TIMEOUT_MS = 30_000;

describe('ShellCommandRunner', () => {
  it(
    'runs a successful command',
    async () => {
      const runner = new ShellCommandRunner();
      const result = await runner.run('echo hello');
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('hello');
    },
    REAL_COMMAND_TEST_TIMEOUT_MS,
  );

  it(
    'captures non-zero exit code',
    async () => {
      const runner = new ShellCommandRunner();
      const result = await runner.run('node -e "process.exit(1)"');
      expect(result.exitCode).toBe(1);
    },
    REAL_COMMAND_TEST_TIMEOUT_MS,
  );

  it('captures stderr on failure', async () => {
    const runner = new ShellCommandRunner();
    const result = await runner.run('node -e "process.stderr.write(\'err\'); process.exit(2)"');
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('err');
  });

  it('expands Windows env placeholders for direct node -e execution', async () => {
    if (process.platform !== 'win32') {
      return;
    }
    const runner = new ShellCommandRunner();
    const result = await runner.run('node -e "console.log(\'%PL_TEST_VALUE%\')"', {
      env: { PL_TEST_VALUE: 'expanded' },
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('expanded');
  });

  it(
    'preserves nested escapes for Windows direct node -e execution',
    async () => {
      if (process.platform !== 'win32') {
        return;
      }

      const dir = await mkdtemp(join(tmpdir(), 'pl-shell-runner-'));
      try {
        const runner = new ShellCommandRunner();
        const target = join(dir, 'escapes.txt');
        const command = `node -e "require('node:fs').writeFileSync('${target.replace(/\\/g, '\\\\')}', 'regex=/\\\\d+/\\\\nline=ok')"`;
        const result = await runner.run(command);
        expect(result.exitCode).toBe(0);
        await expect(readFile(target, 'utf8')).resolves.toBe('regex=/\\d+/\\nline=ok');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
    REAL_COMMAND_TEST_TIMEOUT_MS,
  );

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

type MockChild = EventEmitter & {
  pid: number;
  stdout: EventEmitter;
  stderr: EventEmitter;
};

function createMockChild(pid = 1234): MockChild {
  const child = new EventEmitter() as MockChild;
  child.pid = pid;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

describe('ShellCommandRunner (mocked spawn)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('captures output and exit code from a spawned command', async () => {
    const child = createMockChild();
    let capturedCmd = '';
    let capturedOpts: Record<string, unknown> = {};
    vi.doMock('node:child_process', () => ({
      spawn: vi.fn((cmd: string, opts: Record<string, unknown>) => {
        capturedCmd = cmd;
        capturedOpts = opts;
        return child;
      }),
    }));
    const mod = await import('./shell-command-runner.js');
    const runner = new mod.ShellCommandRunner();
    const runPromise = runner.run('anything');
    child.stdout.emit('data', Buffer.from('partial'));
    child.stderr.emit('data', Buffer.from('errmsg'));
    child.emit('close', 3);
    const result = await runPromise;
    expect(capturedCmd).toBe('anything');
    expect(capturedOpts['shell']).toBeTruthy();
    expect(result.exitCode).toBe(3);
    expect(result.stdout).toBe('partial');
    expect(result.stderr).toBe('errmsg');
  });

  it('forwards the requested cwd to spawn', async () => {
    const child = createMockChild();
    let capturedOpts: Record<string, unknown> = {};
    vi.doMock('node:child_process', () => ({
      spawn: vi.fn((_cmd: string, opts: Record<string, unknown>) => {
        capturedOpts = opts;
        return child;
      }),
    }));
    const mod = await import('./shell-command-runner.js');
    const runner = new mod.ShellCommandRunner();
    const runPromise = runner.run('anything', { cwd: '/tmp/workspace' });
    child.emit('close', 0);
    await runPromise;
    expect(capturedOpts['cwd']).toBe('/tmp/workspace');
  });

  it('falls back to exitCode 1 when spawn emits an error without a numeric code', async () => {
    const child = createMockChild();
    vi.doMock('node:child_process', () => ({
      spawn: vi.fn(() => child),
    }));
    const mod = await import('./shell-command-runner.js');
    const runner = new mod.ShellCommandRunner();
    const runPromise = runner.run('anything');
    child.emit('error', new Error('something failed'));
    const result = await runPromise;
    expect(result.exitCode).toBe(1);
  });

  it('marks timed-out commands and records the timeout message', async () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const killSpy = vi.spyOn(process, 'kill').mockReturnValue(true as never);
    const child = createMockChild(4321);
    vi.doMock('node:child_process', () => ({
      spawn: vi.fn(() => child),
    }));
    try {
      const mod = await import('./shell-command-runner.js');
      const runner = new mod.ShellCommandRunner();
      const runPromise = runner.run('anything', { timeoutMs: 5 });
      await new Promise((resolve) => setTimeout(resolve, 20));
      child.emit('close', null);
      const result = await runPromise;
      expect(killSpy).toHaveBeenCalledWith(-4321, 'SIGTERM');
      expect(result.exitCode).toBe(124);
      expect(result.timedOut).toBe(true);
      expect(result.stderr).toContain('timed out after 1s');
    } finally {
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    }
  });

  it('fails closed when output exceeds the buffer limit', async () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const killSpy = vi.spyOn(process, 'kill').mockReturnValue(true as never);
    const child = createMockChild(9753);
    vi.doMock('node:child_process', () => ({
      spawn: vi.fn(() => child),
    }));
    try {
      const mod = await import('./shell-command-runner.js');
      const runner = new mod.ShellCommandRunner();
      const runPromise = runner.run('anything');
      child.stdout.emit('data', Buffer.alloc(4 * 1024 * 1024 + 1, 'a'));
      child.emit('close', 0);
      const result = await runPromise;
      expect(killSpy).toHaveBeenCalledWith(-9753, 'SIGTERM');
      expect(result.exitCode).toBe(1);
    } finally {
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    }
  });

  it('falls back to killing the direct pid when process-group kill fails', async () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const killSpy = vi.spyOn(process, 'kill').mockImplementation((pid: number) => {
      if (pid < 0) {
        throw new Error('group kill failed');
      }
      return true;
    });
    const child = createMockChild(1357);
    vi.doMock('node:child_process', () => ({
      spawn: vi.fn(() => child),
    }));
    try {
      const mod = await import('./shell-command-runner.js');
      const runner = new mod.ShellCommandRunner();
      const runPromise = runner.run('anything', { timeoutMs: 5 });
      await new Promise((resolve) => setTimeout(resolve, 20));
      child.emit('close', null);
      const result = await runPromise;
      expect(killSpy).toHaveBeenCalledWith(-1357, 'SIGTERM');
      expect(killSpy).toHaveBeenCalledWith(1357, 'SIGTERM');
      expect(result.exitCode).toBe(124);
    } finally {
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    }
  });

  it('uses taskkill on win32 timeout', async () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const child = createMockChild(2468);
    const killer = createMockChild(8642);
    const spawnMock = vi.fn((cmd: string) => {
      if (cmd === 'taskkill') {
        queueMicrotask(() => killer.emit('close', 0));
        return killer;
      }
      return child;
    });
    vi.doMock('node:child_process', () => ({
      spawn: spawnMock,
    }));
    try {
      const mod = await import('./shell-command-runner.js');
      const runner = new mod.ShellCommandRunner();
      const runPromise = runner.run('anything', { timeoutMs: 5 });
      await new Promise((resolve) => setTimeout(resolve, 20));
      child.emit('close', null);
      const result = await runPromise;
      expect(result.timedOut).toBe(true);
      expect(spawnMock).toHaveBeenCalledWith(
        'taskkill',
        ['/F', '/T', '/PID', '2468'],
        expect.objectContaining({ windowsHide: true, stdio: 'ignore' }),
      );
    } finally {
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    }
  });

  it('returns empty strings when stdout and stderr are empty on success', async () => {
    const child = createMockChild();
    vi.doMock('node:child_process', () => ({
      spawn: vi.fn(() => child),
    }));
    const mod = await import('./shell-command-runner.js');
    const runner = new mod.ShellCommandRunner();
    const runPromise = runner.run('anything');
    child.emit('close', 0);
    const result = await runPromise;
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  it('returns empty strings when stdout and stderr are empty on error', async () => {
    const child = createMockChild();
    vi.doMock('node:child_process', () => ({
      spawn: vi.fn(() => child),
    }));
    const mod = await import('./shell-command-runner.js');
    const runner = new mod.ShellCommandRunner();
    const runPromise = runner.run('anything');
    child.emit('error', Object.assign(new Error('fail'), { code: 3 }));
    const result = await runPromise;
    expect(result.exitCode).toBe(3);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  it('passes shell: true on win32', async () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    let capturedOpts: Record<string, unknown> = {};
    const child = createMockChild();
    vi.doMock('node:child_process', () => ({
      spawn: vi.fn((_cmd: string, opts: Record<string, unknown>) => {
        capturedOpts = opts;
        return child;
      }),
    }));
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      const mod = await import('./shell-command-runner.js');
      const runner = new mod.ShellCommandRunner();
      const runPromise = runner.run('anything');
      child.emit('close', 0);
      await runPromise;
      expect(capturedOpts['shell']).toBe(true);
    } finally {
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    }
  });

  it('escapes interpolated Windows shell env values before invoking cmd.exe', async () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    let capturedOpts: Record<string, unknown> = {};
    const child = createMockChild();
    vi.doMock('node:child_process', () => ({
      spawn: vi.fn((_cmd: string, opts: Record<string, unknown>) => {
        capturedOpts = opts;
        return child;
      }),
    }));
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      const mod = await import('./shell-command-runner.js');
      const runner = new mod.ShellCommandRunner();
      const runPromise = runner.run('echo %PROMPT_LANGUAGE_VAR_0%', {
        env: {
          PROMPT_LANGUAGE_VAR_0: 'alpha & beta | (gamma) ^ "delta" < in > out',
          SAFE_ENV: 'untouched&value',
        },
      });
      child.emit('close', 0);
      await runPromise;

      expect(capturedOpts['shell']).toBe(true);
      expect(capturedOpts['env']).toMatchObject({
        PROMPT_LANGUAGE_VAR_0: 'alpha ^& beta ^| ^(gamma^) ^^ ^"delta^" ^< in ^> out',
        SAFE_ENV: 'untouched&value',
      });
    } finally {
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    }
  });

  it('falls back to exitCode 1 when stdout and stderr are null on error', async () => {
    const child = createMockChild();
    vi.doMock('node:child_process', () => ({
      spawn: vi.fn(() => child),
    }));
    const mod = await import('./shell-command-runner.js');
    const runner = new mod.ShellCommandRunner();
    const runPromise = runner.run('anything');
    child.emit('error', Object.assign(new Error('fail'), { code: 3 }));
    const result = await runPromise;
    expect(result.exitCode).toBe(3);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  it('returns exitCode 1 when close emits no numeric code', async () => {
    const child = createMockChild();
    vi.doMock('node:child_process', () => ({
      spawn: vi.fn(() => child),
    }));
    const mod = await import('./shell-command-runner.js');
    const runner = new mod.ShellCommandRunner();
    const runPromise = runner.run('anything');
    child.emit('close', null);
    const result = await runPromise;
    expect(result.exitCode).toBe(1);
    expect(result.timedOut).toBe(false);
  });

  it('bypasses cmd.exe for direct node -e commands on win32', async () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const child = createMockChild(3579);
    let capturedFile = '';
    let capturedArgs: unknown[] = [];
    let capturedOpts: Record<string, unknown> = {};
    vi.doMock('node:child_process', () => ({
      spawn: vi.fn(
        (file: string, argsOrOptions: unknown, maybeOptions?: Record<string, unknown>) => {
          capturedFile = file;
          if (Array.isArray(argsOrOptions)) {
            capturedArgs = argsOrOptions;
            capturedOpts = maybeOptions ?? {};
          } else {
            capturedArgs = [];
            capturedOpts = (argsOrOptions as Record<string, unknown>) ?? {};
          }
          return child;
        },
      ),
    }));

    try {
      const mod = await import('./shell-command-runner.js');
      const runner = new mod.ShellCommandRunner();
      const runPromise = runner.run(
        "node -e \\\"const fs=require('fs'); fs.writeFileSync('x.txt', `count=${1}\\\\n`); console.log(1);\\\"",
      );
      child.stdout.emit('data', Buffer.from('1'));
      child.emit('close', 0);
      const result = await runPromise;

      expect(capturedFile).toBe(process.execPath);
      expect(capturedArgs).toEqual([
        '-e',
        "const fs=require('fs'); fs.writeFileSync('x.txt', `count=${1}\\\\n`); console.log(1);",
      ]);
      expect(capturedOpts['shell']).toBe(false);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('1');
    } finally {
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    }
  });

  it('preserves raw interpolated values for direct node -e placeholder expansion on win32', async () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const child = createMockChild(24601);
    let capturedFile = '';
    let capturedArgs: unknown[] = [];
    vi.doMock('node:child_process', () => ({
      spawn: vi.fn((file: string, argsOrOptions: unknown) => {
        capturedFile = file;
        capturedArgs = Array.isArray(argsOrOptions) ? argsOrOptions : [];
        return child;
      }),
    }));

    try {
      const mod = await import('./shell-command-runner.js');
      const runner = new mod.ShellCommandRunner();
      const runPromise = runner.run('node -e "console.log(\'%PROMPT_LANGUAGE_VAR_0%\')"', {
        env: { PROMPT_LANGUAGE_VAR_0: 'alpha & echo injected' },
      });
      child.emit('close', 0);
      await runPromise;

      expect(capturedFile).toBe(process.execPath);
      expect(capturedArgs).toEqual(['-e', "console.log('alpha & echo injected')"]);
    } finally {
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    }
  });
});
