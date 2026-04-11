/**
 * ClaudeProcessSpawner — spawns child `claude -p` processes for spawn nodes.
 *
 * Each child gets an isolated state directory (.prompt-language-{name}/)
 * and runs as a separate Claude session with its own flow definition.
 */

import { execFileSync, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  ProcessSpawner,
  SpawnInput,
  SpawnResult,
  ChildStatus,
} from '../../application/ports/process-spawner.js';
import { stringifyVariableValue } from '../../domain/variable-value.js';

export class ClaudeProcessSpawner implements ProcessSpawner {
  private readonly cwd: string;

  constructor(cwd?: string) {
    this.cwd = cwd ?? process.cwd();
  }

  /** Validate spawn name: alphanumeric, hyphens, and underscores only. */
  static isValidSpawnName(name: string): boolean {
    return /^[\w-]+$/.test(name);
  }

  async spawn(input: SpawnInput): Promise<SpawnResult> {
    if (!ClaudeProcessSpawner.isValidSpawnName(input.name)) {
      throw new Error(
        `Invalid spawn name "${input.name}" — only alphanumeric characters, hyphens, and underscores are allowed`,
      );
    }

    if (input.model?.trim() === '') {
      throw new Error(
        `Invalid model name for spawn "${input.name}" — model must be a non-empty string`,
      );
    }

    const prompt = this.buildChildPrompt(input);

    // H-INT-005: Use spawn-level cwd if specified, otherwise fall back to instance cwd
    const childCwd = input.cwd ?? this.cwd;

    // beads: prompt-language-2j9v — pass --model when specified
    const modelArgs: string[] = input.model !== undefined ? ['--model', input.model] : [];

    const child = spawn('claude', ['-p', '--dangerously-skip-permissions', ...modelArgs, prompt], {
      cwd: childCwd,
      stdio: 'ignore',
      detached: true,
      env: {
        ...process.env,
        PROMPT_LANGUAGE_STATE_DIR: input.stateDir,
      },
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
      // State file doesn't exist yet or is unreadable — child still starting
      return { status: 'running' };
    }
  }

  async terminate(pid: number): Promise<boolean> {
    try {
      if (process.platform === 'win32') {
        // Windows does not support signaling detached process groups by negative PID.
        execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
        return true;
      }

      // Detached child processes become their own process group on POSIX.
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

  private buildChildPrompt(input: SpawnInput): string {
    // Sanitize goal: collapse newlines to spaces to prevent prompt injection
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
