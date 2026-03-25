#!/usr/bin/env node
/**
 * SessionStart hook entry point.
 *
 * On session start or resume, if a flow is active, writes colorized
 * flow visualization to stderr (for the user) and returns
 * additionalContext via stdout JSON (for Claude).
 */

import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { FileStateStore } from '../../infrastructure/adapters/file-state-store.js';
import { renderFlow } from '../../domain/render-flow.js';
import { colorizeFlow } from '../../domain/colorize-flow.js';
import { buildCaptureRetryPrompt } from '../../domain/capture-prompt.js';
import { formatError } from '../../domain/format-error.js';
import { findNodeById } from '../../domain/flow-node.js';
import type { SessionState } from '../../domain/session-state.js';
import { readStdin } from './read-stdin.js';
import { debug } from './debug.js';

// H#100: Detect project type and suggest relevant flows
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

/**
 * Find a let-prompt node that is currently awaiting capture.
 * Returns the variable name if found, null otherwise.
 */
function findAwaitingCapture(state: SessionState): string | null {
  for (const [nodeId, progress] of Object.entries(state.nodeProgress)) {
    if (progress.status === 'awaiting_capture') {
      const node = findNodeById(state.flowSpec.nodes, nodeId);
      if (node?.kind === 'let') return node.variableName;
    }
  }
  return null;
}

// H-INT-009: Expected state version — increment when SessionState format changes
const CURRENT_STATE_VERSION = 1;

async function main(): Promise<void> {
  // Consume stdin (required by hook protocol)
  await readStdin();

  debug('SessionStart hook invoked');

  const stateStore = new FileStateStore(process.cwd());
  const state = await stateStore.loadCurrent();

  debug(`SessionStart: state status=${state?.status ?? 'none'}`);

  // Self-heal: clean up stale state from a previous session
  if (state && (state.status === 'completed' || state.status === 'failed')) {
    await stateStore.clear(state.sessionId ?? '');
    debug(`SessionStart: cleaned up finished flow (${state.status})`);
    process.stderr.write(`[prompt-language] Cleaned up finished flow (${state.status})\n`);
  }

  if (state?.status === 'active') {
    // H-INT-009: Check state file version compatibility
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

    // Compaction-aware: re-emit capture prompt if a variable is awaiting capture
    const awaitingVar = findAwaitingCapture(state);
    let captureContext = '';
    if (awaitingVar) {
      debug(`SessionStart: re-emitting capture for var "${awaitingVar}"`);
      captureContext = '\n\n' + buildCaptureRetryPrompt(awaitingVar, state.captureNonce);
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

  // H#100: Suggest flows when no active flow
  const suggestion = await suggestFlows();
  if (suggestion) {
    const output = JSON.stringify({ additionalContext: suggestion });
    process.stdout.write(output);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`[prompt-language] hook error: ${formatError(error)}\n`);
  process.exitCode = 0;
});
