import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { InMemoryCommandRunner } from '../infrastructure/adapters/in-memory-command-runner.js';
import { InMemoryStateStore } from '../infrastructure/adapters/in-memory-state-store.js';
import { FileCaptureReader } from '../infrastructure/adapters/file-capture-reader.js';
import { FileAuditLogger } from '../infrastructure/adapters/file-audit-logger.js';
import { HeadlessProcessSpawner } from '../infrastructure/adapters/headless-process-spawner.js';
import { FileMemoryStore } from '../infrastructure/adapters/file-memory-store.js';
import { ShellCommandRunner } from '../infrastructure/adapters/shell-command-runner.js';
import { runFlowHeadless } from './run-flow-headless.js';
import type { PromptTurnResult, PromptTurnRunner } from './ports/prompt-turn-runner.js';
import type {
  ChildStatus,
  ProcessSpawner,
  SpawnInput,
  SpawnResult,
} from './ports/process-spawner.js';

class RecordingPromptRunner implements PromptTurnRunner {
  readonly prompts: string[] = [];

  constructor(
    private readonly effect?: (input: {
      cwd: string;
      prompt: string;
      model?: string;
    }) => Promise<PromptTurnResult | void>,
  ) {}

  async run(input: { cwd: string; prompt: string; model?: string }): Promise<PromptTurnResult> {
    this.prompts.push(input.prompt);
    const result = await this.effect?.(input);
    return result ?? { exitCode: 0 };
  }
}

class SequenceStatusProcessSpawner implements ProcessSpawner {
  private pollIndex = 0;

  constructor(private readonly statuses: readonly ChildStatus[]) {}

  async spawn(_input: SpawnInput): Promise<SpawnResult> {
    return { pid: 1234 };
  }

  async poll(_stateDir: string): Promise<ChildStatus> {
    const status = this.statuses[Math.min(this.pollIndex, this.statuses.length - 1)] ?? {
      status: 'running' as const,
    };
    this.pollIndex += 1;
    return status;
  }
}

