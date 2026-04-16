import { beforeEach, describe, expect, it, vi } from 'vitest';

const { spawnMock, execFileSyncMock, writeFileSyncMock, readFileMock, randomUuidMock } = vi.hoisted(
  () => ({
    spawnMock: vi.fn(),
    execFileSyncMock: vi.fn(),
    writeFileSyncMock: vi.fn(),
    readFileMock: vi.fn(),
    randomUuidMock: vi.fn(),
  }),
);

vi.mock('node:child_process', () => ({
  execFileSync: execFileSyncMock,
  spawn: spawnMock,
}));

vi.mock('node:fs', () => ({
  writeFileSync: writeFileSyncMock,
}));

vi.mock('node:fs/promises', () => ({
  readFile: readFileMock,
}));

vi.mock('node:crypto', () => ({
  randomUUID: randomUuidMock,
}));

import { CliSessionRunner } from './cli-session-runner.js';

describe('CliSessionRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    randomUuidMock.mockReturnValue('cli-run-id');
    spawnMock.mockReturnValue({
      pid: 4321,
      unref: vi.fn(),
    });
    delete process.env['PL_RUN_ID'];
    delete process.env['PL_TRACE'];
    delete process.env['PL_TRACE_DIR'];
  });

  function setPlatform(value: NodeJS.Platform): () => void {
    const original = process.platform;
    Object.defineProperty(process, 'platform', {
      configurable: true,
      value,
    });
    return () => {
      Object.defineProperty(process, 'platform', {
        configurable: true,
        value: original,
      });
    };
  }

  it('advertises external process capabilities', () => {
    const runner = new CliSessionRunner('C:/workspace', 'codex', 'bin/cli.mjs');

    expect(runner.capabilities).toEqual({
      externalProcess: true,
      terminate: true,
      cwdOverride: true,
      modelPassThrough: true,
      stateDirPolling: true,
      inProcessExecution: false,
    });
  });

  it('launches a child flow with propagated env and model', async () => {
    process.env['PL_RUN_ID'] = 'trace-run';
    process.env['PL_TRACE'] = '1';
    process.env['PL_TRACE_DIR'] = 'C:/trace-dir';

    const runner = new CliSessionRunner('C:/workspace', 'codex', 'bin/cli.mjs');
    const handle = await runner.launch({
      name: 'child_1',
      goal: 'Line 1\nLine 2',
      flowText: '  prompt: Continue',
      variables: {
        quote: 'He said "hi"',
        multiline: 'a\nb',
      },
      stateDir: 'C:/state-dir',
      cwd: 'C:/child-workspace',
      model: 'gpt-5.4',
    });

    const firstWriteCall = writeFileSyncMock.mock.calls[0];
    expect(firstWriteCall).toBeDefined();
    if (!firstWriteCall) {
      throw new Error('expected writeFileSync to be called');
    }
    const [flowFilePath, flowText] = firstWriteCall;
    expect(writeFileSyncMock).toHaveBeenCalledWith(flowFilePath, flowText, 'utf-8');
    expect(String(flowFilePath)).toContain('child-workspace');
    expect(String(flowFilePath)).toContain('state-dir-flow.txt');
    expect(String(flowText)).toContain('Goal: Line 1 Line 2');
    expect(String(flowText)).toContain('  let quote = "He said \\"hi\\""');
    expect(String(flowText)).toContain('  let multiline = "a\\nb"');
    expect(spawnMock).toHaveBeenCalledWith(
      'node',
      [
        'bin/cli.mjs',
        'run',
        '--runner',
        'codex',
        '--state-dir',
        'C:/state-dir',
        '--file',
        String(flowFilePath),
        '--model',
        'gpt-5.4',
      ],
      {
        cwd: 'C:/child-workspace',
        stdio: 'ignore',
        detached: true,
        env: expect.objectContaining({
          PROMPT_LANGUAGE_STATE_DIR: 'C:/state-dir',
          PL_SPAWN_NAME: 'child_1',
          PL_RUN_ID: 'trace-run',
          PL_TRACE: '1',
          PL_TRACE_DIR: 'C:/trace-dir',
        }),
      },
    );
    expect(handle).toEqual({
      runId: 'cli-run-id',
      stateDir: 'C:/state-dir',
      pid: 4321,
      captureMode: 'state-file',
    });
  });

  it('rejects invalid spawn names before launching', async () => {
    const runner = new CliSessionRunner('C:/workspace', 'codex', 'bin/cli.mjs');

    await expect(
      runner.launch({
        name: 'bad name',
        goal: 'x',
        flowText: '',
        variables: {},
        stateDir: 'C:/state-dir',
      }),
    ).rejects.toThrow(/Invalid spawn name/);

    expect(writeFileSyncMock).not.toHaveBeenCalled();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('uses the runner cwd when no child cwd or model is provided and omits missing child PIDs', async () => {
    spawnMock.mockReturnValueOnce({
      pid: undefined,
      unref: vi.fn(),
    });

    const runner = new CliSessionRunner('C:/workspace', 'codex', 'bin/cli.mjs');
    const handle = await runner.launch({
      name: 'child_2',
      goal: 'Goal only',
      flowText: '',
      variables: {},
      stateDir: 'C:/state-dir',
    });

    expect(spawnMock).toHaveBeenCalledWith(
      'node',
      [
        'bin/cli.mjs',
        'run',
        '--runner',
        'codex',
        '--state-dir',
        'C:/state-dir',
        '--file',
        expect.stringContaining('state-dir-flow.txt'),
      ],
      expect.objectContaining({
        cwd: 'C:/workspace',
      }),
    );
    expect(handle).toEqual({
      runId: 'cli-run-id',
      stateDir: 'C:/state-dir',
      pid: undefined,
      captureMode: 'state-file',
    });
  });

  it('maps completed state-file snapshots to completed with variables', async () => {
    readFileMock.mockResolvedValue(
      JSON.stringify({
        status: 'completed',
        variables: {
          answer: '42',
        },
      }),
    );
    const runner = new CliSessionRunner('C:/workspace', 'codex', 'bin/cli.mjs');

    await expect(runner.poll({ stateDir: 'C:/state-dir' })).resolves.toEqual({
      status: 'completed',
      variables: {
        answer: '42',
      },
    });
  });

  it('maps failed and cancelled state-file snapshots to failed', async () => {
    const runner = new CliSessionRunner('C:/workspace', 'codex', 'bin/cli.mjs');

    readFileMock.mockResolvedValueOnce(JSON.stringify({ status: 'failed', variables: { x: '1' } }));
    await expect(runner.poll({ stateDir: 'C:/state-dir' })).resolves.toEqual({
      status: 'failed',
      variables: { x: '1' },
    });

    readFileMock.mockResolvedValueOnce(
      JSON.stringify({ status: 'cancelled', variables: { y: '2' } }),
    );
    await expect(runner.poll({ stateDir: 'C:/state-dir' })).resolves.toEqual({
      status: 'failed',
      variables: { y: '2' },
    });
  });

  it('treats unreadable state files as still running', async () => {
    readFileMock.mockRejectedValue(new Error('missing'));
    const runner = new CliSessionRunner('C:/workspace', 'codex', 'bin/cli.mjs');

    await expect(runner.poll({ stateDir: 'C:/state-dir' })).resolves.toEqual({
      status: 'running',
    });
  });

  it('treats non-terminal persisted states as still running', async () => {
    readFileMock.mockResolvedValue(JSON.stringify({ status: 'running' }));
    const runner = new CliSessionRunner('C:/workspace', 'codex', 'bin/cli.mjs');

    await expect(runner.poll({ stateDir: 'C:/state-dir' })).resolves.toEqual({
      status: 'running',
    });
  });

  it('returns false when terminate has no pid and uses taskkill on Windows PIDs', async () => {
    const runner = new CliSessionRunner('C:/workspace', 'codex', 'bin/cli.mjs');

    await expect(runner.terminate({ pid: undefined })).resolves.toBe(false);
    await expect(runner.terminate({ pid: 4321 })).resolves.toBe(true);

    expect(execFileSyncMock).toHaveBeenCalledWith('taskkill', ['/PID', '4321', '/T', '/F'], {
      stdio: 'ignore',
    });
  });

  it('uses process groups on non-Windows and falls back to direct pid termination', async () => {
    const restorePlatform = setPlatform('linux');
    const killSpy = vi.spyOn(process, 'kill');
    try {
      killSpy.mockImplementationOnce(() => true);
      const runner = new CliSessionRunner('C:/workspace', 'codex', 'bin/cli.mjs');
      await expect(runner.terminate({ pid: 4321 })).resolves.toBe(true);
      expect(killSpy).toHaveBeenCalledWith(-4321, 'SIGTERM');

      killSpy.mockReset();
      killSpy.mockImplementationOnce(() => {
        const error = new Error('group failed') as NodeJS.ErrnoException;
        error.code = 'EPERM';
        throw error;
      });
      killSpy.mockImplementationOnce(() => true);

      await expect(runner.terminate({ pid: 4321 })).resolves.toBe(true);
      expect(killSpy.mock.calls).toEqual([
        [-4321, 'SIGTERM'],
        [4321, 'SIGTERM'],
      ]);
    } finally {
      killSpy.mockRestore();
      restorePlatform();
    }
  });

  it('returns false when non-Windows termination discovers a missing process', async () => {
    const restorePlatform = setPlatform('linux');
    const killSpy = vi.spyOn(process, 'kill');
    try {
      killSpy.mockImplementationOnce(() => {
        const error = new Error('missing group') as NodeJS.ErrnoException;
        error.code = 'ESRCH';
        throw error;
      });

      const runner = new CliSessionRunner('C:/workspace', 'codex', 'bin/cli.mjs');
      await expect(runner.terminate({ pid: 4321 })).resolves.toBe(false);

      killSpy.mockReset();
      killSpy.mockImplementationOnce(() => {
        const error = new Error('group failed') as NodeJS.ErrnoException;
        error.code = 'EPERM';
        throw error;
      });
      killSpy.mockImplementationOnce(() => {
        const error = new Error('missing pid') as NodeJS.ErrnoException;
        error.code = 'ESRCH';
        throw error;
      });

      await expect(runner.terminate({ pid: 4321 })).resolves.toBe(false);
    } finally {
      killSpy.mockRestore();
      restorePlatform();
    }
  });
});
