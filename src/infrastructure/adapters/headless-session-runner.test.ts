import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runFlowHeadlessMock, randomUuidMock } = vi.hoisted(() => ({
  runFlowHeadlessMock: vi.fn(),
  randomUuidMock: vi.fn(),
}));

vi.mock('node:crypto', () => ({
  randomUUID: randomUuidMock,
}));

vi.mock('../../application/run-flow-headless.js', () => ({
  runFlowHeadless: runFlowHeadlessMock,
}));

import { HeadlessSessionRunner } from './headless-session-runner.js';

function createDeferred() {
  let resolve: (value: {
    finalState: {
      status: string;
      variables: Record<string, unknown>;
    };
  }) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<{
    finalState: {
      status: string;
      variables: Record<string, unknown>;
    };
  }>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return {
    promise,
    resolve,
    reject,
  };
}

describe('HeadlessSessionRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    randomUuidMock.mockReturnValue('test-uuid');
  });

  it('advertises in-process capabilities', () => {
    const runner = new HeadlessSessionRunner({
      commandRunner: {} as never,
      cwd: 'C:/workspace',
      promptTurnRunner: {} as never,
    });

    expect(runner.capabilities).toEqual({
      externalProcess: false,
      terminate: false,
      cwdOverride: true,
      modelPassThrough: true,
      stateDirPolling: false,
      inProcessExecution: true,
    });
  });

  it('launches an in-process child and returns completed variables after polling', async () => {
    const deferred = createDeferred();
    runFlowHeadlessMock.mockReturnValue(deferred.promise);

    const runner = new HeadlessSessionRunner({
      auditLogger: { record: vi.fn() } as never,
      captureReader: { readFromText: vi.fn() } as never,
      commandRunner: { run: vi.fn() } as never,
      cwd: 'C:/workspace',
      memoryStore: { append: vi.fn() } as never,
      messageStore: { push: vi.fn() } as never,
      promptTurnRunner: { runPromptTurn: vi.fn() } as never,
    });
    const nestedSpawner = { spawn: vi.fn(), poll: vi.fn(), terminate: vi.fn() } as never;
    runner.setProcessSpawner(nestedSpawner);

    const handle = await runner.launch({
      name: 'child',
      goal: 'Parent goal\nSecond line',
      flowText: '  prompt: Continue',
      variables: {
        quote: 'He said "hi"',
        multiline: 'a\nb',
      },
      stateDir: 'state-a',
      cwd: 'C:/child-workspace',
      model: 'gpt-5.4',
    });

    expect(handle).toEqual({
      runId: 'test-uuid',
      stateDir: 'state-a',
      pid: process.pid,
      captureMode: 'memory',
    });

    await expect(runner.poll({ stateDir: 'missing' })).resolves.toEqual({ status: 'running' });

    deferred.resolve({
      finalState: {
        status: 'completed',
        variables: {
          result: 'ok',
          count: 2,
        },
      },
    });
    await Promise.resolve();
    await Promise.resolve();

    await expect(runner.poll({ stateDir: 'state-a' })).resolves.toEqual({
      status: 'completed',
      variables: {
        result: 'ok',
        count: '2',
      },
    });

    expect(runFlowHeadlessMock).toHaveBeenCalledWith(
      {
        cwd: 'C:/child-workspace',
        flowText: [
          'Goal: Parent goal Second line',
          '',
          'flow:',
          '  let quote = "He said \\"hi\\""',
          '  let multiline = "a\\nb"',
          '',
          '  prompt: Continue',
        ].join('\n'),
        model: 'gpt-5.4',
        sessionId: 'test-uuid',
      },
      expect.objectContaining({
        auditLogger: expect.any(Object),
        captureReader: expect.any(Object),
        commandRunner: expect.any(Object),
        memoryStore: expect.any(Object),
        processSpawner: nestedSpawner,
        promptTurnRunner: expect.any(Object),
        stateStore: expect.any(Object),
      }),
    );
  });

  it('marks child runs failed when headless execution throws and terminate is unsupported', async () => {
    runFlowHeadlessMock.mockRejectedValue(new Error('boom'));

    const runner = new HeadlessSessionRunner({
      commandRunner: { run: vi.fn() } as never,
      cwd: 'C:/workspace',
      promptTurnRunner: { runPromptTurn: vi.fn() } as never,
    });

    await runner.launch({
      name: 'child',
      goal: '',
      flowText: '',
      variables: {},
      stateDir: 'state-b',
    });
    await Promise.resolve();
    await Promise.resolve();

    await expect(runner.poll({ stateDir: 'state-b' })).resolves.toEqual({
      status: 'failed',
    });
    await expect(runner.terminate()).resolves.toBe(false);
  });
});
