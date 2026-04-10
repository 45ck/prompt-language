import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { InMemoryCommandRunner } from '../infrastructure/adapters/in-memory-command-runner.js';
import { InMemoryStateStore } from '../infrastructure/adapters/in-memory-state-store.js';
import { FileCaptureReader } from '../infrastructure/adapters/file-capture-reader.js';
import { FileAuditLogger } from '../infrastructure/adapters/file-audit-logger.js';
import { FileMemoryStore } from '../infrastructure/adapters/file-memory-store.js';
import { runFlowHeadless } from './run-flow-headless.js';
import type { PromptTurnResult, PromptTurnRunner } from './ports/prompt-turn-runner.js';

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
});
