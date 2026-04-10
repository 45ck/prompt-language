import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CommandResult, CommandRunner } from '../../application/ports/command-runner.js';
import type { SpawnInput } from '../../application/ports/process-spawner.js';
import type {
  PromptTurnResult,
  PromptTurnRunner,
} from '../../application/ports/prompt-turn-runner.js';

vi.mock('../../application/run-flow-headless.js', () => ({
  runFlowHeadless: vi.fn(),
}));

const { runFlowHeadless } = await import('../../application/run-flow-headless.js');
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

function createCommandRunner(): CommandRunner {
  return {
    run: vi.fn<() => Promise<CommandResult>>().mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
    }),
  };
}

function createPromptTurnRunner(): PromptTurnRunner {
  return {
    run: vi.fn<() => Promise<PromptTurnResult>>().mockResolvedValue({ exitCode: 0 }),
  };
}

async function flushTasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('HeadlessProcessSpawner', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('runs child flows in-process and returns the current pid', async () => {
    vi.mocked(runFlowHeadless).mockResolvedValue({
      finalState: {
        status: 'completed',
        variables: { result: 'done' },
      } as never,
      turns: 0,
    });

    const commandRunner = createCommandRunner();
    const promptTurnRunner = createPromptTurnRunner();
    const spawner = new HeadlessProcessSpawner({
      commandRunner,
      cwd: '/repo/workspace',
      promptTurnRunner,
    });

    const result = await spawner.spawn(makeInput({ variables: { color: 'purple' } }));

    expect(result).toEqual({ pid: process.pid });

    await flushTasks();

    expect(runFlowHeadless).toHaveBeenCalledTimes(1);

    expect(runFlowHeadless).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: '/repo/workspace',
        flowText: expect.stringContaining('let color = "purple"'),
        sessionId: expect.any(String),
      }),
      expect.objectContaining({
        commandRunner,
        processSpawner: spawner,
        promptTurnRunner,
      }),
    );
  });

  it('reports running until the in-process child completes', async () => {
    let resolveChild: ((value: unknown) => void) | undefined;
    vi.mocked(runFlowHeadless).mockReturnValue(
      new Promise((resolve) => {
        resolveChild = resolve;
      }) as never,
    );

    const spawner = new HeadlessProcessSpawner({
      commandRunner: createCommandRunner(),
      cwd: '/repo/workspace',
      promptTurnRunner: createPromptTurnRunner(),
    });

    await spawner.spawn(makeInput());
    await expect(spawner.poll('.prompt-language-worker')).resolves.toEqual({ status: 'running' });

    resolveChild?.({
      finalState: {
        status: 'completed',
        variables: { result: 'done' },
      },
      turns: 0,
    });

    await flushTasks();
    await expect(spawner.poll('.prompt-language-worker')).resolves.toEqual({
      status: 'completed',
      variables: { result: 'done' },
    });
  });

  it('reports failed when the child run rejects', async () => {
    vi.mocked(runFlowHeadless).mockRejectedValue(new Error('boom'));

    const spawner = new HeadlessProcessSpawner({
      commandRunner: createCommandRunner(),
      cwd: '/repo/workspace',
      promptTurnRunner: createPromptTurnRunner(),
    });

    await spawner.spawn(makeInput());

    await flushTasks();
    await expect(spawner.poll('.prompt-language-worker')).resolves.toEqual({ status: 'failed' });
  });

  it('does not support external termination for in-process children', async () => {
    const spawner = new HeadlessProcessSpawner({
      commandRunner: createCommandRunner(),
      cwd: '/repo/workspace',
      promptTurnRunner: createPromptTurnRunner(),
    });

    await expect(spawner.terminate(99)).resolves.toBe(false);
  });
});
