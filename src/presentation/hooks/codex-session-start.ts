#!/usr/bin/env node
/**
 * Codex SessionStart hook entry point.
 *
 * Emits additionalContext for Codex and mirrors the active-flow status banner.
 */

import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { FileStateStore } from '../../infrastructure/adapters/file-state-store.js';
import { renderFlow } from '../../domain/render-flow.js';
import { colorizeFlow } from '../../domain/colorize-flow.js';
import { buildCaptureRetryPrompt } from '../../domain/capture-prompt.js';
import { buildReviewJudgeRetryPrompt } from '../../domain/review-judge-capture.js';
import { findNodeById } from '../../domain/flow-node.js';
import { withHookErrorRecovery } from './hook-error-handler.js';
import type { SessionState } from '../../domain/session-state.js';
import { readStdin } from './read-stdin.js';
import { debug } from './debug.js';
import { formatStateLoadDiagnosticMessage } from './format-state-load-diagnostic.js';

async function suggestFlows(): Promise<string | null> {
  const cwd = process.cwd();
  const checks = [
    { file: 'package.json', hint: '/fix-and-test, /tdd. Gate: "done when: tests_pass"' },
    { file: 'Cargo.toml', hint: '/fix-and-test. Gate: "done when: cargo_test_pass"' },
    { file: 'go.mod', hint: '/fix-and-test. Gate: "done when: go_test_pass"' },
    { file: 'setup.py', hint: '/fix-and-test. Gate: "done when: pytest_pass"' },
    { file: 'pyproject.toml', hint: '/fix-and-test. Gate: "done when: pytest_pass"' },
  ];
  for (const { file, hint } of checks) {
    try {
      await access(join(cwd, file));
      return (
        `[prompt-language] Skills: ${hint}. ` +
        'Tip: add "done when: tests_pass" to any prompt for verified completion.'
      );
    } catch {
      continue;
    }
  }
  return null;
}

function findAwaitingCapturePrompt(state: SessionState): string | null {
  for (const [nodeId, progress] of Object.entries(state.nodeProgress)) {
    if (progress.status === 'awaiting_capture') {
      const node = findNodeById(state.flowSpec.nodes, nodeId);
      if (node?.kind === 'let')
        return buildCaptureRetryPrompt(node.variableName, state.captureNonce);
      if (node?.kind === 'review' && node.judgeName) {
        return buildReviewJudgeRetryPrompt(node.id, state.captureNonce);
      }
    }
  }
  return null;
}

const CURRENT_STATE_VERSION = 1;

async function main(): Promise<void> {
  await readStdin();
  debug('Codex SessionStart hook invoked');

  const stateStore = new FileStateStore(process.cwd());
  const state = await stateStore.loadCurrent();
  const loadDiagnostic = stateStore.getLastLoadDiagnostic();
  debug(`Codex SessionStart: state status=${state?.status ?? 'none'}`);

  if (state == null && loadDiagnostic != null) {
    const message = formatStateLoadDiagnosticMessage(loadDiagnostic);
    process.stderr.write(`${message}\n`);
    process.stdout.write(JSON.stringify({ additionalContext: message }));
    return;
  }

  if (state && (state.status === 'completed' || state.status === 'failed')) {
    await stateStore.clear(state.sessionId ?? '');
    debug(`Codex SessionStart: cleaned up finished flow (${state.status})`);
    process.stderr.write(`[prompt-language] Cleaned up finished flow (${state.status})\n`);
  }

  if (state?.status === 'active') {
    const stateVersion = state.version ?? 0;
    let versionWarning = '';
    if (stateVersion > CURRENT_STATE_VERSION) {
      versionWarning = `\n[prompt-language] WARNING: State file version ${stateVersion} is newer than this plugin (expects v${CURRENT_STATE_VERSION}). Consider updating the plugin.\n`;
    } else if (stateVersion < CURRENT_STATE_VERSION) {
      versionWarning = `\n[prompt-language] WARNING: State file version ${stateVersion} is older than expected (v${CURRENT_STATE_VERSION}). State may need migration.\n`;
    }
    if (versionWarning) {
      process.stderr.write(versionWarning);
    }

    const rendered = renderFlow(state);
    process.stderr.write(`\n${colorizeFlow(rendered)}\n`);

    const capturePrompt = findAwaitingCapturePrompt(state);
    let captureContext = '';
    if (capturePrompt) {
      debug('Codex SessionStart: re-emitting awaiting capture prompt');
      captureContext = '\n\n' + capturePrompt;
    }

    const output = JSON.stringify({
      additionalContext:
        `[prompt-language] Active flow detected:\n\n${rendered}` +
        (versionWarning ? `\n${versionWarning}` : '') +
        captureContext,
    });
    process.stdout.write(output);
    return;
  }

  const suggestion = await suggestFlows();
  if (suggestion) {
    const output = JSON.stringify({ additionalContext: suggestion });
    process.stdout.write(output);
  }
}

withHookErrorRecovery('Codex SessionStart', process.cwd(), main).catch(() => {
  process.exitCode = 0;
});
