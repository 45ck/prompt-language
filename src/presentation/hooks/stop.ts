#!/usr/bin/env node
/**
 * Stop hook entry point.
 *
 * If a flow is active and incomplete, blocks the stop (exit 2).
 * Otherwise exits 0.
 */

import { evaluateStop } from '../../application/evaluate-stop.js';
import { FileStateStore } from '../../infrastructure/adapters/file-state-store.js';
import { readStdin } from './read-stdin.js';

async function main(): Promise<void> {
  // Consume stdin (required by hook protocol)
  await readStdin();

  const stateStore = new FileStateStore(process.cwd());
  const result = await evaluateStop(stateStore);

  if (result.blocked) {
    process.stderr.write(result.reason);
    process.exitCode = 2;
    return;
  }

  process.exitCode = 0;
}

void main();
