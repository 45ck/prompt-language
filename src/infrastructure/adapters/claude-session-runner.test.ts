import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SpawnedSessionRequest } from './spawned-session-runner.js';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
  execFileSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

const { spawn: mockedSpawn } = await import('node:child_process');
const { readFile: mockedReadFile } = await import('node:fs/promises');

const { ClaudeSessionRunner } = await import('./claude-session-runner.js');

function makeRequest(overrides: Partial<SpawnedSessionRequest> = {}): SpawnedSessionRequest {
  return {
    name: 'child1',
    goal: 'Test goal',
    flowText: '  prompt: Hello',
    variables: {},
    stateDir: '/tmp/.prompt-language-child1',
    ...overrides,
  };
}

describe('ClaudeSessionRunner', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('capabilities', () => {
    it('reports correct capabilities', () => {
      const runner = new ClaudeSessionRunner('/work');
      expect(runner.capabilities).toEqual({
        externalProcess: true,
        terminate: true,
        cwdOverride: true,
        modelPassThrough: true,
        stateDirPolling: true,
        inProcessExecution: false,
      });
    });
  });

  describe('launch', () => {
    it('spawns a detached claude process and returns a handle', async () => {
      const fakeChild = { pid: 1234, unref: vi.fn() };
      vi.mocked(mockedSpawn).mockReturnValue(fakeChild as never);

      const runner = new ClaudeSessionRunner('/work');
      const handle = await runner.launch(makeRequest());

      expect(handle.pid).toBe(1234);
      expect(handle.stateDir).toBe('/tmp/.prompt-language-child1');
      expect(handle.captureMode).toBe('state-file');
      expect(handle.runId).toBeTruthy();
      expect(fakeChild.unref).toHaveBeenCalled();
    });

    it('sets PROMPT_LANGUAGE_STATE_DIR in child env', async () => {
      const fakeChild = { pid: 99, unref: vi.fn() };
      vi.mocked(mockedSpawn).mockReturnValue(fakeChild as never);

      const runner = new ClaudeSessionRunner('/work');
      await runner.launch(makeRequest({ stateDir: '/custom/state' }));

      const callArgs = vi.mocked(mockedSpawn).mock.calls[0]!;
      const options = callArgs[2] as { env: Record<string, string> };
      expect(options.env['PROMPT_LANGUAGE_STATE_DIR']).toBe('/custom/state');
    });

    it('returns pid undefined when child.pid is undefined', async () => {
      const fakeChild = { pid: undefined, unref: vi.fn() };
      vi.mocked(mockedSpawn).mockReturnValue(fakeChild as never);

      const runner = new ClaudeSessionRunner('/work');
      const handle = await runner.launch(makeRequest());

      expect(handle.pid).toBeUndefined();
    });

    it('throws on invalid spawn name', async () => {
      const runner = new ClaudeSessionRunner('/work');
      await expect(runner.launch(makeRequest({ name: 'bad;name' }))).rejects.toThrow(
        'Invalid spawn name',
      );
    });

    it('throws on empty model name', async () => {
      const runner = new ClaudeSessionRunner('/work');
      await expect(runner.launch(makeRequest({ model: '   ' }))).rejects.toThrow(
        'model must be a non-empty string',
      );
    });

    it('passes --model flag when model is provided', async () => {
      const fakeChild = { pid: 1, unref: vi.fn() };
      vi.mocked(mockedSpawn).mockReturnValue(fakeChild as never);

      const runner = new ClaudeSessionRunner('/work');
      await runner.launch(makeRequest({ model: 'gpt-5' }));

      const callArgs = vi.mocked(mockedSpawn).mock.calls[0]!;
      expect(callArgs[1]).toContain('--model');
      expect(callArgs[1]).toContain('gpt-5');
    });
  });

  describe('poll', () => {
    it('returns completed with variables', async () => {
      vi.mocked(mockedReadFile).mockResolvedValue(
        JSON.stringify({ status: 'completed', variables: { result: 'done' } }),
      );

      const runner = new ClaudeSessionRunner();
      const snapshot = await runner.poll({ stateDir: '/state/dir' });

      expect(snapshot).toEqual({ status: 'completed', variables: { result: 'done' } });
    });

    it('returns failed when state is cancelled', async () => {
      vi.mocked(mockedReadFile).mockResolvedValue(JSON.stringify({ status: 'cancelled' }));

      const runner = new ClaudeSessionRunner();
      const snapshot = await runner.poll({ stateDir: '/state/dir' });

      expect(snapshot).toEqual({ status: 'failed', variables: undefined });
    });

    it('returns running when state file is missing', async () => {
      vi.mocked(mockedReadFile).mockRejectedValue(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
      );

      const runner = new ClaudeSessionRunner();
      const snapshot = await runner.poll({ stateDir: '/state/dir' });

      expect(snapshot).toEqual({ status: 'running' });
    });
  });

  describe('terminate', () => {
    it('returns false for undefined pid', async () => {
      const runner = new ClaudeSessionRunner('/work');
      const result = await runner.terminate({ pid: undefined });
      expect(result).toBe(false);
    });

    it('returns false for pid 0', async () => {
      const runner = new ClaudeSessionRunner('/work');
      const result = await runner.terminate({ pid: 0 });
      expect(result).toBe(false);
    });
  });

  describe('isValidSpawnName', () => {
    it('accepts valid names', () => {
      expect(ClaudeSessionRunner.isValidSpawnName('fix-auth')).toBe(true);
      expect(ClaudeSessionRunner.isValidSpawnName('task_1')).toBe(true);
    });

    it('rejects invalid names', () => {
      expect(ClaudeSessionRunner.isValidSpawnName('')).toBe(false);
      expect(ClaudeSessionRunner.isValidSpawnName('bad;name')).toBe(false);
    });
  });
});
