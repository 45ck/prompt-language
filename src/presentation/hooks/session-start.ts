#!/usr/bin/env node
/**
 * SessionStart hook entry point.
 *
 * On session start or resume, if a flow is active, writes colorized
 * flow visualization to stderr (for the user) and returns
 * additionalContext via stdout JSON (for Claude).
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

    const output = JSON.stringify({
      additionalContext: `[prompt-language] Active flow detected:\n\n${rendered}`,
    });
    process.stdout.write(output);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`[prompt-language] hook error: ${formatError(error)}\n`);
  process.exitCode = 0;
});
