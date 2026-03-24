import { describe, it, expect } from 'vitest';
import {
  evaluateCompletion,
  resolveBuiltinCommand,
  isInvertedPredicate,
  detectTestCommand,
} from './evaluate-completion.js';
import { InMemoryStateStore } from '../infrastructure/adapters/in-memory-state-store.js';
import { InMemoryCommandRunner } from '../infrastructure/adapters/in-memory-command-runner.js';
import { createSessionState } from '../domain/session-state.js';
import { createFlowSpec, createCompletionGate } from '../domain/flow-spec.js';
import type { CommandRunner } from './ports/command-runner.js';

function makeStore(): InMemoryStateStore {
  return new InMemoryStateStore();
}

function makeRunner(): InMemoryCommandRunner {
  return new InMemoryCommandRunner();
}

describe('evaluateCompletion', () => {
  it('allows completion when no active flow', async () => {
    const store = makeStore();
    const runner = makeRunner();
    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);
  });

  it('allows completion when flow has no gates', async () => {
    const store = makeStore();
    const runner = makeRunner();
    const spec = createFlowSpec('Simple task', []);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await evaluateCompletion(store, runner);
    expect(result.blocked).toBe(false);

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

  it('resolves file_exists predicate to test -f command', async () => {
    const store = makeStore();
    const runner = makeRunner();
    runner.setResult("test -f 'app.js'", { exitCode: 0, stdout: '', stderr: '' });

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
    runner.setResult("test -f 'dist/my file.js'", { exitCode: 0, stdout: '', stderr: '' });

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

  it('maps file_exists <path> to test -f with quoted path', () => {
    expect(resolveBuiltinCommand('file_exists app.js')).toBe("test -f 'app.js'");
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
    expect(resolveBuiltinCommand('file_exists dist/my file.js')).toBe("test -f 'dist/my file.js'");
  });

  it('rejects absolute paths in file_exists', () => {
    expect(resolveBuiltinCommand('file_exists /etc/passwd')).toBeUndefined();
    expect(resolveBuiltinCommand('file_exists /tmp/foo')).toBeUndefined();
  });

  it('rejects backslash in file_exists path', () => {
    expect(resolveBuiltinCommand('file_exists foo\\bar')).toBeUndefined();
  });

  it('allows safe paths with dots, slashes, and hyphens', () => {
    expect(resolveBuiltinCommand('file_exists src/foo-bar/baz.ts')).toBe(
      "test -f 'src/foo-bar/baz.ts'",
    );
    expect(resolveBuiltinCommand('file_exists ./a/b.txt')).toBe("test -f './a/b.txt'");
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

  it('resolves "not file_exists app.js" to test -f command', () => {
    expect(resolveBuiltinCommand('not file_exists app.js')).toBe("test -f 'app.js'");
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

  it('propagates error when runner throws during gate evaluation', async () => {
    const store = makeStore();
    const throwingRunner: CommandRunner = {
      run: async () => {
        throw new Error('network error');
      },
    };

    const spec = createFlowSpec('test', [], [createCompletionGate('tests_pass')]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    await expect(evaluateCompletion(store, throwingRunner)).rejects.toThrow('network error');
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
