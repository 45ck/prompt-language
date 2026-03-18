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
import { readStdin } from './read-stdin.js';

async function main(): Promise<void> {
  const raw = await readStdin();
  const input = JSON.parse(raw) as { prompt: string };

  const stateStore = new FileStateStore(process.cwd());
  const sessionId = randomUUID();

  const result = await injectContext({ prompt: input.prompt, sessionId }, stateStore);

  const output = JSON.stringify({ prompt: result.prompt });
  process.stdout.write(output);
}

void main();
