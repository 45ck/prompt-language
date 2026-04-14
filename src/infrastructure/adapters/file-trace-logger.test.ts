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
let savedTraceDir: string | undefined;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'trace-test-'));
  savedTraceDir = process.env['PL_TRACE_DIR'];
  delete process.env['PL_TRACE_DIR'];
});

afterEach(async () => {
  if (savedTraceDir === undefined) {
    delete process.env['PL_TRACE_DIR'];
  } else {
    process.env['PL_TRACE_DIR'] = savedTraceDir;
  }
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

  it('honors PL_TRACE_DIR when set to an absolute path', async () => {
    const absolute = join(tempDir, 'env-abs');
    process.env['PL_TRACE_DIR'] = absolute;
    const logger = new FileTraceLogger(join(tempDir, 'ignored-cwd'));
    logger.log({
      runId: 'run-env-abs',
      seq: 0,
      timestamp: '2024-01-01T00:00:00.000Z',
      event: 'node_advance',
      source: 'runtime',
      pid: 1,
    });

    const content = await readFile(join(absolute, 'provenance.jsonl'), 'utf-8');
    expect(content).toContain('"run-env-abs"');
  });

  it('honors PL_TRACE_DIR when set to a relative path (resolved against cwd arg)', async () => {
    process.env['PL_TRACE_DIR'] = 'rel-trace';
    const logger = new FileTraceLogger(tempDir);
    logger.log({
      runId: 'run-env-rel',
      seq: 0,
      timestamp: '2024-01-01T00:00:00.000Z',
      event: 'node_advance',
      source: 'runtime',
      pid: 1,
    });

    const content = await readFile(join(tempDir, 'rel-trace', 'provenance.jsonl'), 'utf-8');
    expect(content).toContain('"run-env-rel"');
  });

  it('writes provenance.jsonl directly under PL_TRACE_DIR, not in a nested .prompt-language/', async () => {
    const absolute = join(tempDir, 'flat-bundle');
    process.env['PL_TRACE_DIR'] = absolute;
    const logger = new FileTraceLogger(tempDir);
    logger.log({
      runId: 'run-flat',
      seq: 0,
      timestamp: '2024-01-01T00:00:00.000Z',
      event: 'node_advance',
      source: 'runtime',
      pid: 1,
    });

    // Must be AT PL_TRACE_DIR/provenance.jsonl, not nested.
    const content = await readFile(join(absolute, 'provenance.jsonl'), 'utf-8');
    expect(content).toContain('"run-flat"');
  });

  it('falls back to <cwd>/.prompt-language when PL_TRACE_DIR is unset', async () => {
    delete process.env['PL_TRACE_DIR'];
    const logger = new FileTraceLogger(tempDir);
    logger.log({
      runId: 'run-default',
      seq: 0,
      timestamp: '2024-01-01T00:00:00.000Z',
      event: 'node_advance',
      source: 'runtime',
      pid: 1,
    });

    const content = await readFile(join(tempDir, '.prompt-language', 'provenance.jsonl'), 'utf-8');
    expect(content).toContain('"run-default"');
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
