/**
 * resolveProcessSpawner — factory that creates the appropriate ProcessSpawner
 * based on the PL_SPAWN_RUNNER environment variable.
 *
 * Defaults to ClaudeProcessSpawner when PL_SPAWN_RUNNER is unset or "claude".
 * For other runners (codex, opencode, ollama, aider), creates a CliProcessSpawner
 * that delegates to `prompt-language run --runner <name>`.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProcessSpawner } from '../../application/ports/process-spawner.js';
import { ClaudeProcessSpawner } from './claude-process-spawner.js';
import { CliProcessSpawner } from './cli-process-spawner.js';

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
    return new ClaudeProcessSpawner(cwd);
  }

  if (!SUPPORTED_RUNNERS.has(runner)) {
    process.stderr.write(
      `[prompt-language] WARNING: Unknown PL_SPAWN_RUNNER="${runner}", falling back to claude.\n`,
    );
    return new ClaudeProcessSpawner(cwd);
  }

  return new CliProcessSpawner(cwd, runner, resolveCliPath());
}
