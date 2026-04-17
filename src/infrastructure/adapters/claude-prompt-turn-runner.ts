import { spawn, spawnSync } from 'node:child_process';

import type {
  PromptTurnInput,
  PromptTurnResult,
  PromptTurnRunner,
} from '../../application/ports/prompt-turn-runner.js';

const DEFAULT_TIMEOUT_MS = 600_000;
const CLAUDE_TIMEOUT_MS_ENV = 'PROMPT_LANGUAGE_CLAUDE_TIMEOUT_MS';
const CLAUDE_EFFORT_ENV = 'PROMPT_LANGUAGE_CLAUDE_EFFORT';
const VALID_CLAUDE_EFFORTS = new Set(['low', 'medium', 'high']);

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value === '' ? undefined : value;
}

function readPositiveIntEnv(name: string): number | undefined {
  const value = readEnv(name);
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function readClaudeEffort(): string | undefined {
  const value = readEnv(CLAUDE_EFFORT_ENV)?.toLowerCase();
  return value && VALID_CLAUDE_EFFORTS.has(value) ? value : undefined;
}

function claudeLaunchCommand(args: readonly string[]): [string, ...string[]] {
  if (process.platform === 'win32') {
    return ['cmd.exe', '/d', '/s', '/c', 'claude.cmd', ...args];
  }
  return ['claude', ...args];
}

function terminateClaudeProcessTree(child: ReturnType<typeof spawn>): void {
  try {
    child.kill();
  } catch {
    // ignore termination failures
  }

  if (process.platform === 'win32' && child.pid !== undefined) {
    try {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } catch {
      // ignore taskkill failures and rely on the direct kill attempt above
    }
  }

  child.stdin?.destroy();
  child.stdout?.destroy();
  child.stderr?.destroy();
}

export class ClaudePromptTurnRunner implements PromptTurnRunner {
  async run(input: PromptTurnInput): Promise<PromptTurnResult> {
    const args = this.buildArgs(input);
    const timeoutMs = readPositiveIntEnv(CLAUDE_TIMEOUT_MS_ENV) ?? DEFAULT_TIMEOUT_MS;

    return await new Promise<PromptTurnResult>((resolve) => {
      const [command, ...commandArgs] = claudeLaunchCommand(args);
      const child = spawn(command, commandArgs, {
        cwd: input.cwd,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let settled = false;
      let timedOut = false;

      const settle = (result: PromptTurnResult): void => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) clearTimeout(timer);
        resolve(result);
      };

      const buildAssistantText = (): string | undefined => {
        const primary = stdout.trim();
        if (primary.length > 0) return primary;
        const fallback = stderr.trim();
        return fallback.length > 0 ? fallback : undefined;
      };

      const timer =
        timeoutMs > 0
          ? setTimeout(() => {
              timedOut = true;
              terminateClaudeProcessTree(child);
            }, timeoutMs)
          : undefined;

      child.stdout?.setEncoding('utf8');
      child.stdout?.on('data', (chunk: string) => {
        stdout += chunk;
      });

      child.stderr?.setEncoding('utf8');
      child.stderr?.on('data', (chunk: string) => {
        stderr += chunk;
      });

      child.once('error', (error) => {
        stderr += error.message;
        settle({
          exitCode: 1,
          assistantText: buildAssistantText(),
        });
      });

      child.once('close', (code) => {
        if (timedOut) {
          const timeoutMessage = `Claude timed out after ${timeoutMs}ms waiting for output.`;
          const assistantText = [stdout.trim(), stderr.trim(), timeoutMessage]
            .filter(Boolean)
            .join('\n');
          settle({
            exitCode: 124,
            assistantText: assistantText || undefined,
          });
          return;
        }

        settle({
          exitCode: code ?? 1,
          assistantText: buildAssistantText(),
        });
      });

      try {
        child.stdin?.end(input.prompt);
      } catch {
        child.stdin?.destroy();
      }
    });
  }

  buildArgs(input: PromptTurnInput): string[] {
    const args = ['-p', '--dangerously-skip-permissions'];
    if (input.model != null) {
      args.push('--model', input.model);
    }
    const effort = readClaudeEffort();
    if (effort !== undefined) {
      args.push('--effort', effort);
    }
    return args;
  }
}
