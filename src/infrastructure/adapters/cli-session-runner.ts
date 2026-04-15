/**
 * CliSessionRunner — SpawnedSessionRunner implementation that launches
 * child flows via `prompt-language run --runner <name>`.
 *
 * Extracted from CliProcessSpawner. Used when PL_SPAWN_RUNNER is set
 * to a non-Claude runner (codex, opencode, ollama, aider).
 */

import { randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringifyVariableValue } from '../../domain/variable-value.js';
import type {
  SpawnedSessionCapabilities,
  SpawnedSessionHandle,
  SpawnedSessionRequest,
  SpawnedSessionRunner,
  SpawnedSessionSnapshot,
} from './spawned-session-runner.js';

export class CliSessionRunner implements SpawnedSessionRunner {
  readonly capabilities: SpawnedSessionCapabilities = {
    externalProcess: true,
    terminate: true,
    cwdOverride: true,
    modelPassThrough: true,
    stateDirPolling: true,
    inProcessExecution: false,
  };

  private readonly cwd: string;
  private readonly runner: string;
  private readonly cliPath: string;

  constructor(cwd: string, runner: string, cliPath: string) {
    this.cwd = cwd;
    this.runner = runner;
    this.cliPath = cliPath;
  }

  async launch(request: SpawnedSessionRequest): Promise<SpawnedSessionHandle> {
    if (!/^[\w-]+$/.test(request.name)) {
      throw new Error(
        `Invalid spawn name "${request.name}" — only alphanumeric characters, hyphens, and underscores are allowed`,
      );
    }

    const flowText = this.buildChildFlow(request);
    const childCwd = request.cwd ?? this.cwd;

    const flowFile = join(childCwd, `${request.stateDir}-flow.txt`);
    writeFileSync(flowFile, flowText, 'utf-8');

    const args = [
      this.cliPath,
      'run',
      '--runner',
      this.runner,
      '--state-dir',
      request.stateDir,
      '--file',
      flowFile,
    ];

    if (request.model) {
      args.push('--model', request.model);
    }

    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      PROMPT_LANGUAGE_STATE_DIR: request.stateDir,
      PL_SPAWN_NAME: request.name,
    };
    if (process.env['PL_RUN_ID']) childEnv['PL_RUN_ID'] = process.env['PL_RUN_ID'];
    if (process.env['PL_TRACE']) childEnv['PL_TRACE'] = process.env['PL_TRACE'];
    if (process.env['PL_TRACE_DIR']) childEnv['PL_TRACE_DIR'] = process.env['PL_TRACE_DIR'];

    const child = spawn('node', args, {
      cwd: childCwd,
      stdio: 'ignore',
      detached: true,
      env: childEnv,
    });

    child.unref();

    const pid = child.pid ?? 0;
    return {
      runId: randomUUID(),
      stateDir: request.stateDir,
      pid: pid || undefined,
      captureMode: 'state-file',
    };
  }

  async poll(ref: Readonly<{ readonly stateDir: string }>): Promise<SpawnedSessionSnapshot> {
    const statePath = join(ref.stateDir, 'session-state.json');
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

  private buildChildFlow(input: SpawnedSessionRequest): string {
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
