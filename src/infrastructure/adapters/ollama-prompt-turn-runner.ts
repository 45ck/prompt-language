import { execFile } from 'node:child_process';
import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { dirname, join, relative, resolve } from 'node:path';
import type {
  PromptTurnInput,
  PromptTurnResult,
  PromptTurnRunner,
} from '../../application/ports/prompt-turn-runner.js';
import { selectCompactRenderModeForEnvelope } from '../../application/select-compact-render-mode.js';

// cspell:ignore fscrud timeouterror

const execFileAsync = promisify(execFile);

const OLLAMA_BASE_URL_ENV = 'PROMPT_LANGUAGE_OLLAMA_BASE_URL';
const OLLAMA_TIMEOUT_MS_ENV = 'PROMPT_LANGUAGE_OLLAMA_TIMEOUT_MS';
const OLLAMA_RETRY_ATTEMPTS_ENV = 'PROMPT_LANGUAGE_OLLAMA_RETRY_ATTEMPTS';
const OLLAMA_RETRY_DELAY_MS_ENV = 'PROMPT_LANGUAGE_OLLAMA_RETRY_DELAY_MS';
const OLLAMA_ACTION_ROUNDS_ENV = 'PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS';
const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_TIMEOUT_MS = 300_000;
const DEFAULT_OLLAMA_RETRY_ATTEMPTS = 3;
const DEFAULT_OLLAMA_RETRY_DELAY_MS = 1_000;
const DEFAULT_ACTION_ROUNDS = 8;
const MAX_LIST_ENTRIES = 200;
const MAX_FILE_BYTES = 100_000;
const MAX_COMMAND_OUTPUT = 12_000;
const TRACE_PATH = '.prompt-language/ollama-turns.jsonl';

type OllamaMessageRole = 'system' | 'user' | 'assistant';

interface OllamaMessage {
  readonly role: OllamaMessageRole;
  readonly content: string;
}

interface OllamaChatResponse {
  readonly message?: {
    readonly content?: string | undefined;
  };
  readonly error?: string | undefined;
}

interface ActionEnvelope {
  readonly actions?: readonly RunnerAction[] | undefined;
}

type RunnerAction =
  | {
      readonly type: 'list_files';
      readonly path?: string | undefined;
    }
  | {
      readonly type: 'read_file';
      readonly path: string;
    }
  | {
      readonly type: 'write_file';
      readonly path: string;
      readonly content: string;
    }
  | {
      readonly type: 'run_command';
      readonly command: string;
      readonly timeout_ms?: number | undefined;
    }
  | {
      readonly type: 'done';
      readonly message?: string | undefined;
    };

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

