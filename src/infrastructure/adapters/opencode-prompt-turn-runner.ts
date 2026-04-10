import { spawn } from 'node:child_process';
import type {
  PromptTurnInput,
  PromptTurnResult,
  PromptTurnRunner,
} from '../../application/ports/prompt-turn-runner.js';

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
      : undefined;

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

export class OpenCodePromptTurnRunner implements PromptTurnRunner {
  async run(input: PromptTurnInput): Promise<PromptTurnResult> {
    const args = this.buildArgs(input);
    const child = spawn('opencode', args, {
      cwd: input.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let stepFinishTimer: ReturnType<typeof setTimeout> | undefined;

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
        try {
          child.kill();
        } catch {
          // ignore termination failures and return the observed result
        }
        settle(resolve, buildResult(fallbackExitCode));
      }, STEP_FINISH_GRACE_MS);
    };

    return await new Promise<PromptTurnResult>((resolve) => {
      const resolvePromise = resolve;

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
    const args = ['run', '--format', 'json', '--dangerously-skip-permissions', '--dir', input.cwd];

    if (input.model != null) {
      args.push('--model', input.model);
    }

    args.push(buildOpenCodePrompt(input.prompt));
    return args;
  }
}
