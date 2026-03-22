/**
 * FileStateStore — persists SessionState to .prompt-language/session-state.json.
 */

import { mkdir, readFile, writeFile, unlink, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { StateStore } from '../../application/ports/state-store.js';
import type { SessionState } from '../../domain/session-state.js';

const DIR_NAME = '.prompt-language';
const FILE_NAME = 'session-state.json';
// H#79: Guard against enormous state files
const MAX_STATE_FILE_SIZE = 100 * 1024; // 100 KB

export class FileStateStore implements StateStore {
  private readonly dirPath: string;
  private readonly filePath: string;

  constructor(basePath: string) {
    this.dirPath = join(basePath, DIR_NAME);
    this.filePath = join(this.dirPath, FILE_NAME);
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
    await writeFile(this.filePath, json, 'utf-8');
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
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
