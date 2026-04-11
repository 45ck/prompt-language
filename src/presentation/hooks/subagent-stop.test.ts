import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HOOK_TEST_TIMEOUT_MS = process.platform === 'win32' ? 60_000 : 30_000;

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'cf-subagent-stop-'));
});

afterEach(async () => {
  await rm(tempDir, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 200,
  });
});

interface HookResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runHook(input: string, cwd: string): HookResult {
  const srcRoot = join(import.meta.dirname, '..', '..', '..');
  const scriptPath = join(srcRoot, 'src', 'presentation', 'hooks', 'subagent-stop.ts');
  try {
    const stdout = execSync(`npx tsx "${scriptPath}"`, {
      input,
      encoding: 'utf-8',
      cwd,
      timeout: HOOK_TEST_TIMEOUT_MS,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
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

function subagentPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    agent_transcript_path: join(tempDir, 'subagent-transcript.jsonl'),
    last_assistant_message: 'child summary',
    ...overrides,
  });
}

describe('subagent-stop hook (integration)', () => {
  it('exits 0 when no active flow exists', () => {
    const result = runHook(subagentPayload(), tempDir);
    expect(result.exitCode).toBe(0);
  });

  it('exits 2 when flow is active', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const state = {
      version: 1,
      sessionId: 'test-session',
      flowSpec: {
        goal: 'Active child task',
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
      spawnedChildren: {},
      raceChildren: {},
      captureNonce: 'test-nonce-1234',
    };
    await writeFile(join(stateDir, 'session-state.json'), JSON.stringify(state));

    const result = runHook(subagentPayload(), tempDir);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('[prompt-language]');
    expect(result.stderr).toContain('Active child task');
  });

  it('exits 0 when stop_hook_active is true (prevents infinite loop)', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const state = {
      version: 1,
      sessionId: 'test-session',
      flowSpec: {
        goal: 'Active child task',
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
      spawnedChildren: {},
      raceChildren: {},
      captureNonce: 'test-nonce-1234',
    };
    await writeFile(join(stateDir, 'session-state.json'), JSON.stringify(state));

    const result = runHook(subagentPayload({ stop_hook_active: true }), tempDir);
    expect(result.exitCode).toBe(0);
  });

  it('marks running spawned children failed when a terminal child flow stops', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const state = {
      version: 1,
      sessionId: 'test-session',
      flowSpec: {
        goal: 'Failed child task',
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
      status: 'failed',
      warnings: [],
      spawnedChildren: {
        child: {
          name: 'child',
          status: 'running',
          pid: 999999,
          stateDir: join(tempDir, '.prompt-language-child'),
        },
      },
      raceChildren: {},
      captureNonce: 'test-nonce-1234',
    };
    const statePath = join(stateDir, 'session-state.json');
    await writeFile(statePath, JSON.stringify(state));

    const result = runHook(subagentPayload(), tempDir);
    expect(result.exitCode).toBe(0);

    const saved = JSON.parse(await readFile(statePath, 'utf-8')) as {
      spawnedChildren: Record<string, { status: string }>;
    };
    expect(saved.spawnedChildren['child']?.status).toBe('failed');
  });
});
