/**
 * ShellCommandRunner — executes commands via child_process.
 */

import { spawn } from 'node:child_process';
import type {
  CommandRunner,
  CommandResult,
  RunOptions,
} from '../../application/ports/command-runner.js';

function getDefaultTimeoutMs(): number {
  const envVal = process.env['PROMPT_LANGUAGE_CMD_TIMEOUT_MS'];
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 30_000;
}

const DEFAULT_TIMEOUT_MS = getDefaultTimeoutMs();
const MAX_BUFFER_BYTES = 4 * 1024 * 1024;
const SHELL_META_PATTERN = /(?:\|\||&&|>>|[|><;&])/;

interface DirectExecution {
  readonly file: string;
  readonly args: readonly string[];
}

function expandWindowsEnvPlaceholders(
  text: string,
  env: NodeJS.ProcessEnv | Readonly<Record<string, string>>,
): string {
  return text.replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (_match, name: string) => env[name] ?? '');
}

function tryParseDirectExecution(command: string): DirectExecution | undefined {
  if (process.platform !== 'win32') {
    return undefined;
  }

  const trimmed = command.trim();
  if (!/^node\s+-e\s+/i.test(trimmed)) {
    if (SHELL_META_PATTERN.test(trimmed)) {
      return undefined;
    }
    return undefined;
  }

  let script = trimmed.replace(/^node\s+-e\s+/i, '').trim();
  if (script.startsWith('\\"') && script.endsWith('\\"')) {
    script = script.slice(2, -2);
  } else if (
    (script.startsWith('"') && script.endsWith('"')) ||
    (script.startsWith("'") && script.endsWith("'"))
  ) {
    script = script.slice(1, -1);
  } else {
    return undefined;
  }

  return {
    file: process.execPath,
    args: ['-e', script.replace(/\\"/g, '"').replace(/\\\\/g, '\\')],
  };
}

async function terminateProcessTree(pid: number): Promise<boolean> {
  if (process.platform === 'win32') {
    return await new Promise<boolean>((resolve) => {
      const killer = spawn('taskkill', ['/F', '/T', '/PID', String(pid)], {
        windowsHide: true,
        stdio: 'ignore',
      });
      killer.once('error', () => resolve(false));
      killer.once('close', (code) => resolve(code === 0));
    });
  }

  try {
    process.kill(-pid, 'SIGTERM');
    return true;
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
      return true;
    } catch {
      return false;
    }
  }
}

function createTimedOutResult(stdout: string, stderr: string, timeoutMs: number): CommandResult {
  const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  const timeoutMessage = `timed out after ${timeoutSeconds}s`;
  const nextStdout = stdout.trimEnd();
  const nextStderr = [stderr.trimEnd(), timeoutMessage].filter(Boolean).join('\n');
  return {
    exitCode: 124,
    stdout: nextStdout,
    stderr: nextStderr,
    timedOut: true,
  };
}

export class ShellCommandRunner implements CommandRunner {
  async run(command: string, options?: RunOptions): Promise<CommandResult> {
    const timeout = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const envOverride = options?.env ? { ...process.env, ...options.env } : process.env;
    const directExecution = tryParseDirectExecution(command);
    const shell = directExecution === undefined;
    const detached = process.platform !== 'win32';

    return await new Promise<CommandResult>((resolve) => {
      const directArgs =
        directExecution === undefined
          ? undefined
          : directExecution.args.map((arg) => expandWindowsEnvPlaceholders(arg, envOverride));
      const child =
        directExecution === undefined
          ? spawn(command, {
              shell,
              detached,
              windowsHide: true,
              cwd: options?.cwd,
              env: envOverride,
              stdio: ['ignore', 'pipe', 'pipe'],
            })
          : spawn(directExecution.file, directArgs ?? [], {
              shell,
              detached,
              windowsHide: true,
              cwd: options?.cwd,
              env: envOverride,
              stdio: ['ignore', 'pipe', 'pipe'],
            });

      let stdout = '';
      let stderr = '';
      let finished = false;
      let timedOut = false;
      let tooMuchOutput = false;

      const finish = (result: CommandResult): void => {
        if (finished) return;
        finished = true;
        resolve(result);
      };

      const killChild = async (): Promise<void> => {
        if (child.pid == null) return;
        await terminateProcessTree(child.pid);
      };

      const timer =
        timeout > 0
          ? setTimeout(() => {
              timedOut = true;
              void killChild();
            }, timeout)
          : null;

      child.stdout?.on('data', (chunk: Buffer) => {
        if (tooMuchOutput) return;
        stdout += chunk.toString('utf-8');
        if (Buffer.byteLength(stdout, 'utf-8') > MAX_BUFFER_BYTES) {
          tooMuchOutput = true;
          void killChild();
        }
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        if (tooMuchOutput) return;
        stderr += chunk.toString('utf-8');
        if (Buffer.byteLength(stderr, 'utf-8') > MAX_BUFFER_BYTES) {
          tooMuchOutput = true;
          void killChild();
        }
      });

      child.once('error', (error: NodeJS.ErrnoException) => {
        if (timer) clearTimeout(timer);
        finish({
          exitCode: typeof error.code === 'number' ? error.code : 1,
          stdout,
          stderr,
          timedOut,
        });
      });

      child.once('close', (code) => {
        if (timer) clearTimeout(timer);

        if (timedOut) {
          finish(createTimedOutResult(stdout, stderr, timeout));
          return;
        }

        if (tooMuchOutput) {
          finish({
            exitCode: 1,
            stdout,
            stderr,
          });
          return;
        }

        if (typeof code === 'number') {
          finish({
            exitCode: code,
            stdout,
            stderr,
          });
          return;
        }

        finish({
          exitCode: 1,
          stdout,
          stderr,
          timedOut,
        });
      });
    });
  }
}
