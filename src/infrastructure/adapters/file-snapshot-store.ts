/**
 * FileSnapshotStore — tar-gzip capture/restore of the plugin stateDir.
 *
 * Implementation notes (PR2):
 * - Captures the stateDir into a tar.gz archive under
 *   `<storeDir>/<sha256>.tar.gz`. `storeDir` defaults to
 *   `<stateDir>/.snapshots/` and can be redirected via
 *   `PL_SNAPSHOT_STORE_DIR`. The `.snapshots/` subtree is always excluded
 *   from the archive so captures are not recursive.
 * - Size-checks the tree BEFORE archiving. Rejects with an exact
 *   "snapshot capture exceeds PL_SNAPSHOT_MAX_MB cap" error string if the
 *   tree (excluding `.snapshots/`) exceeds the cap.
 * - Content-addresses: identical trees produce identical refs.
 * - Concurrent captures are serialized by a best-effort advisory lock
 *   (`<storeDir>/.lock`) with a 60 s staleness window.
 * - Restore extracts into a sibling temp dir, then deletes the live tree
 *   (except `.snapshots/`) and moves the extracted contents into place.
 *   A `restore-in-progress` marker is dropped before the destructive
 *   step so interrupted restores can be detected on re-entry.
 * - Symlinks are dereferenced; Windows 260-char paths are rejected at
 *   capture time with the offending path in the error.
 *
 * Scope: the adapter operates only on the stateDir passed to
 * `capture`/`restore`. It never touches anything outside that tree.
 */
import { createHash } from 'node:crypto';
import { promises as fs, existsSync } from 'node:fs';
import * as path from 'node:path';
import * as tar from 'tar';

import type { SnapshotStorePort } from '../../application/ports/snapshot-store.js';

const SNAPSHOTS_SUBDIR = '.snapshots';
const LOCK_FILE = '.lock';
const RESTORE_MARKER = 'restore-in-progress';
const STALE_LOCK_MS = 60_000;
const WINDOWS_MAX_PATH = 260;

export interface FileSnapshotStoreOptions {
  /** Max uncompressed tree size in MB. Default 10. */
  readonly maxMb?: number | undefined;
  /**
   * Override the directory where tarballs are stored. When unset, the
   * adapter writes into `<stateDir>/.snapshots/`. Tests override this
   * to route snapshots to a tmpdir outside the workspace.
   */
  readonly storeDir?: string | undefined;
}

export class FileSnapshotStore implements SnapshotStorePort {
  private readonly maxBytes: number;
  private readonly refCounts = new Map<string, number>();
  private readonly overrideStoreDir: string | undefined;

  constructor(options: FileSnapshotStoreOptions = {}) {
    const mb = options.maxMb ?? 10;
    this.maxBytes = mb * 1024 * 1024;
    this.overrideStoreDir = options.storeDir;
  }

  async capture(stateDir: string): Promise<string> {
    const storeDir = this.resolveStoreDir(stateDir);
    await fs.mkdir(storeDir, { recursive: true });
    const release = await acquireLock(storeDir);
    try {
      const entries = await collectEntries(stateDir);
      await assertUnderCap(stateDir, entries, this.maxBytes);
      const tmpFile = path.join(
        storeDir,
        `tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tar.gz`,
      );
      await createArchive(stateDir, entries, tmpFile);
      const ref = await sha256OfFile(tmpFile);
      const finalFile = path.join(storeDir, `${ref}.tar.gz`);
      if (existsSync(finalFile)) {
        await fs.rm(tmpFile, { force: true });
      } else {
        await fs.rename(tmpFile, finalFile);
      }
      this.refCounts.set(ref, (this.refCounts.get(ref) ?? 0) + 1);
      return ref;
    } finally {
      await release();
    }
  }

  async restore(ref: string, stateDir: string): Promise<void> {
    const storeDir = this.resolveStoreDir(stateDir);
    const archive = path.join(storeDir, `${ref}.tar.gz`);
    if (!existsSync(archive)) {
      throw new Error(`snapshot ref ${ref} not found; cannot restore files`);
    }
    await fs.mkdir(storeDir, { recursive: true });
    await recoverStaleMarker(storeDir);
    const extractDir = path.join(storeDir, `restore-${ref}-${process.pid}-${Date.now()}`);
    await fs.mkdir(extractDir, { recursive: true });
    await tar.extract({ file: archive, cwd: extractDir });
    const marker = path.join(storeDir, RESTORE_MARKER);
    await fs.writeFile(marker, extractDir, 'utf8');
    try {
      await clearLiveTree(stateDir);
      await moveExtractedInto(extractDir, stateDir);
    } finally {
      await fs.rm(marker, { force: true });
      await fs.rm(extractDir, { recursive: true, force: true });
    }
  }

  async cleanup(ref: string): Promise<void> {
    const count = (this.refCounts.get(ref) ?? 0) - 1;
    if (count > 0) {
      this.refCounts.set(ref, count);
      return;
    }
    this.refCounts.delete(ref);
  }

  private resolveStoreDir(stateDir: string): string {
    return this.overrideStoreDir ?? path.join(stateDir, SNAPSHOTS_SUBDIR);
  }
}

