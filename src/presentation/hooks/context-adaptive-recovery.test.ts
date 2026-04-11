import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HOOK_TEST_TIMEOUT_MS = process.platform === 'win32' ? 60_000 : 30_000;

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'cf-context-adaptive-recovery-'));
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

function runHook(scriptName: 'session-start.ts' | 'pre-compact.ts', cwd: string): HookResult {
  const srcRoot = join(import.meta.dirname, '..', '..', '..');
  const scriptPath = join(srcRoot, 'src', 'presentation', 'hooks', scriptName);
  const result = spawnSync(`npx tsx "${scriptPath}"`, {
    input: '{}',
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

function makeActiveState(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    sessionId: 'test-session',
    flowSpec: {
      goal: 'Recovery flow',
      nodes: [
        { kind: 'prompt', id: 'p1', text: 'outline the plan' },
        { kind: 'run', id: 'r1', command: 'npm test' },
      ],
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
    captureNonce: 'test-nonce-12345678',
    ...overrides,
  };
}

async function writeStateFiles(options: {
  primary?: string;
  backup?: string;
  backup2?: string;
}): Promise<void> {
  const stateDir = join(tempDir, '.prompt-language');
  await mkdir(stateDir, { recursive: true });

  if (options.primary !== undefined) {
    await writeFile(join(stateDir, 'session-state.json'), options.primary, 'utf-8');
  }
  if (options.backup !== undefined) {
    await writeFile(join(stateDir, 'session-state.bak.json'), options.backup, 'utf-8');
  }
  if (options.backup2 !== undefined) {
    await writeFile(join(stateDir, 'session-state.bak2.json'), options.backup2, 'utf-8');
  }
}

function parseAdditionalContext(stdout: string): string {
  return (JSON.parse(stdout) as { additionalContext: string }).additionalContext;
}

describe('context-adaptive recovery hooks', () => {
  it('session-start resumes from backup after interrupted state corruption and keeps the current step visible (resume_boundary)', async () => {
    const recovered = makeActiveState({
      sessionId: 'recovered-backup',
      flowSpec: {
        goal: 'Recovered interrupted flow',
        nodes: [
          { kind: 'prompt', id: 'p1', text: 'collect evidence' },
          { kind: 'run', id: 'r1', command: 'npm test' },
        ],
        completionGates: [],
        defaults: { maxIterations: 5, maxAttempts: 3 },
        warnings: [],
      },
      currentNodePath: [1],
    });

    await writeStateFiles({
      primary: JSON.stringify({
        sessionId: 'corrupt-primary',
        status: 'active',
        variables: {},
        flowSpec: recovered.flowSpec,
      }),
      backup: JSON.stringify(recovered),
    });

    const result = runHook('session-start.ts', tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('session-state.json is corrupted, trying backup');
    expect(result.stderr).toContain('Recovered state from backup file');
    expect(result.stderr).toContain('Recovered interrupted flow');
    expect(result.stderr).toContain('> run: npm test');

    const additionalContext = parseAdditionalContext(result.stdout);
    expect(additionalContext).toContain('[prompt-language] Active flow detected');
    expect(additionalContext).toContain('Recovered interrupted flow');
    expect(additionalContext).toContain('> run: npm test');
  });

  it('session-start surfaces PLR-004 with recovery action when no valid snapshot remains (state_mismatch)', async () => {
    await writeStateFiles({
      primary: '{{broken primary',
      backup: '{{broken backup',
      backup2: '{{broken backup2',
    });

    const result = runHook('session-start.ts', tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('[prompt-language] PLR-004');
    expect(result.stderr).toContain('Action: Run "reset flow"');

    const additionalContext = parseAdditionalContext(result.stdout);
    expect(additionalContext).toContain('PLR-004');
    expect(additionalContext).toContain(
      'Resume state is corrupted and could not be recovered from backup.',
    );
    expect(additionalContext).toContain(
      'Action: Run "reset flow" or remove the .prompt-language/session-state*.json files before continuing.',
    );
  });

  it('session-start keeps capture failure details visible on resume and re-emits the retry prompt (capture_failure)', async () => {
    const state = makeActiveState({
      flowSpec: {
        goal: 'Capture retry flow',
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
      currentNodePath: [0],
      nodeProgress: {
        l1: {
          iteration: 2,
          maxIterations: 3,
          status: 'awaiting_capture',
          captureFailureReason: 'capture file empty or not found',
        },
      },
      captureNonce: 'capture1234',
    });

    await writeStateFiles({ primary: JSON.stringify(state) });

    const result = runHook('session-start.ts', tempDir);
    expect(result.exitCode).toBe(0);

    const additionalContext = parseAdditionalContext(result.stdout);
    expect(additionalContext).toContain('[prompt-language] Active flow detected');
    expect(additionalContext).toContain(
      '[capture failed: capture file empty or not found — retry 2/3]',
    );
    expect(additionalContext).toContain('Variable capture');
    expect(additionalContext).toContain('.prompt-language/vars/answer');
  });

  it('pre-compact recovers from backup and preserves compact current-step and gate visibility (compaction_boundary)', async () => {
    const recovered = makeActiveState({
      sessionId: 'compact-recovery',
      flowSpec: {
        goal: 'Recovered compact flow',
        nodes: [
          { kind: 'prompt', id: 'p1', text: 'gather logs' },
          { kind: 'run', id: 'r1', command: 'npm test' },
        ],
        completionGates: [{ predicate: 'tests_pass' }, { predicate: 'lint_pass' }],
        defaults: { maxIterations: 5, maxAttempts: 3 },
        warnings: [],
      },
      currentNodePath: [1],
      gateResults: { tests_pass: true, lint_pass: false },
    });

    await writeStateFiles({
      primary: '{{broken primary',
      backup: JSON.stringify(recovered),
    });

    const result = runHook('pre-compact.ts', tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('session-state.json is corrupted, trying backup');
    expect(result.stderr).toContain('Recovered state from backup file');

    const additionalContext = parseAdditionalContext(result.stdout);
    expect(additionalContext).toContain(
      '[prompt-language] Active flow preserved across compaction.',
    );
    expect(additionalContext).toContain('[pl] Recovered compact flow | active');
    expect(additionalContext).toContain('>R: npm test');
    expect(additionalContext).toContain('gates: +tests_pass -lint_pass');
  });

  it('pre-compact preserves capture retry instructions when backup recovery crosses a compaction boundary (compaction_boundary, capture_failure)', async () => {
    const recovered = makeActiveState({
      sessionId: 'compact-capture-recovery',
      flowSpec: {
        goal: 'Recovered capture flow',
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
      currentNodePath: [0],
      nodeProgress: {
        l1: {
          iteration: 2,
          maxIterations: 3,
          status: 'awaiting_capture',
          captureFailureReason: 'capture file empty or not found',
        },
      },
      captureNonce: 'capture5678',
    });

    await writeStateFiles({
      primary: '{{broken primary',
      backup: JSON.stringify(recovered),
    });

    const result = runHook('pre-compact.ts', tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('session-state.json is corrupted, trying backup');
    expect(result.stderr).toContain('Recovered state from backup file');

    const additionalContext = parseAdditionalContext(result.stdout);
    expect(additionalContext).toContain(
      '[prompt-language] Active flow preserved across compaction.',
    );
    expect(additionalContext).toContain('Recovered capture flow');
    expect(additionalContext).toContain('IMPORTANT: Capture is in progress.');
    expect(additionalContext).toContain('Variable capture');
    expect(additionalContext).toContain('.prompt-language/vars/answer');
  });
});
