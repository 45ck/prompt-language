import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HOOK_TEST_TIMEOUT_MS = 30_000;

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'cf-pre-compact-'));
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

function runHook(input: string, cwd: string, env: NodeJS.ProcessEnv = {}): HookResult {
  const srcRoot = join(import.meta.dirname, '..', '..', '..');
  const scriptPath = join(srcRoot, 'src', 'presentation', 'hooks', 'pre-compact.ts');
  const result = spawnSync(`npx tsx "${scriptPath}"`, {
    input,
    encoding: 'utf-8',
    cwd,
    env: { ...process.env, ...env },
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
    expect(result.stderr).toContain(
      '[prompt-language] render-mode requested=compact actual=full escalated=true triggerIds=compaction_boundary',
    );
    expect(parsed.additionalContext).toContain(
      '[prompt-language] Active flow preserved across compaction.',
    );
    expect(parsed.additionalContext).toContain(
      '[prompt-language] render-mode requested=compact actual=full escalated=true triggerIds=compaction_boundary',
    );
    expect(parsed.additionalContext).toContain(
      '[prompt-language] Auto-escalated to full mode: hook pre-compact crossed a compaction boundary',
    );
    expect(parsed.additionalContext).toContain('[prompt-language summary]');
    expect(parsed.additionalContext).toContain('status: active');
    expect(parsed.additionalContext).toContain('step: 1/1');
    expect(parsed.additionalContext).toContain('node: prompt: do work');
    expect(parsed.additionalContext).toContain('vars: 0');
    expect(parsed.additionalContext).toContain('Build feature');
    expect(parsed.additionalContext).toContain('DSL reference');
  });

  it('emits render byte metrics when the env flag is enabled', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(
      join(stateDir, 'session-state.json'),
      JSON.stringify(makeState('active', 'Metric compact task')),
    );

    const result = runHook('{}', tempDir, {
      PROMPT_LANGUAGE_RENDER_BYTE_METRICS: '1',
    });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain(
      '[prompt-language] render-bytes hook=pre-compact channel=additionalContext',
    );
    expect(result.stderr).toMatch(/stable_bytes=\d+/);
    expect(result.stderr).toMatch(/dynamic_bytes=\d+/);
    expect(result.stderr).toMatch(/total_bytes=\d+/);
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
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('session-state.json is corrupted, trying backup');
  });

  it('finds awaiting_capture let node nested inside try block', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const state = {
      ...makeState('active', 'Nested capture test'),
      captureNonce: 'nested12345',
      nodeProgress: {
        l2: { iteration: 1, maxIterations: 3, status: 'awaiting_capture' },
      },
      flowSpec: {
        goal: 'Nested capture test',
        nodes: [
          {
            kind: 'try',
            id: 't1',
            body: [
              {
                kind: 'let',
                id: 'l2',
                declarationKind: 'let',
                variableName: 'deepVar',
                append: false,
                source: { type: 'prompt', text: 'Nested question?' },
              },
            ],
            catchCondition: 'command_failed',
            catchBody: [],
            finallyBody: [],
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
    expect(parsed.additionalContext).toContain('deepVar');
  });

  it('includes capture re-injection when awaiting_capture (capture_failure)', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const state = {
      ...makeState('active', 'Capture test'),
      captureNonce: 'abc12345',
      nodeProgress: {
        l1: { iteration: 1, maxIterations: 3, status: 'awaiting_capture' },
      },
      flowSpec: {
        goal: 'Capture test',
        nodes: [
          {
            kind: 'let',
            id: 'l1',
            declarationKind: 'let',
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
    expect(result.stderr).toContain(
      '[prompt-language] render-mode requested=compact actual=full escalated=true triggerIds=compaction_boundary,capture_failure',
    );
    expect(result.stderr).toContain(
      '[prompt-language] WARNING: compact mode suppressed; full mode required for hook pre-compact crossed a compaction boundary; capture recovery is active',
    );
    expect(parsed.additionalContext).toContain(
      '[prompt-language] render-mode requested=compact actual=full escalated=true triggerIds=compaction_boundary,capture_failure',
    );
    expect(parsed.additionalContext).toContain(
      '[prompt-language] Auto-escalated to full mode: hook pre-compact crossed a compaction boundary; capture recovery is active',
    );
    expect(parsed.additionalContext).toContain('Variable capture');
    expect(parsed.additionalContext).toContain('answer');
  });

  it('re-emits a pending prompt node across compaction', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const state = {
      ...makeState('active', 'Prompt compaction'),
      nodeProgress: {
        p1: { iteration: 1, maxIterations: 1, status: 'awaiting_capture' },
      },
      flowSpec: {
        goal: 'Prompt compaction',
        nodes: [{ kind: 'prompt', id: 'p1', text: 'Continue with cleanup' }],
        completionGates: [],
        defaults: { maxIterations: 5, maxAttempts: 3 },
        warnings: [],
      },
    };
    await writeFile(join(stateDir, 'session-state.json'), JSON.stringify(state));

    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as { additionalContext: string };
    expect(parsed.additionalContext).toContain('IMPORTANT: A prompt step is still pending.');
    expect(parsed.additionalContext).toContain('Continue with cleanup');
  });

  it('keeps capture handoff instructions visible across a compaction boundary after a capture-file failure', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const state = {
      ...makeState('active', 'Capture retry compact'),
      captureNonce: 'compact12345',
      nodeProgress: {
        l1: {
          iteration: 2,
          maxIterations: 3,
          status: 'awaiting_capture',
          captureFailureReason: 'capture file empty or not found',
        },
      },
      flowSpec: {
        goal: 'Capture retry compact',
        nodes: [
          {
            kind: 'let',
            id: 'l1',
            declarationKind: 'let',
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
      '[prompt-language] render-mode requested=compact actual=full escalated=true triggerIds=compaction_boundary,capture_failure',
    );
    expect(parsed.additionalContext).toContain('IMPORTANT: A prompt step is still pending.');
    expect(parsed.additionalContext).toContain(
      'Variable capture for "answer" was not found. Please save your response',
    );
    expect(parsed.additionalContext).toContain('.prompt-language/vars/answer');
  });

  it('includes review judge capture re-injection when a review node is awaiting capture', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const state = {
      ...makeState('active', 'Review capture test'),
      captureNonce: 'judge12345',
      nodeProgress: {
        rv1: { iteration: 1, maxIterations: 3, status: 'awaiting_capture' },
      },
      flowSpec: {
        goal: 'Review capture test',
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
    expect(parsed.additionalContext).toContain(
      '[prompt-language] render-mode requested=compact actual=full escalated=true triggerIds=compaction_boundary,capture_failure',
    );
    expect(parsed.additionalContext).toContain('A prompt step is still pending');
    expect(parsed.additionalContext).toContain('__review_judge_rv1__');
    expect(parsed.additionalContext).toContain('JSON capture');
  });

  it('auto-escalates to full mode when backup recovery makes compact rendering unsafe', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    await writeFile(join(stateDir, 'session-state.json'), '{{broken primary');
    await writeFile(
      join(stateDir, 'session-state.bak.json'),
      JSON.stringify({
        ...makeState('active', 'Recovered flow'),
        flowSpec: {
          goal: 'Recovered flow',
          nodes: [{ kind: 'run', id: 'r1', command: 'npm test' }],
          completionGates: [],
          defaults: { maxIterations: 5, maxAttempts: 3 },
          warnings: [],
        },
      }),
    );

    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain(
      '[prompt-language] render-mode requested=compact actual=full escalated=true triggerIds=compaction_boundary,resume_boundary,state_mismatch',
    );
    expect(result.stderr).toContain(
      '[prompt-language] WARNING: compact mode suppressed; full mode required for hook pre-compact crossed a compaction boundary; state recovered from session-state.bak.json',
    );

    const parsed = JSON.parse(result.stdout) as { additionalContext: string };
    expect(parsed.additionalContext).toContain(
      '[prompt-language] render-mode requested=compact actual=full escalated=true triggerIds=compaction_boundary,resume_boundary,state_mismatch',
    );
    expect(parsed.additionalContext).toContain(
      '[prompt-language] Auto-escalated to full mode: hook pre-compact crossed a compaction boundary; state recovered from session-state.bak.json',
    );
    expect(parsed.additionalContext).toContain('> run: npm test');
    expect(parsed.additionalContext).not.toContain('>R: npm test');
  });

  it('auto-escalates to full mode when checksum sanitization clears gate results', async () => {
    const stateDir = join(tempDir, '.prompt-language');
    await mkdir(stateDir, { recursive: true });
    const state = {
      ...makeState('active', 'Checksum-sanitized flow'),
      flowSpec: {
        goal: 'Checksum-sanitized flow',
        nodes: [{ kind: 'run', id: 'r1', command: 'npm test' }],
        completionGates: [{ predicate: 'tests_pass' }],
        defaults: { maxIterations: 5, maxAttempts: 3 },
        warnings: [],
      },
      gateResults: { tests_pass: true },
      gateDiagnostics: { tests_pass: { passed: true } },
      _checksum: 'deadbeef'.repeat(8),
    };
    await writeFile(join(stateDir, 'session-state.json'), JSON.stringify(state, null, 2), 'utf-8');

    const result = runHook('{}', tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain('state file checksum mismatch, clearing gate results');
    expect(result.stderr).toContain(
      '[prompt-language] render-mode requested=compact actual=full escalated=true triggerIds=compaction_boundary,state_mismatch',
    );
    expect(result.stderr).toContain(
      '[prompt-language] WARNING: compact mode suppressed; full mode required for hook pre-compact crossed a compaction boundary; state checksum mismatch required gate-result sanitization',
    );

    const parsed = JSON.parse(result.stdout) as { additionalContext: string };
    expect(parsed.additionalContext).toContain(
      '[prompt-language] Active flow preserved across compaction.',
    );
    expect(parsed.additionalContext).toContain(
      '[prompt-language] render-mode requested=compact actual=full escalated=true triggerIds=compaction_boundary,state_mismatch',
    );
    expect(parsed.additionalContext).toContain(
      '[prompt-language] Auto-escalated to full mode: hook pre-compact crossed a compaction boundary; state checksum mismatch required gate-result sanitization',
    );
    expect(parsed.additionalContext).toContain('[prompt-language summary]');
    expect(parsed.additionalContext).toContain('gates: 0/1 passed');
    expect(parsed.additionalContext).toContain('tests_pass  [pending]');
    expect(parsed.additionalContext).not.toContain('tests_pass  [pass]');
  });
});
