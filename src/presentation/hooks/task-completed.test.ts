import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync, type ExecSyncOptionsWithStringEncoding } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'cf-task-'));
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
  const scriptPath = join(srcRoot, 'src', 'presentation', 'hooks', 'task-completed.ts');
  const opts: ExecSyncOptionsWithStringEncoding = {
    input,
    encoding: 'utf-8',
    cwd,
    timeout: 10_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  };
  try {
    const stdout = execSync(`npx tsx "${scriptPath}"`, opts);
    return { exitCode: 0, stdout, stderr: '' };
  } catch (error: unknown) {
    const e = error as {
      status: number;
      stdout: string;
      stderr: string;
    };
    return {
      exitCode: e.status,
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
    };
  }
}

describe('task-completed hook (integration)', () => {
  it('exits 0 when no active flow', () => {
    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
  });

  it('exits 0 when flow has no gates', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const state = {
      sessionId: 'test-session',
      flowSpec: {
        goal: 'Simple task',
        nodes: [],
        completionGates: [],
        defaults: { maxIterations: 5, maxAttempts: 3 },
        warnings: [],
      },
      currentNodePath: [0],
      nodeProgress: {},
      variables: {},
      gateResults: {},
      gateDiagnostics: {},
      status: 'active',
      warnings: [],
    };
    await writeFile(join(stateDir, 'session-state.json'), JSON.stringify(state));

    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
  });

  it('exits 2 when gate command fails', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const state = {
      sessionId: 'test-session',
      flowSpec: {
        goal: 'Gated task',
        nodes: [],
        completionGates: [{ predicate: 'tests_pass', command: 'node -e "process.exit(1)"' }],
        defaults: { maxIterations: 5, maxAttempts: 3 },
        warnings: [],
      },
      currentNodePath: [0],
      nodeProgress: {},
      variables: {},
      gateResults: {},
      gateDiagnostics: {},
      status: 'active',
      warnings: [],
    };
    await writeFile(join(stateDir, 'session-state.json'), JSON.stringify(state));

    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('tests_pass');
  });

  it('exits 0 when gate command passes', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const state = {
      sessionId: 'test-session',
      flowSpec: {
        goal: 'Passing task',
        nodes: [],
        completionGates: [{ predicate: 'echo_check', command: 'echo ok' }],
        defaults: { maxIterations: 5, maxAttempts: 3 },
        warnings: [],
      },
      currentNodePath: [0],
      nodeProgress: {},
      variables: {},
      gateResults: {},
      gateDiagnostics: {},
      status: 'active',
      warnings: [],
    };
    await writeFile(join(stateDir, 'session-state.json'), JSON.stringify(state));

    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
  });
});
