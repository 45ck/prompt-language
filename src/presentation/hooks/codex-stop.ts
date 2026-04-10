#!/usr/bin/env node
/**
 * Codex Stop hook entry point.
 *
 * Merges stop-blocking and completion-gate enforcement for the Codex host.
 */

import { evaluateStop } from '../../application/evaluate-stop.js';
import { evaluateCompletion } from '../../application/evaluate-completion.js';
import { renderCompletionSummary } from '../../domain/render-flow.js';
import { FileStateStore } from '../../infrastructure/adapters/file-state-store.js';
import { ShellCommandRunner } from '../../infrastructure/adapters/shell-command-runner.js';
import { FileAuditLogger } from '../../infrastructure/adapters/file-audit-logger.js';
import { readStdin } from './read-stdin.js';
import { withHookErrorRecovery } from './hook-error-handler.js';
import { renderCompletionResult } from './render-completion-result.js';

async function main(): Promise<void> {
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
  const stopResult = await evaluateStop(stateStore);
  if (stopResult.blocked) {
    process.stderr.write(`[prompt-language] ${stopResult.reason}\n`);
    process.exitCode = 2;
    return;
  }

  const commandRunner = new ShellCommandRunner();
  const auditLogger = new FileAuditLogger(process.cwd());
  const completion = await evaluateCompletion(stateStore, commandRunner, auditLogger);
  if (completion.blocked || completion.outcomes.length > 0) {
    process.stderr.write(`[prompt-language] ${renderCompletionResult(completion)}\n`);
    process.exitCode = 2;
    return;
  }

  const state = await stateStore.loadCurrent();
  if (state) {
    const summary = renderCompletionSummary(state);
    const color = state.status === 'completed' ? '\x1b[32;1m' : '\x1b[31;1m';
    process.stderr.write(`${color}[PL] ${summary}\x1b[0m\n`);
  }

  process.exitCode = 0;
}

withHookErrorRecovery('Codex Stop', process.cwd(), main).catch(() => {
  process.exitCode = 0;
});
