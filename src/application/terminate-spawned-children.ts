import { addWarning, updateSpawnedChild } from '../domain/session-state.js';
import type { SessionState } from '../domain/session-state.js';
import type { ProcessSpawner } from './ports/process-spawner.js';

/**
 * Best-effort cleanup for still-running spawned children when the parent flow
 * transitions to a terminal failure/cancelled state.
 */
export async function terminateRunningSpawnedChildren(
  state: SessionState,
  processSpawner?: ProcessSpawner,
): Promise<SessionState> {
  if (state.status !== 'failed' && state.status !== 'cancelled') {
    return state;
  }

  let next = state;

  for (const [name, child] of Object.entries(state.spawnedChildren)) {
    if (child.status !== 'running') continue;

    let warning = `Parent flow ${state.status}; marked spawned child "${name}" as failed.`;

    if (child.pid !== undefined && processSpawner?.terminate) {
      const terminated = await processSpawner.terminate(child.pid);
      warning = terminated
        ? `Parent flow ${state.status}; terminated spawned child "${name}" (pid ${child.pid}).`
        : `Parent flow ${state.status}; child "${name}" (pid ${child.pid}) was already gone.`;
    } else if (child.pid !== undefined) {
      warning =
        `Parent flow ${state.status}; no process cleanup available for spawned child ` +
        `"${name}" (pid ${child.pid}).`;
    }

    next = updateSpawnedChild(next, name, { ...child, status: 'failed' });
    next = addWarning(next, warning);
  }

  return next;
}
