#!/usr/bin/env node
/**
 * PreCompact hook entry point.
 *
 * When Claude Code compacts conversation context, all injected flow state
 * is lost. This hook re-injects a compact summary as additionalContext
 * so the flow state survives compaction.
 */

import { FileStateStore } from '../../infrastructure/adapters/file-state-store.js';
import { renderFlow } from '../../domain/render-flow.js';
import { formatError } from '../../domain/format-error.js';
import { readStdin } from './read-stdin.js';

async function main(): Promise<void> {
  // Consume stdin (required by hook protocol)
  await readStdin();

  const stateStore = new FileStateStore(process.cwd());
  const state = await stateStore.loadCurrent();

  if (state?.status !== 'active') {
    return;
  }

  const rendered = renderFlow(state);
  const summary =
    '[prompt-language] Active flow preserved across compaction.\n\n' +
    rendered +
    '\n\n' +
    'DSL reference: nodes are prompt, run, let/var, while, until, retry, ' +
    'if/else, try/catch/finally, foreach, break, spawn, await. ' +
    'Variables: ${name} interpolation. Gates: "done when:" section.';

  const output = JSON.stringify({ additionalContext: summary });
  process.stdout.write(output);
}

main().catch((error: unknown) => {
  process.stderr.write(`[prompt-language] hook error: ${formatError(error)}\n`);
  process.exitCode = 0;
});
