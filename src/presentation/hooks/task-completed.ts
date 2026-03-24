#!/usr/bin/env node
/**
 * TaskCompleted hook entry point.
 *
 * Runs completion gates. If any gate fails, exits 2 to block completion.
 */

import { evaluateCompletion } from '../../application/evaluate-completion.js';
import { FileStateStore } from '../../infrastructure/adapters/file-state-store.js';
import { ShellCommandRunner } from '../../infrastructure/adapters/shell-command-runner.js';
import { FileAuditLogger } from '../../infrastructure/adapters/file-audit-logger.js';
import { formatError } from '../../domain/format-error.js';
import { readStdin } from './read-stdin.js';

async function main(): Promise<void> {
  // Consume stdin (required by hook protocol)
  await readStdin();

  const stateStore = new FileStateStore(process.cwd());
  const commandRunner = new ShellCommandRunner();
  const auditLogger = new FileAuditLogger(process.cwd());

  const result = await evaluateCompletion(stateStore, commandRunner, auditLogger);

  if (result.blocked) {
    process.stderr.write(`[prompt-language] ${result.reason}\n`);
    process.exitCode = 2;
    return;
  }

  process.exitCode = 0;
}

main().catch((error: unknown) => {
  process.stderr.write(`[prompt-language] hook error: ${formatError(error)}\n`);
  process.exitCode = 0;
});
