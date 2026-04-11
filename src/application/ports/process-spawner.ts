/**
 * ProcessSpawner — port for spawning child flow processes.
 *
 * Each spawn node launches a separate child runner with its own
 * isolated state directory and flow definition.
 */

import type { VariableStore } from '../../domain/variable-value.js';

export interface SpawnInput {
  readonly name: string;
  readonly goal: string;
  readonly flowText: string;
  readonly variables: VariableStore;
  readonly stateDir: string;
  readonly cwd?: string | undefined;
  /** beads: prompt-language-2j9v — model to pass through to the child runner. */
  readonly model?: string | undefined;
}

export interface SpawnResult {
  readonly pid: number;
}

export interface ChildStatus {
  readonly status: 'running' | 'completed' | 'failed';
  readonly variables?: Readonly<Record<string, string>> | undefined;
}

export interface ProcessSpawner {
  /** Launch a child flow process with the given flow. Returns the child PID. */
  spawn(input: SpawnInput): Promise<SpawnResult>;

  /** Poll the status of a spawned child by reading its state directory. */
  poll(stateDir: string): Promise<ChildStatus>;

  /**
   * Best-effort termination for a spawned child.
   * Returns true when a termination signal was sent, false when the process was already gone.
   */
  terminate?(pid: number): Promise<boolean>;
}
