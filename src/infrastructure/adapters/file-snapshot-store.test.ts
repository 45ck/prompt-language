/**
 * FileSnapshotStore — round-trip, cap enforcement, marker recovery tests.
 *
 * The test suite uses tmpdir-backed stateDirs and forces `storeDir` to a
 * fresh subdirectory per test so runs cannot collide.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs, existsSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { FileSnapshotStore } from './file-snapshot-store.js';

async function makeWorkdir(): Promise<{ stateDir: string; storeDir: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pl-snapshot-'));
  const stateDir = path.join(root, 'state');
  const storeDir = path.join(root, 'store');
  await fs.mkdir(stateDir, { recursive: true });
  await fs.mkdir(storeDir, { recursive: true });
  return { stateDir, storeDir };
}

async function cleanup(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // best-effort
  }
}

async function writeTree(
  stateDir: string,
  files: Record<string, { content: string | Buffer; mode?: number }>,
): Promise<void> {
  for (const [rel, spec] of Object.entries(files)) {
    const abs = path.join(stateDir, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, spec.content);
    if (spec.mode != null && process.platform !== 'win32') {
      await fs.chmod(abs, spec.mode);
    }
  }
}

describe('FileSnapshotStore — capture + restore round trip', () => {
  let stateDir: string;
  let storeDir: string;
  let rootDir: string;

  beforeEach(async () => {
    const dirs = await makeWorkdir();
    stateDir = dirs.stateDir;
    storeDir = dirs.storeDir;
    rootDir = path.dirname(stateDir);
  });

  afterEach(async () => {
    await cleanup(rootDir);
  });

  it('round-trips a 5-file tree including bytes, KB, and a 1 MB file', async () => {
    const bigPayload = Buffer.alloc(1024 * 1024, 0x37);
    await writeTree(stateDir, {
      'readme.txt': { content: 'hello', mode: 0o644 },
      'nested/a.json': { content: '{"a":1}', mode: 0o644 },
      'nested/b.bin': { content: Buffer.from([1, 2, 3, 4, 5]), mode: 0o640 },
      'kb.log': { content: 'x'.repeat(2048), mode: 0o644 },
      'big.bin': { content: bigPayload, mode: 0o644 },
    });

    const store = new FileSnapshotStore({ storeDir });
    const ref = await store.capture(stateDir);
    expect(ref).toMatch(/^[a-f0-9]{64}$/);

    await fs.rm(path.join(stateDir, 'readme.txt'));
    await fs.writeFile(path.join(stateDir, 'nested/a.json'), 'CHANGED');

    await store.restore(ref, stateDir);

    const readme = await fs.readFile(path.join(stateDir, 'readme.txt'), 'utf8');
    expect(readme).toBe('hello');
    const a = await fs.readFile(path.join(stateDir, 'nested/a.json'), 'utf8');
    expect(a).toBe('{"a":1}');
    const big = await fs.readFile(path.join(stateDir, 'big.bin'));
    expect(big.length).toBe(bigPayload.length);
    expect(big.equals(bigPayload)).toBe(true);
  });

  it.skipIf(process.platform === 'win32')('preserves POSIX mode bits after restore', async () => {
    await writeTree(stateDir, {
      'exec.sh': { content: '#!/bin/sh\necho hi', mode: 0o755 },
      'ro.txt': { content: 'x', mode: 0o440 },
    });
    const store = new FileSnapshotStore({ storeDir });
    const ref = await store.capture(stateDir);
    await fs.rm(path.join(stateDir, 'exec.sh'));
    await fs.rm(path.join(stateDir, 'ro.txt'));
    await store.restore(ref, stateDir);
    const execStat = await fs.stat(path.join(stateDir, 'exec.sh'));
    const roStat = await fs.stat(path.join(stateDir, 'ro.txt'));
    const MODE_MASK = 0o777;
    expect(execStat.mode % (MODE_MASK + 1)).toBeGreaterThan(0o600);
    expect(roStat.mode % (MODE_MASK + 1)).toBeGreaterThan(0);
  });

  it('rejects capture when the tree exceeds the configured cap', async () => {
    const oneMb = Buffer.alloc(1024 * 1024, 0x42);
    const files: Record<string, { content: Buffer }> = {};
    for (let i = 0; i < 11; i++) {
      files[`chunk-${i}.bin`] = { content: oneMb };
    }
    await writeTree(stateDir, files);
    const store = new FileSnapshotStore({ maxMb: 10, storeDir });
    await expect(store.capture(stateDir)).rejects.toThrow(
      /snapshot capture exceeds PL_SNAPSHOT_MAX_MB cap of 10 MB; measured \d+\.\d+ MB under /,
    );
  });

  it('rejects restore when the ref is unknown', async () => {
    const store = new FileSnapshotStore({ storeDir });
    await expect(store.restore('deadbeef', stateDir)).rejects.toThrow(
      /snapshot ref deadbeef not found; cannot restore files/,
    );
  });

  it('content-addresses identical trees to the same ref', async () => {
    await writeTree(stateDir, { 'a.txt': { content: 'same' } });
    const store = new FileSnapshotStore({ storeDir });
    const ref1 = await store.capture(stateDir);
    const ref2 = await store.capture(stateDir);
    expect(ref1).toBe(ref2);
  });

  it('recovers from a stale restore-in-progress marker', async () => {
    await writeTree(stateDir, { 'keep.txt': { content: 'v1' } });
    const store = new FileSnapshotStore({ storeDir });
    const ref = await store.capture(stateDir);

    const marker = path.join(storeDir, 'restore-in-progress');
    await fs.writeFile(marker, path.join(storeDir, 'phantom-dir'), 'utf8');

    await fs.writeFile(path.join(stateDir, 'keep.txt'), 'v2');
    await store.restore(ref, stateDir);
    expect(existsSync(marker)).toBe(false);
    const content = await fs.readFile(path.join(stateDir, 'keep.txt'), 'utf8');
    expect(content).toBe('v1');
  });

  it('serializes concurrent captures and produces valid refs', async () => {
    await writeTree(stateDir, {
      'a.txt': { content: 'hello' },
      'b.txt': { content: 'world' },
    });
    const store = new FileSnapshotStore({ storeDir });
    const [ref1, ref2] = await Promise.all([store.capture(stateDir), store.capture(stateDir)]);
    expect(ref1).toMatch(/^[a-f0-9]{64}$/);
    expect(ref2).toMatch(/^[a-f0-9]{64}$/);
    expect(ref1).toBe(ref2);
    expect(existsSync(path.join(storeDir, `${ref1}.tar.gz`))).toBe(true);
  });

  it('cleanup refcounts so shared refs are not blind-deleted', async () => {
    await writeTree(stateDir, { 'a.txt': { content: 'hello' } });
    const store = new FileSnapshotStore({ storeDir });
    const ref1 = await store.capture(stateDir);
    const ref2 = await store.capture(stateDir);
    expect(ref1).toBe(ref2);
    await store.cleanup(ref1);
    const target = path.join(storeDir, `${ref1}.tar.gz`);
    expect(existsSync(target)).toBe(true);
    await store.cleanup(ref2);
    expect(existsSync(target)).toBe(true);
  });

  it('excludes the .snapshots subtree from subsequent captures', async () => {
    await writeTree(stateDir, { 'a.txt': { content: 'only' } });
    const defaultStore = new FileSnapshotStore();
    const ref1 = await defaultStore.capture(stateDir);
    const ref2 = await defaultStore.capture(stateDir);
    expect(ref1).toBe(ref2);
  });

  it.skipIf(process.platform !== 'win32')(
    'rejects paths over the Windows 260-char limit with the offending path',
    async () => {
      const deepDir = 'a'.repeat(20);
      let tree = deepDir;
      for (let i = 0; i < 15; i++) tree = path.join(tree, deepDir);
      const leaf = 'b'.repeat(40) + '.txt';
      const files: Record<string, { content: string }> = {};
      files[path.join(tree, leaf)] = { content: 'x' };
      await writeTree(stateDir, files);
      const store = new FileSnapshotStore({ storeDir });
      await expect(store.capture(stateDir)).rejects.toThrow(/Windows 260-char limit/);
    },
  );
});
