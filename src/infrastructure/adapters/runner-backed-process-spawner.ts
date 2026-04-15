/**
 * RunnerBackedProcessSpawner — compatibility adapter bridging the
 * application-level ProcessSpawner port to the infrastructure-level
 * SpawnedSessionRunner contract.
 *
 * This is the only layer that translates between infrastructure adapter
 * handles and the generic ProcessSpawner surface. It maintains an
 * ephemeral stateDir -> handle map for in-memory runners.
 */

import type {
  ChildStatus,
  ProcessSpawner,
  SpawnInput,
  SpawnResult,
} from '../../application/ports/process-spawner.js';
import type { SpawnedSessionHandle, SpawnedSessionRunner } from './spawned-session-runner.js';

export class RunnerBackedProcessSpawner implements ProcessSpawner {
  private readonly handles = new Map<string, SpawnedSessionHandle>();

  constructor(private readonly runner: SpawnedSessionRunner) {}

  async spawn(input: SpawnInput): Promise<SpawnResult> {
    const handle = await this.runner.launch(input);
    this.handles.set(input.stateDir, handle);
    return { pid: handle.pid ?? 0 };
  }

  async poll(stateDir: string): Promise<ChildStatus> {
    const snapshot = await this.runner.poll({
      stateDir,
      handle: this.handles.get(stateDir),
    });
    return snapshot.variables != null
      ? { status: snapshot.status, variables: snapshot.variables }
      : { status: snapshot.status };
  }

  async terminate(pid: number): Promise<boolean> {
    if (!this.runner.terminate) return false;

    const handle = [...this.handles.values()].find((candidate) => candidate.pid === pid);
    return this.runner.terminate({
      pid,
      handle,
      stateDir: handle?.stateDir ?? '',
    });
  }
}
