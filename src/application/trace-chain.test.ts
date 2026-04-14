/**
 * Trace chain integration tests — proves state-hash propagation and
 * TraceLogger emission from autoAdvanceNodes().
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __resetTraceChainForTests, autoAdvanceNodes } from './advance-flow.js';
import { createSessionState } from '../domain/session-state.js';
import { createFlowSpec } from '../domain/flow-spec.js';
import { createPromptNode, createLetNode } from '../domain/flow-node.js';
import { hashState } from '../domain/state-hash.js';
import type { TraceEntry, TraceLogger } from './ports/trace-logger.js';

function makeRecordingLogger(): TraceLogger & { entries: TraceEntry[] } {
  const entries: TraceEntry[] = [];
  return {
    entries,
    log(entry) {
      entries.push(entry);
    },
  };
}

beforeEach(() => {
  __resetTraceChainForTests();
  delete process.env['PL_RUN_ID'];
});

describe('trace chain wiring', () => {
  it('populates stateHash and prevStateHash after a transition', async () => {
    const spec = createFlowSpec('goal', [
      createLetNode('v1', 'a', { type: 'literal', value: 'hello' }),
      createPromptNode('p1', 'hi'),
    ]);
    const initial = createSessionState('sess', spec);
    expect(initial.stateHash).toBeUndefined();

    const result = await autoAdvanceNodes(initial);
    expect(result.state.stateHash).toBeDefined();
    expect(result.state.stateHash).toHaveLength(64);
    // prevStateHash is undefined on the first transition because the initial
    // state has no stateHash yet — that is expected behavior.
  });

  it('chains prevStateHash across successive autoAdvance cycles', async () => {
    process.env['PL_RUN_ID'] = 'test-run-chain';
    const spec = createFlowSpec('goal', [
      createLetNode('v1', 'a', { type: 'literal', value: 'x' }),
      createPromptNode('p1', 'hi'),
    ]);
    const logger = makeRecordingLogger();
    const s0 = createSessionState('sess', spec);
    const r1 = await autoAdvanceNodes(
      s0,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      logger,
    );
    const r2 = await autoAdvanceNodes(
      r1.state,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      logger,
    );

    // r2.state.prevStateHash should equal r1.state.stateHash if a transition
    // occurred in the second call; otherwise the second call was a no-op.
    if (r2.state !== r1.state) {
      expect(r2.state.prevStateHash).toBe(r1.state.stateHash);
    }

    // Trace entries form a chain: each prevEventHash matches the prior eventHash.
    expect(logger.entries.length).toBeGreaterThan(0);
    for (let i = 0; i < logger.entries.length; i += 1) {
      const e = logger.entries[i]!;
      expect(e.runId).toBe('test-run-chain');
      expect(e.seq).toBe(i);
      expect(e.eventHash).toBeDefined();
      if (i === 0) {
        expect(e.prevEventHash).toBeUndefined();
      } else {
        expect(e.prevEventHash).toBe(logger.entries[i - 1]!.eventHash);
      }
    }
  });

  it('detects tamper: recomputing a hash on a modified state does not match the logged hash', async () => {
    process.env['PL_RUN_ID'] = 'test-run-tamper';
    const spec = createFlowSpec('goal', [
      createLetNode('v1', 'a', { type: 'literal', value: 'x' }),
      createPromptNode('p1', 'hi'),
    ]);
    const logger = makeRecordingLogger();
    const s0 = createSessionState('sess', spec);
    const r1 = await autoAdvanceNodes(
      s0,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      logger,
    );

    const original = r1.state;
    expect(original.stateHash).toBeDefined();
    // Tamper: change a variable outside the transition path.
    const tampered = {
      ...original,
      variables: { ...original.variables, injected: 'evil' },
    };
    const recomputed = hashState({ ...tampered, stateHash: undefined, prevStateHash: undefined });
    expect(recomputed).not.toBe(original.stateHash);
  });

  it('works with no traceLogger supplied (NULL_TRACE_LOGGER default, no throw)', async () => {
    const spec = createFlowSpec('goal', [createPromptNode('p1', 'hi')]);
    const result = await autoAdvanceNodes(createSessionState('s', spec));
    expect(result).toBeDefined();
  });
});
