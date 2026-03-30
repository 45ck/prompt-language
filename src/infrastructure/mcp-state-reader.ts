/**
 * mcp-state-reader — pure helpers for reading and mutating session state
 * from the file system for the MCP server.
 *
 * Kept separate so mcp-server.ts stays within the 350-line limit.
 */

import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { SessionState } from '../domain/session-state.js';

const DIR_NAME = '.prompt-language';
const FILE_NAME = 'session-state.json';

export function resolveStateDir(
  envVar: string | undefined,
  argVar: string | undefined,
  cwd: string,
): string {
  return envVar ?? argVar ?? join(cwd, DIR_NAME);
}

export function stateFilePath(stateDir: string): string {
  return join(stateDir, FILE_NAME);
}

function computeChecksum(json: string): string {
  return createHash('sha256').update(json).digest('hex');
}

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

function parseStateJson(raw: string): SessionState {
  const parsed = JSON.parse(raw) as SessionState & { _checksum?: string };
  const storedChecksum = parsed._checksum;

  if (storedChecksum !== undefined) {
    const { _checksum: _, ...stateWithout } = parsed;
    const expectedChecksum = computeChecksum(JSON.stringify(stateWithout, null, 2));
    if (storedChecksum !== expectedChecksum) {
      const sanitized = { ...stateWithout, gateResults: {}, gateDiagnostics: {} };
      if (!isStateStructureValid(sanitized)) {
        throw new Error('State file has invalid structure after checksum mismatch');
      }
      return sanitized as SessionState;
    }
    return stateWithout as SessionState;
  }

  if (!isStateStructureValid(parsed)) {
    throw new Error('State file has invalid structure');
  }
  return parsed as SessionState;
}

export async function readSessionState(stateDir: string): Promise<SessionState | null> {
  const filePath = stateFilePath(stateDir);
  try {
    const raw = await readFile(filePath, 'utf-8');
    return parseStateJson(raw);
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') return null;
    return null;
  }
}

export async function writeSessionState(stateDir: string, state: SessionState): Promise<void> {
  await mkdir(stateDir, { recursive: true });
  const json = JSON.stringify(state, null, 2);
  const checksum = computeChecksum(json);
  const stateWithChecksum = { ...state, _checksum: checksum };
  const jsonWithChecksum = JSON.stringify(stateWithChecksum, null, 2);
  await writeFile(stateFilePath(stateDir), jsonWithChecksum, 'utf-8');
}

export async function deleteSessionState(stateDir: string): Promise<void> {
  try {
    await unlink(stateFilePath(stateDir));
  } catch (error: unknown) {
    if (!isNodeError(error) || error.code !== 'ENOENT') throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
