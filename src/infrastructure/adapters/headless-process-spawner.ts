import { randomUUID } from 'node:crypto';

import { runFlowHeadless } from '../../application/run-flow-headless.js';
import type { AuditLogger } from '../../application/ports/audit-logger.js';
import type { CaptureReader } from '../../application/ports/capture-reader.js';
import type { CommandRunner } from '../../application/ports/command-runner.js';
import type { MemoryStore } from '../../application/ports/memory-store.js';
import type { MessageStore } from '../../application/ports/message-store.js';
import type {
  ChildStatus,
  ProcessSpawner,
  SpawnInput,
  SpawnResult,
} from '../../application/ports/process-spawner.js';
import type { PromptTurnRunner } from '../../application/ports/prompt-turn-runner.js';
import { InMemoryStateStore } from './in-memory-state-store.js';

interface HeadlessChildRecord {
  status: ChildStatus['status'];
  task: Promise<void>;
  variables?: Readonly<Record<string, string>> | undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeLiteral(value: string | number | boolean): string {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function buildChildFlow(input: SpawnInput): string {
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

function stringifyVariables(
  variables: Readonly<Record<string, string | number | boolean>>,
): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.entries(variables).map(([key, value]) => [key, String(value)]));
}

/**
 * Runs spawned child flows inside the current Node process for headless runners.
 * This keeps Codex/OpenCode/Ollama CI flows deterministic without depending on
 * a second authenticated external CLI session for child work.
 */
export class HeadlessProcessSpawner implements ProcessSpawner {
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
    },
  ) {}

  async spawn(input: SpawnInput): Promise<SpawnResult> {
    const child: HeadlessChildRecord = {
      status: 'running',
      task: Promise.resolve(),
    };
    this.children.set(input.stateDir, child);
    child.task = this.runChild(input);

    // Headless children run in-process, so there is no separate OS PID. Reuse
    // the current process PID so await liveness checks treat the child as alive
    // until poll() reports a terminal status.
    return { pid: process.pid };
  }

  async poll(stateDir: string): Promise<ChildStatus> {
    const child = this.children.get(stateDir);
    if (!child) return { status: 'running' };

    if (child.status === 'running') {
      await Promise.race([child.task, sleep(100)]);
    }

    return child.variables != null
      ? { status: child.status, variables: child.variables }
      : { status: child.status };
  }

  async terminate(_pid: number): Promise<boolean> {
    return false;
  }

  private async runChild(input: SpawnInput): Promise<void> {
    const child = this.children.get(input.stateDir);
    if (!child) return;

    try {
      const result = await runFlowHeadless(
        {
          cwd: input.cwd ?? this.deps.cwd,
          flowText: buildChildFlow(input),
          ...(input.model != null ? { model: input.model } : {}),
          sessionId: randomUUID(),
        },
        {
          auditLogger: this.deps.auditLogger,
          captureReader: this.deps.captureReader,
          commandRunner: this.deps.commandRunner,
          memoryStore: this.deps.memoryStore,
          // Child-to-parent send/receive can be layered on top later with a
          // child-scoped message-store adapter. Headless spawn/await does not
          // require it for the current shipped path.
          processSpawner: this,
          promptTurnRunner: this.deps.promptTurnRunner,
          stateStore: new InMemoryStateStore(),
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
