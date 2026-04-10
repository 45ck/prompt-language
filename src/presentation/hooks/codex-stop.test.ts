import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HOOK_TEST_TIMEOUT_MS = process.platform === 'win32' ? 60_000 : 30_000;

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'cf-codex-stop-'));
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
  const scriptPath = join(srcRoot, 'src', 'presentation', 'hooks', 'codex-stop.ts');
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

describe('codex-stop hook (integration)', () => {
  it('exits 0 when no active flow exists', () => {
    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
  });

  it('renders classified gate outcomes instead of generic blocked text', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const state = {
      version: 1,
      sessionId: 'test-session',
      flowSpec: {
        goal: 'Gated task',
        nodes: [],
        completionGates: [{ predicate: 'tests_pass', command: 'node -e "process.exit(1)"' }],
        defaults: { maxIterations: 5, maxAttempts: 3 },
        warnings: [],
      },
      currentNodePath: [],
      nodeProgress: {},
      variables: {},
      gateResults: {},
      gateDiagnostics: {},
      status: 'completed',
      warnings: [],
      spawnedChildren: {},
      raceChildren: {},
      captureNonce: 'test-nonce-1234',
    };
    await writeFile(join(stateDir, 'session-state.json'), JSON.stringify(state));

    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('[prompt-language]');
    expect(result.stderr).toContain('PLO-001');
    expect(result.stderr).toContain('tests_pass');
  });
});
