import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HOOK_TEST_TIMEOUT_MS = 30_000;

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'cf-session-start-'));
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
  const scriptPath = join(srcRoot, 'src', 'presentation', 'hooks', 'session-start.ts');
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

describe('session-start hook (integration)', () => {
  it('produces no output when no active flow', () => {
    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('writes colorized flow to stderr when flow is active', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(
      join(stateDir, 'session-state.json'),
      JSON.stringify(makeState('active', 'Resume task')),
    );

    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('[PL]');
    expect(result.stderr).toContain('Resume task');
    // Should contain ANSI codes (colorized)
    expect(result.stderr).toContain('\x1b[');
  });

  it('returns additionalContext in stdout JSON when flow is active', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(
      join(stateDir, 'session-state.json'),
      JSON.stringify(makeState('active', 'Resume task')),
    );

    const result = runHook('{}', tempDir);
    const parsed = JSON.parse(result.stdout) as { additionalContext: string };
    expect(parsed.additionalContext).toContain('[prompt-language] Active flow detected');
    expect(parsed.additionalContext).toContain('Resume task');
  });

  it('does not write when flow is completed', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(
      join(stateDir, 'session-state.json'),
      JSON.stringify(makeState('completed', 'Done task')),
    );

    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).not.toContain('[PL]');
  });

  it('surfaces PLR-004 when resume state cannot be recovered (state_mismatch)', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(join(stateDir, 'session-state.json'), '{{broken json');

    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('[prompt-language] PLR-004');
    const parsed = JSON.parse(result.stdout) as { additionalContext: string };
    expect(parsed.additionalContext).toContain('PLR-004');
    expect(parsed.additionalContext).toContain(
      'Resume state is corrupted and could not be recovered',
    );
  });

  it('warns when state version is newer than expected (H-INT-009)', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const state = { ...makeState('active', 'Versioned flow'), version: 99 };
    await writeFile(join(stateDir, 'session-state.json'), JSON.stringify(state));

    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('WARNING');
    expect(result.stderr).toContain('newer than this plugin');
  });

  it('no version warning when version matches (H-INT-009)', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const state = { ...makeState('active', 'Normal flow'), version: 1 };
    await writeFile(join(stateDir, 'session-state.json'), JSON.stringify(state));

    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).not.toContain('WARNING');
  });

  it('finds awaiting_capture let node nested inside foreach block', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const state = {
      ...makeState('active', 'Nested capture test'),
      captureNonce: 'nested67890',
      nodeProgress: {
        l3: { iteration: 1, maxIterations: 3, status: 'awaiting_capture' },
      },
      flowSpec: {
        goal: 'Nested capture test',
        nodes: [
          {
            kind: 'foreach',
            id: 'fe1',
            variableName: 'item',
            listExpression: 'a b c',
            maxIterations: 50,
            body: [
              {
                kind: 'let',
                id: 'l3',
                variableName: 'nestedAnswer',
                append: false,
                source: { type: 'prompt', text: 'What about ${item}?' },
              },
            ],
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
    expect(parsed.additionalContext).toContain('nestedAnswer');
  });

  it('re-emits capture prompt when awaiting_capture on resume (capture_failure)', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const state = {
      ...makeState('active', 'Capture resume'),
      captureNonce: 'abc12345',
      nodeProgress: {
        l1: { iteration: 1, maxIterations: 3, status: 'awaiting_capture' },
      },
      flowSpec: {
        goal: 'Capture resume',
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
    expect(parsed.additionalContext).toContain('.prompt-language/vars/answer');
  });

  it('keeps capture failure reason and retry count visible when resuming an interrupted capture', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const state = {
      ...makeState('active', 'Capture retry resume'),
      captureNonce: 'resume12345',
      nodeProgress: {
        l1: {
          iteration: 2,
          maxIterations: 3,
          status: 'awaiting_capture',
          captureFailureReason: 'capture file empty or not found',
        },
      },
      flowSpec: {
        goal: 'Capture retry resume',
        nodes: [
          {
            kind: 'let',
            id: 'l1',
            variableName: 'answer',
            append: false,
            source: { type: 'prompt', text: 'What changed?' },
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
    expect(parsed.additionalContext).toContain(
      '[capture failed: capture file empty or not found — retry 2/3]',
    );
    expect(parsed.additionalContext).toContain('Variable capture');
    expect(parsed.additionalContext).toContain('.prompt-language/vars/answer');
  });

  it('re-emits named review judge capture when a review node is awaiting capture', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const state = {
      ...makeState('active', 'Review judge resume'),
      captureNonce: 'judge12345',
      nodeProgress: {
        rv1: { iteration: 1, maxIterations: 3, status: 'awaiting_capture' },
      },
      flowSpec: {
        goal: 'Review judge resume',
        nodes: [
          {
            kind: 'review',
            id: 'rv1',
            maxRounds: 3,
            judgeName: 'impl_quality',
            body: [{ kind: 'prompt', id: 'p1', text: 'Draft' }],
          },
        ],
        completionGates: [],
        defaults: { maxIterations: 5, maxAttempts: 3 },
        warnings: [],
        judges: [{ name: 'impl_quality', lines: ['kind: model'] }],
      },
    };
    await writeFile(join(stateDir, 'session-state.json'), JSON.stringify(state));

    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as { additionalContext: string };
    expect(parsed.additionalContext).toContain('JSON capture');
    expect(parsed.additionalContext).toContain('__review_judge_rv1__');
  });
});
