import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SpawnInput } from '../../application/ports/process-spawner.js';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

const { spawn: mockedSpawn } = await import('node:child_process');
const { readFile: mockedReadFile } = await import('node:fs/promises');

// Import after mocks are set up
const { ClaudeProcessSpawner } = await import('./claude-process-spawner.js');

function makeInput(overrides: Partial<SpawnInput> = {}): SpawnInput {
  return {
    name: 'child1',
    goal: 'Test goal',
    flowText: '  prompt: Hello',
    variables: {},
    stateDir: '/tmp/.prompt-language-child1',
    ...overrides,
  };
}

describe('ClaudeProcessSpawner', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('spawn', () => {
    it('spawns a detached claude process with correct arguments', async () => {
      const fakeChild = { pid: 1234, unref: vi.fn() };
      vi.mocked(mockedSpawn).mockReturnValue(fakeChild as never);

      const spawner = new ClaudeProcessSpawner('/work');
      const result = await spawner.spawn(makeInput());

      expect(result.pid).toBe(1234);
      expect(fakeChild.unref).toHaveBeenCalled();
      expect(mockedSpawn).toHaveBeenCalledWith(
        'claude',
        ['-p', '--dangerously-skip-permissions', expect.stringContaining('Goal: Test goal')],
        expect.objectContaining({
          cwd: '/work',
          stdio: 'ignore',
          detached: true,
        }),
      );
    });

    it('sets PROMPT_LANGUAGE_STATE_DIR in child env', async () => {
      const fakeChild = { pid: 99, unref: vi.fn() };
      vi.mocked(mockedSpawn).mockReturnValue(fakeChild as never);

      const spawner = new ClaudeProcessSpawner('/work');
      await spawner.spawn(makeInput({ stateDir: '/custom/state' }));

      const callArgs = vi.mocked(mockedSpawn).mock.calls[0]!;
      const options = callArgs[2] as { env: Record<string, string> };
      expect(options.env['PROMPT_LANGUAGE_STATE_DIR']).toBe('/custom/state');
    });

    it('returns pid 0 when child.pid is undefined', async () => {
      const fakeChild = { pid: undefined, unref: vi.fn() };
      vi.mocked(mockedSpawn).mockReturnValue(fakeChild as never);

      const spawner = new ClaudeProcessSpawner('/work');
      const result = await spawner.spawn(makeInput());

      expect(result.pid).toBe(0);
    });

    it('builds child prompt with variable declarations', async () => {
      const fakeChild = { pid: 1, unref: vi.fn() };
      vi.mocked(mockedSpawn).mockReturnValue(fakeChild as never);

      const spawner = new ClaudeProcessSpawner('/work');
      await spawner.spawn(
        makeInput({
          variables: { greeting: 'hello', count: 42 },
        }),
      );

      const callArgs = vi.mocked(mockedSpawn).mock.calls[0]!;
      const prompt = callArgs[1][2];
      expect(prompt).toContain('let greeting = "hello"');
      expect(prompt).toContain('let count = "42"');
    });

    it('escapes double quotes and backslashes in variable values', async () => {
      const fakeChild = { pid: 1, unref: vi.fn() };
      vi.mocked(mockedSpawn).mockReturnValue(fakeChild as never);

      const spawner = new ClaudeProcessSpawner('/work');
      await spawner.spawn(
        makeInput({
          variables: { msg: 'say "hi"' },
        }),
      );

      const callArgs = vi.mocked(mockedSpawn).mock.calls[0]!;
      const prompt = callArgs[1][2];
      expect(prompt).toContain('let msg = "say \\"hi\\""');
    });

    it('escapes newlines in variable values', async () => {
      const fakeChild = { pid: 1, unref: vi.fn() };
      vi.mocked(mockedSpawn).mockReturnValue(fakeChild as never);

      const spawner = new ClaudeProcessSpawner('/work');
      await spawner.spawn(
        makeInput({
          variables: { multi: 'line1\nline2' },
        }),
      );

      const callArgs = vi.mocked(mockedSpawn).mock.calls[0]!;
      const prompt = callArgs[1][2];
      expect(prompt).toContain('let multi = "line1\\nline2"');
    });

    it('builds prompt without variable block when no variables', async () => {
      const fakeChild = { pid: 1, unref: vi.fn() };
      vi.mocked(mockedSpawn).mockReturnValue(fakeChild as never);

      const spawner = new ClaudeProcessSpawner('/work');
      await spawner.spawn(makeInput({ variables: {} }));

      const callArgs = vi.mocked(mockedSpawn).mock.calls[0]!;
      const prompt = callArgs[1][2];
      expect(prompt).toBe('Goal: Test goal\n\nflow:\n  prompt: Hello');
      expect(prompt).not.toContain('let ');
    });
  });

  describe('poll', () => {
    it('returns completed with variables when state is completed', async () => {
      vi.mocked(mockedReadFile).mockResolvedValue(
        JSON.stringify({
          status: 'completed',
          variables: { result: 'done' },
        }),
      );

      const spawner = new ClaudeProcessSpawner();
      const status = await spawner.poll('/state/dir');

      expect(status).toEqual({
        status: 'completed',
        variables: { result: 'done' },
      });
    });

    it('returns failed when state is failed', async () => {
      vi.mocked(mockedReadFile).mockResolvedValue(
        JSON.stringify({ status: 'failed', variables: { x: '1' } }),
      );

      const spawner = new ClaudeProcessSpawner();
      const status = await spawner.poll('/state/dir');

      expect(status).toEqual({
        status: 'failed',
        variables: { x: '1' },
      });
    });

    it('returns failed when state is cancelled', async () => {
      vi.mocked(mockedReadFile).mockResolvedValue(JSON.stringify({ status: 'cancelled' }));

      const spawner = new ClaudeProcessSpawner();
      const status = await spawner.poll('/state/dir');

      expect(status).toEqual({
        status: 'failed',
        variables: undefined,
      });
    });

    it('returns running when state is active', async () => {
      vi.mocked(mockedReadFile).mockResolvedValue(JSON.stringify({ status: 'active' }));

      const spawner = new ClaudeProcessSpawner();
      const status = await spawner.poll('/state/dir');

      expect(status).toEqual({ status: 'running' });
    });

    it('returns running when state file does not exist', async () => {
      vi.mocked(mockedReadFile).mockRejectedValue(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
      );

      const spawner = new ClaudeProcessSpawner();
      const status = await spawner.poll('/state/dir');

      expect(status).toEqual({ status: 'running' });
    });

    it('returns running when state file contains invalid JSON', async () => {
      vi.mocked(mockedReadFile).mockResolvedValue('not json');

      const spawner = new ClaudeProcessSpawner();
      const status = await spawner.poll('/state/dir');

      expect(status).toEqual({ status: 'running' });
    });

    it('reads from correct path within state directory', async () => {
      vi.mocked(mockedReadFile).mockResolvedValue(JSON.stringify({ status: 'active' }));

      const spawner = new ClaudeProcessSpawner();
      await spawner.poll('/my/state');

      expect(mockedReadFile).toHaveBeenCalledWith(
        expect.stringContaining('session-state.json'),
        'utf-8',
      );
    });

    it('returns completed without variables when variables field is missing', async () => {
      vi.mocked(mockedReadFile).mockResolvedValue(JSON.stringify({ status: 'completed' }));

      const spawner = new ClaudeProcessSpawner();
      const status = await spawner.poll('/state/dir');

      expect(status).toEqual({
        status: 'completed',
        variables: undefined,
      });
    });
  });
});

