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
import { HeadlessSessionRunner } from './headless-session-runner.js';
import { RunnerBackedProcessSpawner } from './runner-backed-process-spawner.js';

/**
 * Runs spawned child flows inside the current Node process for headless runners.
 * This keeps Codex/OpenCode/Ollama CI flows deterministic without depending on
 * a second authenticated external CLI session for child work.
 *
 * Delegates to HeadlessSessionRunner via RunnerBackedProcessSpawner.
 */
export class HeadlessProcessSpawner implements ProcessSpawner {
  private readonly delegate: RunnerBackedProcessSpawner;
  private readonly runner: HeadlessSessionRunner;

  constructor(deps: {
    readonly auditLogger?: AuditLogger | undefined;
    readonly captureReader?: CaptureReader | undefined;
    readonly commandRunner: CommandRunner;
    readonly cwd: string;
    readonly memoryStore?: MemoryStore | undefined;
    readonly messageStore?: MessageStore | undefined;
    readonly promptTurnRunner: PromptTurnRunner;
  }) {
    this.runner = new HeadlessSessionRunner(deps);
    this.delegate = new RunnerBackedProcessSpawner(this.runner);
    // Wire self-referential spawn for nested children
    this.runner.setProcessSpawner(this);
  }

  async spawn(input: SpawnInput): Promise<SpawnResult> {
    return this.delegate.spawn(input);
  }

  async poll(stateDir: string): Promise<ChildStatus> {
    return this.delegate.poll(stateDir);
  }

  async terminate(pid: number): Promise<boolean> {
    return this.delegate.terminate(pid);
  }
}
