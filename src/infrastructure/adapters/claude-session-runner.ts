/**
 * ClaudeSessionRunner — SpawnedSessionRunner implementation that launches
 * external `claude -p` processes for spawn nodes.
 *
 * Extracted from ClaudeProcessSpawner. All Claude-specific launch, poll,
 * and terminate logic lives here behind the provider-neutral contract.
 */

import { randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringifyVariableValue } from '../../domain/variable-value.js';
import { resolveStateRoot } from './resolve-state-root.js';
import type {
  SpawnedSessionCapabilities,
  SpawnedSessionHandle,
  SpawnedSessionRequest,
  SpawnedSessionRunner,
  SpawnedSessionSnapshot,
} from './spawned-session-runner.js';

export class ClaudeSessionRunner implements SpawnedSessionRunner {
  readonly capabilities: SpawnedSessionCapabilities = {
    externalProcess: true,
    terminate: true,
    cwdOverride: true,
    modelPassThrough: true,
    stateDirPolling: true,
    inProcessExecution: false,
  };

  private readonly cwd: string;

  constructor(cwd?: string) {
    this.cwd = cwd ?? process.cwd();
  }

  /** Validate spawn name: alphanumeric, hyphens, and underscores only. */
  static isValidSpawnName(name: string): boolean {
    return /^[\w-]+$/.test(name);
  }

  async launch(request: SpawnedSessionRequest): Promise<SpawnedSessionHandle> {
    if (!ClaudeSessionRunner.isValidSpawnName(request.name)) {
      throw new Error(
        `Invalid spawn name "${request.name}" — only alphanumeric characters, hyphens, and underscores are allowed`,
      );
    }

    if (request.model?.trim() === '') {
      throw new Error(
        `Invalid model name for spawn "${request.name}" — model must be a non-empty string`,
      );
    }

    const prompt = this.buildChildPrompt(request);
    const childCwd = request.cwd ?? this.cwd;
    const resolvedStateDir = resolveStateRoot(childCwd, request.stateDir);
    const modelArgs: string[] = request.model !== undefined ? ['--model', request.model] : [];

    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      PROMPT_LANGUAGE_STATE_DIR: resolvedStateDir,
      PL_SPAWN_NAME: request.name,
    };
    if (process.env['PL_RUN_ID']) childEnv['PL_RUN_ID'] = process.env['PL_RUN_ID'];
    if (process.env['PL_TRACE']) childEnv['PL_TRACE'] = process.env['PL_TRACE'];
    if (process.env['PL_TRACE_DIR']) childEnv['PL_TRACE_DIR'] = process.env['PL_TRACE_DIR'];

    const child = spawn('claude', ['-p', '--dangerously-skip-permissions', ...modelArgs, prompt], {
      cwd: childCwd,
      stdio: 'ignore',
      detached: true,
      env: childEnv,
    });

    child.unref();

    const pid = child.pid ?? 0;
    return {
      runId: randomUUID(),
      stateDir: resolvedStateDir,
      pid: pid || undefined,
      captureMode: 'state-file',
    };
  }

  async poll(
    ref: Readonly<{
      readonly stateDir: string;
      readonly handle?: SpawnedSessionHandle | undefined;
    }>,
  ): Promise<SpawnedSessionSnapshot> {
    const stateRoot = ref.handle?.stateDir ?? resolveStateRoot(this.cwd, ref.stateDir);
    const statePath = join(stateRoot, 'session-state.json');
    try {
      const raw = await readFile(statePath, 'utf-8');
      const state = JSON.parse(raw) as {
        status?: string;
        variables?: Record<string, string>;
      };
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

  async terminate(ref: Readonly<{ readonly pid?: number | undefined }>): Promise<boolean> {
    const pid = ref.pid;
    if (pid === undefined || pid === 0) return false;

    try {
      if (process.platform === 'win32') {
        execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
          stdio: 'ignore',
        });
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

  private buildChildPrompt(input: SpawnedSessionRequest): string {
    const sanitizedGoal = input.goal.replace(/[\r\n]+/g, ' ').trim();

    const varLines = Object.entries(input.variables)
      .map(
        ([k, v]) =>
          `  let ${k} = "${stringifyVariableValue(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`,
      )
      .join('\n');

    const varBlock = varLines ? `\n${varLines}\n` : '';

    return `Goal: ${sanitizedGoal}\n\nflow:${varBlock}\n${input.flowText}`;
  }
}
