#!/usr/bin/env node
/**
 * PostToolUse hook entry point.
 *
 * After Bash/Write/Edit tool calls, reads session state and writes
 * colorized flow visualization to stderr as a persistent visual reminder
 * of the active flow step.
 */

import { FileStateStore } from '../../infrastructure/adapters/file-state-store.js';
import { renderFlow } from '../../domain/render-flow.js';
import { colorizeFlow } from '../../domain/colorize-flow.js';
import { formatError } from '../../domain/format-error.js';
import { readStdin } from './read-stdin.js';

async function main(): Promise<void> {
  // Consume stdin (required by hook protocol)
  await readStdin();

  const stateStore = new FileStateStore(process.cwd());
  const state = await stateStore.loadCurrent();

  if (state?.status === 'active') {
    const rendered = renderFlow(state);
    process.stderr.write(`\n${colorizeFlow(rendered)}\n`);
  }

  process.exitCode = 0;
}

main().catch((error: unknown) => {
  process.stderr.write(`[prompt-language] hook error: ${formatError(error)}\n`);
  process.exitCode = 0;
});
