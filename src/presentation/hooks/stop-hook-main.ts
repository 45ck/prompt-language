import { evaluateStop } from '../../application/evaluate-stop.js';
import { terminateRunningSpawnedChildren } from '../../application/terminate-spawned-children.js';
import { renderCompletionSummary } from '../../domain/render-flow.js';
import { ClaudeProcessSpawner } from '../../infrastructure/adapters/claude-process-spawner.js';
import { FileStateStore } from '../../infrastructure/adapters/file-state-store.js';
import { readStdin } from './read-stdin.js';

export async function runStopHook(): Promise<void> {
  const raw = await readStdin();

  try {
    const input: unknown = JSON.parse(raw);
    if (
      typeof input === 'object' &&
      input !== null &&
      'stop_hook_active' in input &&
      (input as Record<string, unknown>)['stop_hook_active'] === true
    ) {
      process.exitCode = 0;
      return;
    }
  } catch {
    // Non-JSON stdin — continue with normal evaluation
  }

  const stateStore = new FileStateStore(process.cwd());
  const result = await evaluateStop(stateStore);

  if (result.blocked) {
    process.stderr.write(`[prompt-language] ${result.reason}\n`);
    process.exitCode = 2;
    return;
  }

  let state = result.state;
  if (state && (state.status === 'failed' || state.status === 'cancelled')) {
    const cleaned = await terminateRunningSpawnedChildren(
      state,
      new ClaudeProcessSpawner(process.cwd()),
    );
    if (cleaned !== state) {
      await stateStore.save(cleaned);
      state = cleaned;
    }
  }

  if (state) {
    const summary = renderCompletionSummary(state);
    const color = state.status === 'completed' ? '\x1b[32;1m' : '\x1b[31;1m';
    process.stderr.write(`${color}[PL] ${summary}\x1b[0m\n`);
  }

  process.exitCode = 0;
}
