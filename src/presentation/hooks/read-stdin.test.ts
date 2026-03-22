import { describe, it, expect, afterEach } from 'vitest';
import { Readable } from 'node:stream';
import { readStdin } from './read-stdin.js';

describe('readStdin', () => {
  const originalStdin = process.stdin;

  afterEach(() => {
    Object.defineProperty(process, 'stdin', { value: originalStdin, writable: true });
  });

  function mockStdin(chunks: string[]): void {
    const readable = new Readable({
      read() {
        for (const chunk of chunks) {
          this.push(Buffer.from(chunk, 'utf-8'));
        }
        this.push(null);
      },
    });
    Object.defineProperty(process, 'stdin', { value: readable, writable: true });
  }

  it('reads a single chunk from stdin', async () => {
    mockStdin(['hello world']);
    const result = await readStdin();
    expect(result).toBe('hello world');
  });

  it('concatenates multiple chunks', async () => {
    mockStdin(['foo', 'bar', 'baz']);
    const result = await readStdin();
    expect(result).toBe('foobarbaz');
  });

  it('returns empty string for empty stdin', async () => {
    mockStdin([]);
    const result = await readStdin();
    expect(result).toBe('');
  });

  it('rejects on stream error', async () => {
    const readable = new Readable({
      read() {
        this.destroy(new Error('read failure'));
      },
    });
    Object.defineProperty(process, 'stdin', { value: readable, writable: true });
    await expect(readStdin()).rejects.toThrow('read failure');
  });
});
