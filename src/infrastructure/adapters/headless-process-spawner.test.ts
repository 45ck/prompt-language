import { beforeEach, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import type { SpawnInput } from '../../application/ports/process-spawner.js';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

const { execFileSync: mockedExecFileSync, spawn: mockedSpawn } = await import('node:child_process');
const {
  mkdir: mockedMkdir,
  readFile: mockedReadFile,
  writeFile: mockedWriteFile,
} = await import('node:fs/promises');
const { HeadlessProcessSpawner } = await import('./headless-process-spawner.js');

function makeInput(overrides: Partial<SpawnInput> = {}): SpawnInput {
  return {
    name: 'worker',
    goal: 'Sub-task: worker',
    flowText: '  run: echo child-output > worker-result.txt',
    variables: {},
    stateDir: '.prompt-language-worker',
    ...overrides,
  };
}

describe('HeadlessProcessSpawner', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('writes a child flow file and spawns the headless CLI', async () => {
    const fakeChild = { pid: 4321, unref: vi.fn() };
    vi.mocked(mockedSpawn).mockReturnValue(fakeChild as never);

    const spawner = new HeadlessProcessSpawner({
      cliPath: '/repo/bin/cli.mjs',
      cwd: '/repo/workspace',
      runner: 'ollama',
      model: 'ollama/gemma4:31b',
    });

    const result = await spawner.spawn(makeInput({ variables: { color: 'purple' } }));

    const stateDir = join('/repo/workspace', '.prompt-language-worker');
    const flowPath = join(stateDir, 'spawn.flow');

    expect(result).toEqual({ pid: 4321 });
    expect(mockedMkdir).toHaveBeenCalledWith(stateDir, {
      recursive: true,
    });
    expect(mockedWriteFile).toHaveBeenCalledWith(
      flowPath,
      expect.stringContaining('let color = "purple"'),
      'utf8',
    );
    expect(fakeChild.unref).toHaveBeenCalled();
    expect(mockedSpawn).toHaveBeenCalledWith(
      process.execPath,
      [
        '/repo/bin/cli.mjs',
        'ci',
        '--runner',
        'ollama',
        '--state-dir',
        '.prompt-language-worker',
        '--model',
        'ollama/gemma4:31b',
        '--file',
        flowPath,
      ],
      expect.objectContaining({
        cwd: '/repo/workspace',
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      }),
    );
  });

  it('returns pid 0 when the spawned child has no pid', async () => {
    const fakeChild = { pid: undefined, unref: vi.fn() };
    vi.mocked(mockedSpawn).mockReturnValue(fakeChild as never);

    const spawner = new HeadlessProcessSpawner({
      cliPath: '/repo/bin/cli.mjs',
      cwd: '/repo/workspace',
      runner: 'opencode',
    });

    await expect(spawner.spawn(makeInput())).resolves.toEqual({ pid: 0 });
  });

  it('reads completed child state from the configured state directory', async () => {
    vi.mocked(mockedReadFile).mockResolvedValue(
      JSON.stringify({ status: 'completed', variables: { result: 'done' } }),
    );

    const spawner = new HeadlessProcessSpawner({
      cliPath: '/repo/bin/cli.mjs',
      cwd: '/repo/workspace',
      runner: 'ollama',
    });

    const status = await spawner.poll('.prompt-language-worker');

    expect(status).toEqual({
      status: 'completed',
      variables: { result: 'done' },
    });
  });

  it('terminates detached child processes on Windows and POSIX', async () => {
    const spawner = new HeadlessProcessSpawner({
      cliPath: '/repo/bin/cli.mjs',
      cwd: '/repo/workspace',
      runner: 'ollama',
    });

    const platformSpy = vi.spyOn(process, 'platform', 'get');

    platformSpy.mockReturnValue('win32');
    await expect(spawner.terminate(99)).resolves.toBe(true);
    expect(mockedExecFileSync).toHaveBeenCalledWith('taskkill', ['/PID', '99', '/T', '/F'], {
      stdio: 'ignore',
    });

    platformSpy.mockReturnValue('linux');
    const killSpy = vi.spyOn(process, 'kill').mockReturnValue(true);
    await expect(spawner.terminate(88)).resolves.toBe(true);
    expect(killSpy).toHaveBeenCalledWith(-88, 'SIGTERM');

    killSpy.mockRestore();
    platformSpy.mockRestore();
  });
});
