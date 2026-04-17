import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { InMemoryCommandRunner } from '../infrastructure/adapters/in-memory-command-runner.js';
import { InMemoryStateStore } from '../infrastructure/adapters/in-memory-state-store.js';
import { FileCaptureReader } from '../infrastructure/adapters/file-capture-reader.js';
import { FileAuditLogger } from '../infrastructure/adapters/file-audit-logger.js';
import { FileMessageStore } from '../infrastructure/adapters/file-message-store.js';
import { FileMemoryStore } from '../infrastructure/adapters/file-memory-store.js';
import { HeadlessProcessSpawner } from '../infrastructure/adapters/headless-process-spawner.js';
import { ShellCommandRunner } from '../infrastructure/adapters/shell-command-runner.js';
import { runFlowHeadless } from './run-flow-headless.js';
import type { CommandResult, CommandRunner, RunOptions } from './ports/command-runner.js';
import type { PromptTurnResult, PromptTurnRunner } from './ports/prompt-turn-runner.js';
import { FLOW_OUTCOME_CODES, RUNTIME_DIAGNOSTIC_CODES } from '../domain/diagnostic-report.js';
import type { SessionState } from '../domain/session-state.js';
import type {
  ChildStatus,
  ProcessSpawner,
  SpawnInput,
  SpawnResult,
} from './ports/process-spawner.js';
import { stringifyVariableValue } from '../domain/variable-value.js';

class RecordingPromptRunner implements PromptTurnRunner {
  readonly prompts: string[] = [];
  readonly calls: { cwd: string; prompt: string; model?: string; scopePrompt?: string }[] = [];

  constructor(
    private readonly effect?: (input: {
      cwd: string;
      prompt: string;
      model?: string;
      scopePrompt?: string;
    }) => Promise<PromptTurnResult | void>,
  ) {}

  async run(input: {
    cwd: string;
    prompt: string;
    model?: string;
    scopePrompt?: string;
  }): Promise<PromptTurnResult> {
    this.prompts.push(input.prompt);
    this.calls.push(input);
    const result = await this.effect?.(input);
    return result ?? { exitCode: 0 };
  }
}

class RecordingStateStore extends InMemoryStateStore {
  readonly savedStates: SessionState[] = [];

  override async save(state: SessionState): Promise<void> {
    this.savedStates.push(state);
    await super.save(state);
  }
}

class SequenceStatusProcessSpawner implements ProcessSpawner {
  private pollIndex = 0;

  constructor(private readonly statuses: readonly ChildStatus[]) {}

  async spawn(_input: SpawnInput): Promise<SpawnResult> {
    return { pid: process.pid };
  }

  async poll(_stateDir: string): Promise<ChildStatus> {
    const status = this.statuses[Math.min(this.pollIndex, this.statuses.length - 1)] ?? {
      status: 'running' as const,
    };
    this.pollIndex += 1;
    return status;
  }
}

class EchoRedirectCommandRunner implements CommandRunner {
  private readonly fallback = new ShellCommandRunner();

  async run(command: string, options?: RunOptions): Promise<CommandResult> {
    const match = /^echo\s+(.+?)\s*>\s*(.+)$/.exec(command.trim());
    if (match == null) {
      return await this.fallback.run(command, options);
    }

    const cwd = options?.cwd ?? process.cwd();
    const value = match[1] ?? '';
    const targetPath = join(cwd, (match[2] ?? '').trim());
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, `${value}\n`, 'utf8');
    return { exitCode: 0, stdout: '', stderr: '' };
  }
}

class ScriptedSpawnProcessSpawner implements ProcessSpawner {
  private readonly children = new Map<string, ChildStatus>();
  private nextPid = 1;

  constructor(private readonly baseCwd: string = process.cwd()) {}

