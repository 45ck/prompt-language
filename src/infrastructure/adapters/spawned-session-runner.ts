/**
 * SpawnedSessionRunner — infrastructure-only contract for child-flow lifecycle.
 *
 * This sits below ProcessSpawner in the architecture. Application code
 * continues to depend only on ProcessSpawner; this contract gives the
 * adapter layer one provider-neutral place to describe how a child run
 * is launched, polled, and terminated.
 */

import type { VariableStore } from '../../domain/variable-value.js';

export type SpawnCaptureMode = 'state-file' | 'memory';

export interface SpawnedSessionRequest {
  readonly name: string;
  readonly goal: string;
  readonly flowText: string;
  readonly variables: VariableStore;
  readonly stateDir: string;
  readonly cwd?: string | undefined;
  readonly model?: string | undefined;
}

export interface SpawnedSessionHandle {
  /** Infrastructure-local identifier for the launched child. */
  readonly runId: string;
  /** Stable lookup key shared with the current runtime contract. */
  readonly stateDir: string;
  /** Present for external-process runners. Omitted for in-process runners. */
  readonly pid?: number | undefined;
  readonly captureMode: SpawnCaptureMode;
}

export interface SpawnedSessionSnapshot {
  readonly status: 'running' | 'completed' | 'failed';
  readonly variables?: Readonly<Record<string, string>> | undefined;
}

export interface SpawnedSessionCapabilities {
  readonly externalProcess: boolean;
  readonly terminate: boolean;
  readonly cwdOverride: boolean;
  readonly modelPassThrough: boolean;
  readonly stateDirPolling: boolean;
  readonly inProcessExecution: boolean;
}

export interface SpawnedSessionRunner {
  readonly capabilities: SpawnedSessionCapabilities;

  launch(request: SpawnedSessionRequest): Promise<SpawnedSessionHandle>;

  /**
   * stateDir is mandatory because the current runtime persists only stateDir
   * and pid. handle is optional so in-memory runners can use it when present,
   * while file-backed runners can re-derive state from disk.
   */
  poll(
    ref: Readonly<{
      readonly stateDir: string;
      readonly handle?: SpawnedSessionHandle | undefined;
    }>,
  ): Promise<SpawnedSessionSnapshot>;

  /**
   * Best effort. External-process runners may use pid and/or handle metadata.
   * In-process runners may always return false.
   */
  terminate?(
    ref: Readonly<{
      readonly pid?: number | undefined;
      readonly handle?: SpawnedSessionHandle | undefined;
      readonly stateDir: string;
    }>,
  ): Promise<boolean>;
}

export type SpawnedSessionRunnerId = 'claude-external' | 'headless' | 'cli-external';
