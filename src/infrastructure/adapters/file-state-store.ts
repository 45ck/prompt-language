/**
 * FileStateStore — persists SessionState to .prompt-language/session-state.json.
 */

import { mkdir, readFile, writeFile, unlink, access, open } from 'node:fs/promises';
import { join } from 'node:path';
import type { StateStore } from '../../application/ports/state-store.js';
import type { SessionState } from '../../domain/session-state.js';

const DIR_NAME = '.prompt-language';
const FILE_NAME = 'session-state.json';
const LOCK_NAME = 'session-state.lock';
// H#79: Guard against enormous state files
const MAX_STATE_FILE_SIZE = 100 * 1024; // 100 KB
// H#58: Lock timeout and retry config
const LOCK_MAX_RETRIES = 20;
const LOCK_RETRY_MS = 50;

export class FileStateStore implements StateStore {
  private readonly dirPath: string;
  private readonly filePath: string;
  private readonly lockPath: string;

  constructor(basePath: string) {
    this.dirPath = join(basePath, DIR_NAME);
    this.filePath = join(this.dirPath, FILE_NAME);
    this.lockPath = join(this.dirPath, LOCK_NAME);
  }

  async load(sessionId: string): Promise<SessionState | null> {
    const state = await this.readState();
    if (state?.sessionId === sessionId) {
      return state;
    }
    return null;
  }

  async save(state: SessionState): Promise<void> {
    await this.ensureDir();
    const json = JSON.stringify(state, null, 2);
    if (json.length > MAX_STATE_FILE_SIZE) {
      throw new Error(
        `State file exceeds ${MAX_STATE_FILE_SIZE} bytes (${json.length} bytes). ` +
          'Possible cause: large command output in variables.',
      );
    }
    // H#58: File locking to prevent concurrent writes
    await this.withLock(async () => {
      await writeFile(this.filePath, json, 'utf-8');
    });
  }

  async clear(_sessionId: string): Promise<void> {
    try {
      await unlink(this.filePath);
    } catch (error: unknown) {
      if (!isNodeError(error) || error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async exists(): Promise<boolean> {
    try {
      await access(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  async loadCurrent(): Promise<SessionState | null> {
    return this.readState();
  }

  private async readState(): Promise<SessionState | null> {
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      return JSON.parse(raw) as SessionState;
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return null;
      }
      // Corrupted or invalid JSON — treat as no state (fail-open)
      if (error instanceof SyntaxError) {
        return null;
      }
      throw error;
    }
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.dirPath, { recursive: true });
  }

  // H#58: Advisory file locking with O_EXCL for atomic creation
  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquireLock();
    try {
      return await fn();
    } finally {
      await this.releaseLock();
    }
  }

  private async acquireLock(): Promise<void> {
    for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
      try {
        const handle = await open(this.lockPath, 'wx');
        await handle.close();
        return;
      } catch (error: unknown) {
        if (isNodeError(error) && error.code === 'EEXIST') {
          await sleep(LOCK_RETRY_MS);
          continue;
        }
        throw error;
      }
    }
    // Stale lock — force remove and retry once
    try {
      await unlink(this.lockPath);
    } catch {
      // ignore
    }
    const handle = await open(this.lockPath, 'wx');
    await handle.close();
  }

  private async releaseLock(): Promise<void> {
    try {
      await unlink(this.lockPath);
    } catch {
      // ignore
    }
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
