/**
 * FileStateStore — persists SessionState to .prompt-language/session-state.json.
 */

import {
  mkdir,
  readFile,
  writeFile,
  rename,
  unlink,
  access,
  open,
  copyFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { StateStore } from '../../application/ports/state-store.js';
import type { SessionState } from '../../domain/session-state.js';

const DIR_NAME = '.prompt-language';
const FILE_NAME = 'session-state.json';
const TEMP_FILE_NAME = 'session-state.tmp.json';
const LOCK_NAME = 'session-state.lock';
const PENDING_PROMPT_NAME = 'pending-nl-prompt.json';
// H-SEC-009: Backup file names (two-generation rotation)
const BACKUP_FILE_NAME = 'session-state.bak.json';
const BACKUP2_FILE_NAME = 'session-state.bak2.json';
// H#79: Guard against enormous state files
const MAX_STATE_FILE_SIZE = 100 * 1024; // 100 KB
// H#58: Lock timeout and retry config
const LOCK_MAX_RETRIES = 20;
const LOCK_RETRY_MS = 50;
// H-REL-001: Rename retry config (Windows EBUSY)
const RENAME_MAX_RETRIES = 3;
const RENAME_RETRY_MS = 50;

export class FileStateStore implements StateStore {
  private readonly dirPath: string;
  private readonly filePath: string;
  private readonly tempFilePath: string;
  private readonly lockPath: string;
  private readonly pendingPromptPath: string;
  private readonly backupPath: string;
  private readonly backupPath2: string;

  constructor(basePath: string, stateDir = DIR_NAME) {
    this.dirPath = join(basePath, stateDir);
    this.filePath = join(this.dirPath, FILE_NAME);
    this.tempFilePath = join(this.dirPath, TEMP_FILE_NAME);
    this.lockPath = join(this.dirPath, LOCK_NAME);
    this.pendingPromptPath = join(this.dirPath, PENDING_PROMPT_NAME);
    this.backupPath = join(this.dirPath, BACKUP_FILE_NAME);
    this.backupPath2 = join(this.dirPath, BACKUP2_FILE_NAME);
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
    // H-SEC-002: Append integrity checksum (avoid re-parse round-trip)
    const checksum = computeChecksum(json);
    const stateWithChecksum = { ...state, _checksum: checksum };
    const jsonWithChecksum = JSON.stringify(stateWithChecksum, null, 2);
    // H#58: File locking to prevent concurrent writes
    // H-REL-001: Write to temp file then atomic rename
    // D02-fix: Backup moved inside lock to prevent TOCTOU race
    await this.withLock(async () => {
      await this.backupCurrentState();
      await writeFile(this.tempFilePath, jsonWithChecksum, 'utf-8');
      await this.renameWithRetry(this.tempFilePath, this.filePath);
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

  async savePendingPrompt(prompt: string): Promise<void> {
    await this.ensureDir();
    const json = JSON.stringify({ prompt, timestamp: Date.now() });
    await writeFile(this.pendingPromptPath, json, 'utf-8');
  }

  async loadPendingPrompt(): Promise<string | null> {
    try {
      const raw = await readFile(this.pendingPromptPath, 'utf-8');
      const parsed = JSON.parse(raw) as { prompt: string };
      return parsed.prompt ?? null;
    } catch {
      return null;
    }
  }

  async clearPendingPrompt(): Promise<void> {
    try {
      await unlink(this.pendingPromptPath);
    } catch (error: unknown) {
      if (!isNodeError(error) || error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private async readState(): Promise<SessionState | null> {
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      return this.parseStateJson(raw);
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return null;
      }
      // D03-fix: Catch all parse/corruption errors, not just SyntaxError
      // Any error reading an existing file indicates corruption — try backup
      process.stderr.write(
        '[prompt-language] WARNING: session-state.json is corrupted, trying backup\n',
      );
      return this.readBackupState();
    }
  }

  /** Parse raw JSON into SessionState, handling checksum verification. */
  private parseStateJson(raw: string): SessionState {
    const parsed = JSON.parse(raw) as SessionState & { _checksum?: string };

    // H-SEC-002: Verify state file integrity
    const storedChecksum = parsed._checksum;
    if (storedChecksum !== undefined) {
      const { _checksum: _, ...stateWithout } = parsed;
      const expectedChecksum = computeChecksum(JSON.stringify(stateWithout, null, 2));
      if (storedChecksum !== expectedChecksum) {
        process.stderr.write(
          '[prompt-language] WARNING: state file checksum mismatch, clearing gate results\n',
        );
        const sanitized = { ...stateWithout, gateResults: {}, gateDiagnostics: {} };
        if (!isStateStructureValid(sanitized)) {
          throw new Error('State file has invalid structure after checksum mismatch');
        }
        return sanitized as SessionState;
      }
      return stateWithout as SessionState;
    }

    // Legacy file without checksum — validate structure before returning
    if (!isStateStructureValid(parsed)) {
      throw new Error('State file has invalid structure (no checksum, missing required fields)');
    }
    return parsed as SessionState;
  }

  // H-SEC-009: Read backup state file on primary corruption (two-generation fallback)
  private async readBackupState(): Promise<SessionState | null> {
    try {
      const raw = await readFile(this.backupPath, 'utf-8');
      process.stderr.write('[prompt-language] Recovered state from backup file\n');
      return this.parseStateJson(raw);
    } catch {
      // bak.json failed — try second-generation backup
      try {
        const raw = await readFile(this.backupPath2, 'utf-8');
        process.stderr.write('[prompt-language] Recovered state from second-generation backup\n');
        return this.parseStateJson(raw);
      } catch {
        return null;
      }
    }
  }

  // H-SEC-009: Two-generation backup rotation before overwriting
  private async backupCurrentState(): Promise<void> {
    // Rotate: bak → bak2 first
    try {
      await copyFile(this.backupPath, this.backupPath2);
    } catch {
      // No existing bak to rotate — that's fine
    }
    // Then: main → bak
    try {
      await copyFile(this.filePath, this.backupPath);
    } catch {
      // No existing state to backup — that's fine
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
        // H-REL-008: Write PID and timestamp to lock file for stale detection
        const handle = await open(this.lockPath, 'wx');
        try {
          await handle.writeFile(JSON.stringify({ pid: process.pid, timestamp: Date.now() }));
        } finally {
          await handle.close();
        }
        return;
      } catch (error: unknown) {
        if (isNodeError(error) && error.code === 'EEXIST') {
          // H-REL-008: Check if lock holder PID is still alive
          if (await this.isLockStale()) {
            try {
              await unlink(this.lockPath);
            } catch {
              // ignore — another process may have already cleaned it
            }
            continue; // retry immediately after breaking stale lock
          }
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
    try {
      await handle.writeFile(JSON.stringify({ pid: process.pid, timestamp: Date.now() }));
    } finally {
      await handle.close();
    }
  }

  // H-REL-008: Check if the lock is stale
  // Primary: timestamp-based threshold (works on all platforms including Windows)
  // Secondary: PID liveness check (only on non-Windows, where process.kill(pid,0) is reliable)
  private async isLockStale(): Promise<boolean> {
    try {
      const raw = await readFile(this.lockPath, 'utf-8');
      const { pid, timestamp } = JSON.parse(raw) as { pid: number; timestamp: number };
      const age = Date.now() - timestamp;
      const STALE_THRESHOLD_MS = 30_000;
      // Lock is definitely stale if older than threshold
      if (age >= STALE_THRESHOLD_MS) return true;
      // Lock is young — on non-Windows, verify PID is still alive
      if (process.platform !== 'win32') {
        try {
          process.kill(pid, 0); // signal 0 = existence check
          return false; // PID is alive
        } catch {
          return true; // PID is dead — lock is stale
        }
      }
      // On Windows, trust timestamp only (process.kill(pid,0) is unreliable)
      return false;
    } catch {
      // Can't read or parse lock file — treat as stale
      return true;
    }
  }

  private async releaseLock(): Promise<void> {
    try {
      await unlink(this.lockPath);
    } catch {
      // ignore
    }
  }

  // H-REL-001: Rename with retry for Windows EBUSY errors
  private async renameWithRetry(src: string, dest: string): Promise<void> {
    for (let i = 0; i < RENAME_MAX_RETRIES; i++) {
      try {
        await rename(src, dest);
        return;
      } catch (error: unknown) {
        if (isNodeError(error) && error.code === 'EBUSY' && i < RENAME_MAX_RETRIES - 1) {
          await sleep(RENAME_RETRY_MS);
          continue;
        }
        throw error;
      }
    }
  }
}

/** Validate that parsed JSON has the minimum required SessionState structure. */
function isStateStructureValid(state: unknown): state is SessionState {
  if (typeof state !== 'object' || state === null) return false;
  const s = state as Record<string, unknown>;
  return (
    typeof s['sessionId'] === 'string' &&
    typeof s['status'] === 'string' &&
    Array.isArray(s['currentNodePath']) &&
    typeof s['variables'] === 'object' &&
    s['variables'] !== null &&
    typeof s['flowSpec'] === 'object' &&
    s['flowSpec'] !== null
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// H-SEC-002: Compute SHA-256 checksum of state JSON content
function computeChecksum(json: string): string {
  return createHash('sha256').update(json).digest('hex');
}
