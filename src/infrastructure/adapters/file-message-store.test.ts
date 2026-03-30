/**
 * Unit tests for FileMessageStore.
 *
 * beads: prompt-language-n6gr
 *
 * Directory layout used in tests:
 *   {tempDir}/.prompt-language/         ← parent state dir
 *   {tempDir}/.prompt-language-worker/  ← child state dir
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileMessageStore } from './file-message-store.js';

let tempDir: string;
let parentStateDir: string;
let childStateDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'msg-store-test-'));
  parentStateDir = join(tempDir, '.prompt-language');
  childStateDir = join(tempDir, '.prompt-language-worker');
  await mkdir(parentStateDir, { recursive: true });
  await mkdir(childStateDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

/** Parent process has its state dir and knows about the worker child. */
function makeParentStore(): FileMessageStore {
  return new FileMessageStore(parentStateDir, { worker: childStateDir });
}

/** Child process only knows its own state dir; no spawned children. */
function makeChildStore(): FileMessageStore {
  return new FileMessageStore(childStateDir, {});
}

describe('FileMessageStore — parent sends to child', () => {
  it('delivers a message to child inbox', async () => {
    const parent = makeParentStore();
    // Parent sends to 'worker' → writes to {childStateDir}/messages/inbox.json
    await parent.send('worker', 'Focus on import errors');

    const child = makeChildStore();
    // Child receives from 'parent' → reads from {childStateDir}/messages/inbox.json
    const msg = await child.receive('parent');
    expect(msg).toBe('Focus on import errors');
  });

  it('receive returns undefined when inbox is empty', async () => {
    const child = makeChildStore();
    const msg = await child.receive('parent');
    expect(msg).toBeUndefined();
  });
});

describe('FileMessageStore — child sends to parent', () => {
  it('delivers a message to parent inbox', async () => {
    const child = makeChildStore();
    // Child sends to 'parent' → writes to {parentStateDir}/messages/worker/inbox.json
    await child.send('parent', 'Fixed 3 lint errors');

    const parent = makeParentStore();
    // Parent receives from 'worker' → reads from {parentStateDir}/messages/worker/inbox.json
    const msg = await parent.receive('worker');
    expect(msg).toBe('Fixed 3 lint errors');
  });
});

describe('FileMessageStore — message sequencing', () => {
  it('delivers messages in FIFO order', async () => {
    const parent = makeParentStore();
    await parent.send('worker', 'first');
    await parent.send('worker', 'second');

    const child = makeChildStore();
    const first = await child.receive('parent');
    const second = await child.receive('parent');
    expect(first).toBe('first');
    expect(second).toBe('second');
  });

  it('marks messages consumed — receive returns each message only once', async () => {
    const parent = makeParentStore();
    await parent.send('worker', 'hello');

    const child = makeChildStore();
    const first = await child.receive('parent');
    const second = await child.receive('parent');
    expect(first).toBe('hello');
    expect(second).toBeUndefined();
  });

  it('preserves unread messages after a partial read', async () => {
    const parent = makeParentStore();
    await parent.send('worker', 'msg-1');
    await parent.send('worker', 'msg-2');
    await parent.send('worker', 'msg-3');

    const child = makeChildStore();
    await child.receive('parent'); // consume msg-1
    const second = await child.receive('parent');
    const third = await child.receive('parent');
    expect(second).toBe('msg-2');
    expect(third).toBe('msg-3');
  });
});
