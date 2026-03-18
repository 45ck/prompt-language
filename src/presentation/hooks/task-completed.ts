#!/usr/bin/env node
/**
 * TaskCompleted hook entry point.
 *
 * Runs completion gates. If any gate fails, exits 2 to block completion.
 */

import { evaluateCompletion } from '../../application/evaluate-completion.js';
import { FileStateStore } from '../../infrastructure/adapters/file-state-store.js';
import { ShellCommandRunner } from '../../infrastructure/adapters/shell-command-runner.js';
import { readStdin } from './read-stdin.js';

async function main(): Promise<void> {
  // Consume stdin (required by hook protocol)
  await readStdin();

  const stateStore = new FileStateStore(process.cwd());
  const commandRunner = new ShellCommandRunner();

  const result = await evaluateCompletion(stateStore, commandRunner);

  if (result.blocked) {
    process.stderr.write(result.reason);
    process.exitCode = 2;
    return;
  }

  process.exitCode = 0;
}

void main();
