/**
 * ShellCommandRunner — executes commands via child_process.
 */

import { exec } from 'node:child_process';
import type {
  CommandRunner,
  CommandResult,
  RunOptions,
} from '../../application/ports/command-runner.js';

const DEFAULT_TIMEOUT_MS = 30_000;

export class ShellCommandRunner implements CommandRunner {
  async run(command: string, options?: RunOptions): Promise<CommandResult> {
    const timeout = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    return new Promise((resolve) => {
      exec(
        command,
        { encoding: 'utf-8', timeout, maxBuffer: 4 * 1024 * 1024 },
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
