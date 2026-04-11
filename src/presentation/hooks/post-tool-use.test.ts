import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureTagName } from '../../domain/capture-prompt.js';

const HOOK_TEST_TIMEOUT_MS = 30_000;

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'cf-post-tool-'));
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
  const scriptPath = join(srcRoot, 'src', 'presentation', 'hooks', 'post-tool-use.ts');
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
    raceChildren: {},
    captureNonce: '11111111-1111-4111-8111-111111111111',
  };
}

describe('post-tool-use hook (integration)', () => {
  it('exits 0 when no active flow', () => {
    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
  });

  it('writes colorized flow to stderr when flow is active', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(
      join(stateDir, 'session-state.json'),
      JSON.stringify(makeState('active', 'My task')),
    );

    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('[PL]');
    expect(result.stderr).toContain('My task');
    // Should contain ANSI codes (colorized)
    expect(result.stderr).toContain('\x1b[');
  });

  it('does not write to stderr when flow is completed', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(
      join(stateDir, 'session-state.json'),
      JSON.stringify(makeState('completed', 'Done task')),
    );

    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).not.toContain('[PL]');
  });

  it('exits 0 on corrupted state (fail-open)', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(join(stateDir, 'session-state.json'), '{{broken json');

    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
  });

  it('extracts capture tags from tool output payload text', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(
      join(stateDir, 'session-state.json'),
      JSON.stringify(makeState('active', 'Capture from tool output')),
    );

    const tag = captureTagName('11111111-1111-4111-8111-111111111111');
    const hookInput = JSON.stringify({
      tool_name: 'Bash',
      tool_response: {
        output: `done <${tag} name="answer">tool value</${tag}>`,
      },
    });

    const result = runHook(hookInput, tempDir);
    expect(result.exitCode).toBe(0);
    await expect(readFile(join(stateDir, 'vars', 'answer'), 'utf-8')).resolves.toBe('tool value');
  });

  it('extracts capture tags from response_text when tool output has none', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(
      join(stateDir, 'session-state.json'),
      JSON.stringify(makeState('active', 'Capture from response text')),
    );

    const tag = captureTagName('11111111-1111-4111-8111-111111111111');
    const hookInput = JSON.stringify({
      tool_name: 'Bash',
      tool_response: { output: 'plain tool output only' },
      response_text: `final answer <${tag} name="answer">response text value</${tag}>`,
    });

    const result = runHook(hookInput, tempDir);
    expect(result.exitCode).toBe(0);
    await expect(readFile(join(stateDir, 'vars', 'answer'), 'utf-8')).resolves.toBe(
      'response text value',
    );
  });

  it('extracts capture tags from nested full response text fields', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(
      join(stateDir, 'session-state.json'),
      JSON.stringify(makeState('active', 'Capture from nested response text')),
    );

    const tag = captureTagName('11111111-1111-4111-8111-111111111111');
    const hookInput = JSON.stringify({
      tool_name: 'Bash',
      tool_response: { output: 'plain tool output only' },
      result: {
        response: {
          text: `nested reply <${tag} name="answer">nested response value</${tag}>`,
        },
      },
    });

    const result = runHook(hookInput, tempDir);
    expect(result.exitCode).toBe(0);
    await expect(readFile(join(stateDir, 'vars', 'answer'), 'utf-8')).resolves.toBe(
      'nested response value',
    );
  });

  it('preserves file-write and tool-output precedence over response_text capture tags', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    const varsDir = join(stateDir, 'vars');
    await mkdir(varsDir, { recursive: true });
    await writeFile(
      join(stateDir, 'session-state.json'),
      JSON.stringify(makeState('active', 'Capture precedence')),
    );

    const tag = captureTagName('11111111-1111-4111-8111-111111111111');

    await writeFile(join(varsDir, 'fileCapture'), 'written by file channel');

    const hookInput = JSON.stringify({
      tool_name: 'Bash',
      tool_response: {
        output: [
          `tool <${tag} name="toolWins">tool output value</${tag}>`,
          `tool <${tag} name="fileCapture">tool should not override file</${tag}>`,
        ],
      },
      response_text: [
        `reply <${tag} name="toolWins">response should lose</${tag}>`,
        `reply <${tag} name="responseOnly">response only value</${tag}>`,
      ],
    });

    const result = runHook(hookInput, tempDir);
    expect(result.exitCode).toBe(0);
    await expect(readFile(join(varsDir, 'fileCapture'), 'utf-8')).resolves.toBe(
      'written by file channel',
    );
    await expect(readFile(join(varsDir, 'toolWins'), 'utf-8')).resolves.toBe('tool output value');
    await expect(readFile(join(varsDir, 'responseOnly'), 'utf-8')).resolves.toBe(
      'response only value',
    );
  });

  it('keeps tool output precedence over nested full response text capture tags', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    const varsDir = join(stateDir, 'vars');
    await mkdir(varsDir, { recursive: true });
    await writeFile(
      join(stateDir, 'session-state.json'),
      JSON.stringify(makeState('active', 'Nested capture precedence')),
    );

    const tag = captureTagName('11111111-1111-4111-8111-111111111111');
    const hookInput = JSON.stringify({
      tool_name: 'Bash',
      tool_response: {
        output: `tool <${tag} name="winner">tool output value</${tag}>`,
      },
      result: {
        response: {
          text: `reply <${tag} name="winner">response should lose</${tag}>`,
        },
      },
    });

    const result = runHook(hookInput, tempDir);
    expect(result.exitCode).toBe(0);
    await expect(readFile(join(varsDir, 'winner'), 'utf-8')).resolves.toBe('tool output value');
  });

  it('writes a compact progress notification when the tool payload includes stderr text', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(
      join(stateDir, 'session-state.json'),
      JSON.stringify(makeState('active', 'Progress task')),
    );

    const hookInput = JSON.stringify({
      tool_name: 'Bash',
      tool_response: {
        stderr: 'still working',
      },
    });

    const result = runHook(hookInput, tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('prompt: do work');
    expect(result.stderr).toContain('[PL]');
  });
});
