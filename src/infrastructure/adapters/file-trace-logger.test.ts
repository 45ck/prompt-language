/**
 * FileTraceLogger — unit tests.
 *
 * Verifies provenance.jsonl is created, entries are appended as separate
 * JSON lines in order, and undefined fields are elided.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileTraceLogger } from './file-trace-logger.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'trace-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('FileTraceLogger', () => {
  it('creates .prompt-language and appends three entries in order', async () => {
    const logger = new FileTraceLogger(tempDir);
    for (let i = 0; i < 3; i += 1) {
      logger.log({
        runId: 'run-1',
        seq: i,
        timestamp: `2024-01-01T00:00:0${i}.000Z`,
        event: 'node_advance',
        source: 'runtime',
        pid: 123,
        nodeId: `n${i}`,
      });
    }

    const content = await readFile(join(tempDir, '.prompt-language', 'provenance.jsonl'), 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(3);
    const parsed = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(parsed.map((p) => p['seq'])).toEqual([0, 1, 2]);
    expect(parsed.map((p) => p['nodeId'])).toEqual(['n0', 'n1', 'n2']);
    expect(parsed[0]!['event']).toBe('node_advance');
    expect(parsed[0]!['source']).toBe('runtime');
  });

  it('omits undefined fields from serialized entries', async () => {
    const logger = new FileTraceLogger(tempDir);
    logger.log({
      runId: 'run-2',
      seq: 0,
      timestamp: '2024-01-01T00:00:00.000Z',
      event: 'node_advance',
      source: 'runtime',
      pid: 7,
      nodeId: undefined,
      stateAfterHash: undefined,
    });

    const content = await readFile(join(tempDir, '.prompt-language', 'provenance.jsonl'), 'utf-8');
    const record = JSON.parse(content.trim()) as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(record, 'nodeId')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(record, 'stateAfterHash')).toBe(false);
    expect(record['pid']).toBe(7);
  });

  it('accepts an absolute stateDir', async () => {
    const absolute = join(tempDir, 'abs');
    const logger = new FileTraceLogger(join(tempDir, 'ignored'), absolute);
    logger.log({
      runId: 'run-3',
      seq: 0,
      timestamp: '2024-01-01T00:00:00.000Z',
      event: 'node_advance',
      source: 'runtime',
      pid: 1,
    });

    const content = await readFile(join(absolute, 'provenance.jsonl'), 'utf-8');
    expect(content).toContain('"run-3"');
  });
});
