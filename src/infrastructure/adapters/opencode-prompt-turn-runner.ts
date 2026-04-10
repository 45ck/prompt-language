import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  PromptTurnInput,
  PromptTurnResult,
  PromptTurnRunner,
} from '../../application/ports/prompt-turn-runner.js';
// cspell:ignore LOCALAPPDATA USERPROFILE

interface OpenCodeJsonEvent {
  readonly type?: string | undefined;
  readonly part?:
    | {
        readonly snapshot?: string | undefined;
        readonly text?: string | undefined;
      }
    | undefined;
}

const STEP_FINISH_GRACE_MS = 1_000;
const OPENCODE_AGENT_ENV = 'PROMPT_LANGUAGE_OPENCODE_AGENT';
const OPENCODE_VARIANT_ENV = 'PROMPT_LANGUAGE_OPENCODE_VARIANT';
const OPENCODE_HOME_ENV = 'PROMPT_LANGUAGE_OPENCODE_HOME';
const OPENCODE_CONFIG_HOME_ENV = 'PROMPT_LANGUAGE_OPENCODE_XDG_CONFIG_HOME';
const OPENCODE_DATA_HOME_ENV = 'PROMPT_LANGUAGE_OPENCODE_XDG_DATA_HOME';
const OPENCODE_TIMEOUT_MS_ENV = 'PROMPT_LANGUAGE_OPENCODE_TIMEOUT_MS';
const DEFAULT_OPENCODE_TIMEOUT_MS = 90_000;
const OLLAMA_PROVIDER_PACKAGE = '@ai-sdk/openai-compatible';
const DEFAULT_OLLAMA_API_KEY = 'ollama-local';

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ?? undefined;
}

function readPositiveIntEnv(name: string): number | undefined {
  const value = readEnv(name);
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function buildOpenCodeEnv(): NodeJS.ProcessEnv | undefined {
  const home = readEnv(OPENCODE_HOME_ENV);
  const configHomeOverride = readEnv(OPENCODE_CONFIG_HOME_ENV);
  const dataHomeOverride = readEnv(OPENCODE_DATA_HOME_ENV);

  if (home === undefined && configHomeOverride === undefined && dataHomeOverride === undefined) {
    return undefined;
  }

  const env: NodeJS.ProcessEnv = { ...process.env };

  if (home !== undefined) {
    env['HOME'] = home;
    env['USERPROFILE'] = home;
    env['APPDATA'] = join(home, 'AppData', 'Roaming');
    env['LOCALAPPDATA'] = join(home, 'AppData', 'Local');
    env['XDG_CONFIG_HOME'] ??= join(home, '.config');
    env['XDG_DATA_HOME'] ??= join(home, '.local', 'share');
  }

  if (configHomeOverride !== undefined) {
    env['XDG_CONFIG_HOME'] = configHomeOverride;
  }

  if (dataHomeOverride !== undefined) {
    env['XDG_DATA_HOME'] = dataHomeOverride;
  }

  return env;
}

function isOllamaModel(model?: string): model is string {
  return model?.startsWith('ollama/') ?? false;
}

function buildWorkspaceScopedOpenCodeEnv(root: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    OLLAMA_API_KEY: readEnv('OLLAMA_API_KEY') ?? DEFAULT_OLLAMA_API_KEY,
    HOME: root,
    USERPROFILE: root,
    APPDATA: join(root, 'AppData', 'Roaming'),
    LOCALAPPDATA: join(root, 'AppData', 'Local'),
    XDG_CONFIG_HOME: join(root, '.config'),
    XDG_DATA_HOME: join(root, '.local', 'share'),
  };
}

function buildWorkspaceScopedOpenCodeConfig(modelRef: string): string {
  return (
    JSON.stringify(
      {
        $schema: 'https://opencode.ai/config.json',
        provider: {
          ollama: {
            npm: OLLAMA_PROVIDER_PACKAGE,
            name: 'Ollama (local)',
            options: {
              baseURL: 'http://127.0.0.1:11434/v1',
              apiKey: '{env:OLLAMA_API_KEY}',
            },
            models: {
              [modelRef]: {
                name: `Ollama ${modelRef}`,
              },
            },
          },
        },
        model: `ollama/${modelRef}`,
        small_model: `ollama/${modelRef}`,
        snapshot: false,
        instructions: [],
        enabled_providers: ['ollama'],
      },
      null,
      2,
    ) + '\n'
  );
}

