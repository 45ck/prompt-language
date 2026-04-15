/**
 * resolveProcessSpawner — factory that creates the appropriate ProcessSpawner
 * based on the PL_SPAWN_RUNNER environment variable.
 *
 * Internally delegates to SpawnedSessionRunner implementations wrapped in
 * RunnerBackedProcessSpawner. Application code continues to depend only
 * on ProcessSpawner.
 *
 * Defaults to ClaudeSessionRunner when PL_SPAWN_RUNNER is unset or "claude".
 * For other runners (codex, opencode, ollama, aider), creates a CliSessionRunner
 * that delegates to `prompt-language run --runner <name>`.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProcessSpawner } from '../../application/ports/process-spawner.js';
import { ClaudeSessionRunner } from './claude-session-runner.js';
import { CliSessionRunner } from './cli-session-runner.js';
import { RunnerBackedProcessSpawner } from './runner-backed-process-spawner.js';

const SUPPORTED_RUNNERS = new Set(['claude', 'codex', 'opencode', 'ollama', 'aider']);

/**
 * Resolve the CLI entry point path. Uses `PL_CLI_PATH` if set,
 * otherwise derives from this file's location in the dist tree.
 */
function resolveCliPath(): string {
  if (process.env['PL_CLI_PATH']) {
    return process.env['PL_CLI_PATH'];
  }
  // Default: assume standard npm layout — bin/cli.mjs relative to package root.
  // This file lives at dist/infrastructure/adapters/resolve-process-spawner.js
  // so package root is three levels up.
  const thisDir = dirname(fileURLToPath(import.meta.url));
  return join(thisDir, '..', '..', '..', 'bin', 'cli.mjs');
}

export function resolveProcessSpawner(cwd: string): ProcessSpawner {
  const runner = process.env['PL_SPAWN_RUNNER']?.trim().toLowerCase();

  if (!runner || runner === 'claude') {
    return new RunnerBackedProcessSpawner(new ClaudeSessionRunner(cwd));
  }

  if (!SUPPORTED_RUNNERS.has(runner)) {
    process.stderr.write(
      `[prompt-language] WARNING: Unknown PL_SPAWN_RUNNER="${runner}", falling back to claude.\n`,
    );
    return new RunnerBackedProcessSpawner(new ClaudeSessionRunner(cwd));
  }

  return new RunnerBackedProcessSpawner(new CliSessionRunner(cwd, runner, resolveCliPath()));
}
