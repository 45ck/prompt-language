/**
 * Unit tests for FileMemoryStore.
 *
 * beads: prompt-language-7g58
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileMemoryStore } from './file-memory-store.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'memory-store-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function makeStore(): FileMemoryStore {
  return new FileMemoryStore(tempDir);
}

describe('FileMemoryStore.readAll', () => {
  it('returns empty array when memory file does not exist', async () => {
    const store = makeStore();
    const entries = await store.readAll();
    expect(entries).toEqual([]);
  });
});

describe('FileMemoryStore.append — free-form text', () => {
  it('appends a text entry to an empty store', async () => {
    const store = makeStore();
    await store.append({ timestamp: '2024-01-01T00:00:00Z', text: 'User prefers TypeScript' });
    const entries = await store.readAll();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.text).toBe('User prefers TypeScript');
  });

  it('appends multiple text entries in order', async () => {
    const store = makeStore();
    await store.append({ timestamp: '2024-01-01T00:00:00Z', text: 'first' });
    await store.append({ timestamp: '2024-01-01T00:01:00Z', text: 'second' });
    const entries = await store.readAll();
    expect(entries).toHaveLength(2);
    expect(entries[0]?.text).toBe('first');
    expect(entries[1]?.text).toBe('second');
  });
});

describe('FileMemoryStore.append — key-value replace', () => {
  it('stores a key-value entry', async () => {
    const store = makeStore();
    await store.append({
      timestamp: '2024-01-01T00:00:00Z',
      key: 'lang_pref',
      value: 'TypeScript',
    });
    const entry = await store.findByKey('lang_pref');
    expect(entry?.value).toBe('TypeScript');
  });

  it('replaces an existing key-value entry on write', async () => {
    const store = makeStore();
    await store.append({
      timestamp: '2024-01-01T00:00:00Z',
      key: 'lang_pref',
      value: 'JavaScript',
    });
    await store.append({
      timestamp: '2024-01-01T00:01:00Z',
      key: 'lang_pref',
      value: 'TypeScript',
    });
    const entries = await store.readAll();
    // Should only have one entry for this key
    const keyEntries = entries.filter((e) => e.key === 'lang_pref');
    expect(keyEntries).toHaveLength(1);
    expect(keyEntries[0]?.value).toBe('TypeScript');
  });

  it('does not remove text entries when writing a key-value entry', async () => {
    const store = makeStore();
    await store.append({ timestamp: '2024-01-01T00:00:00Z', text: 'some memory' });
    await store.append({ timestamp: '2024-01-01T00:01:00Z', key: 'lang', value: 'TS' });
    const entries = await store.readAll();
    expect(entries.some((e) => e.text === 'some memory')).toBe(true);
    expect(entries.some((e) => e.key === 'lang')).toBe(true);
  });
});

describe('FileMemoryStore.findByKey', () => {
  it('returns undefined when key does not exist', async () => {
    const store = makeStore();
    const entry = await store.findByKey('missing');
    expect(entry).toBeUndefined();
  });

  it('returns the most recent entry for a key', async () => {
    const store = makeStore();
    // Key-value entries replace on write, so there will only be one entry after two writes
    await store.append({ timestamp: '2024-01-01T00:00:00Z', key: 'color', value: 'blue' });
    await store.append({ timestamp: '2024-01-01T00:01:00Z', key: 'color', value: 'red' });
    const entry = await store.findByKey('color');
    expect(entry?.value).toBe('red');
  });

  it('does not find text-only entries by key', async () => {
    const store = makeStore();
    await store.append({ timestamp: '2024-01-01T00:00:00Z', text: 'just text' });
    const entry = await store.findByKey('text');
    expect(entry).toBeUndefined();
  });

  it('writes to a custom state directory when provided', async () => {
    const store = new FileMemoryStore(tempDir, '.prompt-language-worker');
    await store.append({ timestamp: '2024-01-01T00:00:00Z', key: 'color', value: 'purple' });
    await expect(
      access(join(tempDir, '.prompt-language-worker', 'memory.json')),
    ).resolves.toBeUndefined();
  });
});
