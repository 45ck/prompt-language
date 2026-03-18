import { describe, it, expect } from 'vitest';
import { injectContext } from './inject-context.js';
import { InMemoryStateStore } from '../infrastructure/adapters/in-memory-state-store.js';
import { createSessionState } from '../domain/session-state.js';
import { createFlowSpec } from '../domain/flow-spec.js';
import { createPromptNode } from '../domain/flow-node.js';

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
