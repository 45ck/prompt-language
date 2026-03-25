#!/usr/bin/env node
/**
 * UserPromptSubmit hook entry point.
 *
 * Reads JSON { prompt } from stdin, injects flow context if active,
 * writes JSON { prompt } to stdout.
 */

import { randomUUID } from 'node:crypto';
import { injectContext } from '../../application/inject-context.js';
import { FileStateStore } from '../../infrastructure/adapters/file-state-store.js';
import { ShellCommandRunner } from '../../infrastructure/adapters/shell-command-runner.js';
import { FileCaptureReader } from '../../infrastructure/adapters/file-capture-reader.js';
import { ClaudeProcessSpawner } from '../../infrastructure/adapters/claude-process-spawner.js';
import { FileAuditLogger } from '../../infrastructure/adapters/file-audit-logger.js';
import { formatError } from '../../domain/format-error.js';
import type { SessionState } from '../../domain/session-state.js';
import { readStdin } from './read-stdin.js';

function parseInput(raw: string): { prompt: string } | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && 'prompt' in parsed) {
      const obj = parsed as Record<string, unknown>;
      if (typeof obj['prompt'] === 'string') {
        return { prompt: obj['prompt'] };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const input = parseInput(raw);

  if (!input) {
    process.stdout.write(raw);
    return;
  }

  const stateStore = new FileStateStore(process.cwd());
  const commandRunner = new ShellCommandRunner();
  const captureReader = new FileCaptureReader(process.cwd());
  const processSpawner = new ClaudeProcessSpawner(process.cwd());
  const auditLogger = new FileAuditLogger(process.cwd());
  const sessionId = randomUUID();

  let stateBefore: SessionState | null = null;
  try {
    stateBefore = await stateStore.loadCurrent();
  } catch {
    process.stderr.write('[prompt-language] WARNING: Corrupt state detected, resetting\n');
    await stateStore.clear('');
  }

  const result = await injectContext(
    { prompt: input.prompt, sessionId },
    stateStore,
    commandRunner,
    captureReader,
    processSpawner,
    auditLogger,
  );

  if (result.prompt !== input.prompt) {
    const state = await stateStore.loadCurrent();
    if (state?.status === 'active') {
      const { renderFlow } = await import('../../domain/render-flow.js');
      const { colorizeFlow } = await import('../../domain/colorize-flow.js');
      process.stderr.write(`\n${colorizeFlow(renderFlow(state))}\n`);
    }

    // Completion banner: detect active → completed/failed transition
    if (state && stateBefore?.status === 'active' && state.status !== 'active') {
      const goal = state.flowSpec.goal || 'unnamed flow';
      if (state.status === 'completed') {
        process.stderr.write(`\x1b[32;1m[PL] Flow completed: ${goal} | All gates passed\x1b[0m\n`);
      } else if (state.status === 'failed') {
        process.stderr.write(`\x1b[31;1m[PL] Flow failed: ${goal}\x1b[0m\n`);
      }
    }
  }

  const output = JSON.stringify({ prompt: result.prompt });
  process.stdout.write(output);
}

main().catch((error: unknown) => {
  process.stderr.write(`[prompt-language] hook error: ${formatError(error)}\n`);
  process.exitCode = 0;
});
