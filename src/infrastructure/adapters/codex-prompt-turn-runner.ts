import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import type {
  PromptTurnInput,
  PromptTurnResult,
  PromptTurnRunner,
} from '../../application/ports/prompt-turn-runner.js';

const DEFAULT_TIMEOUT_MS = 600_000;
const CODEX_TIMEOUT_MS_ENV = 'PROMPT_LANGUAGE_CODEX_TIMEOUT_MS';

function quotePowerShellArg(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildCodexPowerShellCommand(args: readonly string[]): string {
  return `& codex ${args.map(quotePowerShellArg).join(' ')}`;
}

function readPositiveIntEnv(name: string): number | undefined {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function resolveWindowsCodexCommandPrefix(): [string, string[]] {
  try {
    const result = spawnSync('where.exe', ['codex.cmd'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    const shimPath = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (result.status === 0 && shimPath) {
      const shimDir = dirname(shimPath);
      const bundledNode = join(shimDir, 'node.exe');
      const entrypoint = join(shimDir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
      if (existsSync(entrypoint)) {
        return [existsSync(bundledNode) ? bundledNode : 'node', [entrypoint]];
      }
    }
  } catch {
    // Fall back to the PowerShell launcher below.
  }

  return ['powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command']];
}

function codexBinaryCommand(...args: string[]): [string, ...string[]] {
  if (process.platform !== 'win32') {
    return ['codex', ...args];
  }

  const [command, prefixArgs] = resolveWindowsCodexCommandPrefix();
  if (command === 'powershell') {
    return [command, ...prefixArgs, buildCodexPowerShellCommand(args)];
  }
  return [command, ...prefixArgs, ...args];
}

function terminateCodexProcessTree(child: ReturnType<typeof spawn>): void {
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

function readAssistantText(outputFile: string, fallback?: string): string | undefined {
  try {
    return readFileSync(outputFile, 'utf-8').trim() || undefined;
  } catch {
    return fallback?.trim() ?? undefined;
  }
}

export function buildCodexPrompt(prompt: string): string {
  return [
    'You are executing a prompt-language flow step, not doing open-ended coding.',
    'Treat the text below as the active workflow state and current instruction.',
    'Rules:',
    '- Work directly in the current workspace when the instruction requires file or repository changes.',
    '- Do not stop after describing what you would do. Perform the requested edits, reads, and checks now.',
    '- Preserve exact fixture strings, filenames, and file contents from the workflow. Do not redact, mask, or paraphrase them.',
    '- If a step says a file must contain an exact value, write that exact value with no extra text.',
    '- Prefer minimal changes that satisfy the current step.',
    '- After completing the step, reply with one short line only.',
    '',
    prompt,
  ].join('\n');
}

export class CodexPromptTurnRunner implements PromptTurnRunner {
  async run(input: PromptTurnInput): Promise<PromptTurnResult> {
    const outputFile = join(
      tmpdir(),
      `codex-last-message-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`,
    );
    const args = this.buildArgs(input, outputFile);
    const timeoutMs = readPositiveIntEnv(CODEX_TIMEOUT_MS_ENV) ?? DEFAULT_TIMEOUT_MS;
    const [command, ...commandArgs] = codexBinaryCommand(...args);

    return await new Promise<PromptTurnResult>((resolve) => {
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
        try {
          resolve(result);
        } finally {
          try {
            rmSync(outputFile, { force: true });
          } catch {
            // ignore cleanup failures
          }
        }
      };

      const buildResult = (exitCode: number): PromptTurnResult => {
        const fallback = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
        return {
          exitCode,
          assistantText: readAssistantText(outputFile, fallback),
        };
      };

      const timer =
        timeoutMs > 0
          ? setTimeout(() => {
              timedOut = true;
              terminateCodexProcessTree(child);
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
        settle(buildResult(1));
      });

      child.once('close', (code) => {
        if (timedOut) {
          const timedOutMessage = `Codex timed out after ${timeoutMs}ms waiting for output.`;
          const fallback = [stdout.trim(), stderr.trim(), timedOutMessage]
            .filter(Boolean)
            .join('\n');
          settle({
            exitCode: 124,
            assistantText: readAssistantText(outputFile, fallback),
          });
          return;
        }

        settle(buildResult(code ?? 1));
      });

      try {
        child.stdin?.end(buildCodexPrompt(input.prompt));
      } catch {
        child.stdin?.destroy();
      }
    });
  }

  buildArgs(input: PromptTurnInput, outputFile: string): string[] {
    const args = [
      'exec',
      '--dangerously-bypass-approvals-and-sandbox',
      '--skip-git-repo-check',
      '--output-last-message',
      outputFile,
      '-C',
      input.cwd,
    ];

    if (input.model != null) {
      args.push('--model', input.model);
    }

    args.push('-');
    return args;
  }
}
