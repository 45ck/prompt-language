export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface RunOptions {
  readonly timeoutMs?: number;
  /** H-LANG-009: Environment variables to inject into command execution. */
  readonly env?: Readonly<Record<string, string>>;
}

export interface CommandRunner {
  run(command: string, options?: RunOptions): Promise<CommandResult>;
}