function readPositiveIntEnv(name: string): number | undefined {
  const value = readEnv(name);
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function resolveOllamaModel(model?: string): string {
  if (model?.startsWith('ollama/')) {
    return model.slice('ollama/'.length);
  }
  return model ?? 'gemma4:31b';
}

function getOllamaBaseUrl(): string {
  return readEnv(OLLAMA_BASE_URL_ENV) ?? DEFAULT_OLLAMA_BASE_URL;
}

function getOllamaTimeoutMs(): number {
  return readPositiveIntEnv(OLLAMA_TIMEOUT_MS_ENV) ?? DEFAULT_OLLAMA_TIMEOUT_MS;
}

function getOllamaRetryAttempts(): number {
  return readPositiveIntEnv(OLLAMA_RETRY_ATTEMPTS_ENV) ?? DEFAULT_OLLAMA_RETRY_ATTEMPTS;
}

function getOllamaRetryDelayMs(): number {
  return readPositiveIntEnv(OLLAMA_RETRY_DELAY_MS_ENV) ?? DEFAULT_OLLAMA_RETRY_DELAY_MS;
}

function getOllamaActionRounds(): number {
  return readPositiveIntEnv(OLLAMA_ACTION_ROUNDS_ENV) ?? DEFAULT_ACTION_ROUNDS;
}

function createSystemPrompt(): string {
  return [
    'You are a local workspace automation agent for prompt-language.',
    'Respond with strict JSON only. Do not use markdown fences.',
    'Use this schema exactly:',
    '{"actions":[{"type":"list_files","path":"."},{"type":"read_file","path":"file.txt"},{"type":"write_file","path":"file.txt","content":"..."},{"type":"run_command","command":"npm test","timeout_ms":120000},{"type":"done","message":"short status"}]}',
    'Rules:',
    '- Paths must stay within the current workspace.',
    '- Use read_file or list_files before guessing file contents.',
    '- Use write_file for any file creation or modification.',
    '- Use run_command only when the prompt explicitly needs command execution.',
    '- When the task is complete, include one done action.',
    '- If the prompt only asks for an acknowledgement or a remembered value, you may use only the done action.',
  ].join('\n');
}

export function simplifyPromptLanguageEnvelope(prompt: string): string {
  const capturePrompt = compactCaptureEnvelope(prompt);
  if (capturePrompt !== undefined) {
    return capturePrompt;
  }

  const modeDecision = selectCompactRenderModeForEnvelope(prompt);
  if (modeDecision.actualMode === 'full') {
    return prompt;
  }

  const trimmed = prompt.trim();
  if (!trimmed.startsWith('[prompt-language] Flow:')) {
    return prompt;
  }

  const sections = trimmed
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter((section) => section.length > 0);
  if (sections.length < 2) {
    return prompt;
  }

  const lastSection = sections[sections.length - 1];
  if (lastSection?.startsWith('[prompt-language:')) {
    sections.pop();
  }
  if (sections.length < 2) {
    return prompt;
  }

  const task = sections.pop();
  if (!task) {
    return prompt;
  }

  const flowHeader = sections[0]?.replace(/^\[prompt-language\]\s*/, '');
  const variablesSection = sections.find((section) => section.startsWith('Variables:'));
  const priorPromptLines = sections
    .flatMap((section) => section.split('\n'))
    .map((line) => line.trim())
    .filter((line) => /^[~>]\s+prompt:/i.test(line) && !line.includes('${'))
    .slice(0, -1)
    .filter((line) => !line.includes(task))
    .map((line) => line.replace(/^>\s+prompt:/i, '~ prompt:'));

  const contextSections = [flowHeader, ...priorPromptLines, variablesSection].filter(
    (value): value is string => value != null && value.length > 0,
  );
  if (contextSections.length === 0) {
    return `Current task:\n${task}`;
  }

  return `Context:\n${contextSections.join('\n\n')}\n\nCurrent task:\n${task}`;
}

function compactCaptureEnvelope(prompt: string): string | undefined {
  const trimmed = prompt.trim();
  if (
    !trimmed.startsWith('[prompt-language] Flow:') ||
    !trimmed.includes('[Capture active:') ||
    !trimmed.includes('[Internal')
  ) {
    return undefined;
  }

  const internalMatch = /\[Internal [^\n]+capture:[\s\S]+?\]/i.exec(trimmed);
  if (!internalMatch?.[0]) {
    return undefined;
  }

  const beforeInternal = trimmed.slice(0, internalMatch.index).trim();
  const sections = beforeInternal
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter((section) => section.length > 0);
  const currentTask = sections
    .reverse()
    .find(
      (section) =>
        !section.startsWith('[prompt-language]') &&
        !section.startsWith('[Capture active:') &&
        !/^[~>| ]/.test(section),
    );

  if (currentTask === undefined) {
    return undefined;
  }

  return [
    currentTask,
    '',
    internalMatch[0],
    '',
    'Do not execute future flow steps. Do not create or edit workspace files during capture.',
  ].join('\n');
}

function extractJsonObject(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const fenceMatch = /```(?:json)?\s*([\s\S]+?)```/i.exec(trimmed);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return undefined;
}

function isRunnerAction(value: unknown): value is RunnerAction {
  if (!value || typeof value !== 'object') return false;
  const action = value as Record<string, unknown>;
  if (typeof action['type'] !== 'string') return false;

  switch (action['type']) {
    case 'list_files':
      return action['path'] === undefined || typeof action['path'] === 'string';
    case 'read_file':
      return typeof action['path'] === 'string';
    case 'write_file':
      return typeof action['path'] === 'string' && typeof action['content'] === 'string';
    case 'run_command':
      return (
        typeof action['command'] === 'string' &&
        (action['timeout_ms'] === undefined || typeof action['timeout_ms'] === 'number')
      );
    case 'done':
      return action['message'] === undefined || typeof action['message'] === 'string';
    default:
      return false;
  }
}

export function parseActionEnvelope(text: string): ActionEnvelope | undefined {
  const json = extractJsonObject(text);
  if (json === undefined) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return undefined;
  }

  if (!parsed || typeof parsed !== 'object') return undefined;
  const envelope = parsed as Record<string, unknown>;
  if (!Array.isArray(envelope['actions'])) return undefined;
  if (!envelope['actions'].every(isRunnerAction)) return undefined;
  return { actions: envelope['actions'] as readonly RunnerAction[] };
}

