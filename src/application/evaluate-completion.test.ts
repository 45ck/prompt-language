import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  evaluateCompletion,
  resolveBuiltinCommand,
  isInvertedPredicate,
  detectTestCommand,
  resolveFileExistsPredicatePath,
} from './evaluate-completion.js';
import { InMemoryStateStore } from '../infrastructure/adapters/in-memory-state-store.js';
import { InMemoryCommandRunner } from '../infrastructure/adapters/in-memory-command-runner.js';
import { createSessionState } from '../domain/session-state.js';
import { FLOW_OUTCOME_CODES, RUNTIME_DIAGNOSTIC_CODES } from '../domain/diagnostic-report.js';
import { createFlowSpec, createCompletionGate } from '../domain/flow-spec.js';
import type { CommandRunner } from './ports/command-runner.js';

function makeStore(): InMemoryStateStore {
  return new InMemoryStateStore();
}

function makeRunner(): InMemoryCommandRunner {
  return new InMemoryCommandRunner();
}

function expectedFileExistsCommand(path: string): string {
  return `node -e "process.exit(require('node:fs').existsSync('${path}') ? 0 : 1)"`;
}

describe('evaluateCompletion', () => {
  it('allows completion when no active flow', async () => {
    const store = makeStore();
    const runner = makeRunner();
    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
    expect(result.diagnostics).toEqual([]);
    expect(result.outcomes).toEqual([]);
  });

  it('allows completion when flow has no gates', async () => {
    const store = makeStore();
    const runner = makeRunner();
    const spec = createFlowSpec('Simple task', []);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
    expect(result.outcomes).toEqual([]);

    const saved = await store.loadCurrent();
    expect(saved?.status).toBe('completed');
  });

  it('blocks completion when gate command fails', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('npm test', { exitCode: 1, stdout: '', stderr: 'FAIL' });

    const spec = createFlowSpec('Test task', [], [createCompletionGate('tests_pass', 'npm test')]);
    const session = createSessionState('s2', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('tests_pass');
    expect(result.gateResults['tests_pass']).toBe(false);
  });

  it('hard-stops after too many consecutive failures', async () => {
    const store = makeStore();
    const runner = makeRunner();

    const spec = createFlowSpec('Test task', [], [createCompletionGate('tests_pass', 'npm test')]);
    const session = createSessionState('s-hard-stop', spec);
    await store.save({ ...session, gateFailureCount: 50 });

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('hard-stopped');
    expect(result.gateResults).toEqual({});
    expect(result.diagnostics).toEqual([]);
    expect(result.outcomes).toEqual([
      {
        code: FLOW_OUTCOME_CODES.budgetExhausted,
        summary:
          'Gate evaluation hard-stopped after 50 consecutive failures. Flow marked as failed.',
      },
    ]);

    const saved = await store.loadCurrent();
    expect(saved?.status).toBe('failed');
  });

  it('applies backoff delay after the failure threshold', async () => {
    vi.useFakeTimers();
    try {
      const store = makeStore();
      const runner = makeRunner();
      runner.setResult('npm test', { exitCode: 0, stdout: 'OK', stderr: '' });

      const spec = createFlowSpec(
        'Backoff task',
        [],
        [createCompletionGate('tests_pass', 'npm test')],
      );
      const session = createSessionState('s-backoff', spec);
      await store.save({ ...session, gateFailureCount: 20 });

      const resultPromise = evaluateCompletion(store, runner);
      await vi.advanceTimersByTimeAsync(5000);
      const result = await resultPromise;

      expect(result.blocked).toBe(false);
      expect(result.gateResults['tests_pass']).toBe(true);

      const saved = await store.loadCurrent();
      expect(saved?.status).toBe('completed');
    } finally {
      vi.useRealTimers();
    }
  });

  it('allows completion when all gate commands pass', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('npm test', { exitCode: 0, stdout: 'OK', stderr: '' });
    runner.setResult('npm run lint', { exitCode: 0, stdout: 'OK', stderr: '' });

    const spec = createFlowSpec(
      'Full check',
      [],
      [
        createCompletionGate('tests_pass', 'npm test'),
        createCompletionGate('lint_pass', 'npm run lint'),
      ],
    );
    const session = createSessionState('s3', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
    expect(result.gateResults['tests_pass']).toBe(true);
    expect(result.gateResults['lint_pass']).toBe(true);

    const saved = await store.loadCurrent();
    expect(saved?.status).toBe('completed');
  });

  it('marks gate false when no command and not previously set', async () => {
    const store = makeStore();
    const runner = makeRunner();

    const spec = createFlowSpec('Manual gate', [], [createCompletionGate('manual_check')]);
    const session = createSessionState('s4', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(true);
    expect(result.gateResults['manual_check']).toBe(false);
    expect(result.diagnostics).toEqual([]);
    expect(result.outcomes).toEqual([
      {
        code: FLOW_OUTCOME_CODES.gateFailed,
        summary:
          'Completion gates failed: manual_check. Fix the failing checks before completing the task.',
      },
    ]);
  });

  it('treats non-boolean variable gates as false when no command is provided', async () => {
    const store = makeStore();
    const runner = makeRunner();

    const spec = createFlowSpec('Manual gate', [], [createCompletionGate('manual_check')]);
    const session = createSessionState('s4b', spec);
    await store.save({ ...session, variables: { ...session.variables, manual_check: 'yes' } });

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(true);
    expect(result.gateResults['manual_check']).toBe(false);
    expect(result.outcomes).toEqual([
      {
        code: FLOW_OUTCOME_CODES.gateFailed,
        summary:
          'Completion gates failed: manual_check. Fix the failing checks before completing the task.',
      },
    ]);
  });

  it('propagates command gate result to subsequent commandless gate sharing predicate', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('npm test', { exitCode: 0, stdout: 'OK', stderr: '' });

    const spec = createFlowSpec(
      'Shared predicate',
      [],
      [createCompletionGate('tests_pass', 'npm test'), createCompletionGate('tests_pass')],
    );
    const session = createSessionState('s-shared', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
    expect(result.gateResults['tests_pass']).toBe(true);
  });

  it('runs the correct commands', async () => {
    const store = makeStore();
    const runner = makeRunner();

    const spec = createFlowSpec(
      'Cmd check',
      [],
      [createCompletionGate('build_pass', 'npm run build')],
    );
    const session = createSessionState('s5', spec);
    await store.save(session);

    await evaluateCompletion(store, runner);
    expect(runner.executedCommands).toContain('npm run build');
  });

  it('resolves tests_pass predicate to npm test when no explicit command', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('npm test', { exitCode: 0, stdout: 'OK', stderr: '' });

    const spec = createFlowSpec('Parser gate', [], [createCompletionGate('tests_pass')]);
    const session = createSessionState('s-builtin', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
    expect(result.gateResults['tests_pass']).toBe(true);
    expect(runner.executedCommands).toContain('npm test');
  });

  it('resolves lint_pass predicate to npm run lint', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('npm run lint', { exitCode: 0, stdout: '', stderr: '' });

    const spec = createFlowSpec('Lint gate', [], [createCompletionGate('lint_pass')]);
    const session = createSessionState('s-lint', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
    expect(result.gateResults['lint_pass']).toBe(true);
  });

  it('resolves tests_fail as inverted — passes when command fails', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('npm test', { exitCode: 1, stdout: '', stderr: 'FAIL' });

    const spec = createFlowSpec('Inverted gate', [], [createCompletionGate('tests_fail')]);
    const session = createSessionState('s-inv', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
    expect(result.gateResults['tests_fail']).toBe(true);
  });

  it('resolves tests_fail as inverted — blocks when command succeeds', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('npm test', { exitCode: 0, stdout: 'OK', stderr: '' });

    const spec = createFlowSpec('Inverted gate fail', [], [createCompletionGate('tests_fail')]);
    const session = createSessionState('s-inv2', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(true);
    expect(result.gateResults['tests_fail']).toBe(false);
  });

  it('resolves diff_nonempty — passes when git diff exits non-zero', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('git diff --quiet', { exitCode: 1, stdout: '', stderr: '' });

    const spec = createFlowSpec('Diff gate', [], [createCompletionGate('diff_nonempty')]);
    const session = createSessionState('s-diff', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
    expect(result.gateResults['diff_nonempty']).toBe(true);
  });

  it('resolves file_exists predicate to a cross-platform command', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult(expectedFileExistsCommand('app.js'), { exitCode: 0, stdout: '', stderr: '' });

    const spec = createFlowSpec('File gate', [], [createCompletionGate('file_exists app.js')]);
    const session = createSessionState('s-file', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
    expect(result.gateResults['file_exists app.js']).toBe(true);
  });

  it('resolves file_exists with spaces in path', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult(expectedFileExistsCommand('dist/my file.js'), {
      exitCode: 0,
      stdout: '',
      stderr: '',
    });

    const spec = createFlowSpec(
      'File gate',
      [],
      [createCompletionGate('file_exists dist/my file.js')],
    );
    const session = createSessionState('s-file-space', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
    expect(result.gateResults['file_exists dist/my file.js']).toBe(true);
  });

  it('blocks when resolved builtin gate command fails', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('npm test', { exitCode: 1, stdout: '', stderr: 'FAIL' });

    const spec = createFlowSpec('Failing builtin', [], [createCompletionGate('tests_pass')]);
    const session = createSessionState('s-fail', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(true);
    expect(result.gateResults['tests_pass']).toBe(false);
  });

  it('explicit command overrides builtin resolution', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('yarn test', { exitCode: 0, stdout: 'OK', stderr: '' });

    const spec = createFlowSpec('Override', [], [createCompletionGate('tests_pass', 'yarn test')]);
    const session = createSessionState('s-override', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
    expect(runner.executedCommands).toContain('yarn test');
    expect(runner.executedCommands).not.toContain('npm test');
  });
});

describe('resolveBuiltinCommand', () => {
  it('maps tests_pass to npm test', () => {
    expect(resolveBuiltinCommand('tests_pass')).toBe('npm test');
  });

  it('maps tests_fail to npm test', () => {
    expect(resolveBuiltinCommand('tests_fail')).toBe('npm test');
  });

  it('maps lint_pass to npm run lint', () => {
    expect(resolveBuiltinCommand('lint_pass')).toBe('npm run lint');
  });

  it('maps lint_fail to npm run lint', () => {
    expect(resolveBuiltinCommand('lint_fail')).toBe('npm run lint');
  });

  it('maps diff_nonempty to git diff --quiet', () => {
    expect(resolveBuiltinCommand('diff_nonempty')).toBe('git diff --quiet');
  });

  it('maps file_exists <path> to a cross-platform Node command', () => {
    expect(resolveBuiltinCommand('file_exists app.js')).toBe(expectedFileExistsCommand('app.js'));
  });

  it('returns undefined for file_exists without a path', () => {
    expect(resolveBuiltinCommand('file_exists ')).toBeUndefined();
  });

  it('returns undefined for file_exists without a space', () => {
    expect(resolveBuiltinCommand('file_exists')).toBeUndefined();
  });

  it('rejects shell metacharacters in file_exists path', () => {
    expect(resolveBuiltinCommand('file_exists foo; rm -rf /')).toBeUndefined();
    expect(resolveBuiltinCommand('file_exists $(whoami)')).toBeUndefined();
    expect(resolveBuiltinCommand('file_exists `cat /etc/passwd`')).toBeUndefined();
    expect(resolveBuiltinCommand('file_exists foo | bar')).toBeUndefined();
    expect(resolveBuiltinCommand('file_exists foo && bar')).toBeUndefined();
  });

  it('rejects path traversal with ..', () => {
    expect(resolveBuiltinCommand('file_exists ../../etc/passwd')).toBeUndefined();
    expect(resolveBuiltinCommand('file_exists ../secret')).toBeUndefined();
    expect(resolveBuiltinCommand('file_exists foo/../bar')).toBeUndefined();
  });

  it('allows file_exists with spaces in path', () => {
    expect(resolveBuiltinCommand('file_exists dist/my file.js')).toBe(
      expectedFileExistsCommand('dist/my file.js'),
    );
  });

  it('rejects absolute paths in file_exists', () => {
    expect(resolveBuiltinCommand('file_exists /etc/passwd')).toBeUndefined();
    expect(resolveBuiltinCommand('file_exists /tmp/foo')).toBeUndefined();
  });

  it('rejects backslash in file_exists path', () => {
    expect(resolveBuiltinCommand('file_exists foo\\bar')).toBeUndefined();
  });

  // Bead 91zd: Reject Windows absolute paths explicitly
  it('rejects Windows drive-letter absolute paths in file_exists', () => {
    expect(resolveBuiltinCommand('file_exists C:\\Windows\\System32\\config')).toBeUndefined();
    expect(resolveBuiltinCommand('file_exists D:\\secret\\file.txt')).toBeUndefined();
  });

  it('allows safe paths with dots, slashes, and hyphens', () => {
    expect(resolveBuiltinCommand('file_exists src/foo-bar/baz.ts')).toBe(
      expectedFileExistsCommand('src/foo-bar/baz.ts'),
    );
    expect(resolveBuiltinCommand('file_exists ./a/b.txt')).toBe(
      expectedFileExistsCommand('./a/b.txt'),
    );
  });

  it('returns undefined for unknown predicates', () => {
    expect(resolveBuiltinCommand('custom_check')).toBeUndefined();
  });

  it('returns undefined for command_succeeded (not yet implemented)', () => {
    expect(resolveBuiltinCommand('command_succeeded')).toBeUndefined();
  });

  // H#93: Multi-language gate predicates
  it('maps pytest_pass to pytest', () => {
    expect(resolveBuiltinCommand('pytest_pass')).toBe('pytest');
  });

  it('maps go_test_pass to go test ./...', () => {
    expect(resolveBuiltinCommand('go_test_pass')).toBe('go test ./...');
  });

  it('maps cargo_test_pass to cargo test', () => {
    expect(resolveBuiltinCommand('cargo_test_pass')).toBe('cargo test');
  });

  // H#4: "not" prefix resolution
  it('resolves "not tests_pass" to npm test', () => {
    expect(resolveBuiltinCommand('not tests_pass')).toBe('npm test');
  });

  it('resolves "not file_exists app.js" to the same built-in command', () => {
    expect(resolveBuiltinCommand('not file_exists app.js')).toBe(
      expectedFileExistsCommand('app.js'),
    );
  });
});

describe('resolveFileExistsPredicatePath', () => {
  it('returns a safe relative file_exists path', () => {
    expect(resolveFileExistsPredicatePath('file_exists nested/output.txt')).toBe(
      'nested/output.txt',
    );
  });

  it('returns undefined for unsafe file_exists predicates', () => {
    expect(resolveFileExistsPredicatePath('file_exists $(whoami)')).toBeUndefined();
  });

  it('returns undefined for absolute file_exists predicates', () => {
    expect(resolveFileExistsPredicatePath('file_exists /tmp/output.txt')).toBeUndefined();
  });

  it('returns undefined for traversal file_exists predicates', () => {
    expect(resolveFileExistsPredicatePath('file_exists ../secret.txt')).toBeUndefined();
  });
});

describe('isInvertedPredicate', () => {
  it('returns true for tests_fail', () => {
    expect(isInvertedPredicate('tests_fail')).toBe(true);
  });

  it('returns true for lint_fail', () => {
    expect(isInvertedPredicate('lint_fail')).toBe(true);
  });

  it('returns true for diff_nonempty', () => {
    expect(isInvertedPredicate('diff_nonempty')).toBe(true);
  });

  it('returns false for tests_pass', () => {
    expect(isInvertedPredicate('tests_pass')).toBe(false);
  });

  it('returns false for unknown predicates', () => {
    expect(isInvertedPredicate('custom_check')).toBe(false);
  });

  // H#93: Multi-language inverted predicates
  it('returns true for pytest_fail', () => {
    expect(isInvertedPredicate('pytest_fail')).toBe(true);
  });

  it('returns true for go_test_fail', () => {
    expect(isInvertedPredicate('go_test_fail')).toBe(true);
  });

  it('returns true for cargo_test_fail', () => {
    expect(isInvertedPredicate('cargo_test_fail')).toBe(true);
  });

  // H#4: "not" prefix flips inversion
  it('returns true for "not tests_pass" (non-inverted → inverted)', () => {
    expect(isInvertedPredicate('not tests_pass')).toBe(true);
  });

  it('returns false for "not tests_fail" (inverted → non-inverted)', () => {
    expect(isInvertedPredicate('not tests_fail')).toBe(false);
  });
});

describe('evaluateCompletion — edge cases', () => {
  it('inverted predicate with explicit command passes when command fails', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('custom-cmd', { exitCode: 0, stdout: '', stderr: '' });

    const spec = createFlowSpec('test', [], [createCompletionGate('tests_fail', 'custom-cmd')]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(true);
    expect(result.gateResults['tests_fail']).toBe(false);
  });

  it('inverted predicate with explicit command: blocked when command succeeds', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('custom-cmd', { exitCode: 1, stdout: '', stderr: '' });

    const spec = createFlowSpec('test', [], [createCompletionGate('tests_fail', 'custom-cmd')]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
    expect(result.gateResults['tests_fail']).toBe(true);
  });

  it('returns a blocking runtime diagnostic when gate evaluation crashes', async () => {
    const store = makeStore();
    const throwingRunner: CommandRunner = {
      run: async () => {
        throw new Error('network error');
      },
    };

    const spec = createFlowSpec('test', [], [createCompletionGate('tests_pass')]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, throwingRunner);

    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('network error');
    expect(result.outcomes).toEqual([]);
    expect(result.diagnostics).toEqual([
      {
        code: RUNTIME_DIAGNOSTIC_CODES.gateEvaluationCrashed,
        kind: 'runtime',
        phase: 'gate-eval',
        severity: 'error',
        blocksExecution: true,
        retryable: true,
        summary: 'Gate evaluation crashed: network error',
        action: 'Fix the failing gate command or predicate before rerunning completion.',
      },
    ]);
  });

  // H#5: Variable-based gate predicates
  it('uses boolean variable as gate predicate', async () => {
    const store = makeStore();
    const runner = makeRunner();

    const spec = createFlowSpec('test', [], [createCompletionGate('my_check')]);
    const session = createSessionState('s1', spec);
    const withVar = { ...session, variables: { ...session.variables, my_check: true } };
    await store.save(withVar);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
    expect(result.gateResults['my_check']).toBe(true);
  });

  it('blocks when boolean variable gate is false', async () => {
    const store = makeStore();
    const runner = makeRunner();

    const spec = createFlowSpec('test', [], [createCompletionGate('my_check')]);
    const session = createSessionState('s1', spec);
    const withVar = { ...session, variables: { ...session.variables, my_check: false } };
    await store.save(withVar);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(true);
    expect(result.gateResults['my_check']).toBe(false);
  });

  // H-SEC-003: Stderr truncation increased to 2000 chars with [truncated] marker
  it('stores stderr up to 2000 chars without truncation marker', async () => {
    const store = makeStore();
    const runner = makeRunner();
    const longStderr = 'x'.repeat(2000);
    runner.setResult('npm test', { exitCode: 1, stdout: '', stderr: longStderr });

    const spec = createFlowSpec('test', [], [createCompletionGate('tests_pass', 'npm test')]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    await evaluateCompletion(store, runner);
    const saved = await store.loadCurrent();
    const diag = saved?.gateDiagnostics['tests_pass'];
    expect(diag?.stderr).toBe(longStderr);
    expect(diag?.stderr).not.toContain('[truncated]');
  });

  it('truncates stderr over 2000 chars and adds [truncated] marker', async () => {
    const store = makeStore();
    const runner = makeRunner();
    const longStderr = 'x'.repeat(3000);
    runner.setResult('npm test', { exitCode: 1, stdout: '', stderr: longStderr });

    const spec = createFlowSpec('test', [], [createCompletionGate('tests_pass', 'npm test')]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    await evaluateCompletion(store, runner);
    const saved = await store.loadCurrent();
    const diag = saved?.gateDiagnostics['tests_pass'];
    expect(diag?.stderr).toContain('[truncated]');
    expect(diag?.stderr!.length).toBeLessThan(3000);
  });

  // H-DX-004: Gate stdout in diagnostics
  it('captures stdout in gate diagnostics', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('npm test', { exitCode: 0, stdout: 'All tests passed', stderr: '' });

    const spec = createFlowSpec('test', [], [createCompletionGate('tests_pass', 'npm test')]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    await evaluateCompletion(store, runner);
    const saved = await store.loadCurrent();
    const diag = saved?.gateDiagnostics['tests_pass'];
    expect(diag?.stdout).toBe('All tests passed');
  });

  it('omits stdout from diagnostics when empty', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('npm test', { exitCode: 0, stdout: '', stderr: '' });

    const spec = createFlowSpec('test', [], [createCompletionGate('tests_pass', 'npm test')]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    await evaluateCompletion(store, runner);
    const saved = await store.loadCurrent();
    const diag = saved?.gateDiagnostics['tests_pass'];
    expect(diag?.stdout).toBeUndefined();
  });

  // H-REL-002: Gate command timeout
  it('passes timeoutMs option to command runner', async () => {
    const store = makeStore();
    let capturedOptions: { timeoutMs?: number } | undefined;
    const capturingRunner: CommandRunner = {
      run: async (_cmd, options) => {
        capturedOptions = options;
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    };

    const spec = createFlowSpec('test', [], [createCompletionGate('tests_pass', 'npm test')]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    await evaluateCompletion(store, capturingRunner);
    expect(capturedOptions).toBeDefined();
    expect(capturedOptions!.timeoutMs).toBeGreaterThan(0);
  });
});

// H-INT-002: Environment-aware gate auto-detection
describe('detectTestCommand', () => {
  it('defaults to npm test when no project markers exist', () => {
    // In the test environment (which has package.json), this should return npm test
    // since go.mod, pyproject.toml, setup.py, and Cargo.toml don't exist
    expect(detectTestCommand()).toBe('npm test');
  });
});

describe('evaluateCompletion — unknown gate predicate warning', () => {
  it('adds warning with suggestion for typo predicate test_pass', async () => {
    const store = makeStore();
    const runner = makeRunner();

    const spec = createFlowSpec('test', [], [createCompletionGate('test_pass')]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    await evaluateCompletion(store, runner);
    const saved = await store.loadCurrent();
    expect(saved?.warnings).toContainEqual(expect.stringContaining("did you mean 'tests_pass'"));
  });

  it('does not add warning for completely unrelated predicate', async () => {
    const store = makeStore();
    const runner = makeRunner();

    const spec = createFlowSpec('test', [], [createCompletionGate('deploy_production')]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    await evaluateCompletion(store, runner);
    const saved = await store.loadCurrent();
    expect(saved?.warnings.filter((w) => w.includes('did you mean'))).toHaveLength(0);
  });

  it('does not add warning for known predicates', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('npm test', { exitCode: 0, stdout: '', stderr: '' });

    const spec = createFlowSpec('test', [], [createCompletionGate('tests_pass')]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    await evaluateCompletion(store, runner);
    const saved = await store.loadCurrent();
    expect(saved?.warnings.filter((w) => w.includes('did you mean'))).toHaveLength(0);
  });

  it('does not add warning for boolean variable gates', async () => {
    const store = makeStore();
    const runner = makeRunner();

    const spec = createFlowSpec('test', [], [createCompletionGate('my_check')]);
    const session = createSessionState('s1', spec);
    const withVar = { ...session, variables: { ...session.variables, my_check: true } };
    await store.save(withVar);

    await evaluateCompletion(store, runner);
    const saved = await store.loadCurrent();
    expect(saved?.warnings.filter((w) => w.includes('did you mean'))).toHaveLength(0);
  });
});

describe('resolveBuiltinCommand — H-INT-002 auto-detection', () => {
  it('maps tests_pass to a test command (auto-detected)', () => {
    const cmd = resolveBuiltinCommand('tests_pass');
    expect(cmd).toBeDefined();
    // In our environment it should resolve to npm test (package.json exists)
    expect(cmd).toBe('npm test');
  });

  it('maps tests_fail to the same auto-detected command', () => {
    const cmd = resolveBuiltinCommand('tests_fail');
    expect(cmd).toBeDefined();
    expect(cmd).toBe('npm test');
  });
});

describe('GATE_TIMEOUT_MS env var', () => {
  const originalEnv = process.env['PROMPT_LANGUAGE_GATE_TIMEOUT_MS'];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['PROMPT_LANGUAGE_GATE_TIMEOUT_MS'];
    } else {
      process.env['PROMPT_LANGUAGE_GATE_TIMEOUT_MS'] = originalEnv;
    }
    vi.resetModules();
  });

  it('defaults to 60000 when env var is not set', async () => {
    delete process.env['PROMPT_LANGUAGE_GATE_TIMEOUT_MS'];
    vi.resetModules();

    let capturedTimeout: number | undefined;
    const capturingRunner: CommandRunner = {
      run: async (_cmd, options) => {
        capturedTimeout = options?.timeoutMs;
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    };

    const mod = await import('./evaluate-completion.js');
    const { InMemoryStateStore } =
      await import('../infrastructure/adapters/in-memory-state-store.js');
    const { createSessionState } = await import('../domain/session-state.js');
    const { createFlowSpec, createCompletionGate } = await import('../domain/flow-spec.js');

    const store = new InMemoryStateStore();
    const spec = createFlowSpec('test', [], [createCompletionGate('tests_pass', 'npm test')]);
    await store.save(createSessionState('s-timeout', spec));

    await mod.evaluateCompletion(store, capturingRunner);
    expect(capturedTimeout).toBe(60_000);
  });

  it('uses valid env var value (e.g., "30000")', async () => {
    process.env['PROMPT_LANGUAGE_GATE_TIMEOUT_MS'] = '30000';
    vi.resetModules();

    let capturedTimeout: number | undefined;
    const capturingRunner: CommandRunner = {
      run: async (_cmd, options) => {
        capturedTimeout = options?.timeoutMs;
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    };

    const mod = await import('./evaluate-completion.js');
    const { InMemoryStateStore } =
      await import('../infrastructure/adapters/in-memory-state-store.js');
    const { createSessionState } = await import('../domain/session-state.js');
    const { createFlowSpec, createCompletionGate } = await import('../domain/flow-spec.js');

    const store = new InMemoryStateStore();
    const spec = createFlowSpec('test', [], [createCompletionGate('tests_pass', 'npm test')]);
    await store.save(createSessionState('s-timeout', spec));

    await mod.evaluateCompletion(store, capturingRunner);
    expect(capturedTimeout).toBe(30_000);
  });

  it('falls back to 60000 for invalid env var (e.g., "notanumber")', async () => {
    process.env['PROMPT_LANGUAGE_GATE_TIMEOUT_MS'] = 'notanumber';
    vi.resetModules();

    let capturedTimeout: number | undefined;
    const capturingRunner: CommandRunner = {
      run: async (_cmd, options) => {
        capturedTimeout = options?.timeoutMs;
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    };

    const mod = await import('./evaluate-completion.js');
    const { InMemoryStateStore } =
      await import('../infrastructure/adapters/in-memory-state-store.js');
    const { createSessionState } = await import('../domain/session-state.js');
    const { createFlowSpec, createCompletionGate } = await import('../domain/flow-spec.js');

    const store = new InMemoryStateStore();
    const spec = createFlowSpec('test', [], [createCompletionGate('tests_pass', 'npm test')]);
    await store.save(createSessionState('s-timeout', spec));

    await mod.evaluateCompletion(store, capturingRunner);
    expect(capturedTimeout).toBe(60_000);
  });

  it('falls back to 60000 for zero env var ("0")', async () => {
    process.env['PROMPT_LANGUAGE_GATE_TIMEOUT_MS'] = '0';
    vi.resetModules();

    let capturedTimeout: number | undefined;
    const capturingRunner: CommandRunner = {
      run: async (_cmd, options) => {
        capturedTimeout = options?.timeoutMs;
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    };

    const mod = await import('./evaluate-completion.js');
    const { InMemoryStateStore } =
      await import('../infrastructure/adapters/in-memory-state-store.js');
    const { createSessionState } = await import('../domain/session-state.js');
    const { createFlowSpec, createCompletionGate } = await import('../domain/flow-spec.js');

    const store = new InMemoryStateStore();
    const spec = createFlowSpec('test', [], [createCompletionGate('tests_pass', 'npm test')]);
    await store.save(createSessionState('s-timeout', spec));

    await mod.evaluateCompletion(store, capturingRunner);
    expect(capturedTimeout).toBe(60_000);
  });

  it('falls back to 60000 for negative env var ("-100")', async () => {
    process.env['PROMPT_LANGUAGE_GATE_TIMEOUT_MS'] = '-100';
    vi.resetModules();

    let capturedTimeout: number | undefined;
    const capturingRunner: CommandRunner = {
      run: async (_cmd, options) => {
        capturedTimeout = options?.timeoutMs;
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    };

    const mod = await import('./evaluate-completion.js');
    const { InMemoryStateStore } =
      await import('../infrastructure/adapters/in-memory-state-store.js');
    const { createSessionState } = await import('../domain/session-state.js');
    const { createFlowSpec, createCompletionGate } = await import('../domain/flow-spec.js');

    const store = new InMemoryStateStore();
    const spec = createFlowSpec('test', [], [createCompletionGate('tests_pass', 'npm test')]);
    await store.save(createSessionState('s-timeout', spec));

    await mod.evaluateCompletion(store, capturingRunner);
    expect(capturedTimeout).toBe(60_000);
  });
});

describe('PROMPT_LANGUAGE_GATE_CACHE_TTL', () => {
  const originalEnv = process.env['PROMPT_LANGUAGE_GATE_CACHE_TTL'];

  afterEach(() => {
    vi.useRealTimers();
    if (originalEnv === undefined) {
      delete process.env['PROMPT_LANGUAGE_GATE_CACHE_TTL'];
    } else {
      process.env['PROMPT_LANGUAGE_GATE_CACHE_TTL'] = originalEnv;
    }
    vi.resetModules();
  });

  it('skips re-evaluation for recently passed command-backed gates', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-11T00:00:00.000Z');
    vi.setSystemTime(now);
    delete process.env['PROMPT_LANGUAGE_GATE_CACHE_TTL'];
    vi.resetModules();

    let runCount = 0;
    const runner: CommandRunner = {
      run: async () => {
        runCount += 1;
        return { exitCode: 1, stdout: '', stderr: 'FAIL' };
      },
    };

    const mod = await import('./evaluate-completion.js');
    const { InMemoryStateStore } =
      await import('../infrastructure/adapters/in-memory-state-store.js');
    const { createSessionState } = await import('../domain/session-state.js');
    const { createFlowSpec, createCompletionGate } = await import('../domain/flow-spec.js');

    const store = new InMemoryStateStore();
    const spec = createFlowSpec('test', [], [createCompletionGate('tests_pass', 'npm test')]);
    const session = createSessionState('s-cache-hit', spec);
    await store.save({
      ...session,
      gateResults: { tests_pass: true },
      gateDiagnostics: {
        tests_pass: {
          passed: true,
          command: 'npm test',
          exitCode: 0,
          gateEvaluatedAt: now.getTime(),
        },
      },
    });

    const result = await mod.evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
    expect(runCount).toBe(0);

    const saved = await store.loadCurrent();
    expect(saved?.status).toBe('completed');
    expect(saved?.gateDiagnostics['tests_pass']?.gateEvaluatedAt).toBe(now.getTime());
  });

  it('always re-evaluates failed gates even inside the TTL window', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-11T00:00:00.000Z');
    vi.setSystemTime(now);
    delete process.env['PROMPT_LANGUAGE_GATE_CACHE_TTL'];
    vi.resetModules();

    let runCount = 0;
    const runner: CommandRunner = {
      run: async () => {
        runCount += 1;
        return { exitCode: 0, stdout: 'OK', stderr: '' };
      },
    };

    const mod = await import('./evaluate-completion.js');
    const { InMemoryStateStore } =
      await import('../infrastructure/adapters/in-memory-state-store.js');
    const { createSessionState } = await import('../domain/session-state.js');
    const { createFlowSpec, createCompletionGate } = await import('../domain/flow-spec.js');

    const store = new InMemoryStateStore();
    const spec = createFlowSpec('test', [], [createCompletionGate('tests_pass', 'npm test')]);
    const session = createSessionState('s-cache-failed', spec);
    await store.save({
      ...session,
      gateResults: { tests_pass: false },
      gateDiagnostics: {
        tests_pass: {
          passed: false,
          command: 'npm test',
          exitCode: 1,
          gateEvaluatedAt: now.getTime() - 1000,
        },
      },
    });

    const result = await mod.evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
    expect(runCount).toBe(1);

    const saved = await store.loadCurrent();
    expect(saved?.gateDiagnostics['tests_pass']?.passed).toBe(true);
    expect(saved?.gateDiagnostics['tests_pass']?.gateEvaluatedAt).toBe(now.getTime());
  });

  it('re-evaluates passed gates after the TTL expires', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-11T00:00:31.000Z');
    vi.setSystemTime(now);
    delete process.env['PROMPT_LANGUAGE_GATE_CACHE_TTL'];
    vi.resetModules();

    let runCount = 0;
    const runner: CommandRunner = {
      run: async () => {
        runCount += 1;
        return { exitCode: 0, stdout: 'OK', stderr: '' };
      },
    };

    const mod = await import('./evaluate-completion.js');
    const { InMemoryStateStore } =
      await import('../infrastructure/adapters/in-memory-state-store.js');
    const { createSessionState } = await import('../domain/session-state.js');
    const { createFlowSpec, createCompletionGate } = await import('../domain/flow-spec.js');

    const store = new InMemoryStateStore();
    const spec = createFlowSpec('test', [], [createCompletionGate('tests_pass', 'npm test')]);
    const session = createSessionState('s-cache-expired', spec);
    await store.save({
      ...session,
      gateResults: { tests_pass: true },
      gateDiagnostics: {
        tests_pass: {
          passed: true,
          command: 'npm test',
          exitCode: 0,
          gateEvaluatedAt: now.getTime() - 31_000,
        },
      },
    });

    const result = await mod.evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
    expect(runCount).toBe(1);

    const saved = await store.loadCurrent();
    expect(saved?.gateDiagnostics['tests_pass']?.gateEvaluatedAt).toBe(now.getTime());
  });

  it('uses the configured cache TTL from the environment', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-11T00:01:30.000Z');
    vi.setSystemTime(now);
    process.env['PROMPT_LANGUAGE_GATE_CACHE_TTL'] = '120';
    vi.resetModules();

    let runCount = 0;
    const runner: CommandRunner = {
      run: async () => {
        runCount += 1;
        return { exitCode: 1, stdout: '', stderr: 'FAIL' };
      },
    };

    const mod = await import('./evaluate-completion.js');
    const { InMemoryStateStore } =
      await import('../infrastructure/adapters/in-memory-state-store.js');
    const { createSessionState } = await import('../domain/session-state.js');
    const { createFlowSpec, createCompletionGate } = await import('../domain/flow-spec.js');

    const store = new InMemoryStateStore();
    const spec = createFlowSpec('test', [], [createCompletionGate('tests_pass', 'npm test')]);
    const session = createSessionState('s-cache-env', spec);
    await store.save({
      ...session,
      gateResults: { tests_pass: true },
      gateDiagnostics: {
        tests_pass: {
          passed: true,
          command: 'npm test',
          exitCode: 0,
          gateEvaluatedAt: now.getTime() - 90_000,
        },
      },
    });

    const result = await mod.evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
    expect(runCount).toBe(0);
  });
});

// ── H-INT-010: any() gate composition evaluation ─────────────────────

describe('evaluateCompletion — any() gate composition (H-INT-010)', () => {
  it('passes when any sub-gate passes', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('npm test', { exitCode: 1, stdout: '', stderr: 'FAIL' });
    runner.setResult('npm run lint', { exitCode: 0, stdout: '', stderr: '' });

    const spec = createFlowSpec(
      'test',
      [],
      [
        {
          predicate: 'any(tests_pass, lint_pass)',
          any: [createCompletionGate('tests_pass'), createCompletionGate('lint_pass')],
        },
      ],
    );
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
    expect(result.gateResults['any(tests_pass, lint_pass)']).toBe(true);
  });

  it('fails when no sub-gate passes', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('npm test', { exitCode: 1, stdout: '', stderr: 'FAIL' });
    runner.setResult('npm run lint', { exitCode: 1, stdout: '', stderr: 'FAIL' });

    const spec = createFlowSpec(
      'test',
      [],
      [
        {
          predicate: 'any(tests_pass, lint_pass)',
          any: [createCompletionGate('tests_pass'), createCompletionGate('lint_pass')],
        },
      ],
    );
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(true);
    expect(result.gateResults['any(tests_pass, lint_pass)']).toBe(false);
  });

  it('any() gate works alongside regular gates (all must pass)', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('npm test', { exitCode: 0, stdout: '', stderr: '' });
    runner.setResult('npm run lint', { exitCode: 1, stdout: '', stderr: 'FAIL' });

    const spec = createFlowSpec(
      'test',
      [],
      [
        {
          predicate: 'any(tests_pass, lint_pass)',
          any: [createCompletionGate('tests_pass'), createCompletionGate('lint_pass')],
        },
        createCompletionGate('lint_pass'),
      ],
    );
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    // any() passes (tests_pass succeeds), but standalone lint_pass fails
    expect(result.gateResults['any(tests_pass, lint_pass)']).toBe(true);
    expect(result.gateResults['lint_pass']).toBe(false);
    expect(result.blocked).toBe(true);
  });

  it('passes any() when a boolean variable sub-gate is true', async () => {
    const store = makeStore();
    const runner = makeRunner();

    const spec = createFlowSpec(
      'test',
      [],
      [
        {
          predicate: 'any(ready)',
          any: [createCompletionGate('ready')],
        },
      ],
    );
    const session = createSessionState('s-any-var', spec);
    await store.save({ ...session, variables: { ...session.variables, ready: true } });

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
    expect(result.gateResults['any(ready)']).toBe(true);
    expect(runner.executedCommands).toEqual([]);
  });

  it('fails any() when a variable sub-gate is unset', async () => {
    const store = makeStore();
    const runner = makeRunner();

    const spec = createFlowSpec(
      'test',
      [],
      [
        {
          predicate: 'any(missing_check)',
          any: [createCompletionGate('missing_check')],
        },
      ],
    );
    const session = createSessionState('s-any-missing-var', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(true);
    expect(result.gateResults['any(missing_check)']).toBe(false);
    expect(runner.executedCommands).toEqual([]);
  });
});

// ── H-SEC-006: Audit logger integration ──────────────────────────────

describe('evaluateCompletion — audit logger (H-SEC-006)', () => {
  it('logs gate evaluations to audit logger', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('npm test', { exitCode: 0, stdout: 'OK', stderr: '' });

    const logged: import('./ports/audit-logger.js').AuditEntry[] = [];
    const auditLogger: import('./ports/audit-logger.js').AuditLogger = {
      log: (entry) => logged.push(entry),
    };

    const spec = createFlowSpec('test', [], [createCompletionGate('tests_pass', 'npm test')]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    await evaluateCompletion(store, runner, auditLogger);
    expect(logged).toHaveLength(1);
    expect(logged[0]!.event).toBe('gate_evaluation');
    expect(logged[0]!.command).toBe('npm test');
    expect(logged[0]!.exitCode).toBe(0);
    expect(logged[0]!.timestamp).toBeDefined();
  });

  it('does not fail when no audit logger is provided', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('npm test', { exitCode: 0, stdout: '', stderr: '' });

    const spec = createFlowSpec('test', [], [createCompletionGate('tests_pass', 'npm test')]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
  });
});

// ── H-LANG-010: Gate all() and N_of() ─────────────────────────────────

describe('evaluateCompletion — all() composite gate', () => {
  it('passes when all sub-gates pass', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('npm test', { exitCode: 0, stdout: '', stderr: '' });
    runner.setResult('npm run lint', { exitCode: 0, stdout: '', stderr: '' });

    const gate = {
      predicate: 'all_checks',
      all: [
        { predicate: 'tests_pass', command: 'npm test' },
        { predicate: 'lint_pass', command: 'npm run lint' },
      ],
    };
    const spec = createFlowSpec('test', [], [gate]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
  });

  it('fails when any sub-gate fails', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('npm test', { exitCode: 0, stdout: '', stderr: '' });
    runner.setResult('npm run lint', { exitCode: 1, stdout: '', stderr: 'lint error' });

    const gate = {
      predicate: 'all_checks',
      all: [
        { predicate: 'tests_pass', command: 'npm test' },
        { predicate: 'lint_pass', command: 'npm run lint' },
      ],
    };
    const spec = createFlowSpec('test', [], [gate]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(true);
  });
});

describe('evaluateCompletion — N_of() composite gate', () => {
  it('passes when at least N sub-gates pass', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('npm test', { exitCode: 0, stdout: '', stderr: '' });
    runner.setResult('npm run lint', { exitCode: 1, stdout: '', stderr: '' });
    runner.setResult('npm run build', { exitCode: 0, stdout: '', stderr: '' });

    const gate = {
      predicate: '2_of_checks',
      nOf: {
        n: 2,
        gates: [
          { predicate: 'tests_pass', command: 'npm test' },
          { predicate: 'lint_pass', command: 'npm run lint' },
          { predicate: 'build_pass', command: 'npm run build' },
        ],
      },
    };
    const spec = createFlowSpec('test', [], [gate]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
  });

  it('fails when fewer than N sub-gates pass', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult('npm test', { exitCode: 0, stdout: '', stderr: '' });
    runner.setResult('npm run lint', { exitCode: 1, stdout: '', stderr: '' });
    runner.setResult('npm run build', { exitCode: 1, stdout: '', stderr: '' });

    const gate = {
      predicate: '2_of_checks',
      nOf: {
        n: 2,
        gates: [
          { predicate: 'tests_pass', command: 'npm test' },
          { predicate: 'lint_pass', command: 'npm run lint' },
          { predicate: 'build_pass', command: 'npm run build' },
        ],
      },
    };
    const spec = createFlowSpec('test', [], [gate]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(true);
  });
});

describe('evaluateCompletion — artifact-aware gates', () => {
  it('evaluates artifact and approval gates from structured runtime records', async () => {
    const store = makeStore();
    const runner = makeRunner();

    const spec = createFlowSpec(
      'artifact gates',
      [],
      [
        createCompletionGate('artifact_valid deploy_plan'),
        createCompletionGate('artifact_accepted deploy_plan'),
        createCompletionGate('artifact_active deploy_plan'),
        createCompletionGate('approval_passed("review_deploy_plan")'),
      ],
    );
    const session = createSessionState('s-artifact-accepted', spec);
    await store.save({
      ...session,
      variables: {
        ...session.variables,
        '_artifacts.deploy_plan': {
          artifactId: 'deploy-plan',
          revisionId: 'rev-2',
          runId: 'run-7',
          validationState: 'valid',
          reviewState: 'accepted',
          revisionState: 'active',
        },
        '_approvals.review_deploy_plan': {
          artifactId: 'deploy-plan',
          revisionId: 'rev-2',
          runId: 'run-7',
          outcome: 'approved',
        },
      },
    });

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
    expect(result.gateResults).toEqual({
      'artifact_valid deploy_plan': true,
      'artifact_accepted deploy_plan': true,
      'artifact_active deploy_plan': true,
      'approval_passed("review_deploy_plan")': true,
    });

    const saved = await store.loadCurrent();
    expect(saved?.status).toBe('completed');
  });

  it('supports flattened state records for invalid, reviewed, and superseded artifacts', async () => {
    const store = makeStore();
    const runner = makeRunner();

    const spec = createFlowSpec(
      'artifact gates',
      [],
      [
        createCompletionGate('artifact_invalid(deploy_plan)'),
        createCompletionGate('artifact_reviewed deploy_plan'),
        createCompletionGate('artifact_changes_requested deploy_plan'),
        createCompletionGate('artifact_superseded deploy_plan'),
      ],
    );
    const session = createSessionState('s-artifact-superseded', spec);
    await store.save({
      ...session,
      variables: {
        ...session.variables,
        '_artifacts.deploy_plan.artifact_id': 'deploy-plan',
        '_artifacts.deploy_plan.revision_id': 'rev-3',
        '_artifacts.deploy_plan.run_id': 'run-8',
        '_artifacts.deploy_plan.validation_state': 'invalid',
        '_artifacts.deploy_plan.review_state': 'changes_requested',
        '_artifacts.deploy_plan.revision_state': 'superseded',
      },
    });

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
    expect(result.gateResults).toEqual({
      'artifact_invalid(deploy_plan)': true,
      'artifact_reviewed deploy_plan': true,
      'artifact_changes_requested deploy_plan': true,
      'artifact_superseded deploy_plan': true,
    });
  });

  it('requires explicit artifact binding for approval_passed instead of generic approve state', async () => {
    const store = makeStore();
    const runner = makeRunner();

    const spec = createFlowSpec(
      'artifact gates',
      [],
      [createCompletionGate('approval_passed("review_deploy_plan")')],
    );
    const session = createSessionState('s-approval-binding', spec);
    await store.save({
      ...session,
      variables: {
        ...session.variables,
        approve_rejected: 'false',
        '_approvals.review_deploy_plan.outcome': 'approved',
      },
    });

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(true);
    expect(result.gateResults['approval_passed("review_deploy_plan")']).toBe(false);
  });

  it('keeps approval_passed pinned to the approved artifact revision when a newer revision is active', async () => {
    const store = makeStore();
    const runner = makeRunner();

    const spec = createFlowSpec(
      'artifact gates',
      [],
      [
        createCompletionGate('artifact_valid deploy_plan'),
        createCompletionGate('artifact_active deploy_plan'),
        createCompletionGate('approval_passed("review_deploy_plan")'),
      ],
    );
    const session = createSessionState('s-approval-revision-mismatch', spec);
    await store.save({
      ...session,
      variables: {
        ...session.variables,
        '_artifacts.deploy_plan': {
          artifactId: 'deploy-plan',
          revisionId: 'rev-3',
          runId: 'run-7',
          validationState: 'valid',
          reviewState: 'unreviewed',
          revisionState: 'active',
        },
        '_approvals.review_deploy_plan': {
          artifactId: 'deploy-plan',
          revisionId: 'rev-2',
          runId: 'run-7',
          outcome: 'approved',
        },
      },
    });

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(true);
    expect(result.gateResults).toEqual({
      'artifact_valid deploy_plan': true,
      'artifact_active deploy_plan': true,
      'approval_passed("review_deploy_plan")': false,
    });
  });

  it('blocks malformed special gates before evaluation, including nested composite gates', async () => {
    const store = makeStore();
    const runner = makeRunner();

    const spec = createFlowSpec(
      'artifact gates',
      [],
      [
        {
          predicate: 'any(artifact_valid deploy_plan, approval_passed())',
          any: [
            createCompletionGate('artifact_valid deploy_plan'),
            createCompletionGate('approval_passed()'),
          ],
        },
      ],
    );
    const session = createSessionState('s-artifact-invalid-syntax', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(true);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'PLR-007',
        summary: 'approval_passed requires exactly one approval step id.',
      }),
    ]);
    expect(runner.executedCommands).toEqual([]);
  });
});
