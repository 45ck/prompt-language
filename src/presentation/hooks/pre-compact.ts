#!/usr/bin/env node
/**
 * PreCompact hook entry point.
 *
 * When Claude Code compacts conversation context, all injected flow state
 * is lost. This hook re-injects a compact summary as additionalContext
 * so the flow state survives compaction.
 *
 * Uses compact rendering to minimize token usage, and includes:
 * - Goal and status
 * - Current step index / total
 * - Key (non-auto) variables
 * - Gate pass/fail status
 * - Awaiting-capture context so capture survives compaction
 */

import { FileStateStore } from '../../infrastructure/adapters/file-state-store.js';
import { renderFlowCompact, renderFlowSummary } from '../../domain/render-flow.js';
import { buildCaptureRetryPrompt } from '../../domain/capture-prompt.js';
import { formatError } from '../../domain/format-error.js';
import { findNodeById } from '../../domain/flow-node.js';
import type { SessionState } from '../../domain/session-state.js';
import { readStdin } from './read-stdin.js';
import { debug } from './debug.js';

/** Find the variable name awaiting capture, if any. */
function findAwaitingCapture(state: SessionState): { varName: string; nodeId: string } | null {
  for (const [nodeId, progress] of Object.entries(state.nodeProgress)) {
    if (progress.status === 'awaiting_capture') {
      const node = findNodeById(state.flowSpec.nodes, nodeId);
      if (node?.kind === 'let') {
        return { varName: node.variableName, nodeId };
      }
    }
  }
  return null;
}

async function main(): Promise<void> {
  // Consume stdin (required by hook protocol)
  await readStdin();

  debug('PreCompact hook invoked');

  const stateStore = new FileStateStore(process.cwd());
  const state = await stateStore.loadCurrent();

  if (state?.status !== 'active') {
    debug(`PreCompact: no active flow (status=${state?.status ?? 'none'})`);
    return;
  }

  debug(`PreCompact: preserving flow "${state.flowSpec.goal}"`);

  const oneLiner = renderFlowSummary(state);
  const compact = renderFlowCompact(state);

  // Build capture context if a variable is awaiting capture
  const awaiting = findAwaitingCapture(state);
  let captureContext = '';
  if (awaiting) {
    debug(`PreCompact: awaiting capture for var "${awaiting.varName}"`);
    captureContext =
      '\n\nIMPORTANT: Variable capture is in progress. ' +
      buildCaptureRetryPrompt(awaiting.varName, state.captureNonce);
  }

  const summary =
    `[prompt-language] Active flow preserved across compaction.\n` +
    `${oneLiner}\n\n` +
    compact +
    captureContext +
    '\n\n' +
    'DSL reference: nodes are prompt, run, let/var, while, until, retry, ' +
    'if/else, try/catch/finally, foreach, break, continue, spawn, await. ' +
    'Variables: ${name} interpolation. Gates: "done when:" section.';

  const output = JSON.stringify({ additionalContext: summary });
  process.stdout.write(output);
}

main().catch((error: unknown) => {
  process.stderr.write(`[prompt-language] hook error: ${formatError(error)}\n`);
  process.exitCode = 0;
});
