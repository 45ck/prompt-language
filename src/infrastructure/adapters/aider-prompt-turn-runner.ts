// cspell:ignore aider qwen PYTHONUTF
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import type {
  PromptTurnInput,
  PromptTurnResult,
  PromptTurnRunner,
} from '../../application/ports/prompt-turn-runner.js';

const DEFAULT_MODEL = 'ollama_chat/qwen3-opencode:30b';
const DEFAULT_TIMEOUT_MS = 600_000;
const AIDER_TIMEOUT_MS_ENV = 'PROMPT_LANGUAGE_AIDER_TIMEOUT_MS';
const AIDER_SCOPED_MESSAGE_ENV = 'PROMPT_LANGUAGE_AIDER_SCOPED_MESSAGE';
const MAX_OUTPUT_LENGTH = 12_000;
const MAX_FALLBACK_FILES = 12;
const FILE_REFERENCE_PATTERN =
  /(?:^|[^A-Za-z0-9_./\\-])((?:[A-Za-z0-9_.-]+[\\/])*[A-Za-z0-9_.-]+\.[A-Za-z0-9]{1,8})(?=$|[^A-Za-z0-9_/\\-])/g;
const CAPTURE_FILE_REFERENCE_PATTERN =
  /(?:^|[^A-Za-z0-9_./\\-])(\.prompt-language[\\/]vars[\\/][A-Za-z_]\w*)(?=$|[^A-Za-z0-9_/\\-])/g;
const TRANSIENT_OUTPUT_FILE_PATTERN = /^(?:run|verify)-(?:stdout|stderr)\.txt$/;
const PROTECTED_VERIFY_FILE = 'verify.js';
const PROTECTED_VERIFY_PATTERN =
  /\bdo\s+not\s+(?:read|inspect|open|view|modify|edit|change)(?:\s+or\s+(?:read|inspect|open|view|modify|edit|change))*\s+verify\.js\b/i;

function readPositiveIntEnv(name: string): number | undefined {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function buildAiderArgs(input: PromptTurnInput, files: readonly string[]): string[] {
  const model = input.model ?? DEFAULT_MODEL;
  const disableGit = !hasGitRepo(input.cwd);
  const timeoutMs = readPositiveIntEnv(AIDER_TIMEOUT_MS_ENV);
  const useScopedMessage = process.env[AIDER_SCOPED_MESSAGE_ENV]?.trim() === '1';
  const scopedMessage = input.scopePrompt?.trim();
  const message =
    useScopedMessage && scopedMessage != null && scopedMessage.length > 0
      ? scopedMessage
      : input.prompt;
  return [
    '-m',
    'aider',
    '--model',
    model,
    ...(disableGit ? ['--no-git'] : []),
    '--no-auto-commits',
    '--no-auto-lint',
    '--no-stream',
    '--yes-always',
    '--no-show-model-warnings',
    '--map-tokens',
    '1024',
    '--edit-format',
    'whole',
    ...(timeoutMs != null ? ['--timeout', String(Math.ceil(timeoutMs / 1000))] : []),
    '--message',
    message,
    ...files,
  ];
}

export function buildAiderEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PYTHONUTF8: '1',
    PYTHONIOENCODING: 'utf-8',
    OLLAMA_API_BASE: 'http://127.0.0.1:11434',
  };

  // Aider inherits TERM from git-bash on Windows, but prompt-toolkit expects
  // a native Windows console there. Force a non-interactive terminal mode for
  // headless aider runs so multi-step flows do not crash on the second prompt.
  if (process.platform === 'win32') {
    env['TERM'] = 'dumb';
  }

  return env;
}

function truncateOutput(text: string): string {
  return text.length <= MAX_OUTPUT_LENGTH ? text : text.slice(0, MAX_OUTPUT_LENGTH) + '...';
}

function hasGitRepo(cwd: string): boolean {
  return existsSync(join(cwd, '.git'));
}

function normalizeReferencedFile(cwd: string, candidate: string): string | undefined {
  const trimmed = candidate.trim();
  if (!trimmed) return undefined;

  const absolutePath = resolve(cwd, trimmed);
  const rel = relative(cwd, absolutePath);
  if (!rel || rel.startsWith('..') || rel.includes('\0')) {
    return undefined;
  }

  try {
    if (!statSync(absolutePath).isFile()) return undefined;
  } catch {
    return undefined;
  }

  return rel.replace(/\\/g, '/');
}

function extractReferencedFiles(cwd: string, prompt: string): string[] {
  const referencedFiles: string[] = [];
  const seen = new Set<string>();

  for (const match of prompt.matchAll(CAPTURE_FILE_REFERENCE_PATTERN)) {
    const candidate = match[1];
    const normalized = candidate ? normalizeReferencedFile(cwd, candidate) : undefined;
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    referencedFiles.push(normalized);
  }

  for (const match of prompt.matchAll(FILE_REFERENCE_PATTERN)) {
    const candidate = match[1];
    const normalized = candidate ? normalizeReferencedFile(cwd, candidate) : undefined;
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    referencedFiles.push(normalized);
  }

  return referencedFiles;
}

function protectsVerifyFile(prompt: string): boolean {
  return PROTECTED_VERIFY_PATTERN.test(prompt);
}

function maybeFilterProtectedFiles(files: readonly string[], prompt: string): string[] {
  if (!protectsVerifyFile(prompt)) {
    return [...files];
  }

  return files.filter((file) => file.replace(/\\/g, '/') !== PROTECTED_VERIFY_FILE);
}

function listFallbackWorkspaceFiles(cwd: string, prompt: string): string[] {
  try {
    const files = readdirSync(cwd, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => !name.startsWith('.'))
      .filter((name) => !TRANSIENT_OUTPUT_FILE_PATTERN.test(name))
      .sort((left, right) => left.localeCompare(right))
      .slice(0, MAX_FALLBACK_FILES);
    return maybeFilterProtectedFiles(files, prompt);
  } catch {
    return [];
  }
}

export class AiderPromptTurnRunner implements PromptTurnRunner {
  async run(input: PromptTurnInput): Promise<PromptTurnResult> {
    const files = this.resolveFiles(input.cwd, input.prompt, input.scopePrompt);
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

  resolveFiles(cwd: string, prompt: string, scopePrompt?: string): readonly string[] {
    const scopedPrompt = scopePrompt?.trim();
    const fileSelectionPrompt = scopedPrompt && scopedPrompt.length > 0 ? scopedPrompt : prompt;
    const protectionPrompt = [prompt, scopedPrompt].filter(Boolean).join('\n');
    const referencedFiles = maybeFilterProtectedFiles(
      extractReferencedFiles(cwd, fileSelectionPrompt),
      protectionPrompt,
    );
    if (referencedFiles.length > 0) {
      return referencedFiles;
    }

    // Fresh temp workspaces used by evals often do not have a git repo yet, so
    // aider would otherwise start with an empty repo-map and zero file context.
    return hasGitRepo(cwd) ? [] : listFallbackWorkspaceFiles(cwd, protectionPrompt);
  }

  describeInvocation(input: PromptTurnInput): {
    readonly argv: readonly string[];
    readonly binaryPath: string;
  } {
    const files = this.resolveFiles(input.cwd, input.prompt, input.scopePrompt);
    return {
      argv: ['python', ...buildAiderArgs(input, files)],
      binaryPath: 'python',
    };
  }
}
