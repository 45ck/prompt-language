import { describe, it, expect } from 'vitest';
import { evaluateStop } from './evaluate-stop.js';
import { InMemoryStateStore } from '../infrastructure/adapters/in-memory-state-store.js';
import { createSessionState, markCompleted } from '../domain/session-state.js';
import { createFlowSpec } from '../domain/flow-spec.js';

function makeStore(): InMemoryStateStore {
  return new InMemoryStateStore();
}

describe('evaluateStop', () => {
  it('allows stop when no active flow exists', async () => {
    const store = makeStore();
    const result = await evaluateStop(store);
    expect(result.blocked).toBe(false);
  });

  it('blocks stop when flow is active', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Deploy app', []);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await evaluateStop(store);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('Deploy app');
    expect(result.reason).toContain('still active');
  });

  it('allows stop when flow is completed', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Deploy app', []);
    const session = markCompleted(createSessionState('s2', spec));
    await store.save(session);

    const result = await evaluateStop(store);
    expect(result.blocked).toBe(false);
  });

  it('includes step path in block reason', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Multi-step', []);
    let session = createSessionState('s3', spec);
    session = { ...session, currentNodePath: [1, 2] };
    await store.save(session);

    const result = await evaluateStop(store);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('[1.2]');
  });

  it('allows stop when flow is failed', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Broken task', []);
    const session = { ...createSessionState('s4', spec), status: 'failed' as const };
    await store.save(session);

    const result = await evaluateStop(store);
    expect(result.blocked).toBe(false);
  });

  it('allows stop when flow is cancelled', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Cancelled task', []);
    const session = { ...createSessionState('s5', spec), status: 'cancelled' as const };
    await store.save(session);

    const result = await evaluateStop(store);
    expect(result.blocked).toBe(false);
  });
});