  async spawn(input: SpawnInput): Promise<SpawnResult> {
    const cwd = input.cwd ?? this.baseCwd;
    const childStateDir = isAbsolute(input.stateDir) ? input.stateDir : join(cwd, input.stateDir);
    const variables = Object.fromEntries(
      Object.entries(input.variables).map(([key, value]) => [key, stringifyVariableValue(value)]),
    ) as Record<string, string>;

    for (const rawLine of input.flowText.split('\n')) {
      const line = rawLine.trim();
      if (line.length === 0) {
        continue;
      }

      const letMatch = /^let\s+([A-Za-z0-9_.-]+)\s*=\s*(.+)$/.exec(line);
      if (letMatch != null) {
        variables[letMatch[1] ?? ''] = this.resolveValue(letMatch[2] ?? '', variables);
        continue;
      }

      const returnMatch = /^return\s+(.+)$/.exec(line);
      if (returnMatch != null) {
        variables['__swarm_return'] = this.resolveValue(returnMatch[1] ?? '', variables);
        continue;
      }

      const runMatch = /^run:\s+(.+)$/.exec(line);
      if (runMatch != null) {
        await this.runSimpleCommand(this.resolveValue(runMatch[1] ?? '', variables), cwd);
        continue;
      }

      const sendMatch = /^send\s+(?:"([^"]+)"|([A-Za-z0-9_.-]+))\s+(.+)$/.exec(line);
      if (sendMatch != null) {
        const target = sendMatch[1] ?? sendMatch[2] ?? '';
        const message = this.resolveValue(sendMatch[3] ?? '', variables);
        await new FileMessageStore(childStateDir, {}).send(target, message);
        continue;
      }
    }

    this.children.set(input.stateDir, { status: 'completed', variables });
    return { pid: this.nextPid++ };
  }

  async poll(stateDir: string): Promise<ChildStatus> {
    return this.children.get(stateDir) ?? { status: 'running' };
  }

  private resolveValue(template: string, variables: Readonly<Record<string, string>>): string {
    let value = template.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value.replace(/\$\{([^}]+)\}/g, (_match, name: string) => variables[name] ?? '');
  }

  private async runSimpleCommand(command: string, cwd: string): Promise<void> {
    const echoMatch = /^echo\s+(.+?)\s*>\s*(.+)$/.exec(command.trim());
    if (echoMatch == null) {
      return;
    }

    const targetPath = join(cwd, (echoMatch[2] ?? '').trim());
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, `${echoMatch[1] ?? ''}\n`, 'utf8');
  }
}

function expectedFileExistsCommand(path: string): string {
  return `node -e "process.exit(require('node:fs').existsSync('${path}') ? 0 : 1)"`;
}