export async function prepareOpenCodeEnv(
  input: PromptTurnInput,
): Promise<NodeJS.ProcessEnv | undefined> {
  const explicitEnv = buildOpenCodeEnv();
  if (explicitEnv !== undefined || !isOllamaModel(input.model)) {
    return explicitEnv;
  }

  const root = join(input.cwd, '.prompt-language', 'opencode-home');
  const configDir = join(root, '.config', 'opencode');
  const dataDir = join(root, '.local', 'share');
  const modelRef = input.model.slice('ollama/'.length);

  await mkdir(configDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });

  await writeFile(
    join(configDir, 'package.json'),
    JSON.stringify(
      {
        dependencies: {
          [OLLAMA_PROVIDER_PACKAGE]: 'latest',
        },
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  await writeFile(
    join(configDir, 'opencode.json'),
    buildWorkspaceScopedOpenCodeConfig(modelRef),
    'utf8',
  );

  return buildWorkspaceScopedOpenCodeEnv(root);
}

export function summarizeOpenCodeJsonOutput(
  output: string,
): Pick<PromptTurnResult, 'assistantText' | 'madeProgress'> {
  let startSnapshot: string | undefined;
  let finishSnapshot: string | undefined;
  const textParts: string[] = [];

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    let event: OpenCodeJsonEvent;
    try {
      event = JSON.parse(line) as OpenCodeJsonEvent;
    } catch {
      continue;
    }

    if (event.type === 'step_start' && event.part?.snapshot) {
      startSnapshot = event.part.snapshot;
      continue;
    }

    if (event.type === 'step_finish' && event.part?.snapshot) {
      finishSnapshot = event.part.snapshot;
      continue;
    }

    if (event.type === 'text' && event.part?.text) {
      textParts.push(event.part.text);
    }
  }

  const assistantText = textParts.join('\n').trim() || undefined;
  const madeProgress =
    startSnapshot !== undefined && finishSnapshot !== undefined
      ? startSnapshot !== finishSnapshot
      : false;

  return { assistantText, madeProgress };
}

export function buildOpenCodePrompt(prompt: string): string {
  return [
    'You are executing a prompt-language flow step, not doing open-ended chat.',
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

function terminateOpenCodeProcessTree(child: ReturnType<typeof spawn>): void {
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

  if ('destroy' in (child.stdout ?? {})) {
    child.stdout?.destroy();
  }
  if ('destroy' in (child.stderr ?? {})) {
    child.stderr?.destroy();
  }
}

export class OpenCodePromptTurnRunner implements PromptTurnRunner {
  async run(input: PromptTurnInput): Promise<PromptTurnResult> {
    const args = this.buildArgs(input);
    const env = await prepareOpenCodeEnv(input);
    const child = spawn('opencode', args, {
      cwd: input.cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timeoutMs = readPositiveIntEnv(OPENCODE_TIMEOUT_MS_ENV) ?? DEFAULT_OPENCODE_TIMEOUT_MS;
    let stdout = '';
    let stderr = '';
    let settled = false;
    let stepFinishTimer: ReturnType<typeof setTimeout> | undefined;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

    const buildResult = (exitCode: number): PromptTurnResult => {
      const result = summarizeOpenCodeJsonOutput(stdout);
      return {
        exitCode,
        assistantText: (result.assistantText ?? stderr.trim()) || undefined,
        madeProgress: result.madeProgress,
      };
    };

    const settle = (resolve: (value: PromptTurnResult) => void, result: PromptTurnResult): void => {
      if (settled) return;
      settled = true;
      if (stepFinishTimer !== undefined) clearTimeout(stepFinishTimer);
      if (timeoutTimer !== undefined) clearTimeout(timeoutTimer);
      resolve(result);
    };

    const scheduleStepFinishResolution = (
      resolve: (value: PromptTurnResult) => void,
      fallbackExitCode: number,
    ): void => {
      const result = summarizeOpenCodeJsonOutput(stdout);
      if (result.madeProgress === undefined) return;
      if (stepFinishTimer !== undefined) clearTimeout(stepFinishTimer);
      stepFinishTimer = setTimeout(() => {
        terminateOpenCodeProcessTree(child);
        settle(resolve, buildResult(fallbackExitCode));
      }, STEP_FINISH_GRACE_MS);
    };

    return await new Promise<PromptTurnResult>((resolve) => {
      const resolvePromise = resolve;

      timeoutTimer = setTimeout(() => {
        terminateOpenCodeProcessTree(child);
        const timeoutHint = isOllamaModel(input.model)
          ? `OpenCode timed out after ${timeoutMs}ms waiting for ${input.model}. This usually indicates a local Ollama streaming stall.`
          : `OpenCode timed out after ${timeoutMs}ms waiting for output.`;
        const detail = stderr.trim();
        settle(resolvePromise, {
          exitCode: 124,
          assistantText: detail ? `${detail} ${timeoutHint}` : timeoutHint,
          madeProgress: false,
        });
      }, timeoutMs);

      child.stdout?.setEncoding('utf8');
      child.stdout?.on('data', (chunk: string) => {
        stdout += chunk;
        scheduleStepFinishResolution(resolvePromise, 0);
      });

      child.stderr?.setEncoding('utf8');
      child.stderr?.on('data', (chunk: string) => {
        stderr += chunk;
      });

      child.on('error', (error) => {
        stderr += error.message;
        settle(resolvePromise, buildResult(1));
      });

      child.on('close', (code) => {
        settle(resolvePromise, buildResult(code ?? 1));
      });
    });
  }

  buildArgs(input: PromptTurnInput): string[] {
    const args = [
      'run',
      '--pure',
      '--format',
      'json',
      '--dangerously-skip-permissions',
      '--dir',
      input.cwd,
    ];
    const agent = readEnv(OPENCODE_AGENT_ENV);
    const variant = readEnv(OPENCODE_VARIANT_ENV);

    if (input.model != null) {
      args.push('--model', input.model);
    }

    if (agent !== undefined) {
      args.push('--agent', agent);
    }

    if (variant !== undefined) {
      args.push('--variant', variant);
    }

    args.push(buildOpenCodePrompt(input.prompt));
    return args;
  }
}
