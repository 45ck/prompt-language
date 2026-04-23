/**
 * HeadlessSessionRunner — SpawnedSessionRunner implementation that runs
 * child flows in-process via runFlowHeadless().
 *
 * Extracted from HeadlessProcessSpawner. Non-resumable across parent
 * process restart; if the ephemeral handle is lost, poll reports 'running'.
 */

import { randomUUID } from 'node:crypto';

import { runFlowHeadless } from '../../application/run-flow-headless.js';
import type { AuditLogger } from '../../application/ports/audit-logger.js';
import type { CaptureReader } from '../../application/ports/capture-reader.js';
import type { CommandRunner } from '../../application/ports/command-runner.js';
import type { MemoryStore } from '../../application/ports/memory-store.js';
import type { MessageStore } from '../../application/ports/message-store.js';
import type { ProcessSpawner } from '../../application/ports/process-spawner.js';
import type { PromptTurnRunner } from '../../application/ports/prompt-turn-runner.js';
import type { VariableStore, VariableValue } from '../../domain/variable-value.js';
import { stringifyVariableValue } from '../../domain/variable-value.js';
import { FileMessageStore } from './file-message-store.js';
import { InMemoryStateStore } from './in-memory-state-store.js';
import { resolveStateRoot } from './resolve-state-root.js';
import type {
  SpawnedSessionCapabilities,
  SpawnedSessionHandle,
  SpawnedSessionRequest,
  SpawnedSessionRunner,
  SpawnedSessionSnapshot,
} from './spawned-session-runner.js';

interface HeadlessChildRecord {
  status: SpawnedSessionSnapshot['status'];
  task: Promise<void>;
  variables?: Readonly<Record<string, string>> | undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeLiteral(value: VariableValue): string {
  return stringifyVariableValue(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

function buildChildFlow(input: SpawnedSessionRequest): string {
  const sanitizedGoal = input.goal.replace(/[\r\n]+/g, ' ').trim() || `Sub-task: ${input.name}`;
  const varLines = Object.entries(input.variables).map(
    ([key, value]) => `  let ${key} = "${escapeLiteral(value)}"`,
  );

  const lines = [`Goal: ${sanitizedGoal}`, '', 'flow:'];
  lines.push(...varLines);

  if (varLines.length > 0 && input.flowText.trim() !== '') {
    lines.push('');
  }

  if (input.flowText.trim() !== '') {
    lines.push(...input.flowText.split('\n'));
  }

  return lines.join('\n');
}

function stringifyVariables(variables: VariableStore): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [key, stringifyVariableValue(value)]),
  );
}

export class HeadlessSessionRunner implements SpawnedSessionRunner {
  readonly capabilities: SpawnedSessionCapabilities = {
    externalProcess: false,
    terminate: false,
    cwdOverride: true,
    modelPassThrough: true,
    stateDirPolling: false,
    inProcessExecution: true,
  };

  private readonly children = new Map<string, HeadlessChildRecord>();

  constructor(
    private readonly deps: {
      readonly auditLogger?: AuditLogger | undefined;
      readonly captureReader?: CaptureReader | undefined;
      readonly commandRunner: CommandRunner;
      readonly cwd: string;
      readonly memoryStore?: MemoryStore | undefined;
      readonly messageStore?: MessageStore | undefined;
      readonly promptTurnRunner: PromptTurnRunner;
      /**
       * ProcessSpawner used for nested spawns within headless children.
       * Set after construction via setProcessSpawner() to break the
       * circular dependency (HeadlessSessionRunner -> RunnerBacked -> HeadlessSessionRunner).
       */
      processSpawner?: ProcessSpawner | undefined;
    },
  ) {}

  /** Allow late-binding the process spawner for nested spawn support. */
  setProcessSpawner(spawner: ProcessSpawner): void {
    (this.deps as { processSpawner?: ProcessSpawner }).processSpawner = spawner;
  }

  async launch(request: SpawnedSessionRequest): Promise<SpawnedSessionHandle> {
    const child: HeadlessChildRecord = {
      status: 'running',
      task: Promise.resolve(),
    };
    this.children.set(request.stateDir, child);
    child.task = this.runChild(request);

    return {
      runId: randomUUID(),
      stateDir: request.stateDir,
      pid: process.pid,
      captureMode: 'memory',
    };
  }

  async poll(
    ref: Readonly<{
      readonly stateDir: string;
      readonly handle?: SpawnedSessionHandle | undefined;
    }>,
  ): Promise<SpawnedSessionSnapshot> {
    const child = this.children.get(ref.stateDir);
    if (!child) return { status: 'running' };

    if (child.status === 'running') {
      await Promise.race([child.task, sleep(100)]);
    }

    return child.variables != null
      ? { status: child.status, variables: child.variables }
      : { status: child.status };
  }

  async terminate(): Promise<boolean> {
    return false;
  }

  private async runChild(input: SpawnedSessionRequest): Promise<void> {
    const child = this.children.get(input.stateDir);
    if (!child) return;

    try {
      const childCwd = input.cwd ?? this.deps.cwd;
      const childStateDir = resolveStateRoot(childCwd, input.stateDir);
      const childMessageStore =
        this.deps.messageStore instanceof FileMessageStore
          ? new FileMessageStore(childStateDir, {})
          : this.deps.messageStore;
      const result = await runFlowHeadless(
        {
          cwd: childCwd,
          flowText: buildChildFlow(input),
          ...(input.model != null ? { model: input.model } : {}),
          sessionId: randomUUID(),
        },
        {
          auditLogger: this.deps.auditLogger,
          captureReader: this.deps.captureReader,
          commandRunner: this.deps.commandRunner,
          memoryStore: this.deps.memoryStore,
          messageStore: childMessageStore,
          processSpawner: this.deps.processSpawner,
          promptTurnRunner: this.deps.promptTurnRunner,
          stateStore: new InMemoryStateStore(),
          stateDir: childStateDir,
        },
      );

      child.status = result.finalState.status === 'completed' ? 'completed' : 'failed';
      child.variables = stringifyVariables(result.finalState.variables);
    } catch {
      child.status = 'failed';
      child.variables = undefined;
    }
  }
}
