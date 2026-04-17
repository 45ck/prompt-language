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
import { renderFlow, renderFlowCompact, renderFlowSummaryBlock } from '../../domain/render-flow.js';
import { buildCaptureRetryPrompt } from '../../domain/capture-prompt.js';
import { buildReviewJudgeRetryPrompt } from '../../domain/review-judge-capture.js';
import { findNodeById } from '../../domain/flow-node.js';
import { interpolate } from '../../domain/interpolate.js';
import { withHookErrorRecovery } from './hook-error-handler.js';
import type { SessionState } from '../../domain/session-state.js';
import { readStdin } from './read-stdin.js';
import { debug } from './debug.js';
import { selectPreCompactMode } from './context-adaptive-mode.js';
import { renderCompactGateStatus } from './render-compact-gate-status.js';
import { formatRenderByteMetrics, isRenderByteMetricsEnabled } from './render-byte-metrics.js';

/** Find the variable name awaiting capture, if any. */
function findAwaitingCapturePrompt(state: SessionState): string | null {
  for (const [nodeId, progress] of Object.entries(state.nodeProgress)) {
    if (progress.status === 'awaiting_capture') {
      const node = findNodeById(state.flowSpec.nodes, nodeId);
      if (node?.kind === 'let') {
        return buildCaptureRetryPrompt(node.variableName, state.captureNonce);
      }
      if (node?.kind === 'review' && node.judgeName) {
        return buildReviewJudgeRetryPrompt(node.id, state.captureNonce);
      }
      if (node?.kind === 'prompt') {
        return interpolate(node.text, state.variables);
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
  const loadStatus = stateStore.getLastLoadStatus();

  if (state?.status !== 'active') {
    debug(`PreCompact: no active flow (status=${state?.status ?? 'none'})`);
    return;
  }

  debug(`PreCompact: preserving flow "${state.flowSpec.goal}"`);

  const summaryBlock = renderFlowSummaryBlock(state);
  const compact = renderCompactGateStatus(renderFlowCompact(state), state);
  const full = renderFlow(state);
  const modeDecision = selectPreCompactMode(state, loadStatus);
  process.stderr.write(`${modeDecision.markerLine}\n`);
  if (modeDecision.escalated) {
    process.stderr.write(
      `[prompt-language] WARNING: compact mode suppressed; full mode required for ${modeDecision.summary}\n`,
    );
  }

  // Build resume context if a prompt or capture is awaiting completion
  const capturePrompt = findAwaitingCapturePrompt(state);
  let captureContext = '';
  if (capturePrompt) {
    debug('PreCompact: awaiting capture prompt detected');
    captureContext = '\n\nIMPORTANT: A prompt step is still pending. ' + capturePrompt;
  }

  const summaryStablePrefix = '[prompt-language] Active flow preserved across compaction.\n';
  const summaryStableSuffix =
    '\n\n' +
    'DSL reference: nodes are prompt, run, let/var, while, until, retry, ' +
    'if/else, try/catch/finally, foreach, break, continue, spawn, await. ' +
    'Variables: ${name} interpolation. Gates: "done when:" section.';
  const summaryBody = modeDecision.escalated
    ? `[prompt-language] Auto-escalated to full mode: ${modeDecision.summary}\n\n${summaryBlock}\n\n${full}`
    : `${summaryBlock}\n\n${compact}`;
  const summary =
    summaryStablePrefix +
    `${modeDecision.markerLine}\n\n` +
    summaryBody +
    captureContext +
    summaryStableSuffix;
  if (isRenderByteMetricsEnabled()) {
    process.stderr.write(
      `${formatRenderByteMetrics({
        hook: 'pre-compact',
        channel: 'additionalContext',
        stableParts: [summaryStablePrefix, summaryStableSuffix],
        dynamicParts: [`${modeDecision.markerLine}\n\n`, summaryBody, captureContext],
      })}\n`,
    );
  }

  const output = JSON.stringify({ additionalContext: summary });
  process.stdout.write(output);
}

withHookErrorRecovery('PreCompact', process.cwd(), main).catch(() => {
  process.exitCode = 0;
});
