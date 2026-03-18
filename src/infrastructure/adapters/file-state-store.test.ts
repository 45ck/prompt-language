import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from './file-state-store.js';
import { createSessionState } from '../../domain/session-state.js';
import { createFlowSpec } from '../../domain/flow-spec.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'cf-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function makeSpec() {
  return createFlowSpec('Test goal', []);
}

describe('FileStateStore', () => {
  it('returns null when no state file exists', async () => {
    const store = new FileStateStore(tempDir);
    const result = await store.loadCurrent();
    expect(result).toBeNull();
  });

  it('reports exists as false when no file', async () => {
    const store = new FileStateStore(tempDir);
    expect(await store.exists()).toBe(false);
  });

  it('saves and loads state by session id', async () => {
    const store = new FileStateStore(tempDir);
    const session = createSessionState('s1', makeSpec());
    await store.save(session);

    const loaded = await store.load('s1');
    expect(loaded).not.toBeNull();
    expect(loaded?.sessionId).toBe('s1');
    expect(loaded?.flowSpec.goal).toBe('Test goal');
  });

  it('returns null for wrong session id', async () => {
    const store = new FileStateStore(tempDir);
    const session = createSessionState('s1', makeSpec());
    await store.save(session);

    const loaded = await store.load('wrong-id');
    expect(loaded).toBeNull();
  });

  it('reports exists as true after save', async () => {
    const store = new FileStateStore(tempDir);
    await store.save(createSessionState('s1', makeSpec()));
    expect(await store.exists()).toBe(true);
  });

  it('loadCurrent returns most recently saved state', async () => {
    const store = new FileStateStore(tempDir);
    await store.save(createSessionState('s1', makeSpec()));
    const current = await store.loadCurrent();
    expect(current?.sessionId).toBe('s1');
  });

  it('clear removes state file', async () => {
    const store = new FileStateStore(tempDir);
    await store.save(createSessionState('s1', makeSpec()));
    expect(await store.exists()).toBe(true);

    await store.clear('s1');
    expect(await store.exists()).toBe(false);
    expect(await store.loadCurrent()).toBeNull();
  });

  it('clear is idempotent when file missing', async () => {
    const store = new FileStateStore(tempDir);
    await expect(store.clear('nonexistent')).resolves.toBeUndefined();
  });

  it('creates .prompt-language directory if missing', async () => {
    const store = new FileStateStore(tempDir);
    await store.save(createSessionState('s1', makeSpec()));

    // Verify by loading
    const loaded = await store.loadCurrent();
    expect(loaded).not.toBeNull();
  });
});
