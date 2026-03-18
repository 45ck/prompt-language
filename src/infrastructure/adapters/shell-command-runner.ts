/**
 * ShellCommandRunner — executes commands via child_process.
 */

import { exec } from 'node:child_process';
import type { CommandRunner, CommandResult } from '../../application/ports/command-runner.js';

export class ShellCommandRunner implements CommandRunner {
  async run(command: string): Promise<CommandResult> {
    return new Promise((resolve) => {
      exec(
        command,
        { encoding: 'utf-8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024 },
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
