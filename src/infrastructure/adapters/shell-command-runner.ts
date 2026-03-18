/**
 * ShellCommandRunner — executes commands via child_process.
 */

import { execSync } from 'node:child_process';
import type { CommandRunner, CommandResult } from '../../application/ports/command-runner.js';

export class ShellCommandRunner implements CommandRunner {
  async run(command: string): Promise<CommandResult> {
    try {
      const stdout = execSync(command, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30_000,
      });
      return { exitCode: 0, stdout, stderr: '' };
    } catch (error: unknown) {
      if (isExecError(error)) {
        return {
          exitCode: error.status ?? 1,
          stdout: typeof error.stdout === 'string' ? error.stdout : '',
          stderr: typeof error.stderr === 'string' ? error.stderr : '',
        };
      }
      throw error;
    }
  }
}

interface ExecSyncError {
  status: number | null;
  stdout: unknown;
  stderr: unknown;
}

function isExecError(error: unknown): error is ExecSyncError {
  return error instanceof Error && 'status' in error && 'stdout' in error;
}