function promptRequiresWorkspaceAction(prompt: string): boolean {
  return /\b(create|write|edit|modify|update|delete|remove|rename|read|copy|list|run|execute|inspect|search|find|open)\b/i.test(
    prompt,
  );
}

function extractCapturePath(prompt: string): string | undefined {
  const match = /save(?: your (?:json )?answer| it)? to `([^`]+)`/i.exec(prompt);
  return match?.[1];
}

function resolveWorkspacePath(cwd: string, candidate: string): string {
  const trimmed = candidate.trim();
  if (!trimmed) {
    throw new Error('Path must not be empty.');
  }

  const absolute = resolve(cwd, trimmed);
  const rel = relative(cwd, absolute);
  if (rel.startsWith('..') || rel.includes('\0')) {
    throw new Error(`Path "${candidate}" is outside the workspace.`);
  }

  return absolute;
}

function extractPreferredWorkspaceRoot(prompt: string): string | undefined {
  const workOnlyMatch = /\bWork only in ([A-Za-z0-9_./\\-]+)/i.exec(prompt);
  if (workOnlyMatch?.[1] !== undefined) {
    return workOnlyMatch[1].replace(/[.。,:;]+$/, '');
  }

  const variableMatch = /^\s*fscrud_workspace\s*=\s*([A-Za-z0-9_./\\-]+)/im.exec(prompt);
  return variableMatch?.[1]?.replace(/[.。,:;]+$/, '');
}

function rootActionPath(pathValue: string, preferredRoot: string | undefined): string {
  if (preferredRoot === undefined) return pathValue;
  const normalizedPath = pathValue.replace(/\\/g, '/');
  const normalizedRoot = preferredRoot.replace(/\\/g, '/').replace(/\/+$/, '');
  if (
    normalizedPath === '.' ||
    normalizedPath.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalizedPath) ||
    normalizedPath.startsWith('.prompt-language/') ||
    normalizedPath === '.prompt-language' ||
    normalizedPath === normalizedRoot ||
    normalizedPath.startsWith(`${normalizedRoot}/`) ||
    normalizedPath.startsWith('workspace/')
  ) {
    return pathValue;
  }
  return `${preferredRoot.replace(/[\\/]+$/, '')}/${pathValue}`;
}

function isSameWorkspacePath(cwd: string, left: string, right: string): boolean {
  return resolveWorkspacePath(cwd, left) === resolveWorkspacePath(cwd, right);
}

async function listFiles(
  cwd: string,
  pathValue: string | undefined,
  preferredRoot: string | undefined,
): Promise<string> {
  const root = resolveWorkspacePath(cwd, rootActionPath(pathValue ?? '.', preferredRoot));
  const entries = await readdir(root, { withFileTypes: true });
  const names = entries
    .slice(0, MAX_LIST_ENTRIES)
    .map((entry) => `${entry.isDirectory() ? 'dir' : 'file'} ${entry.name}`);
  return names.length > 0 ? names.join('\n') : '(empty)';
}

async function readWorkspaceFile(
  cwd: string,
  pathValue: string,
  preferredRoot: string | undefined,
): Promise<string> {
  const filePath = resolveWorkspacePath(cwd, rootActionPath(pathValue, preferredRoot));
  const content = await readFile(filePath, 'utf8');
  if (content.length <= MAX_FILE_BYTES) {
    return content;
  }
  return content.slice(0, MAX_FILE_BYTES) + '\n... (truncated)';
}

async function writeWorkspaceFile(
  cwd: string,
  pathValue: string,
  content: string,
  preferredRoot: string | undefined,
): Promise<void> {
  const filePath = resolveWorkspacePath(cwd, rootActionPath(pathValue, preferredRoot));
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

async function runWorkspaceCommand(
  cwd: string,
  command: string,
  timeoutMs?: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const actualTimeout = timeoutMs ?? 120_000;

  try {
    const result =
      process.platform === 'win32'
        ? await execFileAsync('powershell', ['-NoProfile', '-Command', command], {
            cwd,
            encoding: 'utf8',
            timeout: actualTimeout,
            maxBuffer: 2 * 1024 * 1024,
          })
        : await execFileAsync('sh', ['-lc', command], {
            cwd,
            encoding: 'utf8',
            timeout: actualTimeout,
            maxBuffer: 2 * 1024 * 1024,
          });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
    };
  } catch (error) {
    const failure = error as {
      stdout?: string | Buffer | undefined;
      stderr?: string | Buffer | undefined;
      code?: number | string | undefined;
    };
    return {
      stdout: String(failure.stdout ?? ''),
      stderr: String(failure.stderr ?? ''),
      exitCode: typeof failure.code === 'number' ? failure.code : 1,
    };
  }
}

function truncateOutput(text: string): string {
  return text.length <= MAX_COMMAND_OUTPUT ? text : text.slice(0, MAX_COMMAND_OUTPUT) + '...';
}

function describeAction(action: RunnerAction): string {
  switch (action.type) {
    case 'list_files':
      return `list_files(${action.path ?? '.'})`;
    case 'read_file':
      return `read_file(${action.path})`;
    case 'write_file':
      return `write_file(${action.path})`;
    case 'run_command':
      return `run_command(${action.command})`;
    case 'done':
      return 'done';
  }
}

async function appendTrace(
  cwd: string,
  record: {
    readonly requestedModel: string;
    readonly actualModel: string;
    readonly prompt: string;
    readonly rounds: number;
    readonly workspaceActions: number;
    readonly message?: string | undefined;
  },
): Promise<void> {
  const tracePath = join(cwd, TRACE_PATH);
  await mkdir(dirname(tracePath), { recursive: true });
  await appendFile(
    tracePath,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      requestedModel: record.requestedModel,
      actualModel: record.actualModel,
      prompt: record.prompt.slice(0, 400),
      rounds: record.rounds,
      workspaceActions: record.workspaceActions,
      message: record.message,
    }) + '\n',
    'utf8',
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function isTransientOllamaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /fetch failed|network|socket|terminated|aborted|aborterror|timeouterror|model runner has unexpectedly stopped|ECONNRESET|ECONNREFUSED|EPIPE|ETIMEDOUT|UND_ERR|HTTP 5\d\d/i.test(
    message,
  );
}

async function callOllamaChatOnce(
  model: string,
  messages: readonly OllamaMessage[],
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${getOllamaBaseUrl()}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages,
        options: {
          temperature: 0,
        },
      }),
      signal: controller.signal,
    });

    const rawBody =
      typeof response.text === 'function'
        ? await response.text()
        : JSON.stringify(await response.json());
    let payload: OllamaChatResponse | undefined;
    try {
      payload = JSON.parse(rawBody) as OllamaChatResponse;
    } catch {
      if (!response.ok) {
        throw new Error(
          `Ollama request failed with HTTP ${response.status}: ${rawBody.slice(0, 500)}`,
        );
      }
      throw new Error(`Ollama returned invalid JSON: ${rawBody.slice(0, 500)}`);
    }

    if (!response.ok) {
      const bodyHint = rawBody.trim() ? `: ${rawBody.slice(0, 500)}` : '';
      throw new Error(
        payload.error ?? `Ollama request failed with HTTP ${response.status}${bodyHint}`,
      );
    }

    const content = payload.message?.content?.trim();
    if (!content) {
      throw new Error('Ollama returned an empty response.');
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

async function callOllamaChat(
  model: string,
  messages: readonly OllamaMessage[],
  timeoutMs: number,
): Promise<string> {
  const maxAttempts = getOllamaRetryAttempts();
  const retryDelayMs = getOllamaRetryDelayMs();
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await callOllamaChatOnce(model, messages, timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isTransientOllamaError(error)) {
        throw error;
      }
      await sleep(retryDelayMs * attempt);
    }
  }

  throw lastError;
}

function getFallbackModels(model: string): readonly string[] {
  if (model === 'gemma4:31b') {
    return ['gemma4-cpu:31b', 'gemma4-fast-cpu:31b'];
  }
  return [];
}

async function callOllamaChatWithFallback(
  model: string,
  messages: readonly OllamaMessage[],
  timeoutMs: number,
): Promise<{ content: string; actualModel: string }> {
  try {
    return {
      content: await callOllamaChat(model, messages, timeoutMs),
      actualModel: model,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/model failed to load/i.test(message)) {
      throw error;
    }

    for (const fallbackModel of getFallbackModels(model)) {
      try {
        return {
          content: await callOllamaChat(fallbackModel, messages, timeoutMs),
          actualModel: fallbackModel,
        };
      } catch (fallbackError) {
        const fallbackMessage =
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        if (!/model failed to load/i.test(fallbackMessage)) {
          throw fallbackError;
        }
      }
    }

    throw error;
  }
}

export class OllamaPromptTurnRunner implements PromptTurnRunner {
  async run(input: PromptTurnInput): Promise<PromptTurnResult> {
    const requestedModel = resolveOllamaModel(input.model);
    const timeoutMs = getOllamaTimeoutMs();
    const prompt = simplifyPromptLanguageEnvelope(input.prompt);
    const capturePath = extractCapturePath(prompt);
    const preferredRoot =
      capturePath === undefined ? extractPreferredWorkspaceRoot(prompt) : undefined;
    const messages: OllamaMessage[] = [
      { role: 'system', content: createSystemPrompt() },
      { role: 'user', content: prompt },
    ];

    let workspaceActions = 0;
    let finalMessage: string | undefined;
    let actualModel = requestedModel;
    let roundsUsed = 0;
    const maxActionRounds = getOllamaActionRounds();

    try {
      for (let round = 1; round <= maxActionRounds; round += 1) {
        roundsUsed = round;
        const response = await callOllamaChatWithFallback(requestedModel, messages, timeoutMs);
        const raw = response.content;
        actualModel = response.actualModel;
        messages.push({ role: 'assistant', content: raw });

        const parsed = parseActionEnvelope(raw);
        if (parsed?.actions === undefined) {
          messages.push({
            role: 'user',
            content:
              'Your previous reply was invalid. Respond with strict JSON only using the documented actions array.',
          });
          continue;
        }

        const results: string[] = [];
        let reachedDone = false;
        let actionFailed = false;

        for (const action of parsed.actions) {
          try {
            if (capturePath !== undefined) {
              if (
                action.type === 'write_file' &&
                isSameWorkspacePath(input.cwd, action.path, capturePath)
              ) {
                await writeWorkspaceFile(input.cwd, action.path, action.content, undefined);
                workspaceActions += 1;
                await appendTrace(input.cwd, {
                  requestedModel,
                  actualModel,
                  prompt,
                  rounds: round,
                  workspaceActions,
                  message: `Captured ${capturePath}`,
                });
                return {
                  exitCode: 0,
                  assistantText: `Captured ${capturePath}`,
                  madeProgress: true,
                };
              }

              results.push(`${action.type} rejected: capture turns may only write ${capturePath}`);
              continue;
            }

            switch (action.type) {
              case 'list_files': {
                const listing = await listFiles(input.cwd, action.path, preferredRoot);
                results.push(`list_files(${action.path ?? '.'})\n${listing}`);
                break;
              }
              case 'read_file': {
                const content = await readWorkspaceFile(input.cwd, action.path, preferredRoot);
                results.push(`read_file(${action.path})\n${content}`);
                break;
              }
              case 'write_file': {
                await writeWorkspaceFile(input.cwd, action.path, action.content, preferredRoot);
                workspaceActions += 1;
                results.push(`write_file(${action.path}) ok`);
                break;
              }
              case 'run_command': {
                const commandResult = await runWorkspaceCommand(
                  input.cwd,
                  action.command,
                  action.timeout_ms,
                );
                workspaceActions += 1;
                results.push(
                  `run_command(${action.command}) exit=${commandResult.exitCode}\nstdout:\n${truncateOutput(commandResult.stdout)}\nstderr:\n${truncateOutput(commandResult.stderr)}`,
                );
                break;
              }
              case 'done': {
                finalMessage = action.message?.trim() ?? 'Done';
                reachedDone = true;
                break;
              }
            }
          } catch (error) {
            actionFailed = true;
            const message = error instanceof Error ? error.message : String(error);
            results.push(`${describeAction(action)} failed: ${message}`);
          }
        }

        if (reachedDone && !actionFailed) {
          const madeProgress = workspaceActions > 0 || !promptRequiresWorkspaceAction(prompt);
          await appendTrace(input.cwd, {
            requestedModel,
            actualModel,
            prompt,
            rounds: round,
            workspaceActions,
            message: finalMessage,
          });
          return {
            exitCode: 0,
            assistantText: finalMessage,
            madeProgress,
          };
        }

        messages.push({
          role: 'user',
          content:
            results.length > 0
              ? `Action results:\n${results.join('\n\n')}\n\nContinue with the next JSON actions or finish with done.`
              : 'No actions were executed. Continue with valid JSON actions or finish with done.',
        });
      }

      return {
        exitCode: 1,
        assistantText: `Ollama runner exceeded the action round limit (${maxActionRounds}).`,
        madeProgress: workspaceActions > 0,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await appendTrace(input.cwd, {
        requestedModel,
        actualModel,
        prompt,
        rounds: roundsUsed,
        workspaceActions,
        message: `failed: ${message}`,
      });
      return {
        exitCode: 1,
        assistantText: `Ollama runner failed: ${message}`,
        madeProgress: workspaceActions > 0,
      };
    }
  }
}
