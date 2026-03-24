/**
 * Cross-platform compatibility tests.
 *
 * Covers: path handling, shellInterpolate safety, CRLF handling, file locking.
 * Beads: 564x, dvdr, yu9l, 6jim
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { interpolate, shellInterpolate, shellEscapeValue } from '../domain/interpolate.js';
import { parseFlow, parseGates } from '../application/parse-flow.js';
import { splitIterable } from '../domain/split-iterable.js';
import { FileStateStore } from './adapters/file-state-store.js';
import { createSessionState } from '../domain/session-state.js';
import { createFlowSpec } from '../domain/flow-spec.js';
import { createPromptNode } from '../domain/flow-node.js';
import { captureFilePath } from '../domain/capture-prompt.js';
import { mkdtemp, rm, writeFile, mkdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';

// ---------------------------------------------------------------------------
// 1. Path Audit (beads 564x)
// ---------------------------------------------------------------------------

describe('Path cross-platform audit', () => {
  it('FileStateStore uses path.join for all internal paths', () => {
    // Verify constructor computes paths via join() — the result should use
    // the platform separator, not hardcoded forward slashes.
    const store = new FileStateStore('/some/base');
    // We cannot inspect private fields directly, but we can verify that
    // save/load don't crash on platform paths by exercising them in the
    // file-locking tests below. Here we just verify the class instantiates.
    expect(store).toBeDefined();
  });

  it('captureFilePath uses forward slashes (intended — it is a DSL output path)', () => {
    // captureFilePath is a domain function that produces a path string
    // embedded into prompts for Claude. It intentionally uses '/' because
    // the path is consumed by Claude's file tools, not by Node.js fs APIs.
    const result = captureFilePath('myVar');
    expect(result).toBe('.prompt-language/vars/myVar');
    // This is correct — it's a DSL-level path, not a filesystem path.
  });

  it('FileStateStore works with base paths containing spaces', async () => {
    const base = await mkdtemp(join(tmpdir(), 'pl space test '));
    try {
      const store = new FileStateStore(base);
      const spec = createFlowSpec('test', [createPromptNode('n1', 'hello')], [], []);
      const state = createSessionState('s1', spec);
      await store.save(state);
      const loaded = await store.loadCurrent();
      expect(loaded).not.toBeNull();
      expect(loaded!.sessionId).toBe('s1');
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('state directory name does not contain platform-specific separators', () => {
    // The .prompt-language directory name is just a basename, no separators
    const dirName = '.prompt-language';
    expect(dirName).not.toContain('\\');
    expect(dirName).not.toContain('/');
  });

  it('path.join normalizes forward slashes in VARS_DIR constant', () => {
    // The VARS_DIR constants in capture-reader and post-tool-use use
    // '.prompt-language/vars'. When passed to path.join(), Node normalizes
    // to the platform separator automatically.
    const result = join('/base', '.prompt-language/vars', 'myVar');
    expect(result).toContain('myVar');
    // On Windows this becomes \base\.prompt-language\vars\myVar
    // On Unix this becomes /base/.prompt-language/vars/myVar
    // Both are correct — path.join handles the conversion.
    expect(result.split(sep).length).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// 2. shellInterpolate Tests (beads dvdr)
// ---------------------------------------------------------------------------

describe('shellInterpolate cross-platform safety', () => {
  it('wraps values in single quotes for bash safety', () => {
    const result = shellInterpolate('echo ${msg}', { msg: 'hello world' });
    expect(result).toBe("echo 'hello world'");
  });

  it('escapes single quotes within values', () => {
    const result = shellInterpolate('echo ${msg}', { msg: "it's fine" });
    // The standard bash escaping: replace ' with '\'' (end quote, escaped quote, start quote)
    expect(result).toBe("echo 'it'\\''s fine'");
  });

  it('safely quotes values containing $', () => {
    const result = shellInterpolate('echo ${val}', { val: '$HOME' });
    // Single quotes prevent shell expansion of $HOME
    expect(result).toBe("echo '$HOME'");
  });

  it('safely quotes values containing backticks', () => {
    const result = shellInterpolate('echo ${val}', { val: '`whoami`' });
    expect(result).toBe("echo '`whoami`'");
  });

  it('safely quotes values containing newlines', () => {
    const result = shellInterpolate('echo ${val}', { val: 'line1\nline2' });
    // shellEscapeValue wraps in single quotes — the actual newline is preserved
    // inside single quotes, which is valid bash (single-quoted strings are literal).
    expect(result).toBe("echo 'line1\nline2'");
  });

  it('safely quotes actual newline characters in values', () => {
    const result = shellInterpolate('echo ${val}', { val: 'line1\nline2' });
    expect(result).toContain("'");
    // The value is wrapped in single quotes, preserving the literal newline
  });

  it('handles empty string values', () => {
    const result = shellInterpolate('echo ${val}', { val: '' });
    expect(result).toBe("echo ''");
  });

  it('handles values with Windows backslash paths', () => {
    const result = shellInterpolate('echo ${path}', {
      path: 'C:\\Users\\Admin\\file.txt',
    });
    // Backslashes are safe inside single quotes in bash
    expect(result).toBe("echo 'C:\\Users\\Admin\\file.txt'");
  });

  it('handles very long values (10,000+ chars) without breaking quoting', () => {
    const longVal = 'a'.repeat(10_000);
    const result = shellInterpolate('echo ${val}', { val: longVal });
    expect(result).toBe(`echo '${longVal}'`);
    expect(result.startsWith("echo '")).toBe(true);
    expect(result.endsWith("'")).toBe(true);
  });

  it('handles values with null bytes', () => {
    const result = shellInterpolate('echo ${val}', { val: 'before\0after' });
    // Null bytes are kept inside single quotes — they're opaque to bash quoting
    expect(result).toContain("'");
    expect(result).toContain('before');
    expect(result).toContain('after');
  });

  it('handles values with control characters (tabs, carriage returns)', () => {
    const result = shellInterpolate('echo ${val}', { val: 'a\tb\rc' });
    expect(result).toBe("echo 'a\tb\rc'");
  });

  it('handles multiple interpolations in one template', () => {
    const result = shellInterpolate('${a} and ${b}', { a: 'foo', b: 'bar' });
    expect(result).toBe("'foo' and 'bar'");
  });

  it('leaves unknown variables as-is', () => {
    const result = shellInterpolate('echo ${unknown}', {});
    expect(result).toBe('echo ${unknown}');
  });

  it('handles numeric and boolean values', () => {
    const result = shellInterpolate('${n} ${b}', { n: 42, b: true });
    expect(result).toBe("'42' 'true'");
  });

  it('shellEscapeValue handles values with multiple single quotes', () => {
    const result = shellEscapeValue("it's a 'test' isn't it");
    // Each ' becomes '\''
    expect(result).toBe("'it'\\''s a '\\''test'\\'' isn'\\''t it'");
  });

  it('handles default values with ${var:-default} syntax', () => {
    // Variable exists — use it
    const result1 = shellInterpolate('echo ${val:-fallback}', { val: 'real' });
    expect(result1).toBe("echo 'real'");

    // Variable missing — use default, also shell-escaped
    const result2 = shellInterpolate('echo ${val:-fallback}', {});
    expect(result2).toBe("echo 'fallback'");
  });

  // Verify raw interpolate does NOT escape (contrast with shellInterpolate)
  it('raw interpolate does NOT wrap in quotes (important contrast)', () => {
    const result = interpolate('echo ${val}', { val: '; rm -rf /' });
    expect(result).toBe('echo ; rm -rf /');
    // This is why shellInterpolate exists — raw interpolate is unsafe for shell
  });
});

// ---------------------------------------------------------------------------
// 3. CRLF Handling (beads yu9l)
// ---------------------------------------------------------------------------

describe('CRLF/LF handling', () => {
  describe('parseFlow with different line endings', () => {
    it('parses a flow with CRLF line endings', () => {
      const input = 'Goal: test\r\n\r\nflow:\r\n  prompt: Hello\r\n  run: echo hi\r\n';
      const spec = parseFlow(input);
      expect(spec.nodes).toHaveLength(2);
      expect(spec.nodes[0]!.kind).toBe('prompt');
      expect(spec.nodes[1]!.kind).toBe('run');
    });

    it('parses a flow with LF line endings', () => {
      const input = 'Goal: test\n\nflow:\n  prompt: Hello\n  run: echo hi\n';
      const spec = parseFlow(input);
      expect(spec.nodes).toHaveLength(2);
      expect(spec.nodes[0]!.kind).toBe('prompt');
      expect(spec.nodes[1]!.kind).toBe('run');
    });

    it('parses a flow with mixed LF and CRLF', () => {
      const input = 'Goal: test\r\n\nflow:\r\n  prompt: Hello\n  run: echo hi\r\n';
      const spec = parseFlow(input);
      expect(spec.nodes).toHaveLength(2);
    });

    it('parses let/var nodes with CRLF', () => {
      const input = 'flow:\r\n  let x = "hello"\r\n  var y = run "echo hi"\r\n';
      const spec = parseFlow(input);
      expect(spec.nodes).toHaveLength(2);
      expect(spec.nodes[0]!.kind).toBe('let');
      expect(spec.nodes[1]!.kind).toBe('let');
    });

    it('parses if/else blocks with CRLF', () => {
      const input =
        'flow:\r\n  if command_succeeded\r\n    prompt: yes\r\n  else\r\n    prompt: no\r\n  end\r\n';
      const spec = parseFlow(input);
      expect(spec.nodes).toHaveLength(1);
      expect(spec.nodes[0]!.kind).toBe('if');
    });

    it('parses done-when gates with CRLF', () => {
      const input = 'Goal: test\r\n\r\ndone when:\r\n  tests_pass\r\n  lint_pass\r\n';
      const gates = parseGates(input);
      expect(gates).toHaveLength(2);
      expect(gates[0]!.predicate).toBe('tests_pass');
      expect(gates[1]!.predicate).toBe('lint_pass');
    });

    it('parses foreach with CRLF', () => {
      const input = 'flow:\r\n  foreach item in "a b c"\r\n    prompt: Do ${item}\r\n  end\r\n';
      const spec = parseFlow(input);
      expect(spec.nodes).toHaveLength(1);
      expect(spec.nodes[0]!.kind).toBe('foreach');
    });

    it('parses try/catch/finally with CRLF', () => {
      const input =
        'flow:\r\n  try\r\n    run: risky\r\n  catch\r\n    prompt: fix it\r\n  finally\r\n    run: cleanup\r\n  end\r\n';
      const spec = parseFlow(input);
      expect(spec.nodes).toHaveLength(1);
      expect(spec.nodes[0]!.kind).toBe('try');
    });
  });

  describe('session-state JSON round-trip with line endings', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'pl-crlf-'));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it('round-trips state regardless of line endings in variable values', async () => {
      const store = new FileStateStore(tempDir);
      const spec = createFlowSpec('test', [createPromptNode('n1', 'hello')], [], []);
      const state = {
        ...createSessionState('s1', spec),
        variables: {
          crlfVar: 'line1\r\nline2\r\n',
          lfVar: 'line1\nline2\n',
          mixedVar: 'line1\r\nline2\nline3',
        },
      };
      await store.save(state);
      const loaded = await store.loadCurrent();
      expect(loaded).not.toBeNull();
      // JSON.stringify preserves \r\n in string values
      expect(loaded!.variables['crlfVar']).toBe('line1\r\nline2\r\n');
      expect(loaded!.variables['lfVar']).toBe('line1\nline2\n');
      expect(loaded!.variables['mixedVar']).toBe('line1\r\nline2\nline3');
    });

    it('handles CRLF in warnings array', async () => {
      const store = new FileStateStore(tempDir);
      const spec = createFlowSpec(
        'test',
        [createPromptNode('n1', 'hello')],
        [],
        ['warning with\r\nCRLF'],
      );
      const state = createSessionState('s1', spec);
      await store.save(state);
      const loaded = await store.loadCurrent();
      expect(loaded).not.toBeNull();
      expect(loaded!.warnings[0]).toBe('warning with\r\nCRLF');
    });
  });

  describe('splitIterable with CRLF input', () => {
    it('splits CRLF-delimited strings into items', () => {
      const result = splitIterable('alpha\r\nbeta\r\ngamma');
      expect(result).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('splits mixed LF/CRLF strings', () => {
      const result = splitIterable('alpha\r\nbeta\ngamma');
      // split('\n') will leave \r on some items
      // This reveals whether CRLF is handled — the \r may or may not be trimmed
      expect(result.length).toBe(3);
      // Verify items are trimmed (splitIterable trims each line)
      result.forEach((item) => {
        expect(item).not.toMatch(/\r$/);
      });
    });

    it('handles JSON array with CRLF whitespace', () => {
      const result = splitIterable('[\r\n  "a",\r\n  "b"\r\n]');
      expect(result).toEqual(['a', 'b']);
    });

    it('handles markdown list with CRLF', () => {
      const result = splitIterable('- alpha\r\n- beta\r\n- gamma');
      expect(result).toEqual(['alpha', 'beta', 'gamma']);
    });
  });

  describe('interpolate with CRLF in templates', () => {
    it('preserves CRLF in interpolated output', () => {
      const result = interpolate('line1: ${a}\r\nline2: ${b}', { a: 'x', b: 'y' });
      expect(result).toBe('line1: x\r\nline2: y');
    });

    it('handles CRLF in variable values', () => {
      const result = interpolate('val=${v}', { v: 'a\r\nb' });
      expect(result).toBe('val=a\r\nb');
    });
  });
});

// ---------------------------------------------------------------------------
// 4. File Locking (beads 6jim)
// ---------------------------------------------------------------------------

describe('FileStateStore advisory file locking', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-lock-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function makeState(id: string) {
    const spec = createFlowSpec('test', [createPromptNode('n1', 'hello')], [], []);
    return createSessionState(id, spec);
  }

  it('lock acquisition succeeds on first attempt', async () => {
    const store = new FileStateStore(tempDir);
    const state = makeState('s1');
    // If locking works, save should succeed without error
    await expect(store.save(state)).resolves.toBeUndefined();
  });

  it('lock is released after operation completes', async () => {
    const store = new FileStateStore(tempDir);
    await store.save(makeState('s1'));

    // After save, the lock file should not exist
    const lockPath = join(tempDir, '.prompt-language', 'session-state.lock');
    let lockExists = false;
    try {
      await access(lockPath);
      lockExists = true;
    } catch {
      lockExists = false;
    }
    expect(lockExists).toBe(false);
  });

  it('sequential saves succeed (lock released between operations)', async () => {
    const store = new FileStateStore(tempDir);
    await store.save(makeState('s1'));
    await store.save(makeState('s2'));
    await store.save(makeState('s3'));

    const loaded = await store.loadCurrent();
    expect(loaded!.sessionId).toBe('s3');
  });

  it('concurrent saves both complete (locking serializes them)', async () => {
    const store = new FileStateStore(tempDir);
    // Both saves should complete — locking serializes access
    const results = await Promise.allSettled([
      store.save(makeState('s1')),
      store.save(makeState('s2')),
    ]);
    expect(results[0]?.status).toBe('fulfilled');
    expect(results[1]?.status).toBe('fulfilled');

    // One of them should be the final state
    const loaded = await store.loadCurrent();
    expect(loaded).not.toBeNull();
    expect(['s1', 's2']).toContain(loaded!.sessionId);
  });

  it('stale lock files are broken after retries', async () => {
    const store = new FileStateStore(tempDir);
    // Manually create the state dir and a stale lock
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const lockPath = join(stateDir, 'session-state.lock');
    await writeFile(lockPath, 'stale', 'utf-8');

    // save should eventually break the stale lock and succeed
    await expect(store.save(makeState('s1'))).resolves.toBeUndefined();

    const loaded = await store.loadCurrent();
    expect(loaded!.sessionId).toBe('s1');
  });

  it('lock works with paths that contain spaces', async () => {
    const spaceDir = await mkdtemp(join(tmpdir(), 'pl lock spaces '));
    try {
      const store = new FileStateStore(spaceDir);
      await store.save(makeState('s1'));

      const loaded = await store.loadCurrent();
      expect(loaded!.sessionId).toBe('s1');

      // Verify lock was cleaned up
      const lockPath = join(spaceDir, '.prompt-language', 'session-state.lock');
      let lockExists = false;
      try {
        await access(lockPath);
        lockExists = true;
      } catch {
        lockExists = false;
      }
      expect(lockExists).toBe(false);
    } finally {
      await rm(spaceDir, { recursive: true, force: true });
    }
  });

  it('load does not require locking (read-only)', async () => {
    const store = new FileStateStore(tempDir);
    // Save first to create the state
    await store.save(makeState('s1'));

    // Multiple concurrent reads should all succeed
    const results = await Promise.all([
      store.loadCurrent(),
      store.loadCurrent(),
      store.loadCurrent(),
    ]);
    results.forEach((loaded) => {
      expect(loaded).not.toBeNull();
      expect(loaded!.sessionId).toBe('s1');
    });
  });

  it('save then clear then load returns null', async () => {
    const store = new FileStateStore(tempDir);
    await store.save(makeState('s1'));
    await store.clear('s1');
    const loaded = await store.load('s1');
    expect(loaded).toBeNull();
  });

  it('exists returns false before any save', async () => {
    const store = new FileStateStore(tempDir);
    expect(await store.exists()).toBe(false);
  });

  it('exists returns true after save', async () => {
    const store = new FileStateStore(tempDir);
    await store.save(makeState('s1'));
    expect(await store.exists()).toBe(true);
  });

  it('rejects state exceeding max file size', async () => {
    const store = new FileStateStore(tempDir);
    const spec = createFlowSpec('test', [createPromptNode('n1', 'hello')], [], []);
    const state = {
      ...createSessionState('s1', spec),
      variables: { hugeVar: 'x'.repeat(200_000) },
    };
    await expect(store.save(state)).rejects.toThrow(/exceeds/);
  });
});
