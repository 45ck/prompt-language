#!/usr/bin/env node
/**
 * Codex UserPromptSubmit hook entry point.
 *
 * Reuses the prompt-language context injector, but emits Codex-compatible
 * additionalContext instead of rewriting the user prompt.
 */

import { randomUUID } from 'node:crypto';
import { injectContext } from '../../application/inject-context.js';
import { FileStateStore } from '../../infrastructure/adapters/file-state-store.js';
import { ShellCommandRunner } from '../../infrastructure/adapters/shell-command-runner.js';
import { FileCaptureReader } from '../../infrastructure/adapters/file-capture-reader.js';
import { ClaudeProcessSpawner } from '../../infrastructure/adapters/claude-process-spawner.js';
import { FileAuditLogger } from '../../infrastructure/adapters/file-audit-logger.js';
import { FileMemoryStore } from '../../infrastructure/adapters/file-memory-store.js';
import type { SessionState } from '../../domain/session-state.js';
import { readStdin } from './read-stdin.js';
import { debug } from './debug.js';
import { logHookError } from './hook-error-handler.js';

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

  debug('Codex UserPromptSubmit hook invoked');

  if (!input) {
    debug('Codex UserPromptSubmit: no valid prompt input, passing through');
    process.stdout.write(raw);
    return;
  }

  const stateStore = new FileStateStore(process.cwd());
  const commandRunner = new ShellCommandRunner();
  const captureReader = new FileCaptureReader(process.cwd());
  const processSpawner = new ClaudeProcessSpawner(process.cwd());
  const auditLogger = new FileAuditLogger(process.cwd());
  const memoryStore = new FileMemoryStore(process.cwd());
  const sessionId = randomUUID();

  let stateBefore: SessionState | null = null;
  try {
    stateBefore = await stateStore.loadCurrent();
    debug(`Codex UserPromptSubmit: state before=${stateBefore?.status ?? 'none'}`);
  } catch {
    process.stderr.write('[prompt-language] WARNING: Corrupt state detected, resetting\n');
    debug('Codex UserPromptSubmit: corrupt state detected, resetting');
    await stateStore.clear('');
  }

  const result = await injectContext(
    { prompt: input.prompt, sessionId },
    stateStore,
    commandRunner,
    captureReader,
    processSpawner,
    auditLogger,
    memoryStore,
  );

  debug(`Codex UserPromptSubmit: prompt modified=${result.prompt !== input.prompt}`);

  if (result.prompt !== input.prompt) {
    const state = await stateStore.loadCurrent();
    debug(
      `Codex UserPromptSubmit: state after=${state?.status ?? 'none'}, vars=${Object.keys(state?.variables ?? {}).length}`,
    );
    if (state?.status === 'active') {
      const { renderFlow } = await import('../../domain/render-flow.js');
      const { colorizeFlow } = await import('../../domain/colorize-flow.js');
      process.stderr.write(`\n${colorizeFlow(renderFlow(state))}\n`);
    }

    if (state && stateBefore?.status === 'active' && state.status !== 'active') {
      const goal = state.flowSpec.goal || 'unnamed flow';
      if (state.status === 'completed') {
        debug(`Codex UserPromptSubmit: flow completed — ${goal}`);
        process.stderr.write(`\x1b[32;1m[PL] Flow completed: ${goal} | All gates passed\x1b[0m\n`);
      } else if (state.status === 'failed') {
        debug(`Codex UserPromptSubmit: flow failed — ${goal}`);
        process.stderr.write(`\x1b[31;1m[PL] Flow failed: ${goal}\x1b[0m\n`);
      }
    }
  }

  const output =
    result.prompt !== input.prompt
      ? JSON.stringify({
          hookSpecificOutput: {
            additionalContext: result.prompt,
          },
        })
      : '{}';
  process.stdout.write(output);
}

main().catch(async (error: unknown) => {
  await logHookError('Codex UserPromptSubmit', process.cwd(), error);
  process.exitCode = 0;
});