interface FileEntry {
  readonly relPath: string;
  readonly absPath: string;
  readonly size: number;
  readonly mode: number;
}

async function collectEntries(stateDir: string): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];
  await walk(stateDir, stateDir, entries);
  return entries;
}

async function walk(root: string, current: string, out: FileEntry[]): Promise<void> {
  let listing: import('node:fs').Dirent[];
  try {
    listing = await fs.readdir(current, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw err;
  }
  for (const dirent of listing) {
    if (current === root && dirent.name === SNAPSHOTS_SUBDIR) continue;
    const abs = path.join(current, dirent.name);
    if (process.platform === 'win32' && abs.length >= WINDOWS_MAX_PATH) {
      throw new Error(`snapshot capture failed: path exceeds Windows 260-char limit: ${abs}`);
    }
    if (dirent.isDirectory()) {
      await walk(root, abs, out);
      continue;
    }
    if (dirent.isSymbolicLink()) {
      const target = await resolveSymlink(abs);
      if (target == null) continue;
      out.push(target);
      continue;
    }
    if (!dirent.isFile()) continue;
    const stat = await fs.stat(abs);
    out.push({
      relPath: path.relative(root, abs).split(path.sep).join('/'),
      absPath: abs,
      size: stat.size,
      mode: stat.mode,
    });
  }
}

async function resolveSymlink(abs: string): Promise<FileEntry | null> {
  try {
    const stat = await fs.stat(abs);
    if (!stat.isFile()) return null;
    return {
      relPath: path.relative(path.dirname(abs), abs).split(path.sep).join('/'),
      absPath: abs,
      size: stat.size,
      mode: stat.mode,
    };
  } catch {
    return null;
  }
}

async function assertUnderCap(
  stateDir: string,
  entries: readonly FileEntry[],
  maxBytes: number,
): Promise<void> {
  const total = entries.reduce((acc, e) => acc + e.size, 0);
  if (total > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    const measuredMb = (total / (1024 * 1024)).toFixed(2);
    throw new Error(
      `snapshot capture exceeds PL_SNAPSHOT_MAX_MB cap of ${maxMb} MB; measured ${measuredMb} MB under ${stateDir}`,
    );
  }
}

async function createArchive(
  stateDir: string,
  entries: readonly FileEntry[],
  outFile: string,
): Promise<void> {
  if (entries.length === 0) {
    await tar.create({ file: outFile, gzip: true, cwd: stateDir, portable: true }, ['.']);
    return;
  }
  await tar.create(
    { file: outFile, gzip: true, cwd: stateDir, portable: true, follow: true },
    entries.map((e) => e.relPath),
  );
}

async function sha256OfFile(file: string): Promise<string> {
  const hash = createHash('sha256');
  hash.update(await fs.readFile(file));
  return hash.digest('hex');
}

async function clearLiveTree(stateDir: string): Promise<void> {
  let listing: import('node:fs').Dirent[];
  try {
    listing = await fs.readdir(stateDir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw err;
  }
  for (const dirent of listing) {
    if (dirent.name === SNAPSHOTS_SUBDIR) continue;
    await fs.rm(path.join(stateDir, dirent.name), { recursive: true, force: true });
  }
}

async function moveExtractedInto(extractDir: string, stateDir: string): Promise<void> {
  const listing = await fs.readdir(extractDir, { withFileTypes: true });
  for (const dirent of listing) {
    const src = path.join(extractDir, dirent.name);
    const dst = path.join(stateDir, dirent.name);
    await fs.rm(dst, { recursive: true, force: true });
    await fs.rename(src, dst);
  }
}

async function recoverStaleMarker(storeDir: string): Promise<void> {
  const marker = path.join(storeDir, RESTORE_MARKER);
  if (!existsSync(marker)) return;
  let pending: string;
  try {
    pending = (await fs.readFile(marker, 'utf8')).trim();
  } catch {
    await fs.rm(marker, { force: true });
    return;
  }
  if (pending && existsSync(pending)) {
    await fs.rm(pending, { recursive: true, force: true });
  }
  await fs.rm(marker, { force: true });
}

async function acquireLock(storeDir: string): Promise<() => Promise<void>> {
  const lockPath = path.join(storeDir, LOCK_FILE);
  const start = Date.now();
  while (Date.now() - start < STALE_LOCK_MS + 1000) {
    try {
      await fs.writeFile(lockPath, `${process.pid}:${Date.now()}`, { flag: 'wx' });
      return async () => {
        await fs.rm(lockPath, { force: true });
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      if (await isStaleLock(lockPath)) {
        await fs.rm(lockPath, { force: true });
        continue;
      }
      await delay(25);
    }
  }
  throw new Error(`snapshot capture failed to acquire lock at ${lockPath}`);
}

async function isStaleLock(lockPath: string): Promise<boolean> {
  try {
    const contents = await fs.readFile(lockPath, 'utf8');
    const [, tsRaw] = contents.split(':');
    const ts = Number(tsRaw);
    if (!Number.isFinite(ts)) return true;
    return Date.now() - ts > STALE_LOCK_MS;
  } catch {
    return true;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
