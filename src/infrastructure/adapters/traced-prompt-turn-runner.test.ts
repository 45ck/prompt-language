import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';

import {
  TracedPromptTurnRunner,
  TRACED_PROMPT_TURN_ERROR_EXIT,
} from './traced-prompt-turn-runner.js';
import { resetTraceChain } from '../../application/trace-chain.js';
import type {
  PromptTurnInput,
  PromptTurnResult,
  PromptTurnRunner,
} from '../../application/ports/prompt-turn-runner.js';
import type { TraceEntry, TraceLogger } from '../../application/ports/trace-logger.js';

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf-8').digest('hex');
}

function makeRecordingLogger(): TraceLogger & { entries: TraceEntry[] } {
  const entries: TraceEntry[] = [];
  return {
    entries,
    log(entry) {
      entries.push(entry);
    },
  };
}

class FakeInnerRunner implements PromptTurnRunner {
  calls = 0;
  lastInput?: PromptTurnInput;
  result: PromptTurnResult = { exitCode: 0, assistantText: 'response-body' };
  error?: Error;
  async run(input: PromptTurnInput): Promise<PromptTurnResult> {
    this.calls += 1;
    this.lastInput = input;
    if (this.error) throw this.error;
    return this.result;
  }
}

beforeEach(() => {
  resetTraceChain();
  process.env['PL_RUN_ID'] = 'test-run-traced';
});

describe('TracedPromptTurnRunner', () => {
  it('emits begin/end entries with chained hashes and correct stdin hash', async () => {
    const inner = new FakeInnerRunner();
    const logger = makeRecordingLogger();
    const runner = new TracedPromptTurnRunner(inner, logger, {
      nodeId: 'p1',
      nodeKind: 'prompt',
      nodePath: '/p1',
    });

    const input: PromptTurnInput = { cwd: '/tmp/x', prompt: 'hello-world' };
    const result = await runner.run(input);

    expect(result.exitCode).toBe(0);
    expect(inner.calls).toBe(1);
    expect(logger.entries).toHaveLength(2);

    const [begin, end] = logger.entries;
    expect(begin!.event).toBe('agent_invocation_begin');
    expect(begin!.source).toBe('adapter');
    expect(begin!.runId).toBe('test-run-traced');
    expect(begin!.seq).toBe(0);
    expect(begin!.prevEventHash).toBeUndefined();
    expect(begin!.stdinSha256).toBe(sha256Hex('hello-world'));
    expect(begin!.nodeId).toBe('p1');
    expect(begin!.nodeKind).toBe('prompt');
    expect(begin!.pid).toBe(process.pid);

    expect(end!.event).toBe('agent_invocation_end');
    expect(end!.seq).toBe(1);
    expect(end!.prevEventHash).toBe(begin!.eventHash);
    expect(end!.stdoutSha256).toBe(sha256Hex('response-body'));
    expect(end!.exitCode).toBe(0);
    expect(end!.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('emits end with sentinel exit code when inner throws, then rethrows', async () => {
    const inner = new FakeInnerRunner();
    inner.error = new Error('boom');
    const logger = makeRecordingLogger();
    const runner = new TracedPromptTurnRunner(inner, logger);

    await expect(runner.run({ cwd: '/tmp/x', prompt: 'p' })).rejects.toThrow('boom');

    expect(logger.entries).toHaveLength(2);
    expect(logger.entries[1]!.event).toBe('agent_invocation_end');
    expect(logger.entries[1]!.exitCode).toBe(TRACED_PROMPT_TURN_ERROR_EXIT);
    expect(logger.entries[1]!.stdoutSha256).toBe(sha256Hex(''));
  });

  it('is a no-op passthrough when NULL_TRACE_LOGGER is used (no entries, delegate returns)', async () => {
    const inner = new FakeInnerRunner();
    const { NULL_TRACE_LOGGER } = await import('../../application/ports/trace-logger.js');
    const runner = new TracedPromptTurnRunner(inner, NULL_TRACE_LOGGER);
    const result = await runner.run({ cwd: '/tmp', prompt: 'x' });
    expect(result.exitCode).toBe(0);
    expect(inner.calls).toBe(1);
  });

  it('swallows logger errors without breaking the turn', async () => {
    const inner = new FakeInnerRunner();
    const exploding: TraceLogger = {
      log() {
        throw new Error('logger-fail');
      },
    };
    const runner = new TracedPromptTurnRunner(inner, exploding);
    const result = await runner.run({ cwd: '/tmp', prompt: 'x' });
    expect(result.exitCode).toBe(0);
  });

  it('withContext produces a new decorator bound to additional context without mutating state', async () => {
    const inner = new FakeInnerRunner();
    const logger = makeRecordingLogger();
    const base = new TracedPromptTurnRunner(inner, logger);
    const scoped = base.withContext({ nodeId: 'n7', nodeKind: 'prompt' });
    await scoped.run({ cwd: '/tmp', prompt: 'x' });
    expect(logger.entries[0]!.nodeId).toBe('n7');
    expect(logger.entries[0]!.nodeKind).toBe('prompt');
  });
});
