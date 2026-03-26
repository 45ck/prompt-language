#!/usr/bin/env node
/**
 * Stop hook entry point.
 *
 * If a flow is active and incomplete, blocks the stop (exit 2).
 * Otherwise exits 0.
 */

import { evaluateStop } from '../../application/evaluate-stop.js';
import { renderCompletionSummary } from '../../domain/render-flow.js';
import { FileStateStore } from '../../infrastructure/adapters/file-state-store.js';
import { readStdin } from './read-stdin.js';
import { withHookErrorRecovery } from './hook-error-handler.js';

async function main(): Promise<void> {
  // Consume stdin (required by hook protocol)
  const raw = await readStdin();

  // Prevent infinite stop-hook loops: if Claude is already handling
  // a stop hook, allow the stop without checking flow state.
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

  // Flow completion banner: show summary when flow is done
  if (result.state) {
    const summary = renderCompletionSummary(result.state);
    const color = result.state.status === 'completed' ? '\x1b[32;1m' : '\x1b[31;1m';
    process.stderr.write(`${color}[PL] ${summary}\x1b[0m\n`);
  }

  process.exitCode = 0;
}

withHookErrorRecovery('Stop', process.cwd(), main).catch(() => {
  process.exitCode = 0;
});
