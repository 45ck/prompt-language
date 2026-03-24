import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'cf-hook-robust-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

interface HookResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runHook(hookName: string, input: string, cwd: string): HookResult {
  const srcRoot = join(import.meta.dirname, '..', '..', '..');
  const scriptPath = join(srcRoot, 'src', 'presentation', 'hooks', `${hookName}.ts`);
  const result = spawnSync(`npx tsx "${scriptPath}"`, {
    input,
    encoding: 'utf-8',
    cwd,
    timeout: 15_000,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'test-session',
    flowSpec: {
      goal: 'Robustness test',
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
    status: 'active',
    warnings: [],
    ...overrides,
  };
}

async function writeCorruptState(dir: string): Promise<void> {
  const stateDir = join(dir, '.prompt-language');
  await mkdir(stateDir, { recursive: true });
  await writeFile(join(stateDir, 'session-state.json'), '{{broken');
}

async function writeValidState(
  dir: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const stateDir = join(dir, '.prompt-language');
  await mkdir(stateDir, { recursive: true });
  await writeFile(join(stateDir, 'session-state.json'), JSON.stringify(makeState(overrides)));
}

// --- stop hook robustness ---

describe('stop hook robustness', () => {
  it('exits 0 on empty stdin (no state = no active flow)', () => {
    const result = runHook('stop', '', tempDir);
    expect(result.exitCode).toBe(0);
  }, 20_000);

  it('exits 0 on non-JSON stdin', () => {
    const result = runHook('stop', 'not json at all', tempDir);
    expect(result.exitCode).toBe(0);
  }, 20_000);

  it('exits 0 on JSON missing expected fields', () => {
    const result = runHook('stop', '{"foo": "bar"}', tempDir);
    expect(result.exitCode).toBe(0);
  }, 20_000);

  it('exits 0 on corrupt session state (fail-open)', async () => {
    await writeCorruptState(tempDir);
    const result = runHook('stop', '{}', tempDir);
    expect(result.exitCode).toBe(0);
  }, 20_000);

  it('exits 0 when stop_hook_active is true (bypass)', async () => {
    await writeValidState(tempDir);
    const result = runHook('stop', JSON.stringify({ stop_hook_active: true }), tempDir);
    expect(result.exitCode).toBe(0);
  }, 20_000);
});

// --- user-prompt-submit hook robustness ---

describe('user-prompt-submit hook robustness', () => {
  it('exits 0 and returns empty string on empty stdin', () => {
    const result = runHook('user-prompt-submit', '', tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  }, 20_000);

  it('exits 0 and passes through non-JSON stdin', () => {
    const result = runHook('user-prompt-submit', 'raw text', tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('raw text');
  }, 20_000);

  it('exits 0 and passes through JSON without prompt field', () => {
    const input = '{"foo": 1}';
    const result = runHook('user-prompt-submit', input, tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(input);
  }, 20_000);
});

// --- post-tool-use hook robustness ---

describe('post-tool-use hook robustness', () => {
  it('exits 0 on empty stdin', () => {
    const result = runHook('post-tool-use', '', tempDir);
    expect(result.exitCode).toBe(0);
  }, 20_000);

  it('exits 0 on corrupt session state', async () => {
    await writeCorruptState(tempDir);
    const result = runHook('post-tool-use', '{}', tempDir);
    expect(result.exitCode).toBe(0);
  }, 20_000);
});

// --- task-completed hook robustness ---

describe('task-completed hook robustness', () => {
  it('exits 0 on empty stdin (no state = not blocked)', () => {
    const result = runHook('task-completed', '', tempDir);
    expect(result.exitCode).toBe(0);
  }, 20_000);

  it('exits 0 on corrupt session state', async () => {
    await writeCorruptState(tempDir);
    const result = runHook('task-completed', '{}', tempDir);
    expect(result.exitCode).toBe(0);
  }, 20_000);
});

// --- pre-compact hook robustness ---

describe('pre-compact hook robustness', () => {
  it('exits 0 on empty stdin', () => {
    const result = runHook('pre-compact', '', tempDir);
    expect(result.exitCode).toBe(0);
  }, 20_000);

  it('handles very large state file without crashing', async () => {
    const largeVar = 'x'.repeat(50_000);
    await writeValidState(tempDir, { variables: { bigvar: largeVar } });
    const result = runHook('pre-compact', '{}', tempDir);
    expect(result.exitCode).toBe(0);
    // Active flow should produce additionalContext output
    if (result.stdout) {
      const parsed = JSON.parse(result.stdout) as { additionalContext: string };
      expect(parsed.additionalContext).toContain('[prompt-language]');
    }
  }, 20_000);
});

// --- Cross-cutting: all hooks survive missing .prompt-language dir ---

describe('all hooks survive missing .prompt-language dir', () => {
  const hookNames = [
    'stop',
    'user-prompt-submit',
    'post-tool-use',
    'task-completed',
    'pre-compact',
  ];

  for (const hookName of hookNames) {
    it(`${hookName} exits 0 with no state directory`, () => {
      // tempDir has no .prompt-language subdirectory
      const result = runHook(hookName, '{}', tempDir);
      expect(result.exitCode).toBe(0);
    }, 20_000);
  }
});