describe('runFlowHeadless', () => {
  let tempDir = '';

  afterEach(async () => {
    if (!tempDir) return;
    await rm(tempDir, { recursive: true, force: true });
    tempDir = '';
  });

  async function runWithHeadlessSpawner(
    cwd: string,
    flowText: string,
  ): Promise<{
    readonly promptRunner: RecordingPromptRunner;
    readonly result: Awaited<ReturnType<typeof runFlowHeadless>>;
  }> {
    const commandRunner: CommandRunner = new EchoRedirectCommandRunner();
    const promptRunner = new RecordingPromptRunner();
    const messageStore = new FileMessageStore(join(cwd, '.prompt-language'), {});
    const processSpawner = new ScriptedSpawnProcessSpawner(cwd);

    const result = await runFlowHeadless(
      {
        cwd,
        flowText,
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(cwd),
        captureReader: new FileCaptureReader(cwd),
        commandRunner,
        messageStore,
        memoryStore: new FileMemoryStore(cwd),
        processSpawner,
        promptTurnRunner: promptRunner,
        stateStore: new InMemoryStateStore(),
      },
    );

    return { promptRunner, result };
  }

  it('completes a prompt-driven flow once the gate passes', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-'));
    const commandRunner = new InMemoryCommandRunner();
    commandRunner.setResult(expectedFileExistsCommand('done.txt'), {
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
    expect(result.report.status).toBe('ok');
    expect(result.report.outcomes).toEqual([
      expect.objectContaining({
        code: FLOW_OUTCOME_CODES.completed,
      }),
    ]);
    expect(result.turns).toBe(1);
    expect(promptRunner.prompts).toHaveLength(1);
    expect(promptRunner.prompts[0]).toContain('Create done.txt');
  });

  it('keeps direct prompt nodes awaiting capture until the runner returns', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-prompt-dispatch-'));

    const stateStore = new RecordingStateStore();
    let dispatchState: SessionState | null = null;
    const promptRunner = new RecordingPromptRunner(async () => {
      dispatchState = await stateStore.loadCurrent();
      return { exitCode: 0, madeProgress: true };
    });

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: 'Goal: prompt lifecycle\n\nflow:\n  prompt: Create hello.txt\n',
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner: new InMemoryCommandRunner(),
        memoryStore: new FileMemoryStore(tempDir),
        promptTurnRunner: promptRunner,
        stateStore,
      },
    );

    const promptNodeId = result.finalState.flowSpec.nodes[0]?.id;
    const savedDispatchState = dispatchState;

    expect(promptNodeId).toBeDefined();
    expect(savedDispatchState).not.toBeNull();
    if (promptNodeId == null || savedDispatchState == null) {
      throw new Error('expected prompt node and dispatch state to be recorded');
    }
    const dispatchSnapshot: SessionState = savedDispatchState;
    const promptId: string = promptNodeId;
    expect(dispatchSnapshot.currentNodePath).toEqual([0]);
    expect(dispatchSnapshot.nodeProgress[promptId]).toEqual(
      expect.objectContaining({
        status: 'awaiting_capture',
      }),
    );
    expect(dispatchSnapshot.nodeProgress[promptId]?.completedAt).toBeUndefined();
    expect(result.finalState.nodeProgress[promptId]).toEqual(
      expect.objectContaining({
        status: 'completed',
      }),
    );
    expect(result.finalState.nodeProgress[promptId]?.completedAt).toEqual(expect.any(Number));
    expect(
      stateStore.savedStates.some(
        (savedState) => savedState.nodeProgress[promptNodeId ?? '']?.status === 'awaiting_capture',
      ),
    ).toBe(true);
  });

  it('supports let x = prompt capture flows in headless mode', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-capture-'));
    await mkdir(join(tempDir, '.prompt-language', 'vars'), { recursive: true });

    const commandRunner = new InMemoryCommandRunner();
    commandRunner.setResult(expectedFileExistsCommand('answer.txt'), {
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

  it('applies a longer default timeout to headless run nodes without explicit timeout', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-run-timeout-'));
    const receivedOptions: { cwd?: string; timeoutMs?: number }[] = [];
    const commandRunner = {
      run: async (_command: string, options?: { cwd?: string; timeoutMs?: number }) => {
        receivedOptions.push(options ?? {});
        return {
          exitCode: 0,
          stdout: '',
          stderr: '',
        };
      },
    };

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: 'Goal: run once\n\nflow:\n  run: echo hello\n',
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner,
        memoryStore: new FileMemoryStore(tempDir),
        promptTurnRunner: new RecordingPromptRunner(),
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('completed');
    expect(receivedOptions[0]).toEqual(
      expect.objectContaining({
        cwd: tempDir,
        timeoutMs: 300_000,
      }),
    );
  });

  it('lets an explicit runner model override a profile-selected model', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-profile-model-'));
    await writeFile(
      join(tempDir, 'prompt-language.config.json'),
      JSON.stringify({
        profiles: {
          reviewer: {
            systemPreamble: 'Review carefully.',
            model: 'profile-model',
          },
        },
      }),
      'utf8',
    );

    const promptRunner = new RecordingPromptRunner();

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: 'Goal: inspect\n\nuse profile "reviewer"\n\nflow:\n  prompt: Inspect the diff\n',
        model: 'explicit-model',
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
    expect(promptRunner.calls[0]?.model).toBe('explicit-model');
    expect(promptRunner.prompts[0]).toContain('[Internal — prompt-language context profile]');
    expect(promptRunner.prompts[0]).toContain('Applied profiles: reviewer');
  });

  it('passes the active captured prompt separately as scopePrompt', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-scope-prompt-'));

    const promptRunner = new RecordingPromptRunner(async () => ({
      exitCode: 0,
      madeProgress: true,
    }));

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: [
          'Goal: scope prompt relay',
          '',
          'flow:',
          '  prompt: Edit src/app.js',
          '  prompt: Edit README.md only',
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
    expect(promptRunner.calls).toHaveLength(2);
    expect(promptRunner.calls[1]?.prompt).toContain('Edit src/app.js');
    expect(promptRunner.calls[1]?.prompt).toContain('Edit README.md only');
    expect(promptRunner.calls[1]?.scopePrompt).toBe('Edit README.md only');
  });

  it('returns the persisted PLR-005 reason when capture falls back to empty string', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-capture-fallback-'));
    await mkdir(join(tempDir, '.prompt-language', 'vars'), { recursive: true });

    const promptRunner = new RecordingPromptRunner(async () => ({
      exitCode: 0,
      assistantText: 'Tried to respond without writing the capture file.',
      madeProgress: true,
    }));

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: 'Goal: capture response\n\nflow:\n  let answer = prompt "Say hello"\n',
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
    expect(result.finalState.variables['answer']).toBe('');
    expect(result.reason).toBe(
      "PLR-005 Capture for 'answer' fell back to empty string after 3 attempts. (let answer at line 4, col 3)",
    );
    expect(result.report.status).toBe('ok');
    expect(result.report.diagnostics).toEqual([
      expect.objectContaining({
        code: RUNTIME_DIAGNOSTIC_CODES.captureRetryFallback,
      }),
    ]);
    expect(result.report.outcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: FLOW_OUTCOME_CODES.completed,
        }),
      ]),
    );
    expect(promptRunner.prompts).toHaveLength(3);
  });

  it('finishes prompt-free flows without invoking the model runner', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-run-only-'));

    const commandRunner = new InMemoryCommandRunner();
    commandRunner.setResult('echo ok > done.txt', {
      exitCode: 0,
      stdout: '',
      stderr: '',
    });
    commandRunner.setResult(expectedFileExistsCommand('done.txt'), {
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

  it('does not carry transient gate-failed outcomes into a later completed report', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-gate-only-recovery-'));

    const promptRunner = new RecordingPromptRunner(async ({ cwd }) => {
      await writeFile(join(cwd, 'done.txt'), 'ok', 'utf8');
      return { exitCode: 0, madeProgress: true };
    });
    const commandRunner = {
      run: async (command: string) => {
        if (command !== expectedFileExistsCommand('done.txt')) {
          return { exitCode: 1, stdout: '', stderr: `unexpected command: ${command}` };
        }
        return {
          exitCode: existsSync(join(tempDir, 'done.txt')) ? 0 : 1,
          stdout: '',
          stderr: '',
        };
      },
    };

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: 'Goal: recover\n\ndone when:\n  file_exists done.txt\n',
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
    expect(result.report.status).toBe('ok');
    expect(result.report.outcomes).toEqual([
      expect.objectContaining({
        code: FLOW_OUTCOME_CODES.completed,
      }),
    ]);
  });

  it('fails gate-only flows when the prompt runner reports no observable progress', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-gate-only-no-progress-'));
    await writeFile(join(tempDir, 'app.js'), 'process.exit(1)\n', 'utf8');
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ name: 'gate-only-no-progress-test', scripts: { test: 'node app.js' } }),
      'utf8',
    );

    const promptRunner = new RecordingPromptRunner(async () => ({
      exitCode: 0,
      assistantText: 'I inspected the failure but did not change the workspace.',
      madeProgress: false,
    }));
    const commandRunner = {
      run: async (command: string) => {
        if (command !== 'npm test') {
          return { exitCode: 1, stdout: '', stderr: `unexpected command: ${command}` };
        }
        return { exitCode: 1, stdout: '', stderr: '' };
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

    expect(result.finalState.status).toBe('active');
    expect(result.turns).toBe(1);
    expect(result.reason).toBe(
      'Prompt runner completed without observable workspace progress. Last assistant output: I inspected the failure but did not change the workspace.',
    );
    expect(result.report.status).toBe('failed');
    expect(promptRunner.prompts).toHaveLength(1);
  });

  it('fails gate-only flows when the prompt runner exits non-zero', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-gate-only-exit-code-'));
    await writeFile(join(tempDir, 'app.js'), 'process.exit(1)\n', 'utf8');
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ name: 'gate-only-exit-code-test', scripts: { test: 'node app.js' } }),
      'utf8',
    );

    const promptRunner = new RecordingPromptRunner(async () => ({
      exitCode: 7,
      assistantText: 'The runner aborted before applying the fix.',
    }));
    const commandRunner = {
      run: async (command: string) => {
        if (command !== 'npm test') {
          return { exitCode: 1, stdout: '', stderr: `unexpected command: ${command}` };
        }
        return { exitCode: 1, stdout: '', stderr: '' };
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

    expect(result.finalState.status).toBe('failed');
    expect(result.turns).toBe(1);
    expect(result.reason).toBe(
      'Prompt runner exited with code 7. The runner aborted before applying the fix.',
    );
    expect(result.finalState.failureReason).toBe(
      'Prompt runner exited with code 7. The runner aborted before applying the fix.',
    );
    expect(result.report.status).toBe('failed');
    expect(promptRunner.prompts).toHaveLength(1);
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
    expect(result.report.status).toBe('unsuccessful');
    expect(result.report.outcomes).toEqual([
      expect.objectContaining({
        code: FLOW_OUTCOME_CODES.budgetExhausted,
      }),
    ]);
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

    expect(result.finalState.status).toBe('failed');
    expect(result.turns).toBe(1);
    expect(result.reason).toBe('Prompt runner exited with code 42.');
    expect(result.finalState.failureReason).toBe('Prompt runner exited with code 42.');
  });

  it('includes assistant detail when the prompt runner exits non-zero', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-exit-code-detail-'));

    const promptRunner = new RecordingPromptRunner(async () => ({
      exitCode: 9,
      assistantText: 'Runner aborted after writing partial output.',
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

    expect(result.finalState.status).toBe('failed');
    expect(result.turns).toBe(1);
    expect(result.reason).toBe(
      'Prompt runner exited with code 9. Runner aborted after writing partial output.',
    );
    expect(result.finalState.failureReason).toBe(
      'Prompt runner exited with code 9. Runner aborted after writing partial output.',
    );
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
    commandRunner.setResult(expectedFileExistsCommand('done.txt'), {
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

    expect(result.finalState.status).toBe('failed');
    expect(result.turns).toBe(1);
    expect(result.reason).toContain(
      'Completion gates failed: file_exists done.txt. Fix the failing checks before completing the task.',
    );
    expect(result.finalState.failureReason).toContain(
      'Completion gates failed: file_exists done.txt. Fix the failing checks before completing the task.',
    );
    expect(result.report.status).toBe('unsuccessful');
    expect(result.report.outcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: FLOW_OUTCOME_CODES.gateFailed,
        }),
      ]),
    );
    expect(result.reason).toContain('Made a partial change');
  });

  it('omits assistant-detail suffixes when final prompt gates stay blocked and assistant text is empty', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-gate-blocked-empty-'));
    const commandRunner = new InMemoryCommandRunner();
    commandRunner.setResult(expectedFileExistsCommand('done.txt'), {
      exitCode: 1,
      stdout: '',
      stderr: '',
    });

    const promptRunner = new RecordingPromptRunner(async ({ cwd }) => {
      await writeFile(join(cwd, 'notes.txt'), 'partial', 'utf8');
      return {
        exitCode: 0,
        assistantText: '   \n\t   ',
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

    expect(result.finalState.status).toBe('failed');
    expect(result.reason).toBe(
      'Completion gates failed: file_exists done.txt. Fix the failing checks before completing the task.',
    );
    expect(result.finalState.failureReason).toBe(
      'Completion gates failed: file_exists done.txt. Fix the failing checks before completing the task.',
    );
    expect(result.report.status).toBe('unsuccessful');
  });

  it('returns the classified runtime diagnostic when gate evaluation crashes', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-gate-crash-'));

    const promptRunner = new RecordingPromptRunner(async () => ({
      exitCode: 0,
      assistantText: 'Tried to make progress.',
      madeProgress: true,
    }));

    const crashingRunner = {
      run: async () => {
        throw new Error('gate runner offline');
      },
    };

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
        commandRunner: crashingRunner,
        memoryStore: new FileMemoryStore(tempDir),
        promptTurnRunner: promptRunner,
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('active');
    expect(result.turns).toBe(1);
    expect(result.reason).toBe('Gate evaluation crashed: gate runner offline');
    expect(result.report.status).toBe('failed');
    expect(result.report.diagnostics).toEqual([
      expect.objectContaining({
        code: RUNTIME_DIAGNOSTIC_CODES.gateEvaluationCrashed,
      }),
    ]);
  });

  it('returns the classified runtime diagnostic when post-run completion evaluation crashes', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-run-only-gate-crash-'));

    const crashingRunner = {
      run: async (command: string) => {
        if (command === 'echo ok > done.txt') {
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        throw new Error(`gate runner offline for ${command}`);
      },
    };

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
        commandRunner: crashingRunner,
        memoryStore: new FileMemoryStore(tempDir),
        promptTurnRunner: new RecordingPromptRunner(),
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('active');
    expect(result.turns).toBe(0);
    expect(result.reason).toBe(
      "Gate evaluation crashed: gate runner offline for node -e \"process.exit(require('node:fs').existsSync('done.txt') ? 0 : 1)\"",
    );
    expect(result.report.status).toBe('failed');
    expect(result.report.diagnostics).toEqual([
      expect.objectContaining({
        code: RUNTIME_DIAGNOSTIC_CODES.gateEvaluationCrashed,
      }),
    ]);
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

  it('keeps polling when spawned children stay running across two snapshots before completing', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-pause-repeat-'));

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: [
          'Goal: pause twice',
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
    const messageStore = new FileMessageStore(join(tempDir, '.prompt-language'), {});
    const processSpawner = new HeadlessProcessSpawner({
      auditLogger: new FileAuditLogger(tempDir),
      captureReader: new FileCaptureReader(tempDir),
      commandRunner,
      cwd: tempDir,
      messageStore,
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
        messageStore,
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

  it('receives child messages without an explicit await in headless mode', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-message-'));

    const commandRunner = new ShellCommandRunner();
    const promptRunner = new RecordingPromptRunner();
    const messageStore = new FileMessageStore(join(tempDir, '.prompt-language'), {});
    const processSpawner = new ScriptedSpawnProcessSpawner(tempDir);

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: [
          'Goal: child message',
          '',
          'flow:',
          '  spawn "worker"',
          '    send parent "hello-from-worker"',
          '  end',
          '  receive msg from "worker" timeout 30',
          "  run: node -e \"require('node:fs').writeFileSync('received.txt', '${msg}')\"",
        ].join('\n'),
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner,
        messageStore,
        memoryStore: new FileMemoryStore(tempDir),
        processSpawner,
        promptTurnRunner: promptRunner,
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('completed');
    await expect(readFile(join(tempDir, 'received.txt'), 'utf8')).resolves.toContain(
      'hello-from-worker',
    );
  }, 60_000);

  it('imports spawned child variables back into the parent namespace in headless mode', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-spawn-vars-'));

    const commandRunner = new ShellCommandRunner();
    const promptRunner = new RecordingPromptRunner();
    const messageStore = new FileMessageStore(join(tempDir, '.prompt-language'), {});
    const processSpawner = new HeadlessProcessSpawner({
      auditLogger: new FileAuditLogger(tempDir),
      captureReader: new FileCaptureReader(tempDir),
      commandRunner,
      cwd: tempDir,
      messageStore,
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
        messageStore,
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

  it('keeps manager-worker swarm runtime equivalent to the explicit lowered orchestration', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-swarm-manager-worker-'));
    const authoredDir = join(tempDir, 'authored');
    const explicitDir = join(tempDir, 'explicit');
    await mkdir(authoredDir);
    await mkdir(explicitDir);

    const swarmFlow = [
      'Goal: manager worker equivalence',
      '',
      'flow:',
      '  swarm delivery',
      '    role worker',
      '      run: echo worker-ready > worker-note.txt',
      `      return '{"status":"ready","artifact":"worker-note.txt"}'`,
      '    end',
      '    flow:',
      '      start worker',
      '      await all',
      '    end',
      '  end',
      '  run: echo ${delivery.worker.returned} > manager-returned.json',
      '  run: echo ${delivery.worker.status} > manager-status.txt',
    ].join('\n');
    const explicitFlow = [
      'Goal: manager worker equivalence',
      '',
      'flow:',
      '  spawn "worker"',
      '    let __swarm_id = "delivery"',
      '    let __swarm_role = "worker"',
      '    run: echo worker-ready > worker-note.txt',
      `    let __swarm_return = '{"status":"ready","artifact":"worker-note.txt"}'`,
      '    send parent "${__swarm_return}"',
      '  end',
      '  await "worker"',
      '  receive __delivery_worker_returned from "worker" timeout 30',
      '  run: echo ${delivery.worker.returned} > manager-returned.json',
      '  run: echo ${delivery.worker.status} > manager-status.txt',
    ].join('\n');

    const authored = await runWithHeadlessSpawner(authoredDir, swarmFlow);
    const explicit = await runWithHeadlessSpawner(explicitDir, explicitFlow);

    expect(authored.promptRunner.prompts).toHaveLength(0);
    expect(explicit.promptRunner.prompts).toHaveLength(0);
    expect(authored.result.finalState.status).toBe('completed');
    expect(explicit.result.finalState.status).toBe('completed');
    expect(authored.result.finalState.variables['delivery.worker.returned']).toEqual(
      explicit.result.finalState.variables['delivery.worker.returned'],
    );
    expect(authored.result.finalState.variables['delivery.worker.result']).toEqual(
      explicit.result.finalState.variables['delivery.worker.result'],
    );
    await expect(readFile(join(authoredDir, 'manager-returned.json'), 'utf8')).resolves.toBe(
      await readFile(join(explicitDir, 'manager-returned.json'), 'utf8'),
    );
    await expect(readFile(join(authoredDir, 'manager-status.txt'), 'utf8')).resolves.toBe(
      await readFile(join(explicitDir, 'manager-status.txt'), 'utf8'),
    );
    await expect(readFile(join(authoredDir, 'worker-note.txt'), 'utf8')).resolves.toBe(
      await readFile(join(explicitDir, 'worker-note.txt'), 'utf8'),
    );
  }, 60_000);

  it('keeps reviewer-after-workers swarm runtime equivalent to the explicit lowered orchestration', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-swarm-review-chain-'));
    const authoredDir = join(tempDir, 'authored');
    const explicitDir = join(tempDir, 'explicit');
    await mkdir(authoredDir);
    await mkdir(explicitDir);

    const swarmFlow = [
      'Goal: reviewer after workers equivalence',
      '',
      'flow:',
      '  swarm review_pass',
      '    role frontend',
      '      run: echo frontend-ready > frontend.txt',
      '      return "frontend-ready"',
      '    end',
      '    role backend',
      '      run: echo backend-ready > backend.txt',
      '      return "backend-ready"',
      '    end',
      '    role reviewer',
      '      run: echo ${frontend_result}+${backend_result} > review.txt',
      '      return ${frontend_result}-${backend_result}',
      '    end',
      '    flow:',
      '      start frontend, backend',
      '      await all',
      '      let frontend_result = ${review_pass.frontend.returned}',
      '      let backend_result = ${review_pass.backend.returned}',
      '      start reviewer',
      '      await reviewer',
      '    end',
      '  end',
      '  run: echo ${review_pass.reviewer.returned} > summary.txt',
    ].join('\n');
    const explicitFlow = [
      'Goal: reviewer after workers equivalence',
      '',
      'flow:',
      '  spawn "frontend"',
      '    let __swarm_id = "review_pass"',
      '    let __swarm_role = "frontend"',
      '    run: echo frontend-ready > frontend.txt',
      '    let __swarm_return = "frontend-ready"',
      '    send parent "${__swarm_return}"',
      '  end',
      '  spawn "backend"',
      '    let __swarm_id = "review_pass"',
      '    let __swarm_role = "backend"',
      '    run: echo backend-ready > backend.txt',
      '    let __swarm_return = "backend-ready"',
      '    send parent "${__swarm_return}"',
      '  end',
      '  await "frontend"',
      '  receive __review_pass_frontend_returned from "frontend" timeout 30',
      '  await "backend"',
      '  receive __review_pass_backend_returned from "backend" timeout 30',
      '  let frontend_result = ${review_pass.frontend.returned}',
      '  let backend_result = ${review_pass.backend.returned}',
      '  spawn "reviewer"',
      '    let __swarm_id = "review_pass"',
      '    let __swarm_role = "reviewer"',
      '    run: echo ${frontend_result}+${backend_result} > review.txt',
      '    let __swarm_return = ${frontend_result}-${backend_result}',
      '    send parent "${__swarm_return}"',
      '  end',
      '  await "reviewer"',
      '  receive __review_pass_reviewer_returned from "reviewer" timeout 30',
      '  run: echo ${review_pass.reviewer.returned} > summary.txt',
    ].join('\n');

    const authored = await runWithHeadlessSpawner(authoredDir, swarmFlow);
    const explicit = await runWithHeadlessSpawner(explicitDir, explicitFlow);

    expect(authored.promptRunner.prompts).toHaveLength(0);
    expect(explicit.promptRunner.prompts).toHaveLength(0);
    expect(authored.result.finalState.status).toBe('completed');
    expect(explicit.result.finalState.status).toBe('completed');
    expect(authored.result.finalState.variables['review_pass.reviewer.returned']).toEqual(
      explicit.result.finalState.variables['review_pass.reviewer.returned'],
    );
    expect(authored.result.finalState.variables['review_pass.reviewer.status']).toEqual(
      explicit.result.finalState.variables['review_pass.reviewer.status'],
    );
    expect(authored.result.finalState.variables['review_pass.reviewer.returned']).toBe(
      'frontend-ready-backend-ready',
    );
    await expect(readFile(join(authoredDir, 'review.txt'), 'utf8')).resolves.toBe(
      await readFile(join(explicitDir, 'review.txt'), 'utf8'),
    );
    await expect(readFile(join(authoredDir, 'summary.txt'), 'utf8')).resolves.toBe(
      await readFile(join(explicitDir, 'summary.txt'), 'utf8'),
    );
    await expect(readFile(join(authoredDir, 'review.txt'), 'utf8')).resolves.toContain(
      'frontend-ready+backend-ready',
    );
  }, 60_000);

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

  it('executes a deterministic 10+ node nested flow end-to-end in headless mode', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pl-headless-long-nested-'));

    const promptRunner = new RecordingPromptRunner(async ({ cwd }) => {
      const trace = await readFile(join(cwd, 'trace.txt'), 'utf8');
      await writeFile(join(cwd, 'summary.txt'), trace, 'utf8');
      return { exitCode: 0, madeProgress: true };
    });

    const result = await runFlowHeadless(
      {
        cwd: tempDir,
        flowText: [
          'Goal: nested long flow',
          '',
          'flow:',
          '  let items = "alpha beta"',
          '  foreach item in ${items}',
          `    run: node -e "require('node:fs').appendFileSync('trace.txt', 'enter-${'${item}'}\\n')"`,
          '    try',
          '      if ${item} == "alpha"',
          '        retry max 2',
          `          run: node -e "require('node:fs').appendFileSync('trace.txt', 'alpha-retry-${'${item}'}\\n')"`,
          '        end',
          '        foreach phase in "plan apply"',
          `          run: node -e "require('node:fs').appendFileSync('trace.txt', '${'${item}'}-${'${phase}'}\\n')"`,
          '        end',
          '      else',
          '        retry max 2',
          '          foreach phase in "verify cleanup"',
          `            run: node -e "require('node:fs').appendFileSync('trace.txt', '${'${item}'}-${'${phase}'}\\n')"`,
          '          end',
          '        end',
          '      end',
          '    finally',
          `      run: node -e "require('node:fs').appendFileSync('trace.txt', 'finally-${'${item}'}\\n')"`,
          '    end',
          `    run: node -e "require('node:fs').appendFileSync('trace.txt', 'after-${'${item}'}\\n')"`,
          '  end',
          '  prompt: Copy trace.txt into summary.txt exactly',
          '',
          'done when:',
          '  file_exists summary.txt',
        ].join('\n'),
        sessionId: randomUUID(),
      },
      {
        auditLogger: new FileAuditLogger(tempDir),
        captureReader: new FileCaptureReader(tempDir),
        commandRunner: new ShellCommandRunner(),
        memoryStore: new FileMemoryStore(tempDir),
        promptTurnRunner: promptRunner,
        stateStore: new InMemoryStateStore(),
      },
    );

    expect(result.finalState.status).toBe('completed');
    expect(result.turns).toBe(1);
    expect(promptRunner.prompts).toHaveLength(1);
    await expect(readFile(join(tempDir, 'trace.txt'), 'utf8')).resolves.toBe(
      [
        'enter-alpha',
        'alpha-retry-alpha',
        'alpha-plan',
        'alpha-apply',
        'finally-alpha',
        'after-alpha',
        'enter-beta',
        'beta-verify',
        'beta-cleanup',
        'finally-beta',
        'after-beta',
        '',
      ].join('\n'),
    );
    await expect(readFile(join(tempDir, 'summary.txt'), 'utf8')).resolves.toBe(
      [
        'enter-alpha',
        'alpha-retry-alpha',
        'alpha-plan',
        'alpha-apply',
        'finally-alpha',
        'after-alpha',
        'enter-beta',
        'beta-verify',
        'beta-cleanup',
        'finally-beta',
        'after-beta',
        '',
      ].join('\n'),
    );
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
