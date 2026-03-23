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
import { formatError } from '../../domain/format-error.js';
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
  const sessionId = randomUUID();

  const result = await injectContext(
    { prompt: input.prompt, sessionId },
    stateStore,
    commandRunner,
    captureReader,
    processSpawner,
  );

  if (result.prompt !== input.prompt) {
    const state = await stateStore.loadCurrent();
    if (state?.status === 'active') {
      const { renderFlow } = await import('../../domain/render-flow.js');
      process.stderr.write(`\n${renderFlow(state)}\n`);
    }
  }

  const output = JSON.stringify({ prompt: result.prompt });
  process.stdout.write(output);
}

main().catch((error: unknown) => {
  process.stderr.write(`[prompt-language] hook error: ${formatError(error)}\n`);
  process.exitCode = 0;
});
