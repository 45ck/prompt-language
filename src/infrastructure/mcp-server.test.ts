/**
 * mcp-server tests — verifies that the MCP server module can be imported
 * and that state-reading helpers behave correctly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readSessionState, writeSessionState, deleteSessionState } from './mcp-state-reader.js';
import { createSessionState } from '../domain/session-state.js';
import { createFlowSpec } from '../domain/flow-spec.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'mcp-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('readSessionState', () => {
  it('returns null when state file does not exist', async () => {
    const result = await readSessionState(tempDir);
    expect(result).toBeNull();
  });

  it('returns null for a non-existent directory', async () => {
    const result = await readSessionState(join(tempDir, 'missing-dir'));
    expect(result).toBeNull();
  });
});

describe('writeSessionState and readSessionState', () => {
  it('round-trips a session state', async () => {
    const spec = createFlowSpec('Test goal', []);
    const state = createSessionState('session-1', spec);
    await writeSessionState(tempDir, state);
    const loaded = await readSessionState(tempDir);
    expect(loaded).not.toBeNull();
    expect(loaded?.sessionId).toBe('session-1');
    expect(loaded?.flowSpec.goal).toBe('Test goal');
  });

  it('preserves variables through round-trip', async () => {
    const spec = createFlowSpec('Test', []);
    const state = createSessionState('s2', spec);
    const withVar = { ...state, variables: { ...state.variables, myKey: 'myValue' } };
    await writeSessionState(tempDir, withVar);
    const loaded = await readSessionState(tempDir);
    expect(loaded?.variables['myKey']).toBe('myValue');
  });
});

describe('deleteSessionState', () => {
  it('deletes an existing state file', async () => {
    const spec = createFlowSpec('Delete test', []);
    const state = createSessionState('s3', spec);
    await writeSessionState(tempDir, state);
    await deleteSessionState(tempDir);
    const loaded = await readSessionState(tempDir);
    expect(loaded).toBeNull();
  });

  it('does not throw if state file does not exist', async () => {
    await expect(deleteSessionState(tempDir)).resolves.not.toThrow();
  });
});

describe('startMcpServer import', () => {
  it('can import startMcpServer without errors', async () => {
    const mod = await import('./mcp-server.js');
    expect(typeof mod.startMcpServer).toBe('function');
  });
});
