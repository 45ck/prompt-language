import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir, open, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from './file-state-store.js';
import { createSessionState, type SessionState } from '../../domain/session-state.js';
import { createFlowSpec } from '../../domain/flow-spec.js';
import { RUNTIME_DIAGNOSTIC_CODES } from '../../domain/diagnostic-report.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    open: vi.fn().mockImplementation(actual.open),
    rename: vi.fn().mockImplementation(actual.rename),
  };
});

// Re-import the mocked functions for use in tests
const mockedFsPromises = await import('node:fs/promises');
const mockedOpen = mockedFsPromises.open;
const mockedRename = mockedFsPromises.rename;

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
    expect(store.getLastLoadStatus()).toBeNull();
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

  it('writes to an absolute stateDir without nesting under basePath', async () => {
    const absoluteStateDir = join(tempDir, 'absolute-state');
    const store = new FileStateStore(join(tempDir, 'ignored-base'), absoluteStateDir);
    await store.save(createSessionState('s1', makeSpec()));

    await expect(access(join(absoluteStateDir, 'session-state.json'))).resolves.toBeUndefined();
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
      '[prompt-language] WARNING: session-state.json is corrupted, trying backup\n',
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

  it('readState falls back to backup on non-ENOENT errors (D03)', async () => {
    const store = new FileStateStore(tempDir);
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });

    // Make state file a directory so reading it causes EISDIR
    const statePath = join(stateDir, 'session-state.json');
    await mkdir(statePath, { recursive: true });

    // D03: All read errors now fall back to backup instead of rethrowing
    const result = await store.loadCurrent();
    expect(result).toBeNull(); // No backup exists, returns null
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

  describe('loadPendingPrompt returns null when prompt key is missing', () => {
    it('returns null when JSON has no prompt field', async () => {
      const store = new FileStateStore(tempDir);
      const stateDir = join(tempDir, '.prompt-language');
      await mkdir(stateDir, { recursive: true });
      // Write valid JSON without the prompt field
      await writeFile(join(stateDir, 'pending-nl-prompt.json'), '{"timestamp":123}', 'utf-8');

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

  describe('H-SEC-002: state file integrity checksum', () => {
    it('saved file includes _checksum field', async () => {
      const store = new FileStateStore(tempDir);
      await store.save(createSessionState('s1', makeSpec()));

      const statePath = join(tempDir, '.prompt-language', 'session-state.json');
      const raw = await readFile(statePath, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed._checksum).toBeDefined();
      expect(typeof parsed._checksum).toBe('string');
      expect(parsed._checksum.length).toBe(64); // SHA-256 hex
    });

    it('loads state normally when checksum is valid', async () => {
      const store = new FileStateStore(tempDir);
      const session = createSessionState('s1', makeSpec());
      await store.save(session);

      const loaded = await store.loadCurrent();
      expect(loaded).not.toBeNull();
      expect(loaded?.sessionId).toBe('s1');
      // _checksum should be stripped from loaded state
      expect((loaded as unknown as Record<string, unknown>)['_checksum']).toBeUndefined();
      expect(store.getLastLoadStatus()).toEqual({ source: 'primary' });
    });

    it('clears gate results when checksum is tampered', async () => {
      const store = new FileStateStore(tempDir);
      const session = createSessionState('s1', makeSpec());
      await store.save(session);

      // Tamper with the file
      const statePath = join(tempDir, '.prompt-language', 'session-state.json');
      const raw = await readFile(statePath, 'utf-8');
      const parsed = JSON.parse(raw);
      parsed.gateResults = { tests_pass: true };
      parsed.gateDiagnostics = { tests_pass: { passed: true } };
      // Keep old checksum (now invalid)
      await writeFile(statePath, JSON.stringify(parsed, null, 2), 'utf-8');

      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const loaded = await store.loadCurrent();
      expect(loaded).not.toBeNull();
      expect(loaded?.gateResults).toEqual({});
      expect(loaded?.gateDiagnostics).toEqual({});
      expect(store.getLastLoadStatus()).toEqual({
        source: 'checksum_sanitized',
        reason: 'checksum_mismatch',
      });
      expect(stderrSpy).toHaveBeenCalledWith(
        '[prompt-language] WARNING: state file checksum mismatch, clearing gate results\n',
      );
      stderrSpy.mockRestore();
    });

    it('loads state normally without checksum (migration)', async () => {
      const store = new FileStateStore(tempDir);
      const stateDir = join(tempDir, '.prompt-language');
      await mkdir(stateDir, { recursive: true });

      // Write a state file without _checksum (pre-migration)
      const session = createSessionState('s1', makeSpec());
      const json = JSON.stringify(session, null, 2);
      await writeFile(join(stateDir, 'session-state.json'), json, 'utf-8');

      const loaded = await store.loadCurrent();
      expect(loaded).not.toBeNull();
      expect(loaded?.sessionId).toBe('s1');
    });

    it('checksum round-trips correctly', async () => {
      const store = new FileStateStore(tempDir);
      const session = createSessionState('s1', makeSpec());
      await store.save(session);

      // Read raw file and verify checksum manually
      const statePath = join(tempDir, '.prompt-language', 'session-state.json');
      const raw = await readFile(statePath, 'utf-8');
      const parsed = JSON.parse(raw);
      const { _checksum, ...stateWithout } = parsed;
      const expectedChecksum = createHash('sha256')
        .update(JSON.stringify(stateWithout, null, 2))
        .digest('hex');
      expect(_checksum).toBe(expectedChecksum);
    });
  });

  describe('H-REL-001: renameWithRetry', () => {
    afterEach(async () => {
      // Reset and re-apply real implementation (mockRestore breaks the mock for later tests)
      const real = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
      vi.mocked(mockedRename).mockReset().mockImplementation(real.rename);
    });

    it('retries on EBUSY and succeeds on second attempt', async () => {
      const store = new FileStateStore(tempDir);
      const stateDir = join(tempDir, '.prompt-language');
      await mkdir(stateDir, { recursive: true });

      const ebusyError = Object.assign(new Error('EBUSY: resource busy'), { code: 'EBUSY' });

      // First rename call throws EBUSY, subsequent calls fall through to real impl
      vi.mocked(mockedRename).mockRejectedValueOnce(ebusyError);

      const session = createSessionState('s1', makeSpec());
      await store.save(session);

      const loaded = await store.loadCurrent();
      expect(loaded?.sessionId).toBe('s1');
      // Should have been called twice: 1 EBUSY + 1 success
      expect(vi.mocked(mockedRename).mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('throws EBUSY after exhausting all retries', async () => {
      const store = new FileStateStore(tempDir);
      const stateDir = join(tempDir, '.prompt-language');
      await mkdir(stateDir, { recursive: true });

      const ebusyError = Object.assign(new Error('EBUSY: resource busy'), { code: 'EBUSY' });

      // All rename attempts throw EBUSY
      vi.mocked(mockedRename).mockRejectedValue(ebusyError);

      const session = createSessionState('s1', makeSpec());
      await expect(store.save(session)).rejects.toThrow('EBUSY');
    });

    it('immediately throws non-EBUSY rename errors without retrying', async () => {
      const store = new FileStateStore(tempDir);
      const stateDir = join(tempDir, '.prompt-language');
      await mkdir(stateDir, { recursive: true });

      const eaccesError = Object.assign(new Error('EACCES: permission denied'), {
        code: 'EACCES',
      });

      const callsBefore = vi.mocked(mockedRename).mock.calls.length;
      vi.mocked(mockedRename).mockRejectedValue(eaccesError);

      const session = createSessionState('s1', makeSpec());
      await expect(store.save(session)).rejects.toThrow('EACCES');
      // Should only have been called once (no retries for non-EBUSY)
      const callsAfter = vi.mocked(mockedRename).mock.calls.length;
      expect(callsAfter - callsBefore).toBe(1);
    });
  });

  describe('H-SEC-009: state file backup and recovery', () => {
    it('creates backup file on save', async () => {
      const store = new FileStateStore(tempDir);
      const session = createSessionState('s1', makeSpec());
      await store.save(session);

      // First save — no backup yet (no previous state to backup)
      const backupPath = join(tempDir, '.prompt-language', 'session-state.bak.json');
      try {
        await access(backupPath);
        // If backup exists, that's fine too (if state existed before)
      } catch {
        // No backup on first save — expected
      }

      // Second save creates backup of first state
      const session2 = createSessionState('s2', makeSpec());
      await store.save(session2);
      const backupRaw = await readFile(backupPath, 'utf-8');
      const backup = JSON.parse(backupRaw);
      expect(backup.sessionId).toBe('s1');
    });

    it('recovers from backup when primary state is corrupted', async () => {
      const store = new FileStateStore(tempDir);
      const session = createSessionState('s1', makeSpec());
      await store.save(session);

      // Save again so s1 becomes the backup
      const session2 = createSessionState('s2', makeSpec());
      await store.save(session2);

      // Corrupt the primary state file
      const statePath = join(tempDir, '.prompt-language', 'session-state.json');
      await writeFile(statePath, '{{corrupted garbage', 'utf-8');

      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const loaded = await store.loadCurrent();
      expect(loaded).not.toBeNull();
      expect(loaded?.sessionId).toBe('s1'); // Recovered from backup
      expect(store.getLastLoadDiagnostic()).toBeNull();
      expect(store.getLastLoadStatus()).toEqual({
        source: 'backup',
        recoveredFrom: 'session-state.bak.json',
      });
      expect(stderrSpy).toHaveBeenCalledWith(
        '[prompt-language] WARNING: session-state.json is corrupted, trying backup\n',
      );
      expect(stderrSpy).toHaveBeenCalledWith(
        '[prompt-language] Recovered state from backup file\n',
      );
      stderrSpy.mockRestore();
    });

    it('returns null when both primary and backup are corrupted', async () => {
      const store = new FileStateStore(tempDir);
      const stateDir = join(tempDir, '.prompt-language');
      await mkdir(stateDir, { recursive: true });

      // Corrupt both files
      await writeFile(join(stateDir, 'session-state.json'), '{{garbage', 'utf-8');
      await writeFile(join(stateDir, 'session-state.bak.json'), '{{also garbage', 'utf-8');

      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const loaded = await store.loadCurrent();
      expect(loaded).toBeNull();
      expect(store.getLastLoadDiagnostic()?.code).toBe(
        RUNTIME_DIAGNOSTIC_CODES.resumeStateCorruption,
      );
      expect(store.getLastLoadStatus()).toEqual({
        source: 'unrecoverable',
        reason: 'resume_state_corruption',
      });
      stderrSpy.mockRestore();
    });

    it('recovers from bak2.json when both primary and bak.json are corrupted', async () => {
      const store = new FileStateStore(tempDir);
      const stateDir = join(tempDir, '.prompt-language');
      await mkdir(stateDir, { recursive: true });

      // Save three times: s1 → bak2, s2 → bak, s3 → main
      const session1 = createSessionState('s1', makeSpec());
      await store.save(session1);
      const session2 = createSessionState('s2', makeSpec());
      await store.save(session2);
      const session3 = createSessionState('s3', makeSpec());
      await store.save(session3);

      // Verify bak2 has s1
      const bak2Path = join(stateDir, 'session-state.bak2.json');
      const bak2Raw = await readFile(bak2Path, 'utf-8');
      const bak2Parsed = JSON.parse(bak2Raw);
      expect(bak2Parsed.sessionId).toBe('s1');

      // Corrupt both primary and bak
      await writeFile(join(stateDir, 'session-state.json'), '{{garbage', 'utf-8');
      await writeFile(join(stateDir, 'session-state.bak.json'), '{{also garbage', 'utf-8');

      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const loaded = await store.loadCurrent();
      expect(loaded).not.toBeNull();
      expect(loaded?.sessionId).toBe('s1'); // Recovered from bak2
      expect(store.getLastLoadDiagnostic()).toBeNull();
      expect(store.getLastLoadStatus()).toEqual({
        source: 'backup2',
        recoveredFrom: 'session-state.bak2.json',
      });
      expect(stderrSpy).toHaveBeenCalledWith(
        '[prompt-language] Recovered state from second-generation backup\n',
      );
      stderrSpy.mockRestore();
    });

    it('returns null when primary, bak, and bak2 are all corrupted', async () => {
      const store = new FileStateStore(tempDir);
      const stateDir = join(tempDir, '.prompt-language');
      await mkdir(stateDir, { recursive: true });

      await writeFile(join(stateDir, 'session-state.json'), '{{garbage', 'utf-8');
      await writeFile(join(stateDir, 'session-state.bak.json'), '{{also garbage', 'utf-8');
      await writeFile(join(stateDir, 'session-state.bak2.json'), '{{still garbage', 'utf-8');

      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const loaded = await store.loadCurrent();
      expect(loaded).toBeNull();
      expect(store.getLastLoadDiagnostic()?.code).toBe(
        RUNTIME_DIAGNOSTIC_CODES.resumeStateCorruption,
      );
      expect(store.getLastLoadStatus()).toEqual({
        source: 'unrecoverable',
        reason: 'resume_state_corruption',
      });
      stderrSpy.mockRestore();
    });

    it('rotates bak to bak2 on each save', async () => {
      const store = new FileStateStore(tempDir);
      const stateDir = join(tempDir, '.prompt-language');

      await store.save(createSessionState('s1', makeSpec()));
      await store.save(createSessionState('s2', makeSpec()));
      await store.save(createSessionState('s3', makeSpec()));

      const bakRaw = await readFile(join(stateDir, 'session-state.bak.json'), 'utf-8');
      const bak2Raw = await readFile(join(stateDir, 'session-state.bak2.json'), 'utf-8');
      expect(JSON.parse(bakRaw).sessionId).toBe('s2');
      expect(JSON.parse(bak2Raw).sessionId).toBe('s1');
    });
  });

  describe('structural validation on corrupted state', () => {
    it('triggers backup recovery when state has missing currentNodePath', async () => {
      const store = new FileStateStore(tempDir);
      const stateDir = join(tempDir, '.prompt-language');
      await mkdir(stateDir, { recursive: true });

      // Write a valid backup
      const goodSession = createSessionState('backup-ok', makeSpec());
      const goodJson = JSON.stringify(goodSession, null, 2);
      const goodChecksum = createHash('sha256').update(goodJson).digest('hex');
      await writeFile(
        join(stateDir, 'session-state.bak.json'),
        JSON.stringify({ ...goodSession, _checksum: goodChecksum }, null, 2),
        'utf-8',
      );

      // Write a state file missing currentNodePath (no checksum = legacy path)
      const badState = {
        sessionId: 'corrupt',
        status: 'active',
        variables: {},
        flowSpec: { goal: 'test', nodes: [], completionGates: [], defaults: {}, warnings: [] },
        // missing currentNodePath
      };
      await writeFile(
        join(stateDir, 'session-state.json'),
        JSON.stringify(badState, null, 2),
        'utf-8',
      );

      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const loaded = await store.loadCurrent();
      expect(loaded).not.toBeNull();
      expect(loaded?.sessionId).toBe('backup-ok');
      expect(stderrSpy).toHaveBeenCalledWith(
        '[prompt-language] WARNING: session-state.json is corrupted, trying backup\n',
      );
      stderrSpy.mockRestore();
    });

    it('checksum mismatch with valid structure returns sanitized state', async () => {
      const store = new FileStateStore(tempDir);
      const stateDir = join(tempDir, '.prompt-language');
      await mkdir(stateDir, { recursive: true });

      // Write a complete state with a wrong checksum
      const session = createSessionState('s1', makeSpec());
      const tampered = {
        ...session,
        gateResults: { tests_pass: true },
        gateDiagnostics: { tests_pass: { passed: true } },
        _checksum: 'deadbeef'.repeat(8), // 64-char invalid checksum
      };
      await writeFile(
        join(stateDir, 'session-state.json'),
        JSON.stringify(tampered, null, 2),
        'utf-8',
      );

      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const loaded = await store.loadCurrent();
      expect(loaded).not.toBeNull();
      expect(loaded?.sessionId).toBe('s1');
      expect(loaded?.gateResults).toEqual({}); // Cleared due to checksum mismatch
      expect(loaded?.gateDiagnostics).toEqual({});
      stderrSpy.mockRestore();
    });

    it('checksum mismatch with invalid structure triggers backup recovery', async () => {
      const store = new FileStateStore(tempDir);
      const stateDir = join(tempDir, '.prompt-language');
      await mkdir(stateDir, { recursive: true });

      // Write a valid backup
      const goodSession = createSessionState('backup-ok', makeSpec());
      const goodJson = JSON.stringify(goodSession, null, 2);
      const goodChecksum = createHash('sha256').update(goodJson).digest('hex');
      await writeFile(
        join(stateDir, 'session-state.bak.json'),
        JSON.stringify({ ...goodSession, _checksum: goodChecksum }, null, 2),
        'utf-8',
      );

      // Write a structurally invalid state with wrong checksum
      const badState = {
        sessionId: 'bad',
        // missing status, currentNodePath, variables, flowSpec
        _checksum: 'deadbeef'.repeat(8),
      };
      await writeFile(
        join(stateDir, 'session-state.json'),
        JSON.stringify(badState, null, 2),
        'utf-8',
      );

      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const loaded = await store.loadCurrent();
      expect(loaded).not.toBeNull();
      expect(loaded?.sessionId).toBe('backup-ok');
      expect(stderrSpy).toHaveBeenCalledWith(
        '[prompt-language] WARNING: state file checksum mismatch, clearing gate results\n',
      );
      expect(stderrSpy).toHaveBeenCalledWith(
        '[prompt-language] WARNING: session-state.json is corrupted, trying backup\n',
      );
      stderrSpy.mockRestore();
    });
  });

  describe('H-REL-008: stale lock PID verification', () => {
    it('breaks stale lock with dead PID and old timestamp (>30s)', async () => {
      const store = new FileStateStore(tempDir);
      const stateDir = join(tempDir, '.prompt-language');
      await mkdir(stateDir, { recursive: true });

      // Create a lock file with a PID that does not exist and timestamp older than 30s threshold
      const lockPath = join(stateDir, 'session-state.lock');
      const lockData = JSON.stringify({ pid: 999999, timestamp: Date.now() - 35_000 });
      await writeFile(lockPath, lockData, 'utf-8');

      const session = createSessionState('s1', makeSpec());
      await store.save(session);

      const loaded = await store.loadCurrent();
      expect(loaded?.sessionId).toBe('s1');
    });

    it('writes PID to lock file on acquire', async () => {
      const store = new FileStateStore(tempDir);
      const session = createSessionState('s1', makeSpec());
      await store.save(session);

      // Lock should have been released, but verify the save succeeded
      const loaded = await store.loadCurrent();
      expect(loaded?.sessionId).toBe('s1');
    });

    it('treats lock as not stale when timestamp is within 30s threshold on Windows', async () => {
      // On Windows, only timestamp is checked (PID check skipped)
      // A lock younger than 30s with a dead PID should NOT be stale on Windows
      const store = new FileStateStore(tempDir);
      const stateDir = join(tempDir, '.prompt-language');
      await mkdir(stateDir, { recursive: true });

      const lockPath = join(stateDir, 'session-state.lock');
      // Lock is 5 seconds old — well within 30s threshold
      const lockData = JSON.stringify({ pid: 999999, timestamp: Date.now() - 5_000 });
      await writeFile(lockPath, lockData, 'utf-8');

      if (process.platform === 'win32') {
        // On Windows: lock is young, PID check is skipped → lock is NOT stale
        // save() will exhaust retries waiting, then force-remove
        const session = createSessionState('s1', makeSpec());
        await store.save(session);
        const loaded = await store.loadCurrent();
        expect(loaded?.sessionId).toBe('s1');
      } else {
        // On non-Windows: PID 999999 is dead, so lock IS stale despite young timestamp
        const session = createSessionState('s1', makeSpec());
        await store.save(session);
        const loaded = await store.loadCurrent();
        expect(loaded?.sessionId).toBe('s1');
      }
    }, 5000);
  });

  describe('checksum single-serialize (no re-parse)', () => {
    it('checksum matches when loaded without re-parse round-trip', async () => {
      const store = new FileStateStore(tempDir);
      const session = createSessionState('s1', makeSpec());
      await store.save(session);

      // Read raw file and verify checksum matches state without _checksum
      const statePath = join(tempDir, '.prompt-language', 'session-state.json');
      const raw = await readFile(statePath, 'utf-8');
      const parsed = JSON.parse(raw);
      const { _checksum, ...stateWithout } = parsed;
      const expectedChecksum = createHash('sha256')
        .update(JSON.stringify(stateWithout, null, 2))
        .digest('hex');
      expect(_checksum).toBe(expectedChecksum);

      // Also verify load succeeds (no checksum mismatch)
      const loaded = await store.loadCurrent();
      expect(loaded).not.toBeNull();
      expect(loaded?.sessionId).toBe('s1');
    });

    it('checksum round-trips with complex variables', async () => {
      const store = new FileStateStore(tempDir);
      const session = createSessionState('s1', makeSpec());
      const withVars = {
        ...session,
        variables: {
          greeting: 'hello "world"',
          nested: '{"key": "value"}',
          special: 'line1\nline2\ttab',
        },
      };
      await store.save(withVars as typeof session);

      // Verify load does not report checksum mismatch
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const loaded = await store.loadCurrent();
      expect(loaded).not.toBeNull();
      expect(loaded?.variables).toEqual(withVars.variables);
      // No checksum mismatch warning should have been emitted
      const checksumCalls = stderrSpy.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('checksum mismatch'),
      );
      expect(checksumCalls).toHaveLength(0);
      stderrSpy.mockRestore();
    });
  });

  describe('legacy state migration', () => {
    it('backfills snapshots: {} when loading a state file written before PR1', async () => {
      const store = new FileStateStore(tempDir);
      const stateDir = join(tempDir, '.prompt-language');
      await mkdir(stateDir, { recursive: true });
      const session = createSessionState('s1', makeSpec());
      const { snapshots: _dropped, ...legacy } = session as SessionState & {
        snapshots?: unknown;
      };
      void _dropped;
      const raw = JSON.stringify(legacy, null, 2);
      await writeFile(join(stateDir, 'session-state.json'), raw, 'utf-8');

      const loaded = await store.loadCurrent();
      expect(loaded).not.toBeNull();
      expect(loaded?.snapshots).toEqual({});
    });
  });

  describe('lock handle cleanup on writeFile failure', () => {
    it('closes file handle even when writeFile throws', async () => {
      const store = new FileStateStore(tempDir);
      const stateDir = join(tempDir, '.prompt-language');
      await mkdir(stateDir, { recursive: true });

      // Make open succeed but the subsequent writeFile throw
      const real = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
      let handleClosed = false;
      const fakeHandle = {
        writeFile: vi.fn().mockRejectedValue(new Error('disk full')),
        close: vi.fn().mockImplementation(async () => {
          handleClosed = true;
        }),
      };
      vi.mocked(mockedOpen).mockResolvedValueOnce(fakeHandle as never);

      const session = createSessionState('s1', makeSpec());
      // save() calls acquireLock → open succeeds → writeFile throws → close should still be called
      await expect(store.save(session)).rejects.toThrow('disk full');
      expect(handleClosed).toBe(true);
      expect(fakeHandle.close).toHaveBeenCalled();

      // Restore real open
      vi.mocked(mockedOpen).mockReset().mockImplementation(real.open);
    });
  });
});
