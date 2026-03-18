import { describe, it, expect } from 'vitest';
import { injectContext } from './inject-context.js';
import { InMemoryStateStore } from '../infrastructure/adapters/in-memory-state-store.js';
import { createSessionState } from '../domain/session-state.js';
import { createFlowSpec } from '../domain/flow-spec.js';
import {
  createPromptNode,
  createWhileNode,
  createRunNode,
  createIfNode,
  createTryNode,
  createRetryNode,
  createUntilNode,
} from '../domain/flow-node.js';

function makeStore(): InMemoryStateStore {
  return new InMemoryStateStore();
}

describe('injectContext', () => {
  it('passes through prompt when no flow block and no active session', async () => {
    const store = makeStore();
    const result = await injectContext({ prompt: 'Hello world', sessionId: 'test-1' }, store);
    expect(result.prompt).toBe('Hello world');
  });

  it('creates session state when prompt contains flow: block', async () => {
    const store = makeStore();
    const prompt = 'Goal: Test goal\nflow:\n  prompt: Do something\ndone when:\n  tests_pass';
    const result = await injectContext({ prompt, sessionId: 'test-2' }, store);
    expect(result.prompt).toContain('[prompt-language]');
    expect(result.prompt).toContain(prompt);
    const saved = await store.loadCurrent();
    expect(saved).not.toBeNull();
    expect(saved?.sessionId).toBe('test-2');
  });

  it('injects context when a flow is already active', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Build feature', [createPromptNode('p1', 'Do work')]);
    const session = createSessionState('test-3', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Continue working', sessionId: 'test-3' }, store);

    expect(result.prompt).toContain('[prompt-language] Active flow: Build feature');
    expect(result.prompt).toContain('Status: active');
    expect(result.prompt).toContain('Continue working');
  });

  it('includes variable info in context block', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Test', []);
    let session = createSessionState('test-4', spec);
    session = { ...session, variables: { count: 3, passing: true } };
    await store.save(session);

    const result = await injectContext({ prompt: 'Next step', sessionId: 'test-4' }, store);

    expect(result.prompt).toContain('count = 3');
    expect(result.prompt).toContain('passing = true');
  });

  it('resolves nested node via currentNodePath', async () => {
    const store = makeStore();
    const innerRun = createRunNode('r1', 'npm test');
    const whileNode = createWhileNode('w1', 'tests_fail', [
      createPromptNode('p1', 'Fix tests'),
      innerRun,
    ]);
    const spec = createFlowSpec('Nested flow', [whileNode]);
    let session = createSessionState('test-nested', spec);
    session = { ...session, currentNodePath: [0, 1] };
    await store.save(session);

    const result = await injectContext({ prompt: 'Continue', sessionId: 'test-nested' }, store);

    expect(result.prompt).toContain('Current step: run (r1)');
    expect(result.prompt).toContain('Path: [0, 1]');
  });

  it('resolves child of IfNode via currentNodePath', async () => {
    const store = makeStore();
    const ifNode = createIfNode(
      'i1',
      'tests_fail',
      [createPromptNode('p1', 'fix it')],
      [createPromptNode('p2', 'skip it')],
    );
    const spec = createFlowSpec('If test', [ifNode]);
    let session = createSessionState('test-if', spec);
    session = { ...session, currentNodePath: [0, 0] };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 'test-if' }, store);
    expect(result.prompt).toContain('Current step: prompt (p1)');
  });

  it('resolves child of TryNode via currentNodePath', async () => {
    const store = makeStore();
    const tryNode = createTryNode('t1', [createRunNode('r1', 'npm build')], 'command_failed', [
      createPromptNode('p1', 'handle error'),
    ]);
    const spec = createFlowSpec('Try test', [tryNode]);
    let session = createSessionState('test-try', spec);
    session = { ...session, currentNodePath: [0, 0] };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 'test-try' }, store);
    expect(result.prompt).toContain('Current step: run (r1)');
  });

  it('resolves child of RetryNode via currentNodePath', async () => {
    const store = makeStore();
    const retryNode = createRetryNode('re1', [createRunNode('r1', 'npm build')], 3);
    const spec = createFlowSpec('Retry test', [retryNode]);
    let session = createSessionState('test-retry', spec);
    session = { ...session, currentNodePath: [0, 0] };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 'test-retry' }, store);
    expect(result.prompt).toContain('Current step: run (r1)');
  });

  it('resolves child of UntilNode via currentNodePath', async () => {
    const store = makeStore();
    const untilNode = createUntilNode('u1', 'done', [createPromptNode('p1', 'work')], 3);
    const spec = createFlowSpec('Until test', [untilNode]);
    let session = createSessionState('test-until', spec);
    session = { ...session, currentNodePath: [0, 0] };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 'test-until' }, store);
    expect(result.prompt).toContain('Current step: prompt (p1)');
  });

  it('gracefully handles out-of-bounds currentNodePath', async () => {
    const store = makeStore();
    const spec = createFlowSpec('OOB test', [createPromptNode('p1', 'hi')]);
    let session = createSessionState('test-oob', spec);
    session = { ...session, currentNodePath: [99] };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 'test-oob' }, store);
    expect(result.prompt).not.toContain('Current step');
    expect(result.prompt).toContain('Path: [99]');
  });

  it('preserves goal when creating session from prompt with Goal + flow block', async () => {
    const store = makeStore();
    const prompt = 'Goal: deploy the app\nflow:\n  run: npm run deploy\ndone when:\n  deployed';
    const result = await injectContext({ prompt, sessionId: 'test-goal' }, store);

    expect(result.prompt).toContain('[prompt-language] Active flow: deploy the app');
    const saved = await store.loadCurrent();
    expect(saved?.flowSpec.goal).toBe('deploy the app');
  });

  it('includes last step info in context block', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Test', []);
    let session = createSessionState('test-5', spec);
    session = {
      ...session,
      lastStep: { kind: 'run', command: 'npm test', summary: 'Tests passed' },
    };
    await store.save(session);

    const result = await injectContext({ prompt: 'What next?', sessionId: 'test-5' }, store);

    expect(result.prompt).toContain('Last step: run');
    expect(result.prompt).toContain('Tests passed');
  });
});