describe('ClaudeProcessSpawner — spawn error propagation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('propagates errors thrown by child_process spawn', async () => {
    vi.mocked(mockedSpawn).mockImplementation(() => {
      throw new Error('spawn ENOENT');
    });

    const spawner = new ClaudeProcessSpawner('/work');
    await expect(spawner.spawn(makeInput())).rejects.toThrow('spawn ENOENT');
  });
});

describe('ClaudeProcessSpawner — default cwd', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('uses process.cwd() when no cwd is provided', async () => {
    const fakeChild = { pid: 10, unref: vi.fn() };
    vi.mocked(mockedSpawn).mockReturnValue(fakeChild as never);

    const spawner = new ClaudeProcessSpawner();
    await spawner.spawn(makeInput());

    const callArgs = vi.mocked(mockedSpawn).mock.calls[0]!;
    const options = callArgs[2] as { cwd: string };
    expect(options.cwd).toBe(process.cwd());
  });
});

describe('ClaudeProcessSpawner — variable with backslash', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('double-escapes backslashes in variable values', async () => {
    const fakeChild = { pid: 1, unref: vi.fn() };
    vi.mocked(mockedSpawn).mockReturnValue(fakeChild as never);

    const spawner = new ClaudeProcessSpawner('/work');
    await spawner.spawn(
      makeInput({
        variables: { path: 'C:\\Users\\test' },
      }),
    );

    const callArgs = vi.mocked(mockedSpawn).mock.calls[0]!;
    const prompt = callArgs[1][2];
    expect(prompt).toContain('let path = "C:\\\\Users\\\\test"');
  });
});

