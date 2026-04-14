// cspell:ignore aider qwen PYTHONUTF
import { execFileSync } from 'node:child_process';

import type {
  PromptTurnInput,
  PromptTurnResult,
  PromptTurnRunner,
} from '../../application/ports/prompt-turn-runner.js';

const DEFAULT_MODEL = 'ollama_chat/qwen3-opencode:30b';
const DEFAULT_TIMEOUT_MS = 600_000;
const AIDER_TIMEOUT_MS_ENV = 'PROMPT_LANGUAGE_AIDER_TIMEOUT_MS';
const MAX_OUTPUT_LENGTH = 12_000;

function readPositiveIntEnv(name: string): number | undefined {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function buildAiderArgs(input: PromptTurnInput, files: readonly string[]): string[] {
  const model = input.model ?? DEFAULT_MODEL;
  return [
    '-m',
    'aider',
    '--model',
    model,
    '--no-auto-commits',
    '--no-stream',
    '--yes',
    '--no-show-model-warnings',
    '--map-tokens',
    '1024',
    '--edit-format',
    'whole',
    '--message',
    input.prompt,
    ...files,
  ];
}

export function buildAiderEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PYTHONUTF8: '1',
    OLLAMA_API_BASE: 'http://127.0.0.1:11434',
  };
}

function truncateOutput(text: string): string {
  return text.length <= MAX_OUTPUT_LENGTH ? text : text.slice(0, MAX_OUTPUT_LENGTH) + '...';
}

export class AiderPromptTurnRunner implements PromptTurnRunner {
  async run(input: PromptTurnInput): Promise<PromptTurnResult> {
    const files = this.resolveFiles(input.cwd);
    const args = buildAiderArgs(input, files);
    const env = buildAiderEnv();
    const timeoutMs = readPositiveIntEnv(AIDER_TIMEOUT_MS_ENV) ?? DEFAULT_TIMEOUT_MS;

    try {
      const stdout = execFileSync('python', args, {
        cwd: input.cwd,
        encoding: 'utf8',
        timeout: timeoutMs,
        maxBuffer: 4 * 1024 * 1024,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      return {
        exitCode: 0,
        assistantText: truncateOutput(stdout.trim()) || undefined,
        madeProgress: true,
      };
    } catch (error: unknown) {
      const failure = error as {
        stdout?: string | Buffer | undefined;
        stderr?: string | Buffer | undefined;
        status?: number | null | undefined;
        code?: number | string | undefined;
        killed?: boolean | undefined;
      };

      if (failure.killed === true) {
        return {
          exitCode: 124,
          assistantText: `Aider timed out after ${timeoutMs}ms.`,
          madeProgress: false,
        };
      }

      const stdout = String(failure.stdout ?? '').trim();
      const stderr = String(failure.stderr ?? '').trim();
      const assistantText =
        truncateOutput([stdout, stderr].filter(Boolean).join('\n')) || undefined;
      const exitCode =
        typeof failure.status === 'number'
          ? failure.status
          : typeof failure.code === 'number'
            ? failure.code
            : 1;

      return {
        exitCode,
        assistantText,
        madeProgress: stdout.length > 0,
      };
    }
  }

  resolveFiles(_cwd: string): readonly string[] {
    return [];
  }
}
