import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isTransientError, withHookErrorRecovery, logHookError } from './hook-error-handler.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// isTransientError
// ---------------------------------------------------------------------------

describe('isTransientError', () => {
  it('returns true for EBUSY', () => {
    const err = Object.assign(new Error('busy'), { code: 'EBUSY' });
    expect(isTransientError(err)).toBe(true);
  });

  it('returns true for EAGAIN', () => {
    const err = Object.assign(new Error('again'), { code: 'EAGAIN' });
    expect(isTransientError(err)).toBe(true);
  });

  it('returns true for ECONNRESET', () => {
    const err = Object.assign(new Error('reset'), { code: 'ECONNRESET' });
    expect(isTransientError(err)).toBe(true);
  });

  it('returns true for EPIPE', () => {
    const err = Object.assign(new Error('pipe'), { code: 'EPIPE' });
    expect(isTransientError(err)).toBe(true);
  });

  it('returns true for ETIMEDOUT', () => {
    const err = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
    expect(isTransientError(err)).toBe(true);
  });

  it('returns false for ENOENT (permanent)', () => {
    const err = Object.assign(new Error('no entry'), { code: 'ENOENT' });
    expect(isTransientError(err)).toBe(false);
  });

  it('returns false for plain Error without code', () => {
    expect(isTransientError(new Error('oops'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isTransientError('string error')).toBe(false);
    expect(isTransientError(42)).toBe(false);
    expect(isTransientError(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// withHookErrorRecovery
// ---------------------------------------------------------------------------

describe('withHookErrorRecovery', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'hook-err-test-'));
  });

  it('resolves when fn succeeds', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    await withHookErrorRecovery('TestHook', tempDir, fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries once on transient error then resolves', async () => {
    const transientErr = Object.assign(new Error('busy'), { code: 'EBUSY' });
    const fn = vi.fn().mockRejectedValueOnce(transientErr).mockResolvedValueOnce(undefined);

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    await withHookErrorRecovery('TestHook', tempDir, fn);
    stderrSpy.mockRestore();

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('logs to stderr on permanent error (does not retry)', async () => {
    const permanentErr = new Error('fatal');
    const fn = vi.fn().mockRejectedValue(permanentErr);

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    await withHookErrorRecovery('TestHook', tempDir, fn);
    stderrSpy.mockRestore();

    // Only called once — no retry for permanent errors
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('logs to stderr on transient error that fails on retry', async () => {
    const transientErr = Object.assign(new Error('busy'), { code: 'EBUSY' });
    const fn = vi.fn().mockRejectedValue(transientErr);

    const stderrMessages: string[] = [];
    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation((msg: string | Uint8Array) => {
        stderrMessages.push(typeof msg === 'string' ? msg : msg.toString());
        return true;
      });

    await withHookErrorRecovery('TestHook', tempDir, fn);
    stderrSpy.mockRestore();

    expect(fn).toHaveBeenCalledTimes(2);
    const combined = stderrMessages.join('');
    expect(combined).toContain('TestHook');
    expect(combined).toContain('error');
  });
});

// ---------------------------------------------------------------------------
// logHookError
// ---------------------------------------------------------------------------

describe('logHookError', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'hook-err-log-'));
  });

  it('writes to stderr with hook name', async () => {
    const stderrMessages: string[] = [];
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation((msg: string | Uint8Array) => {
      stderrMessages.push(typeof msg === 'string' ? msg : msg.toString());
      return true;
    });

    await logHookError('MyHook', tempDir, new Error('test error'));
    spy.mockRestore();

    const combined = stderrMessages.join('');
    expect(combined).toContain('MyHook');
    expect(combined).toContain('test error');
  });

  it('includes "(after retry)" suffix when wasRetried=true', async () => {
    const stderrMessages: string[] = [];
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation((msg: string | Uint8Array) => {
      stderrMessages.push(typeof msg === 'string' ? msg : msg.toString());
      return true;
    });

    await logHookError('MyHook', tempDir, new Error('retry error'), true);
    spy.mockRestore();

    expect(stderrMessages.join('')).toContain('after retry');
  });

  it('appends entry to audit.jsonl', async () => {
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    await logHookError('AuditHook', tempDir, new Error('audit error'));
    spy.mockRestore();

    const { readFile } = await import('node:fs/promises');
    const content = await readFile(join(tempDir, '.prompt-language', 'audit.jsonl'), 'utf-8');
    const entry = JSON.parse(content.trim()) as {
      type: string;
      hook: string;
      error: string;
      wasRetried: boolean;
    };

    expect(entry.type).toBe('hook_error');
    expect(entry.hook).toBe('AuditHook');
    expect(entry.error).toContain('audit error');
    expect(entry.wasRetried).toBe(false);

    await rm(tempDir, { recursive: true, force: true });
  });
});
