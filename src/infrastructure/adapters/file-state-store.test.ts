import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir, open, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from './file-state-store.js';
import { createSessionState, type SessionState } from '../../domain/session-state.js';
import { createFlowSpec } from '../../domain/flow-spec.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    open: vi.fn().mockImplementation(actual.open),
  };
});

// Re-import the mocked open for use in tests
const { open: mockedOpen } = await import('node:fs/promises');

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'cf-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function makeSpec() {
  return createFlowSpec('Test goal', []);
}

describe('FileStateStore', () => {
  it('returns null when no state file exists', async () => {
    const store = new FileStateStore(tempDir);
    const result = await store.loadCurrent();
    expect(result).toBeNull();
  });

  it('reports exists as false when no file', async () => {
    const store = new FileStateStore(tempDir);
    expect(await store.exists()).toBe(false);
  });

  it('saves and loads state by session id', async () => {
    const store = new FileStateStore(tempDir);
    const session = createSessionState('s1', makeSpec());
    await store.save(session);

    const loaded = await store.load('s1');
    expect(loaded).not.toBeNull();
    expect(loaded?.sessionId).toBe('s1');
    expect(loaded?.flowSpec.goal).toBe('Test goal');
  });

  it('returns null for wrong session id', async () => {
    const store = new FileStateStore(tempDir);
    const session = createSessionState('s1', makeSpec());
    await store.save(session);

    const loaded = await store.load('wrong-id');
    expect(loaded).toBeNull();
  });

  it('reports exists as true after save', async () => {
    const store = new FileStateStore(tempDir);
    await store.save(createSessionState('s1', makeSpec()));
    expect(await store.exists()).toBe(true);
  });

  it('loadCurrent returns most recently saved state', async () => {
    const store = new FileStateStore(tempDir);
    await store.save(createSessionState('s1', makeSpec()));
    const current = await store.loadCurrent();
    expect(current?.sessionId).toBe('s1');
  });

  it('clear removes state file', async () => {
    const store = new FileStateStore(tempDir);
    await store.save(createSessionState('s1', makeSpec()));
    expect(await store.exists()).toBe(true);

    await store.clear('s1');
    expect(await store.exists()).toBe(false);
    expect(await store.loadCurrent()).toBeNull();
  });

  it('clear is idempotent when file missing', async () => {
    const store = new FileStateStore(tempDir);
    await expect(store.clear('nonexistent')).resolves.toBeUndefined();
  });

  it('returns null from loadCurrent when state file contains invalid JSON', async () => {
    const store = new FileStateStore(tempDir);
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(join(stateDir, 'session-state.json'), '{{garbage', 'utf-8');

    const result = await store.loadCurrent();
    expect(result).toBeNull();
  });

  it('writes warning to stderr when state file is corrupted', async () => {
    const store = new FileStateStore(tempDir);
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(join(stateDir, 'session-state.json'), '{{garbage', 'utf-8');

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    await store.loadCurrent();
    expect(stderrSpy).toHaveBeenCalledWith(
      '[prompt-language] WARNING: session-state.json is corrupted, ignoring\n',
    );
    stderrSpy.mockRestore();
  });

  it('returns null from load when state file contains invalid JSON', async () => {
    const store = new FileStateStore(tempDir);
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(join(stateDir, 'session-state.json'), '{{garbage', 'utf-8');

    const result = await store.load('any-id');
    expect(result).toBeNull();
  });

  it('creates .prompt-language directory if missing', async () => {
    const store = new FileStateStore(tempDir);
    await store.save(createSessionState('s1', makeSpec()));

    // Verify by loading
    const loaded = await store.loadCurrent();
    expect(loaded).not.toBeNull();
  });

  it('throws when state file exceeds max size', async () => {
    const store = new FileStateStore(tempDir);
    const session = createSessionState('s1', makeSpec());
    // Create a state with a huge variable to exceed 100KB
    const bigState = {
      ...session,
      variables: { big: 'x'.repeat(200_000) },
    };
    await expect(store.save(bigState as typeof session)).rejects.toThrow(/exceeds 102400 bytes/);
  });

  it('acquires lock after stale lock is force-removed', async () => {
    const store = new FileStateStore(tempDir);
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });

    // Pre-create a stale lock file that persists through all retries
    const lockPath = join(stateDir, 'session-state.lock');
    const handle = await open(lockPath, 'wx');
    await handle.close();

    const session = createSessionState('s1', makeSpec());
    // save() will exhaust 20 retries, force-remove the stale lock, then succeed
    await store.save(session);

    const loaded = await store.loadCurrent();
    expect(loaded?.sessionId).toBe('s1');
  }, 5000); // Lock retry: 20 * 50ms = 1s plus overhead

  it('acquireLock rethrows non-EEXIST errors from open', async () => {
    const store = new FileStateStore(tempDir);
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });

    // Make open() throw EACCES (not EEXIST) for the lock file
    const eacces = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    vi.mocked(mockedOpen).mockRejectedValueOnce(eacces);

    const session = createSessionState('s1', makeSpec());
    await expect(store.save(session)).rejects.toThrow('EACCES');
  });

  it('readState rethrows non-ENOENT, non-SyntaxError errors', async () => {
    const store = new FileStateStore(tempDir);
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });

    // Make state file a directory so reading it causes EISDIR
    const statePath = join(stateDir, 'session-state.json');
    await mkdir(statePath, { recursive: true });

    await expect(store.loadCurrent()).rejects.toThrow();
  });

  it('clear rethrows non-ENOENT errors', async () => {
    const store = new FileStateStore(tempDir);
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });

    // Make state file a non-empty directory so unlink fails with EPERM/EISDIR
    const statePath = join(stateDir, 'session-state.json');
    await mkdir(statePath, { recursive: true });
    await writeFile(join(statePath, 'dummy'), 'x', 'utf-8');

    await expect(store.clear('s1')).rejects.toThrow();
  });

  it('produces valid JSON state file after atomic save', async () => {
    const store = new FileStateStore(tempDir);
    const session = createSessionState('s1', makeSpec());
    await store.save(session);

    const statePath = join(tempDir, '.prompt-language', 'session-state.json');
    const raw = await readFile(statePath, 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.sessionId).toBe('s1');
  });

  it('cleans up temp file after atomic save', async () => {
    const store = new FileStateStore(tempDir);
    const session = createSessionState('s1', makeSpec());
    await store.save(session);

    const tempPath = join(tempDir, '.prompt-language', 'session-state.tmp.json');
    await expect(access(tempPath)).rejects.toThrow();
  });

  describe('pending prompt full cycle', () => {
    it('save → load → clear → load returns null', async () => {
      const store = new FileStateStore(tempDir);
      await store.savePendingPrompt('Hello world');

      const loaded = await store.loadPendingPrompt();
      expect(loaded).toBe('Hello world');

      await store.clearPendingPrompt();

      const afterClear = await store.loadPendingPrompt();
      expect(afterClear).toBeNull();
    });
  });

  describe('loadPendingPrompt returns null on bad JSON', () => {
    it('returns null when pending-nl-prompt.json contains garbage', async () => {
      const store = new FileStateStore(tempDir);
      const stateDir = join(tempDir, '.prompt-language');
      await mkdir(stateDir, { recursive: true });
      await writeFile(join(stateDir, 'pending-nl-prompt.json'), '{{not valid json', 'utf-8');

      const result = await store.loadPendingPrompt();
      expect(result).toBeNull();
    });
  });

  describe('clearPendingPrompt idempotency', () => {
    it('does not throw when file does not exist', async () => {
      const store = new FileStateStore(tempDir);
      await expect(store.clearPendingPrompt()).resolves.toBeUndefined();
    });
  });

  describe('clearPendingPrompt rethrows non-ENOENT errors', () => {
    it('throws when pending prompt path is a directory', async () => {
      const store = new FileStateStore(tempDir);
      const stateDir = join(tempDir, '.prompt-language');
      await mkdir(stateDir, { recursive: true });

      // Make pending-nl-prompt.json a non-empty directory so unlink fails with EPERM/EISDIR
      const promptPath = join(stateDir, 'pending-nl-prompt.json');
      await mkdir(promptPath, { recursive: true });
      await writeFile(join(promptPath, 'dummy'), 'x', 'utf-8');

      await expect(store.clearPendingPrompt()).rejects.toThrow();
    });
  });

  describe('save at boundary size', () => {
    it('succeeds when JSON is just under 100KB', async () => {
      const store = new FileStateStore(tempDir);
      const session = createSessionState('s1', makeSpec());
      // Measure baseline JSON size and fill remaining space
      const baseJson = JSON.stringify(session, null, 2);
      const padding = 100 * 1024 - baseJson.length - 100; // leave small margin for key overhead
      const stateWithPadding = {
        ...session,
        variables: { pad: 'x'.repeat(Math.max(0, padding)) },
      };
      const finalJson = JSON.stringify(stateWithPadding, null, 2);
      // Verify it's under the limit
      expect(finalJson.length).toBeLessThanOrEqual(100 * 1024);

      await expect(store.save(stateWithPadding as typeof session)).resolves.toBeUndefined();
    });
  });

  describe('save preserves variables through round-trip', () => {
    it('loaded state has same variables as saved state', async () => {
      const store = new FileStateStore(tempDir);
      const session = createSessionState('s1', makeSpec());
      const withVars = {
        ...session,
        variables: { greeting: 'hello', count: 42, flag: true },
      };

      await store.save(withVars as typeof session);
      const loaded = await store.loadCurrent();

      expect(loaded).not.toBeNull();
      expect(loaded!.variables).toEqual({ greeting: 'hello', count: 42, flag: true });
    });
  });

  describe('save overwrites previous state', () => {
    it('loadCurrent returns the last saved state', async () => {
      const store = new FileStateStore(tempDir);
      const s1 = createSessionState('s1', makeSpec());
      const s2 = createSessionState('s2', makeSpec());

      await store.save(s1);
      await store.save(s2);

      const loaded = await store.loadCurrent();
      expect(loaded?.sessionId).toBe('s2');
    });
  });

  describe('concurrent saves (serial execution)', () => {
    it('final state is the last saved', async () => {
      const store = new FileStateStore(tempDir);
      const s1 = {
        ...createSessionState('s1', makeSpec()),
        variables: { value: 'first' },
      };
      const s2 = {
        ...createSessionState('s1', makeSpec()),
        variables: { value: 'second' },
      };

      await store.save(s1 as SessionState);
      await store.save(s2 as SessionState);

      const loaded = await store.load('s1');
      expect(loaded).not.toBeNull();
      expect(loaded!.variables).toEqual({ value: 'second' });
    });
  });

  describe('load returns null when sessionId does not match', () => {
    it('save s1, load with s2 returns null', async () => {
      const store = new FileStateStore(tempDir);
      await store.save(createSessionState('s1', makeSpec()));

      const result = await store.load('s2');
      expect(result).toBeNull();
    });
  });

  describe('exists returns false after clear with pending prompt', () => {
    it('save → clear → exists is false, pending prompt also cleared', async () => {
      const store = new FileStateStore(tempDir);
      await store.save(createSessionState('s1', makeSpec()));
      await store.savePendingPrompt('test prompt');

      expect(await store.exists()).toBe(true);
      expect(await store.loadPendingPrompt()).toBe('test prompt');

      await store.clear('s1');
      await store.clearPendingPrompt();

      expect(await store.exists()).toBe(false);
      expect(await store.loadPendingPrompt()).toBeNull();
    });
  });
});
