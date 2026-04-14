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
import { resolveProcessSpawner } from '../../infrastructure/adapters/resolve-process-spawner.js';
import { FileAuditLogger } from '../../infrastructure/adapters/file-audit-logger.js';
import { FileTraceLogger } from '../../infrastructure/adapters/file-trace-logger.js';
import { NULL_TRACE_LOGGER } from '../../application/ports/trace-logger.js';
import { FileMemoryStore } from '../../infrastructure/adapters/file-memory-store.js';
import { shouldEscalateToFullMode } from '../../domain/escalate-render-mode.js';
import type { SessionState } from '../../domain/session-state.js';
import { readStdin } from './read-stdin.js';
import { debug } from './debug.js';
import { logHookError } from './hook-error-handler.js';
import { formatStateLoadDiagnosticMessage } from './format-state-load-diagnostic.js';

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

  debug('UserPromptSubmit hook invoked');

  if (!input) {
    debug('UserPromptSubmit: no valid prompt input, passing through');
    process.stdout.write(raw);
    return;
  }

  const stateStore = new FileStateStore(process.cwd());
  const commandRunner = new ShellCommandRunner();
  const captureReader = new FileCaptureReader(process.cwd());
  const processSpawner = resolveProcessSpawner(process.cwd());
  const auditLogger = new FileAuditLogger(process.cwd());
  const traceLogger =
    process.env['PL_TRACE'] === '1' ? new FileTraceLogger(process.cwd()) : NULL_TRACE_LOGGER;
  const memoryStore = new FileMemoryStore(process.cwd());
  const sessionId = randomUUID();

  let stateBefore: SessionState | null = null;
  try {
    stateBefore = await stateStore.loadCurrent();
    debug(`UserPromptSubmit: state before=${stateBefore?.status ?? 'none'}`);
  } catch {
    process.stderr.write('[prompt-language] WARNING: Corrupt state detected, resetting\n');
    debug('UserPromptSubmit: corrupt state detected, resetting');
    await stateStore.clear('');
  }
  const loadDiagnostic = stateStore.getLastLoadDiagnostic();
  if (stateBefore == null && loadDiagnostic != null) {
    const message = formatStateLoadDiagnosticMessage(loadDiagnostic);
    process.stderr.write(`${message}\n`);
    process.stdout.write(JSON.stringify({ prompt: `${message}\n\n${input.prompt}` }));
    return;
  }

  const result = await injectContext(
    { prompt: input.prompt, sessionId },
    stateStore,
    commandRunner,
    captureReader,
    processSpawner,
    auditLogger,
    memoryStore,
    traceLogger,
  );

  debug(`UserPromptSubmit: prompt modified=${result.prompt !== input.prompt}`);

  if (result.prompt !== input.prompt) {
    const state = await stateStore.loadCurrent();
    debug(
      `UserPromptSubmit: state after=${state?.status ?? 'none'}, vars=${Object.keys(state?.variables ?? {}).length}`,
    );
    if (state?.status === 'active') {
      const { renderFlow } = await import('../../domain/render-flow.js');
      const { colorizeFlow } = await import('../../domain/colorize-flow.js');

      // E2: Automatic full-mode escalation when compact mode is active
      if (process.env['PL_COMPACT_RENDER'] === '1') {
        const escalation = shouldEscalateToFullMode(state, sessionId);
        if (escalation.escalate) {
          process.stderr.write(
            `[prompt-language] Compact mode escalated to full: ${escalation.reason} [${escalation.triggerIds.join(', ')}]\n`,
          );
          debug(`UserPromptSubmit: escalation triggers=${escalation.triggerIds.join(',')}`);
        }
      }

      process.stderr.write(`\n${colorizeFlow(renderFlow(state))}\n`);
    }

    // Completion banner: detect active → completed/failed transition
    if (state && stateBefore?.status === 'active' && state.status !== 'active') {
      const goal = state.flowSpec.goal || 'unnamed flow';
      if (state.status === 'completed') {
        debug(`UserPromptSubmit: flow completed — ${goal}`);
        process.stderr.write(`\x1b[32;1m[PL] Flow completed: ${goal} | All gates passed\x1b[0m\n`);
      } else if (state.status === 'failed') {
        debug(`UserPromptSubmit: flow failed — ${goal}`);
        process.stderr.write(`\x1b[31;1m[PL] Flow failed: ${goal}\x1b[0m\n`);
      }
    }
  }

  const output = JSON.stringify({ prompt: result.prompt });
  process.stdout.write(output);
}

main().catch(async (error: unknown) => {
  await logHookError('UserPromptSubmit', process.cwd(), error);
  process.exitCode = 0;
});
