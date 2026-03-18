import { describe, it, expect } from 'vitest';
import { evaluateCompletion } from './evaluate-completion.js';
import { InMemoryStateStore } from '../infrastructure/adapters/in-memory-state-store.js';
import { InMemoryCommandRunner } from '../infrastructure/adapters/in-memory-command-runner.js';
import { createSessionState } from '../domain/session-state.js';
import { createFlowSpec, createCompletionGate } from '../domain/flow-spec.js';

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
});
