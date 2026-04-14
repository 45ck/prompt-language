/**
 * CliProcessSpawner — spawns child flows via `prompt-language run --runner <name>`.
 *
 * Used when PL_SPAWN_RUNNER is set to a non-Claude runner. Writes the child
 * flow to a temp file and launches `node bin/cli.mjs run --runner <runner>
 * --state-dir <dir> --file <flow-file>` as a detached process.
 *
 * Poll and terminate behavior is identical to ClaudeProcessSpawner since
 * both write state to the same `.prompt-language-<name>/` directory.
 */

import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  ChildStatus,
  ProcessSpawner,
  SpawnInput,
  SpawnResult,
} from '../../application/ports/process-spawner.js';
import { stringifyVariableValue } from '../../domain/variable-value.js';

export class CliProcessSpawner implements ProcessSpawner {
  private readonly cwd: string;
  private readonly runner: string;
  private readonly cliPath: string;

  constructor(cwd: string, runner: string, cliPath: string) {
    this.cwd = cwd;
    this.runner = runner;
    this.cliPath = cliPath;
  }

  async spawn(input: SpawnInput): Promise<SpawnResult> {
    if (!/^[\w-]+$/.test(input.name)) {
      throw new Error(
        `Invalid spawn name "${input.name}" — only alphanumeric characters, hyphens, and underscores are allowed`,
      );
    }

    const flowText = this.buildChildFlow(input);
    const childCwd = input.cwd ?? this.cwd;

    // Write flow to a temp file in the state dir so it persists for the child
    const flowFile = join(childCwd, `${input.stateDir}-flow.txt`);
    writeFileSync(flowFile, flowText, 'utf-8');

    const args = [
      this.cliPath,
      'run',
      '--runner',
      this.runner,
      '--state-dir',
      input.stateDir,
      '--file',
      flowFile,
    ];

    if (input.model) {
      args.push('--model', input.model);
    }

    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      PROMPT_LANGUAGE_STATE_DIR: input.stateDir,
      PL_SPAWN_NAME: input.name,
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
    return { pid };
  }

  async poll(stateDir: string): Promise<ChildStatus> {
    const statePath = join(stateDir, 'session-state.json');
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

  private buildChildFlow(input: SpawnInput): string {
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
