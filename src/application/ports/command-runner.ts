export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface RunOptions {
  readonly timeoutMs?: number;
}

export interface CommandRunner {
  run(command: string, options?: RunOptions): Promise<CommandResult>;
}
