import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HOOK_TEST_TIMEOUT_MS = 30_000;

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'cf-pre-compact-'));
});

afterEach(async () => {
  await rm(tempDir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
});

interface HookResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runHook(input: string, cwd: string): HookResult {
  const srcRoot = join(import.meta.dirname, '..', '..', '..');
  const scriptPath = join(srcRoot, 'src', 'presentation', 'hooks', 'pre-compact.ts');
  const result = spawnSync(`npx tsx "${scriptPath}"`, {
    input,
    encoding: 'utf-8',
    cwd,
    timeout: HOOK_TEST_TIMEOUT_MS,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function makeState(status: string, goal: string) {
  return {
    version: 1,
    sessionId: 'test-session',
    flowSpec: {
      goal,
      nodes: [{ kind: 'prompt', id: 'p1', text: 'do work' }],
      completionGates: [],
      defaults: { maxIterations: 5, maxAttempts: 3 },
      warnings: [],
    },
    currentNodePath: [0],
    nodeProgress: {},
    variables: {},
    gateResults: {},
    gateDiagnostics: {},
    status,
    warnings: [],
    spawnedChildren: {},
    captureNonce: 'test-nonce-00000000',
  };
}

describe('pre-compact hook (integration)', () => {
  it('produces no output when no active flow', () => {
    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('outputs additionalContext when flow is active', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(
      join(stateDir, 'session-state.json'),
      JSON.stringify(makeState('active', 'Build feature')),
    );

    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as { additionalContext: string };
    expect(parsed.additionalContext).toContain(
      '[prompt-language] Active flow preserved across compaction.',
    );
    expect(parsed.additionalContext).toContain('Build feature');
    expect(parsed.additionalContext).toContain('DSL reference');
  });

  it('produces no output when flow is completed', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(
      join(stateDir, 'session-state.json'),
      JSON.stringify(makeState('completed', 'Done task')),
    );

    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('exits 0 on corrupted state (fail-open)', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(join(stateDir, 'session-state.json'), '{{broken json');

    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
  });

  it('finds awaiting_capture let node nested inside try block', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const state = {
      ...makeState('active', 'Nested capture test'),
      captureNonce: 'nested12345',
      nodeProgress: {
        l2: { iteration: 1, maxIterations: 3, status: 'awaiting_capture' },
      },
      flowSpec: {
        goal: 'Nested capture test',
        nodes: [
          {
            kind: 'try',
            id: 't1',
            body: [
              {
                kind: 'let',
                id: 'l2',
                variableName: 'deepVar',
                append: false,
                source: { type: 'prompt', text: 'Nested question?' },
              },
            ],
            catchCondition: 'command_failed',
            catchBody: [],
            finallyBody: [],
          },
        ],
        completionGates: [],
        defaults: { maxIterations: 5, maxAttempts: 3 },
        warnings: [],
      },
    };
    await writeFile(join(stateDir, 'session-state.json'), JSON.stringify(state));

    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as { additionalContext: string };
    expect(parsed.additionalContext).toContain('Variable capture');
    expect(parsed.additionalContext).toContain('deepVar');
  });

  it('includes capture re-injection when awaiting_capture', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const state = {
      ...makeState('active', 'Capture test'),
      captureNonce: 'abc12345',
      nodeProgress: {
        l1: { iteration: 1, maxIterations: 3, status: 'awaiting_capture' },
      },
      flowSpec: {
        goal: 'Capture test',
        nodes: [
          {
            kind: 'let',
            id: 'l1',
            variableName: 'answer',
            append: false,
            source: { type: 'prompt', text: 'What color?' },
          },
        ],
        completionGates: [],
        defaults: { maxIterations: 5, maxAttempts: 3 },
        warnings: [],
      },
    };
    await writeFile(join(stateDir, 'session-state.json'), JSON.stringify(state));

    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as { additionalContext: string };
    expect(parsed.additionalContext).toContain('Variable capture');
    expect(parsed.additionalContext).toContain('answer');
  });
});
