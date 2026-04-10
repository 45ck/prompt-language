import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('debug helper', () => {
  const originalEnv = process.env['PROMPT_LANGUAGE_DEBUG'];
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    if (originalEnv === undefined) {
      delete process.env['PROMPT_LANGUAGE_DEBUG'];
    } else {
      process.env['PROMPT_LANGUAGE_DEBUG'] = originalEnv;
    }
    // Force module re-evaluation
    vi.resetModules();
  });

  it('does not write when PROMPT_LANGUAGE_DEBUG is unset', async () => {
    delete process.env['PROMPT_LANGUAGE_DEBUG'];
    const { debug } = await import('./debug.js');
    debug('test message');
    // Module-level const is cached at import time — so we test the exported function
    // The isDebug const was set at module init when env was unset
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('writes to stderr when PROMPT_LANGUAGE_DEBUG is set', async () => {
    process.env['PROMPT_LANGUAGE_DEBUG'] = '1';
    const { debug } = await import('./debug.js');
    debug('test message');
    expect(stderrSpy).toHaveBeenCalledWith('[PL:hook] test message\n');
  });

  it('does not write when PROMPT_LANGUAGE_DEBUG is "0"', async () => {
    process.env['PROMPT_LANGUAGE_DEBUG'] = '0';
    const { debug } = await import('./debug.js');
    debug('test message');
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('does not write when PROMPT_LANGUAGE_DEBUG is "false"', async () => {
    process.env['PROMPT_LANGUAGE_DEBUG'] = 'false';
    const { debug } = await import('./debug.js');
    debug('test message');
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('supports level-gated category logging', async () => {
    process.env['PROMPT_LANGUAGE_DEBUG'] = '2';
    const { debug } = await import('./debug.js');
    debug('condition result true', { category: 'condition', level: 2 });
    expect(stderrSpy).toHaveBeenCalledWith('[PL:condition] condition result true\n');
  });

  it('does not emit level-3 logs when debug level is 2', async () => {
    process.env['PROMPT_LANGUAGE_DEBUG'] = '2';
    const { debug } = await import('./debug.js');
    debug('capture deep detail', { category: 'capture', level: 3 });
    expect(stderrSpy).not.toHaveBeenCalled();
  });
});
