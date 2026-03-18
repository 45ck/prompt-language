import { describe, it, expect } from 'vitest';
import { InMemoryStateStore } from './in-memory-state-store.js';
import { createSessionState } from '../../domain/session-state.js';
import { createFlowSpec } from '../../domain/flow-spec.js';

function makeSession(id: string) {
  return createSessionState(id, createFlowSpec('Test', []));
}

describe('InMemoryStateStore', () => {
  it('returns null when empty', async () => {
    const store = new InMemoryStateStore();
    expect(await store.load('any')).toBeNull();
    expect(await store.loadCurrent()).toBeNull();
    expect(await store.exists()).toBe(false);
  });

  it('saves and loads by session id', async () => {
    const store = new InMemoryStateStore();
    await store.save(makeSession('s1'));
    const loaded = await store.load('s1');
    expect(loaded?.sessionId).toBe('s1');
  });

  it('loadCurrent returns last saved', async () => {
    const store = new InMemoryStateStore();
    await store.save(makeSession('s1'));
    await store.save(makeSession('s2'));
    const current = await store.loadCurrent();
    expect(current?.sessionId).toBe('s2');
  });

  it('exists returns true after save', async () => {
    const store = new InMemoryStateStore();
    await store.save(makeSession('s1'));
    expect(await store.exists()).toBe(true);
  });

  it('clear removes specific session', async () => {
    const store = new InMemoryStateStore();
    await store.save(makeSession('s1'));
    await store.clear('s1');
    expect(await store.load('s1')).toBeNull();
    expect(store.size).toBe(0);
  });

  it('clear resets loadCurrent when clearing current', async () => {
    const store = new InMemoryStateStore();
    await store.save(makeSession('s1'));
    await store.clear('s1');
    expect(await store.loadCurrent()).toBeNull();
  });
});
