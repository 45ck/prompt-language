import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type {
  PromptTurnInput,
  PromptTurnResult,
  PromptTurnRunner,
} from '../../application/ports/prompt-turn-runner.js';

const DEFAULT_TIMEOUT_MS = 600_000;

function quotePowerShellArg(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildCodexPowerShellCommand(args: readonly string[]): string {
  return `& codex ${args.map(quotePowerShellArg).join(' ')}`;
}

function codexBinaryCommand(...args: string[]): [string, ...string[]] {
  if (process.platform === 'win32') {
    return [
      'powershell',
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      buildCodexPowerShellCommand(args),
    ];
  }

  return ['codex', ...args];
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

    try {
      const [command, ...commandArgs] = codexBinaryCommand(...args);
      execFileSync(command, commandArgs, {
        cwd: input.cwd,
        input: buildCodexPrompt(input.prompt),
        encoding: 'utf-8',
        stdio: ['pipe', 'ignore', 'pipe'],
        timeout: DEFAULT_TIMEOUT_MS,
      });
      return {
        exitCode: 0,
        assistantText: readFileSync(outputFile, 'utf-8').trim() || undefined,
      };
    } catch (error) {
      const execError = error as {
        readonly status?: number | undefined;
        readonly stdout?: unknown;
        readonly stderr?: unknown;
      };
      let assistantText: string | undefined;
      try {
        assistantText = readFileSync(outputFile, 'utf-8').trim() || undefined;
      } catch {
        assistantText =
          (typeof execError.stdout === 'string' ? execError.stdout : '') ||
          (typeof execError.stderr === 'string' ? execError.stderr : '') ||
          undefined;
      }
      return {
        exitCode: execError.status ?? 1,
        assistantText,
      };
    } finally {
      try {
        rmSync(outputFile, { force: true });
      } catch {
        // ignore cleanup failures
      }
    }
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
