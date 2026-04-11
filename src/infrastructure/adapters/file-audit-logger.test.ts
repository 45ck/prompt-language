/**
 * FileAuditLogger — unit tests.
 *
 * Tests that log() writes valid JSON lines to the audit file and that
 * truncation is applied correctly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileAuditLogger } from './file-audit-logger.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'audit-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('FileAuditLogger', () => {
  it('creates the state directory and writes a JSON line on first log', async () => {
    const logger = new FileAuditLogger(tempDir);
    logger.log({
      timestamp: '2024-01-01T00:00:00.000Z',
      event: 'run_command',
      command: 'npm test',
      exitCode: 0,
    });

    const content = await readFile(join(tempDir, '.prompt-language', 'audit.jsonl'), 'utf-8');
    const record = JSON.parse(content.trim()) as Record<string, unknown>;
    expect(record['event']).toBe('run_command');
    expect(record['command']).toBe('npm test');
    expect(record['exitCode']).toBe(0);
  });

  it('appends multiple log entries as separate JSON lines', async () => {
    const logger = new FileAuditLogger(tempDir);
    logger.log({
      timestamp: '2024-01-01T00:00:00.000Z',
      event: 'run_command',
      command: 'cmd1',
      exitCode: 0,
    });
    logger.log({
      timestamp: '2024-01-01T00:00:01.000Z',
      event: 'run_command',
      command: 'cmd2',
      exitCode: 1,
    });

    const content = await readFile(join(tempDir, '.prompt-language', 'audit.jsonl'), 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
    const r1 = JSON.parse(lines[0]!) as Record<string, unknown>;
    const r2 = JSON.parse(lines[1]!) as Record<string, unknown>;
    expect(r1['command']).toBe('cmd1');
    expect(r2['command']).toBe('cmd2');
  });

  it('truncates stdout when longer than 500 chars', async () => {
    const logger = new FileAuditLogger(tempDir);
    const longOutput = 'a'.repeat(600);
    logger.log({
      timestamp: '2024-01-01T00:00:00.000Z',
      event: 'run_command',
      command: 'cmd',
      exitCode: 0,
      stdout: longOutput,
    });

    const content = await readFile(join(tempDir, '.prompt-language', 'audit.jsonl'), 'utf-8');
    const record = JSON.parse(content.trim()) as Record<string, unknown>;
    expect(typeof record['stdout']).toBe('string');
    expect((record['stdout'] as string).endsWith('[truncated]')).toBe(true);
    expect((record['stdout'] as string).length).toBeLessThan(600);
  });

  it('omits stdout and stderr when they are empty or whitespace', async () => {
    const logger = new FileAuditLogger(tempDir);
    logger.log({
      timestamp: '2024-01-01T00:00:00.000Z',
      event: 'run_command',
      command: 'cmd',
      exitCode: 0,
      stdout: '   ',
      stderr: '',
    });

    const content = await readFile(join(tempDir, '.prompt-language', 'audit.jsonl'), 'utf-8');
    const record = JSON.parse(content.trim()) as Record<string, unknown>;
    expect(record['stdout']).toBeUndefined();
    expect(record['stderr']).toBeUndefined();
  });

  it('records timedOut and truncates stderr when needed', async () => {
    const logger = new FileAuditLogger(tempDir);
    logger.log({
      timestamp: '2024-01-01T00:00:00.000Z',
      event: 'run_command',
      command: 'cmd',
      exitCode: 124,
      timedOut: true,
      stderr: 'b'.repeat(600),
    });

    const content = await readFile(join(tempDir, '.prompt-language', 'audit.jsonl'), 'utf-8');
    const record = JSON.parse(content.trim()) as Record<string, unknown>;
    expect(record['timedOut']).toBe(true);
    expect(typeof record['stderr']).toBe('string');
    expect((record['stderr'] as string).endsWith('[truncated]')).toBe(true);
  });

  it('persists node timing metadata for node_advance events', async () => {
    const logger = new FileAuditLogger(tempDir);
    logger.log({
      timestamp: '2024-01-01T00:00:00.000Z',
      event: 'node_advance',
      command: 'run: npm test',
      nodeId: 'r1',
      nodeKind: 'run',
      nodePath: '0.1',
      durationMs: 1532,
    });

    const content = await readFile(join(tempDir, '.prompt-language', 'audit.jsonl'), 'utf-8');
    const record = JSON.parse(content.trim()) as Record<string, unknown>;
    expect(record['event']).toBe('node_advance');
    expect(record['nodeId']).toBe('r1');
    expect(record['nodeKind']).toBe('run');
    expect(record['nodePath']).toBe('0.1');
    expect(record['durationMs']).toBe(1532);
    expect(record['exitCode']).toBeUndefined();
  });

  it('accepts a custom stateDir parameter', async () => {
    const logger = new FileAuditLogger(tempDir, 'my-state');
    logger.log({
      timestamp: '2024-01-01T00:00:00.000Z',
      event: 'run_command',
      command: 'hi',
      exitCode: 0,
    });

    const content = await readFile(join(tempDir, 'my-state', 'audit.jsonl'), 'utf-8');
    expect(content).toContain('"hi"');
  });

  it('does not re-create dir on second log call (dirEnsured flag)', async () => {
    const logger = new FileAuditLogger(tempDir);
    // Two calls — second should not throw even though dir already exists
    logger.log({ timestamp: 'ts', event: 'run_command', command: 'a', exitCode: 0 });
    logger.log({ timestamp: 'ts', event: 'run_command', command: 'b', exitCode: 0 });

    const content = await readFile(join(tempDir, '.prompt-language', 'audit.jsonl'), 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);
  });
});
