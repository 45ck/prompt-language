import { describe, expect, it, vi } from 'vitest';
import type {
  SpawnedSessionCapabilities,
  SpawnedSessionHandle,
  SpawnedSessionRunner,
  SpawnedSessionSnapshot,
} from './spawned-session-runner.js';
import { RunnerBackedProcessSpawner } from './runner-backed-process-spawner.js';

function makeCapabilities(
  overrides: Partial<SpawnedSessionCapabilities> = {},
): SpawnedSessionCapabilities {
  return {
    externalProcess: true,
    terminate: true,
    cwdOverride: true,
    modelPassThrough: true,
    stateDirPolling: true,
    inProcessExecution: false,
    ...overrides,
  };
}

function makeHandle(overrides: Partial<SpawnedSessionHandle> = {}): SpawnedSessionHandle {
  return {
    runId: 'test-run-id',
    stateDir: '/tmp/state',
    pid: 1234,
    captureMode: 'state-file',
    ...overrides,
  };
}

function makeMockRunner(overrides: Partial<SpawnedSessionRunner> = {}): SpawnedSessionRunner {
  return {
    capabilities: makeCapabilities(),
    launch: vi.fn().mockResolvedValue(makeHandle()),
    poll: vi.fn().mockResolvedValue({ status: 'running' } as SpawnedSessionSnapshot),
    terminate: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('RunnerBackedProcessSpawner', () => {
  it('delegates spawn to runner.launch and returns pid', async () => {
    const runner = makeMockRunner();
    const spawner = new RunnerBackedProcessSpawner(runner);

    const result = await spawner.spawn({
      name: 'child',
      goal: 'test',
      flowText: '  prompt: Hello',
      variables: {},
      stateDir: '/tmp/state',
    });

    expect(result.pid).toBe(1234);
    expect(runner.launch).toHaveBeenCalledOnce();
  });

  it('returns pid 0 when handle has no pid', async () => {
    const runner = makeMockRunner({
      launch: vi.fn().mockResolvedValue(makeHandle({ pid: undefined })),
    });
    const spawner = new RunnerBackedProcessSpawner(runner);

    const result = await spawner.spawn({
      name: 'child',
      goal: 'test',
      flowText: '',
      variables: {},
      stateDir: '/tmp/state',
    });

    expect(result.pid).toBe(0);
  });

  it('delegates poll to runner.poll with stateDir and cached handle', async () => {
    const pollFn = vi.fn().mockResolvedValue({ status: 'completed', variables: { x: '1' } });
    const runner = makeMockRunner({ poll: pollFn });
    const spawner = new RunnerBackedProcessSpawner(runner);

    // Spawn first to cache the handle
    await spawner.spawn({
      name: 'child',
      goal: 'test',
      flowText: '',
      variables: {},
      stateDir: '/tmp/state',
    });

    const status = await spawner.poll('/tmp/state');

    expect(status).toEqual({ status: 'completed', variables: { x: '1' } });
    expect(pollFn).toHaveBeenCalledWith({
      stateDir: '/tmp/state',
      handle: expect.objectContaining({ stateDir: '/tmp/state' }),
    });
  });

  it('polls without handle for unknown stateDir', async () => {
    const pollFn = vi.fn().mockResolvedValue({ status: 'running' });
    const runner = makeMockRunner({ poll: pollFn });
    const spawner = new RunnerBackedProcessSpawner(runner);

    const status = await spawner.poll('/unknown/dir');

    expect(status).toEqual({ status: 'running' });
    expect(pollFn).toHaveBeenCalledWith({
      stateDir: '/unknown/dir',
      handle: undefined,
    });
  });

  it('omits variables from poll result when snapshot has none', async () => {
    const runner = makeMockRunner({
      poll: vi.fn().mockResolvedValue({ status: 'failed' }),
    });
    const spawner = new RunnerBackedProcessSpawner(runner);

    const status = await spawner.poll('/tmp/state');

    expect(status).toEqual({ status: 'failed' });
    expect(status.variables).toBeUndefined();
  });

  it('delegates terminate to runner.terminate with pid and handle lookup', async () => {
    const terminateFn = vi.fn().mockResolvedValue(true);
    const runner = makeMockRunner({ terminate: terminateFn });
    const spawner = new RunnerBackedProcessSpawner(runner);

    // Spawn to cache handle with pid
    await spawner.spawn({
      name: 'child',
      goal: 'test',
      flowText: '',
      variables: {},
      stateDir: '/tmp/state',
    });

    const result = await spawner.terminate(1234);

    expect(result).toBe(true);
    expect(terminateFn).toHaveBeenCalledWith({
      pid: 1234,
      handle: expect.objectContaining({ pid: 1234 }),
      stateDir: '/tmp/state',
    });
  });

  it('returns false when runner has no terminate method', async () => {
    const runner = makeMockRunner();
    delete (runner as unknown as Record<string, unknown>)['terminate'];
    const spawner = new RunnerBackedProcessSpawner(runner);

    const result = await spawner.terminate(1234);

    expect(result).toBe(false);
  });

  it('passes empty stateDir when no handle matches pid', async () => {
    const terminateFn = vi.fn().mockResolvedValue(false);
    const runner = makeMockRunner({ terminate: terminateFn });
    const spawner = new RunnerBackedProcessSpawner(runner);

    const result = await spawner.terminate(9999);

    expect(result).toBe(false);
    expect(terminateFn).toHaveBeenCalledWith({
      pid: 9999,
      handle: undefined,
      stateDir: '',
    });
  });
});