describe('runFlowHeadless', () => {
  let tempDir = '';

  afterEach(async () => {
    if (!tempDir) return;
    await rm(tempDir, { recursive: true, force: true });
    tempDir = '';
  });

  it('completes a prompt-driven flow once the gate passes', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-'));
    const commandRunner = new InMemoryCommandRunner();
    commandRunner.setResult("test -f 'done.txt'", {
      exitCode: 0,
      stdout: '',
      stderr: '',
    });

    const promptRunner = new RecordingPromptRunner(async ({ cwd }) => {
      await writeFile(join(cwd, 'done.txt'), 'ok', 'utf8');
    });

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText:
          'Goal: create file\n\nflow:\n  prompt: Create done.txt\n\ndone when:\n  file_exists done.txt\n',
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner,
        memoryStore: new FileMemoryStore(tempDir),
        promptTurnRunner: promptRunner,
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('completed');
    expect(result.turns).toBe(1);
    expect(promptRunner.prompts).toHaveLength(1);
    expect(promptRunner.prompts[0]).toContain('Create done.txt');
  });

  it('supports let x = prompt capture flows in headless mode', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-capture-'));
    await mkdir(join(tempDir, '.prompt-language', 'vars'), { recursive: true });

    const commandRunner = new InMemoryCommandRunner();
    commandRunner.setResult("test -f 'answer.txt'", {
      exitCode: 0,
      stdout: '',
      stderr: '',
    });

    const promptRunner = new RecordingPromptRunner(async ({ cwd }) => {
      await writeFile(
        join(cwd, '.prompt-language', 'vars', 'answer'),
        'hello from capture',
        'utf8',
      );
    });

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText:
          'Goal: capture response\n\nflow:\n  let answer = prompt "Say hello"\n  run: printf "%s" "${answer}" > answer.txt\n\ndone when:\n  file_exists answer.txt\n',
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner,
        memoryStore: new FileMemoryStore(tempDir),
        promptTurnRunner: promptRunner,
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('completed');
    expect(result.turns).toBe(1);
    expect(promptRunner.prompts[0]).toContain('Say hello');
  });

  it('finishes prompt-free flows without invoking the model runner', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-run-only-'));

    const commandRunner = new InMemoryCommandRunner();
    commandRunner.setResult('echo ok > done.txt', {
      exitCode: 0,
      stdout: '',
      stderr: '',
    });
    commandRunner.setResult("test -f 'done.txt'", {
      exitCode: 0,
      stdout: '',
      stderr: '',
    });

    const promptRunner = new RecordingPromptRunner();

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText:
          'Goal: run only\n\nflow:\n  run: echo ok > done.txt\n\ndone when:\n  file_exists done.txt\n',
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner,
        memoryStore: new FileMemoryStore(tempDir),
        promptTurnRunner: promptRunner,
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('completed');
    expect(result.turns).toBe(0);
    expect(promptRunner.prompts).toHaveLength(0);
  });

  it('prompts for gate-only flows before re-evaluating completion gates', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-gate-only-'));
    await writeFile(join(tempDir, 'app.js'), 'process.exit(1)\n', 'utf8');
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ name: 'gate-only-test', scripts: { test: 'node app.js' } }),
      'utf8',
    );

    const promptRunner = new RecordingPromptRunner(async ({ cwd }) => {
      await writeFile(join(cwd, 'app.js'), 'process.exit(0)\n', 'utf8');
      return { exitCode: 0, madeProgress: true };
    });
    const commandRunner = {
      run: async (command: string) => {
        if (command !== 'npm test') {
          return { exitCode: 1, stdout: '', stderr: `unexpected command: ${command}` };
        }
        const app = await import('node:fs/promises').then((fs) =>
          fs.readFile(join(tempDir, 'app.js'), 'utf8'),
        );
        return app.includes('process.exit(0)')
          ? { exitCode: 0, stdout: '', stderr: '' }
          : { exitCode: 1, stdout: '', stderr: '' };
      },
    };

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: 'Fix app.js so it exits 0 instead of 1.\n\ndone when:\n  tests_pass\n',
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner,
        memoryStore: new FileMemoryStore(tempDir),
        promptTurnRunner: promptRunner,
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('completed');
    expect(result.turns).toBe(1);
    expect(promptRunner.prompts).toHaveLength(1);
    expect(promptRunner.prompts[0]).toContain('Fix app.js so it exits 0 instead of 1.');
    expect(promptRunner.prompts[0]).toContain('done when:');
  });

  it('executes the final prompt before completing a multi-prompt flow', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-final-prompt-'));

    let promptCount = 0;
    const promptRunner = new RecordingPromptRunner(async ({ cwd }) => {
      promptCount += 1;
      if (promptCount === 1) {
        await writeFile(join(cwd, 'secret.txt'), 'magic-unicorn-42', 'utf8');
        return { exitCode: 0, madeProgress: true };
      }

      await writeFile(join(cwd, 'answer.txt'), 'magic-unicorn-42', 'utf8');
      return { exitCode: 0, madeProgress: true };
    });

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: [
          'Goal: context test',
          '',
          'flow:',
          '  prompt: Create secret.txt containing exactly "magic-unicorn-42"',
          '  prompt: Read secret.txt and write its contents to answer.txt',
        ].join('\n'),
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner: new InMemoryCommandRunner(),
        memoryStore: new FileMemoryStore(tempDir),
        promptTurnRunner: promptRunner,
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('completed');
    expect(result.turns).toBe(2);
    expect(promptRunner.prompts).toHaveLength(2);
  });

  it('stops when the prompt runner reports no observable progress and work remains', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-no-progress-'));

    const promptRunner = new RecordingPromptRunner(async () => ({
      exitCode: 0,
      assistantText: 'I can certainly generate the content you requested.',
      madeProgress: false,
    }));

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: [
          'Goal: no-op',
          '',
          'flow:',
          '  prompt: Create secret.txt containing exactly hello',
          '  prompt: Read secret.txt and write its contents to answer.txt',
        ].join('\n'),
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner: new InMemoryCommandRunner(),
        memoryStore: new FileMemoryStore(tempDir),
        promptTurnRunner: promptRunner,
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('active');
    expect(result.turns).toBe(1);
    expect(result.reason).toContain('without observable workspace progress');
  });

  it('does not mark a final prompt node complete when the runner reports no observable progress', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-final-no-progress-'));

    const promptRunner = new RecordingPromptRunner(async () => ({
      exitCode: 0,
      assistantText: 'OK',
      madeProgress: false,
    }));

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: ['Goal: final no-op', '', 'flow:', '  prompt: Create hello.txt'].join('\n'),
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner: new InMemoryCommandRunner(),
        memoryStore: new FileMemoryStore(tempDir),
        promptTurnRunner: promptRunner,
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('active');
    expect(result.turns).toBe(1);
    expect(result.reason).toContain('without observable workspace progress');
  });

  it('returns a max-turns reason before invoking the model when the limit is exceeded', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-max-turns-'));

    const promptRunner = new RecordingPromptRunner();

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: ['Goal: max turns', '', 'flow:', '  prompt: Create done.txt'].join('\n'),
        maxTurns: 0,
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner: new InMemoryCommandRunner(),
        memoryStore: new FileMemoryStore(tempDir),
        promptTurnRunner: promptRunner,
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('active');
    expect(result.turns).toBe(1);
    expect(result.reason).toContain('max turn limit');
    expect(promptRunner.prompts).toHaveLength(0);
  });

  it('returns a prompt-runner exit-code reason when the model invocation fails', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-exit-code-'));

    const promptRunner = new RecordingPromptRunner(async () => ({
      exitCode: 42,
    }));

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: ['Goal: exit code', '', 'flow:', '  prompt: Create done.txt'].join('\n'),
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner: new InMemoryCommandRunner(),
        memoryStore: new FileMemoryStore(tempDir),
        promptTurnRunner: promptRunner,
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('active');
    expect(result.turns).toBe(1);
    expect(result.reason).toBe('Prompt runner exited with code 42.');
  });

  it('uses the generic no-progress reason when assistant text is empty', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-no-progress-empty-'));

    const promptRunner = new RecordingPromptRunner(async () => ({
      exitCode: 0,
      assistantText: '   \n\t   ',
      madeProgress: false,
    }));

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: [
          'Goal: no-op empty text',
          '',
          'flow:',
          '  prompt: Create secret.txt containing exactly hello',
          '  prompt: Read secret.txt and write its contents to answer.txt',
        ].join('\n'),
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner: new InMemoryCommandRunner(),
        memoryStore: new FileMemoryStore(tempDir),
        promptTurnRunner: promptRunner,
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('active');
    expect(result.turns).toBe(1);
    expect(result.reason).toBe('Prompt runner completed without observable workspace progress.');
  });

  it('fails cleanly when the final prompt turn leaves completion gates blocked', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-gate-blocked-'));
    const commandRunner = new InMemoryCommandRunner();
    commandRunner.setResult("test -f 'done.txt'", {
      exitCode: 1,
      stdout: '',
      stderr: '',
    });

    const promptRunner = new RecordingPromptRunner(async ({ cwd }) => {
      await writeFile(join(cwd, 'notes.txt'), 'partial', 'utf8');
      return {
        exitCode: 0,
        assistantText: 'Made a partial change but the required file was not created.',
        madeProgress: true,
      };
    });

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText:
          'Goal: create file\n\nflow:\n  prompt: Create done.txt\n\ndone when:\n  file_exists done.txt\n',
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner,
        memoryStore: new FileMemoryStore(tempDir),
        promptTurnRunner: promptRunner,
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('active');
    expect(result.turns).toBe(1);
    expect(result.reason).toContain(
      'Completion gates remained blocked after the final prompt turn.',
    );
    expect(result.reason).toContain('Made a partial change');
  });

  it('returns paused when spawned children are still running', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-pause-'));

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: [
          'Goal: pause',
          '',
          'flow:',
          '  spawn "worker"',
          '    prompt: Create worker.txt',
          '  end',
          '  await all',
        ].join('\n'),
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner: new InMemoryCommandRunner(),
        memoryStore: new FileMemoryStore(tempDir),
        processSpawner: new SequenceStatusProcessSpawner([{ status: 'running' }]),
        promptTurnRunner: new RecordingPromptRunner(),
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('active');
    expect(result.turns).toBe(0);
    expect(result.reason).toBe('Flow paused before reaching completion.');
  });

  it('keeps polling spawned children until they complete', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-pause-'));

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: [
          'Goal: pause',
          '',
          'flow:',
          '  spawn "worker"',
          '    prompt: Create worker.txt',
          '  end',
          '  await all',
        ].join('\n'),
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner: new InMemoryCommandRunner(),
        memoryStore: new FileMemoryStore(tempDir),
        processSpawner: new SequenceStatusProcessSpawner([
          { status: 'running' },
          { status: 'completed' },
        ]),
        promptTurnRunner: new RecordingPromptRunner(),
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('completed');
    expect(result.turns).toBe(0);
  });

  it('executes spawned child work in headless mode and resumes the parent flow', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-spawn-child-'));

    const commandRunner = new ShellCommandRunner();
    const promptRunner = new RecordingPromptRunner();
    const processSpawner = new HeadlessProcessSpawner({
      auditLogger: new FileAuditLogger(tempDir),
      captureReader: new FileCaptureReader(tempDir),
      commandRunner,
      cwd: tempDir,
      memoryStore: new FileMemoryStore(tempDir),
      promptTurnRunner: promptRunner,
    });

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: [
          'Goal: spawn child',
          '',
          'flow:',
          '  spawn "worker"',
          '    run: echo child-output > worker-result.txt',
          '  end',
          '  await "worker"',
          '  run: echo parent-done > parent-marker.txt',
        ].join('\n'),
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner,
        memoryStore: new FileMemoryStore(tempDir),
        processSpawner,
        promptTurnRunner: promptRunner,
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('completed');
    expect(promptRunner.prompts).toHaveLength(0);
    await expect(readFile(join(tempDir, 'worker-result.txt'), 'utf8')).resolves.toContain(
      'child-output',
    );
    await expect(readFile(join(tempDir, 'parent-marker.txt'), 'utf8')).resolves.toContain(
      'parent-done',
    );
  });

  it('imports spawned child variables back into the parent namespace in headless mode', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-spawn-vars-'));

    const commandRunner = new ShellCommandRunner();
    const promptRunner = new RecordingPromptRunner();
    const processSpawner = new HeadlessProcessSpawner({
      auditLogger: new FileAuditLogger(tempDir),
      captureReader: new FileCaptureReader(tempDir),
      commandRunner,
      cwd: tempDir,
      memoryStore: new FileMemoryStore(tempDir),
      promptTurnRunner: promptRunner,
    });

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: [
          'Goal: spawn variable passing',
          '',
          'flow:',
          '  let color = "purple"',
          '  spawn "painter"',
          '    run: echo ${color} > painted.txt',
          '    let result = run "echo painted-${color}"',
          '  end',
          '  await "painter"',
          '  run: echo ${painter.result} > spawn-var.txt',
        ].join('\n'),
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner,
        memoryStore: new FileMemoryStore(tempDir),
        processSpawner,
        promptTurnRunner: promptRunner,
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('completed');
    expect(result.finalState.variables['painter.result']).toBe('painted-purple');
    await expect(readFile(join(tempDir, 'painted.txt'), 'utf8')).resolves.toContain('purple');
    await expect(readFile(join(tempDir, 'spawn-var.txt'), 'utf8')).resolves.toContain(
      'painted-purple',
    );
  });

  it('completes multi-step run-only flows without invoking the model', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-advance-continue-'));

    const commandRunner = new InMemoryCommandRunner();
    commandRunner.setResult('echo one > one.txt', { exitCode: 0, stdout: '', stderr: '' });
    commandRunner.setResult('echo two > two.txt', { exitCode: 0, stdout: '', stderr: '' });

    const promptRunner = new RecordingPromptRunner();

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: [
          'Goal: run chain',
          '',
          'flow:',
          '  run: echo one > one.txt',
          '  run: echo two > two.txt',
        ].join('\n'),
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner,
        memoryStore: new FileMemoryStore(tempDir),
        promptTurnRunner: promptRunner,
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('completed');
    expect(result.turns).toBe(0);
    expect(promptRunner.prompts).toHaveLength(0);
  });

  it('runs shell commands in the flow workspace instead of the repo cwd', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-cwd-'));

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: [
          'Goal: workspace cwd',
          '',
          'flow:',
          "  run: node -e \"require('node:fs').writeFileSync('cwd.txt', process.cwd())\"",
        ].join('\n'),
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner: new ShellCommandRunner(),
        memoryStore: new FileMemoryStore(tempDir),
        promptTurnRunner: new RecordingPromptRunner(),
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('completed');
    await expect(readFile(join(tempDir, 'cwd.txt'), 'utf8')).resolves.toBe(tempDir);
  });

  it('executes only the selected if branch for prompt nodes', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-if-prompt-'));

    let promptCount = 0;
    const promptRunner = new RecordingPromptRunner(async ({ cwd }) => {
      promptCount += 1;
      await writeFile(join(cwd, 'branch.txt'), promptCount === 1 ? 'then-branch' : 'else-branch');
      return { exitCode: 0, madeProgress: true };
    });

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: [
          'Goal: if prompt branch',
          '',
          'flow:',
          '  let flag = "yes"',
          '  if ${flag} == "yes"',
          '    prompt: Write then branch',
          '  else',
          '    prompt: Write else branch',
          '  end',
        ].join('\n'),
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner: new InMemoryCommandRunner(),
        memoryStore: new FileMemoryStore(tempDir),
        promptTurnRunner: promptRunner,
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('completed');
    expect(promptCount).toBe(1);
    await expect(readFile(join(tempDir, 'branch.txt'), 'utf8')).resolves.toBe('then-branch');
  });

  it('executes only the selected if branch for run-only conditions', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-if-run-'));

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: [
          'Goal: if run branch',
          '',
          'flow:',
          '  let a = "yes"',
          '  let b = "yes"',
          '  run: node -e "process.exit(0)"',
          '  if command_succeeded and ${a} == "yes"',
          '    run: echo and-pass > and-result.txt',
          '  else',
          '    run: echo and-fail > and-result.txt',
          '  end',
          '  if ${a} == "no" or ${b} == "yes"',
          '    run: echo or-pass > or-result.txt',
          '  else',
          '    run: echo or-fail > or-result.txt',
          '  end',
        ].join('\n'),
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner: new ShellCommandRunner(),
        memoryStore: new FileMemoryStore(tempDir),
        promptTurnRunner: new RecordingPromptRunner(),
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('completed');
    await expect(readFile(join(tempDir, 'and-result.txt'), 'utf8')).resolves.toContain('and-pass');
    await expect(readFile(join(tempDir, 'or-result.txt'), 'utf8')).resolves.toContain('or-pass');
  });
});