describe('ClaudeProcessSpawner — empty goal', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('builds a valid prompt even with an empty goal string', async () => {
    const fakeChild = { pid: 1, unref: vi.fn() };
    vi.mocked(mockedSpawn).mockReturnValue(fakeChild as never);

    const spawner = new ClaudeProcessSpawner('/work');
    await spawner.spawn(makeInput({ goal: '' }));

    const callArgs = vi.mocked(mockedSpawn).mock.calls[0]!;
    const prompt = callArgs[1][2];
    expect(prompt).toContain('Goal: ');
    expect(prompt).toContain('flow:');
    expect(prompt).toContain('prompt: Hello');
  });
});

describe('ClaudeProcessSpawner — poll with no status field', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns running when state JSON has no status key', async () => {
    vi.mocked(mockedReadFile).mockResolvedValue(JSON.stringify({ variables: { x: '1' } }));

    const spawner = new ClaudeProcessSpawner();
    const status = await spawner.poll('/state/dir');

    expect(status).toEqual({ status: 'running' });
  });
});

describe('ClaudeProcessSpawner — poll with empty object', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns running when state JSON is an empty object', async () => {
    vi.mocked(mockedReadFile).mockResolvedValue(JSON.stringify({}));

    const spawner = new ClaudeProcessSpawner();
    const status = await spawner.poll('/state/dir');

    expect(status).toEqual({ status: 'running' });
  });
});

describe('ClaudeProcessSpawner — poll with extra fields', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('parses correctly when state JSON has extra unexpected fields', async () => {
    vi.mocked(mockedReadFile).mockResolvedValue(
      JSON.stringify({
        status: 'completed',
        variables: { out: 'ok' },
        extraField: 'unexpected',
        nested: { deep: true },
      }),
    );

    const spawner = new ClaudeProcessSpawner();
    const status = await spawner.poll('/state/dir');

    expect(status).toEqual({
      status: 'completed',
      variables: { out: 'ok' },
    });
  });
});

describe('ClaudeProcessSpawner — concurrent spawns', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('handles two spawns in parallel independently', async () => {
    const fakeChild1 = { pid: 100, unref: vi.fn() };
    const fakeChild2 = { pid: 200, unref: vi.fn() };
    vi.mocked(mockedSpawn)
      .mockReturnValueOnce(fakeChild1 as never)
      .mockReturnValueOnce(fakeChild2 as never);

    const spawner = new ClaudeProcessSpawner('/work');
    const [result1, result2] = await Promise.all([
      spawner.spawn(makeInput({ name: 'child-a', stateDir: '/tmp/a' })),
      spawner.spawn(makeInput({ name: 'child-b', stateDir: '/tmp/b' })),
    ]);

    expect(result1.pid).toBe(100);
    expect(result2.pid).toBe(200);
    expect(fakeChild1.unref).toHaveBeenCalled();
    expect(fakeChild2.unref).toHaveBeenCalled();
    expect(mockedSpawn).toHaveBeenCalledTimes(2);
  });
});
