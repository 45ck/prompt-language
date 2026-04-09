import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HOOK_TEST_TIMEOUT_MS = 30_000;

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'cf-hook-'));
});

afterEach(async () => {
  await rm(tempDir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
});

function runHook(input: string, cwd: string): string {
  const srcRoot = join(import.meta.dirname, '..', '..', '..');
  const scriptPath = join(srcRoot, 'src', 'presentation', 'hooks', 'user-prompt-submit.ts');
  return execSync(`npx tsx "${scriptPath}"`, {
    input,
    encoding: 'utf-8',
    cwd,
    timeout: HOOK_TEST_TIMEOUT_MS,
  });
}

describe('user-prompt-submit hook (integration)', () => {
  it('passes through prompt when no active flow', () => {
    const input = JSON.stringify({ prompt: 'Hello world' });
    const output = runHook(input, tempDir);
    const result = JSON.parse(output);
    expect(result.prompt).toBe('Hello world');
  });

  it('passes through prompt when state file contains corrupted JSON (fail-open)', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(join(stateDir, 'session-state.json'), '{{corrupted garbage');

    const input = JSON.stringify({ prompt: 'Hello world' });
    const output = runHook(input, tempDir);
    const result = JSON.parse(output);
    expect(result.prompt).toBe('Hello world');
  });

  it('injects context when flow state file exists', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const state = {
      sessionId: 'test-session',
      flowSpec: {
        goal: 'Build feature',
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

    const input = JSON.stringify({ prompt: 'Next step' });
    const output = runHook(input, tempDir);
    const result = JSON.parse(output);
    expect(result.prompt).toContain('[prompt-language]');
    expect(result.prompt).toContain('Build feature');
    expect(result.prompt).toContain('Next step');
  });
});
