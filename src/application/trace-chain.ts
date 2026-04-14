/**
 * Trace-chain state — shared runId, monotonic seq, and prevEventHash bookkeeping
 * used by both runtime advancement (advance-flow) and adapter-level tracing
 * (e.g. TracedPromptTurnRunner). Centralising here prevents chain divergence.
 *
 * The chain is keyed by runId so multiple concurrent runIds in the same
 * process (rare, but possible during tests) stay independent.
 */

import { hashEvent } from '../domain/state-hash.js';
import { NULL_TRACE_LOGGER, type TraceEntry, type TraceLogger } from './ports/trace-logger.js';

interface TraceChainState {
  seq: number;
  lastEventHash: string | undefined;
}

const traceChains = new Map<string, TraceChainState>();
let cachedRunId: string | undefined;

function generateRunIdFallback(): string {
  // RFC 4122 v4-ish; avoids pulling node:crypto into application at module load.
  // Non-cryptographic uniqueness is sufficient here — runId is a correlation key.
  const rand = (): string =>
    Math.floor(Math.random() * 0x100000000)
      .toString(16)
      .padStart(8, '0');
  return `${rand()}${rand()}-${rand().slice(0, 4)}-4${rand().slice(0, 3)}-${rand().slice(0, 4)}-${rand()}${rand().slice(0, 4)}`;
}

export function currentRunId(): string {
  if (cachedRunId !== undefined) return cachedRunId;
  const fromEnv = process.env['PL_RUN_ID'];
  cachedRunId = fromEnv && fromEnv.length > 0 ? fromEnv : generateRunIdFallback();
  return cachedRunId;
}

export function nextTraceSeq(runId: string): { seq: number; prev: string | undefined } {
  let chain = traceChains.get(runId);
  if (!chain) {
    chain = { seq: 0, lastEventHash: undefined };
    traceChains.set(runId, chain);
  }
  const seq = chain.seq;
  chain.seq += 1;
  return { seq, prev: chain.lastEventHash };
}

export function recordTraceEventHash(runId: string, eventHash: string): void {
  const chain = traceChains.get(runId);
  if (chain) {
    chain.lastEventHash = eventHash;
  }
}

/** Test-only: reset trace-chain bookkeeping between runs. */
export function resetTraceChain(): void {
  traceChains.clear();
  cachedRunId = undefined;
}

/**
 * Finalise a partial trace event: attach prevEventHash, compute eventHash,
 * record it, and hand the completed entry to the logger. Never throws:
 * tracing must not interrupt execution.
 */
export function emitTraceEntry(traceLogger: TraceLogger, partial: Record<string, unknown>): void {
  if (traceLogger === NULL_TRACE_LOGGER) return;
  try {
    const runId = typeof partial['runId'] === 'string' ? partial['runId'] : currentRunId();
    if (partial['runId'] === undefined) partial['runId'] = runId;
    if (partial['seq'] === undefined) {
      const { seq, prev } = nextTraceSeq(runId);
      partial['seq'] = seq;
      if (prev !== undefined && partial['prevEventHash'] === undefined) {
        partial['prevEventHash'] = prev;
      }
    }
    const eventHash = hashEvent(partial);
    partial['eventHash'] = eventHash;
    recordTraceEventHash(runId, eventHash);
    traceLogger.log(partial as unknown as TraceEntry);
  } catch (error) {
    // Tracing must never break execution.
    if (process.env['NODE_ENV'] === 'test') {
      process.stderr.write(
        `[prompt-language] trace-logger failure: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  }
}
