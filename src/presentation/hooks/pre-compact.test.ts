import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'cf-pre-compact-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
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
    timeout: 10_000,
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
});
