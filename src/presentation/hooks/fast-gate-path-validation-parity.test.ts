import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveFileExistsPredicatePath } from '../../application/evaluate-completion.js';

const HOOK_TEST_TIMEOUT_MS = 30_000;

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'cf-fast-gate-'));
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

function runHook(hookName: 'post-tool-use' | 'codex-post-tool-use', cwd: string): HookResult {
  const srcRoot = join(import.meta.dirname, '..', '..', '..');
  const scriptPath = join(srcRoot, 'src', 'presentation', 'hooks', `${hookName}.ts`);
  const result = spawnSync(`npx tsx "${scriptPath}"`, {
    input: JSON.stringify({ tool_name: 'Write' }),
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

async function writeActiveState(predicate: string): Promise<void> {
  const stateDir = join(tempDir, '.prompt-language');
  await mkdir(stateDir, { recursive: true });
  await writeFile(
    join(stateDir, 'session-state.json'),
    JSON.stringify({
      version: 1,
      sessionId: 'test-session',
      flowSpec: {
        goal: 'Fast gate validation parity',
        nodes: [{ kind: 'prompt', id: 'p1', text: 'do work' }],
        completionGates: [{ predicate }],
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
      captureNonce: '11111111-1111-4111-8111-111111111111',
    }),
  );
}

describe.each(['post-tool-use', 'codex-post-tool-use'] as const)(
  '%s fast-gate file_exists validation parity',
  (hookName) => {
    it.each([
      {
        predicate: 'file_exists nested/output.txt',
        setup: async () => {
          await mkdir(join(tempDir, 'nested'), { recursive: true });
          await writeFile(join(tempDir, 'nested', 'output.txt'), 'done');
        },
        expectedStatus: 'PASS',
      },
      {
        predicate: 'file_exists $(whoami)',
        expectedStatus: null,
      },
      {
        predicate: 'file_exists /tmp/output.txt',
        expectedStatus: null,
      },
      {
        predicate: 'file_exists ../secret.txt',
        expectedStatus: null,
      },
    ])(
      'matches evaluator semantics for $predicate',
      async ({ predicate, setup, expectedStatus }) => {
        await writeActiveState(predicate);
        if (setup) {
          await setup();
        }

        const result = runHook(hookName, tempDir);
        expect(result.exitCode).toBe(0);

        const validatedPath = resolveFileExistsPredicatePath(predicate);
        if (validatedPath) {
          expect(expectedStatus).not.toBeNull();
          expect(result.stderr).toContain(`Gate progress: ${predicate} [${expectedStatus}]`);
          return;
        }

        expect(expectedStatus).toBeNull();
        expect(result.stderr).not.toContain(`Gate progress: ${predicate}`);
      },
    );
  },
);
