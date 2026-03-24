/**
 * ShellCommandRunner — executes commands via child_process.
 */

import { exec } from 'node:child_process';
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

export class ShellCommandRunner implements CommandRunner {
  async run(command: string, options?: RunOptions): Promise<CommandResult> {
    const timeout = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    // H-LANG-009: Merge env from options with process.env
    const envOverride = options?.env ? { env: { ...process.env, ...options.env } } : {};
    return new Promise((resolve) => {
      exec(
        command,
        {
          encoding: 'utf-8',
          timeout,
          maxBuffer: 4 * 1024 * 1024,
          ...(process.platform === 'win32' && { shell: 'bash' }),
          ...envOverride,
        },
        (error, stdout, stderr) => {
          if (error) {
            resolve({
              exitCode: typeof error.code === 'number' ? error.code : 1,
              stdout: stdout ?? '',
              stderr: stderr ?? '',
            });
            return;
          }
          resolve({ exitCode: 0, stdout: stdout ?? '', stderr: stderr ?? '' });
        },
      );
    });
  }
}
