import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type {
  ChildStatus,
  ProcessSpawner,
  SpawnInput,
  SpawnResult,
} from '../../application/ports/process-spawner.js';

interface HeadlessProcessSpawnerOptions {
  readonly cliPath: string;
  readonly cwd?: string | undefined;
  readonly model?: string | undefined;
  readonly runner: 'ollama' | 'opencode';
}

function buildChildFlow(input: SpawnInput): string {
  const varLines = Object.entries(input.variables)
    .map(
      ([key, value]) =>
        `  let ${key} = "${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`,
    )
    .join('\n');

  const varBlock = varLines ? `\n${varLines}\n` : '\n';
  return `Goal: ${input.goal}\n\nflow:${varBlock}${input.flowText}`;
}

function resolveStateDir(baseCwd: string, stateDir: string): string {
  return isAbsolute(stateDir) ? stateDir : join(baseCwd, stateDir);
}

export class HeadlessProcessSpawner implements ProcessSpawner {
  private readonly cliPath: string;
  private readonly cwd: string;
  private readonly model?: string | undefined;
  private readonly runner: 'ollama' | 'opencode';
  private readonly stateDirRoots = new Map<string, string>();

  constructor(options: HeadlessProcessSpawnerOptions) {
    this.cliPath = options.cliPath;
    this.cwd = options.cwd ?? process.cwd();
    this.model = options.model;
    this.runner = options.runner;
  }

  async spawn(input: SpawnInput): Promise<SpawnResult> {
    const childCwd = input.cwd ?? this.cwd;
    const stateDirRoot = resolveStateDir(childCwd, input.stateDir);
    const flowPath = join(stateDirRoot, 'spawn.flow');

    await mkdir(stateDirRoot, { recursive: true });
    await writeFile(flowPath, buildChildFlow(input), 'utf8');
    this.stateDirRoots.set(input.stateDir, stateDirRoot);

    const args = [this.cliPath, 'ci', '--runner', this.runner, '--state-dir', input.stateDir];
    const model = input.model ?? this.model;
    if (model !== undefined) {
      args.push('--model', model);
    }
    args.push('--file', flowPath);

    const child = spawn(process.execPath, args, {
      cwd: childCwd,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });

    child.unref();

    return { pid: child.pid ?? 0 };
  }

  async poll(stateDir: string): Promise<ChildStatus> {
    const stateRoot = this.stateDirRoots.get(stateDir) ?? resolveStateDir(this.cwd, stateDir);
    const statePath = join(stateRoot, 'session-state.json');
    try {
      const raw = await readFile(statePath, 'utf-8');
      const state = JSON.parse(raw) as { status?: string; variables?: Record<string, string> };
      const vars = state.variables ?? undefined;

      if (state.status === 'completed') {
        return { status: 'completed', variables: vars };
      }
      if (state.status === 'failed' || state.status === 'cancelled') {
        return { status: 'failed', variables: vars };
      }
      return { status: 'running' };
    } catch {
      return { status: 'running' };
    }
  }

  async terminate(pid: number): Promise<boolean> {
    try {
      if (process.platform === 'win32') {
        execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
        return true;
      }

      process.kill(-pid, 'SIGTERM');
      return true;
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ESRCH') return false;

      try {
        process.kill(pid, 'SIGTERM');
        return true;
      } catch (fallbackError: unknown) {
        const fallback = fallbackError as NodeJS.ErrnoException;
        if (fallback.code === 'ESRCH') return false;
        throw fallbackError;
      }
    }
  }
}
