#!/usr/bin/env node
/**
 * TaskCompleted hook entry point.
 *
 * Runs completion gates. If any gate fails, exits 2 to block completion.
 */

import { evaluateCompletion } from '../../application/evaluate-completion.js';
import { terminateRunningSpawnedChildren } from '../../application/terminate-spawned-children.js';
import { resolveProcessSpawner } from '../../infrastructure/adapters/resolve-process-spawner.js';
import { FileStateStore } from '../../infrastructure/adapters/file-state-store.js';
import { ShellCommandRunner } from '../../infrastructure/adapters/shell-command-runner.js';
import { FileAuditLogger } from '../../infrastructure/adapters/file-audit-logger.js';
import { readStdin } from './read-stdin.js';
import { withHookErrorRecovery } from './hook-error-handler.js';
import { renderCompletionResult } from './render-completion-result.js';

async function main(): Promise<void> {
  // Consume stdin (required by hook protocol)
  await readStdin();

  const stateStore = new FileStateStore(process.cwd());
  const commandRunner = new ShellCommandRunner();
  const auditLogger = new FileAuditLogger(process.cwd());

  const result = await evaluateCompletion(stateStore, commandRunner, auditLogger);

  const current = await stateStore.loadCurrent();
  if (current && (current.status === 'failed' || current.status === 'cancelled')) {
    const cleaned = await terminateRunningSpawnedChildren(
      current,
      resolveProcessSpawner(process.cwd()),
    );
    if (cleaned !== current) {
      await stateStore.save(cleaned);
    }
  }

  if (result.blocked || result.outcomes.length > 0) {
    process.stderr.write(`[prompt-language] ${renderCompletionResult(result)}\n`);
    process.exitCode = 2;
    return;
  }

  process.exitCode = 0;
}

withHookErrorRecovery('TaskCompleted', process.cwd(), main).catch(() => {
  process.exitCode = 0;
});
