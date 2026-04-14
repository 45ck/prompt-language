import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SpawnInput } from '../../application/ports/process-spawner.js';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
  execFileSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  writeFileSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

const { spawn } = await import('node:child_process');
const { writeFileSync } = await import('node:fs');
const { readFile } = await import('node:fs/promises');
const { CliProcessSpawner } = await import('./cli-process-spawner.js');

function makeInput(overrides: Partial<SpawnInput> = {}): SpawnInput {
  return {
    name: 'worker',
    goal: 'Sub-task: worker',
    flowText: '  run: echo hello',
    variables: {},
    stateDir: '.prompt-language-worker',
    ...overrides,
  };
}

describe('CliProcessSpawner', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('spawns a node process with the correct runner args', async () => {
    const childMock = { pid: 42, unref: vi.fn() };
    vi.mocked(spawn).mockReturnValue(childMock as never);

    const spawner = new CliProcessSpawner('/repo', 'codex', '/path/to/cli.mjs');
    const result = await spawner.spawn(makeInput());

    expect(result).toEqual({ pid: 42 });
    expect(spawn).toHaveBeenCalledWith(
      'node',
      expect.arrayContaining([
        '/path/to/cli.mjs',
        'run',
        '--runner',
        'codex',
        '--state-dir',
        '.prompt-language-worker',
        '--file',
        expect.stringContaining('-flow.txt'),
      ]),
      expect.objectContaining({
        cwd: '/repo',
        stdio: 'ignore',
        detached: true,
      }),
    );
    expect(childMock.unref).toHaveBeenCalled();
  });

  it('writes the flow text to a temp file', async () => {
    const childMock = { pid: 42, unref: vi.fn() };
    vi.mocked(spawn).mockReturnValue(childMock as never);

    const spawner = new CliProcessSpawner('/repo', 'codex', '/path/to/cli.mjs');
    await spawner.spawn(makeInput({ variables: { color: 'blue' } }));

    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('.prompt-language-worker-flow.txt'),
      expect.stringContaining('let color = "blue"'),
      'utf-8',
    );
  });

  it('passes --model when specified', async () => {
    const childMock = { pid: 42, unref: vi.fn() };
    vi.mocked(spawn).mockReturnValue(childMock as never);

    const spawner = new CliProcessSpawner('/repo', 'codex', '/path/to/cli.mjs');
    await spawner.spawn(makeInput({ model: 'gpt-5.2' }));

    expect(spawn).toHaveBeenCalledWith(
      'node',
      expect.arrayContaining(['--model', 'gpt-5.2']),
      expect.any(Object),
    );
  });

  it('uses spawn-level cwd when specified', async () => {
    const childMock = { pid: 42, unref: vi.fn() };
    vi.mocked(spawn).mockReturnValue(childMock as never);

    const spawner = new CliProcessSpawner('/repo', 'codex', '/path/to/cli.mjs');
    await spawner.spawn(makeInput({ cwd: '/other/dir' }));

    expect(spawn).toHaveBeenCalledWith(
      'node',
      expect.any(Array),
      expect.objectContaining({ cwd: '/other/dir' }),
    );
  });

  it('rejects invalid spawn names', async () => {
    const spawner = new CliProcessSpawner('/repo', 'codex', '/path/to/cli.mjs');
    await expect(spawner.spawn(makeInput({ name: 'bad name!' }))).rejects.toThrow(
      'Invalid spawn name',
    );
  });

  it('returns pid 0 when child.pid is undefined', async () => {
    const childMock = { pid: undefined, unref: vi.fn() };
    vi.mocked(spawn).mockReturnValue(childMock as never);

    const spawner = new CliProcessSpawner('/repo', 'codex', '/path/to/cli.mjs');
    const result = await spawner.spawn(makeInput());

    expect(result).toEqual({ pid: 0 });
  });

  describe('poll', () => {
    it('returns completed with variables when state says completed', async () => {
      vi.mocked(readFile).mockResolvedValue(
        JSON.stringify({ status: 'completed', variables: { result: 'done' } }),
      );

      const spawner = new CliProcessSpawner('/repo', 'codex', '/path/to/cli.mjs');
      const status = await spawner.poll('.prompt-language-worker');

      expect(status).toEqual({ status: 'completed', variables: { result: 'done' } });
    });

    it('returns failed for failed status', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({ status: 'failed' }));

      const spawner = new CliProcessSpawner('/repo', 'codex', '/path/to/cli.mjs');
      const status = await spawner.poll('.prompt-language-worker');

      expect(status).toEqual({ status: 'failed', variables: undefined });
    });

    it('returns running when state file does not exist', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));

      const spawner = new CliProcessSpawner('/repo', 'codex', '/path/to/cli.mjs');
      const status = await spawner.poll('.prompt-language-worker');

      expect(status).toEqual({ status: 'running' });
    });
  });
});
