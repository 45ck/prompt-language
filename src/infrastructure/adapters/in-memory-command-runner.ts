/**
 * InMemoryCommandRunner — pre-programmed test double for CommandRunner.
 */

import type { CommandRunner, CommandResult } from '../../application/ports/command-runner.js';

const DEFAULT_RESULT: CommandResult = {
  exitCode: 0,
  stdout: '',
  stderr: '',
};

export class InMemoryCommandRunner implements CommandRunner {
  private readonly results = new Map<string, CommandResult>();
  private readonly history: string[] = [];

  /** Pre-program a result for a specific command. */
  setResult(command: string, result: CommandResult): void {
    this.results.set(command, result);
  }

  async run(command: string): Promise<CommandResult> {
    this.history.push(command);
    return this.results.get(command) ?? DEFAULT_RESULT;
  }

  /** Test helper: return commands that were executed. */
  get executedCommands(): readonly string[] {
    return this.history;
  }
}
