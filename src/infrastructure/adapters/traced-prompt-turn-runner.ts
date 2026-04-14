/**
 * TracedPromptTurnRunner — decorator that wraps any PromptTurnRunner and
 * emits `agent_invocation_begin` / `agent_invocation_end` trace entries
 * chained through the shared trace-chain state.
 *
 * Design:
 *   - Zero overhead when the supplied logger is NULL_TRACE_LOGGER.
 *   - Tracing is best-effort: emit failures never break the turn.
 *   - runId / seq / prevEventHash are shared with advance-flow via
 *     src/application/trace-chain.ts — both the runtime state-transition
 *     events and the adapter invocation events form a single chain.
 *   - Optional node context (nodeId/nodeKind/nodePath) is passed through a
 *     TurnContext injector. The runtime attaches it right before invoking the
 *     runner; we never fabricate node identity from unrelated data.
 */

import { createHash } from 'node:crypto';

import { NULL_TRACE_LOGGER, type TraceLogger } from '../../application/ports/trace-logger.js';
import type {
  PromptTurnInput,
  PromptTurnResult,
  PromptTurnRunner,
} from '../../application/ports/prompt-turn-runner.js';
import { emitTraceEntry } from '../../application/trace-chain.js';

/** Sentinel exit code for begin-emitted turns that threw before completing. */
export const TRACED_PROMPT_TURN_ERROR_EXIT = -1;

export interface TurnTraceContext {
  readonly nodeId?: string | undefined;
  readonly nodeKind?: string | undefined;
  readonly nodePath?: string | undefined;
  readonly argv?: readonly string[] | undefined;
  readonly binaryPath?: string | undefined;
}

/** Optional inner-runner introspection surface. */
interface RunnerIntrospection {
  readonly binaryPath?: string | undefined;
  describeInvocation?: (input: PromptTurnInput) => {
    readonly argv?: readonly string[] | undefined;
    readonly binaryPath?: string | undefined;
  };
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf-8').digest('hex');
}

function readIntrospection(runner: PromptTurnRunner): RunnerIntrospection {
  return runner as unknown as RunnerIntrospection;
}

export class TracedPromptTurnRunner implements PromptTurnRunner {
  constructor(
    private readonly inner: PromptTurnRunner,
    private readonly traceLogger: TraceLogger = NULL_TRACE_LOGGER,
    private readonly context: TurnTraceContext = {},
  ) {}

  /**
   * Returns a new decorator bound to an additional per-turn context. Useful
   * when callers know the node identity and want each turn's trace entries
   * attributed correctly without mutating shared decorator state.
   */
  withContext(context: TurnTraceContext): TracedPromptTurnRunner {
    return new TracedPromptTurnRunner(this.inner, this.traceLogger, {
      ...this.context,
      ...context,
    });
  }

  async run(input: PromptTurnInput): Promise<PromptTurnResult> {
    if (this.traceLogger === NULL_TRACE_LOGGER) {
      return this.inner.run(input);
    }

    const introspection = readIntrospection(this.inner);
    const described = introspection.describeInvocation?.(input);
    const binaryPath = this.context.binaryPath ?? described?.binaryPath ?? introspection.binaryPath;
    const argv = this.context.argv ?? described?.argv;

    const stdinSha256 = sha256Hex(input.prompt);
    const startedAt = Date.now();
    const beginPartial: Record<string, unknown> = {
      timestamp: new Date(startedAt).toISOString(),
      event: 'agent_invocation_begin',
      source: 'adapter',
      pid: process.pid,
      stdinSha256,
      cwd: input.cwd,
    };
    if (binaryPath !== undefined) beginPartial['binaryPath'] = binaryPath;
    if (argv !== undefined) beginPartial['argv'] = [...argv];
    if (this.context.nodeId !== undefined) beginPartial['nodeId'] = this.context.nodeId;
    if (this.context.nodeKind !== undefined) beginPartial['nodeKind'] = this.context.nodeKind;
    if (this.context.nodePath !== undefined) beginPartial['nodePath'] = this.context.nodePath;

    emitTraceEntry(this.traceLogger, beginPartial);

    const emitEnd = (exitCode: number, stdout: string): void => {
      const endPartial: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        event: 'agent_invocation_end',
        source: 'adapter',
        pid: process.pid,
        exitCode,
        durationMs: Date.now() - startedAt,
        stdoutSha256: sha256Hex(stdout),
        cwd: input.cwd,
      };
      if (binaryPath !== undefined) endPartial['binaryPath'] = binaryPath;
      if (this.context.nodeId !== undefined) endPartial['nodeId'] = this.context.nodeId;
      if (this.context.nodeKind !== undefined) endPartial['nodeKind'] = this.context.nodeKind;
      if (this.context.nodePath !== undefined) endPartial['nodePath'] = this.context.nodePath;
      emitTraceEntry(this.traceLogger, endPartial);
    };

    try {
      const result = await this.inner.run(input);
      emitEnd(result.exitCode ?? 0, result.assistantText ?? '');
      return result;
    } catch (error) {
      emitEnd(TRACED_PROMPT_TURN_ERROR_EXIT, '');
      throw error;
    }
  }
}
