import { describe, it, expect } from 'vitest';
import { injectContext, looksLikeNaturalLanguage, buildMetaPrompt } from './inject-context.js';
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
  createLetNode,
} from '../domain/flow-node.js';
import type { CommandRunner } from './ports/command-runner.js';

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

    expect(result.prompt).toContain('[prompt-language] Flow: Build feature');
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

  it('marks nested current node via currentNodePath', async () => {
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

    expect(result.prompt).toContain('run: npm test  <-- current');
  });

  it('marks child of IfNode thenBranch as current', async () => {
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
    expect(result.prompt).toContain('prompt: fix it  <-- current');
  });

  it('marks child of IfNode elseBranch as current', async () => {
    const store = makeStore();
    const ifNode = createIfNode(
      'i1',
      'tests_fail',
      [createPromptNode('p1', 'fix it')],
      [createPromptNode('p2', 'skip it')],
    );
    const spec = createFlowSpec('If else test', [ifNode]);
    let session = createSessionState('test-if-else', spec);
    session = { ...session, currentNodePath: [0, 1] };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 'test-if-else' }, store);
    expect(result.prompt).toContain('prompt: skip it  <-- current');
  });

  it('marks child of TryNode body as current', async () => {
    const store = makeStore();
    const tryNode = createTryNode('t1', [createRunNode('r1', 'npm build')], 'command_failed', [
      createPromptNode('p1', 'handle error'),
    ]);
    const spec = createFlowSpec('Try test', [tryNode]);
    let session = createSessionState('test-try', spec);
    session = { ...session, currentNodePath: [0, 0] };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 'test-try' }, store);
    expect(result.prompt).toContain('run: npm build  <-- current');
  });

  it('marks child of TryNode catchBody as current', async () => {
    const store = makeStore();
    const tryNode = createTryNode('t1', [createRunNode('r1', 'npm build')], 'command_failed', [
      createPromptNode('p1', 'handle error'),
    ]);
    const spec = createFlowSpec('Try catch test', [tryNode]);
    let session = createSessionState('test-try-catch', spec);
    session = { ...session, currentNodePath: [0, 1] };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 'test-try-catch' }, store);
    expect(result.prompt).toContain('prompt: handle error  <-- current');
  });

  it('marks child of RetryNode as current', async () => {
    const store = makeStore();
    const retryNode = createRetryNode('re1', [createRunNode('r1', 'npm build')], 3);
    const spec = createFlowSpec('Retry test', [retryNode]);
    let session = createSessionState('test-retry', spec);
    session = { ...session, currentNodePath: [0, 0] };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 'test-retry' }, store);
    expect(result.prompt).toContain('run: npm build  <-- current');
  });

  it('marks child of UntilNode as current', async () => {
    const store = makeStore();
    const untilNode = createUntilNode('u1', 'done', [createPromptNode('p1', 'work')], 3);
    const spec = createFlowSpec('Until test', [untilNode]);
    let session = createSessionState('test-until', spec);
    session = { ...session, currentNodePath: [0, 0] };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 'test-until' }, store);
    expect(result.prompt).toContain('prompt: work  <-- current');
  });

  it('gracefully handles out-of-bounds currentNodePath', async () => {
    const store = makeStore();
    const spec = createFlowSpec('OOB test', [createPromptNode('p1', 'hi')]);
    let session = createSessionState('test-oob', spec);
    session = { ...session, currentNodePath: [99] };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 'test-oob' }, store);
    expect(result.prompt).not.toContain('<-- current');
    expect(result.prompt).toContain('[prompt-language] Flow: OOB test');
  });

  it('preserves goal when creating session from prompt with Goal + flow block', async () => {
    const store = makeStore();
    const prompt = 'Goal: deploy the app\nflow:\n  run: npm run deploy\ndone when:\n  deployed';
    const result = await injectContext({ prompt, sessionId: 'test-goal' }, store);

    expect(result.prompt).toContain('[prompt-language] Flow: deploy the app');
    const saved = await store.loadCurrent();
    expect(saved?.flowSpec.goal).toBe('deploy the app');
  });

  it('renders flow visualization with gate status', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Test', [createPromptNode('p1', 'work')]);
    let session = createSessionState('test-5', spec);
    session = {
      ...session,
      lastStep: { kind: 'run', command: 'npm test', summary: 'Tests passed' },
    };
    await store.save(session);

    const result = await injectContext({ prompt: 'What next?', sessionId: 'test-5' }, store);

    expect(result.prompt).toContain('[prompt-language] Flow: Test');
    expect(result.prompt).toContain('prompt: work');
  });
});

describe('looksLikeNaturalLanguage', () => {
  it('detects "keep fixing until" as NL intent', () => {
    expect(looksLikeNaturalLanguage('keep fixing until tests pass')).toBe(true);
  });

  it('detects "retry" keyword', () => {
    expect(looksLikeNaturalLanguage('retry the build 3 times')).toBe(true);
  });

  it('detects "loop until" phrasing', () => {
    expect(looksLikeNaturalLanguage('loop until everything passes')).toBe(true);
  });

  it('detects "don\'t stop until" phrasing', () => {
    expect(looksLikeNaturalLanguage("don't stop until lint passes")).toBe(true);
  });

  it('detects pseudo-code style "if then"', () => {
    expect(looksLikeNaturalLanguage('if tests fail then fix them')).toBe(true);
  });

  it('detects "on failure" / "on error"', () => {
    expect(looksLikeNaturalLanguage('run the build and on failure try again')).toBe(true);
  });

  it('returns false for plain prompt with no intent keywords', () => {
    expect(looksLikeNaturalLanguage('Refactor the auth module')).toBe(false);
  });

  it('returns false when prompt already contains a flow: block', () => {
    expect(looksLikeNaturalLanguage('Goal: g\nflow:\n  until tests_pass max 3')).toBe(false);
  });

  it('returns false for "sometimes" (no false positive on substring "times")', () => {
    expect(looksLikeNaturalLanguage('Sometimes I deploy on Fridays')).toBe(false);
  });

  it('returns false for "this test passes" (no false positive on "passes")', () => {
    expect(looksLikeNaturalLanguage('This test passes fine already')).toBe(false);
  });

  it('returns false for "catch errors manually" (no false positive on "catch")', () => {
    expect(looksLikeNaturalLanguage('I catch errors manually in the handler')).toBe(false);
  });

  it('returns false for "the build fails gracefully" (no false positive on "fails")', () => {
    expect(looksLikeNaturalLanguage('The build fails gracefully with a nice message')).toBe(false);
  });

  it('returns false for "otherwise known as" (no false positive on "otherwise")', () => {
    expect(looksLikeNaturalLanguage('This module is otherwise known as the router')).toBe(false);
  });

  it('returns false for cross-sentence run/until (bounded regex)', () => {
    expect(looksLikeNaturalLanguage('I want to run the server. Please wait until I respond')).toBe(
      false,
    );
  });
});

describe('injectContext — NL meta-prompt', () => {
  it('injects meta-prompt with DSL reference for NL-looking prompt', async () => {
    const store = makeStore();
    const result = await injectContext(
      { prompt: 'keep fixing until tests pass', sessionId: 'nl-1' },
      store,
    );

    expect(result.prompt).toContain('[prompt-language]');
    expect(result.prompt).toContain('DSL reference');
    expect(result.prompt).toContain('keep fixing until tests pass');
    expect(result.prompt).toContain('flow:');
    expect(result.prompt).toContain('done when:');
  });

  it('parses as DSL when prompt has flow: block even with NL keywords', async () => {
    const store = makeStore();
    const prompt = 'Goal: fix tests\nflow:\n  until tests_pass max 3\n    run: npm test';
    const result = await injectContext({ prompt, sessionId: 'nl-2' }, store);

    expect(result.prompt).toContain('[prompt-language] Flow:');
    expect(result.prompt).not.toContain('DSL reference');
  });

  it('passes through plain prompt with no NL intent', async () => {
    const store = makeStore();
    const result = await injectContext(
      { prompt: 'Refactor the auth module', sessionId: 'nl-3' },
      store,
    );

    expect(result.prompt).toBe('Refactor the auth module');
  });

  it('active flow takes precedence over NL detection', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Existing flow', [createPromptNode('p1', 'work')]);
    const session = createSessionState('nl-4', spec);
    await store.save(session);

    const result = await injectContext(
      { prompt: 'keep going until done', sessionId: 'nl-4' },
      store,
    );

    expect(result.prompt).toContain('[prompt-language] Flow: Existing flow');
    expect(result.prompt).not.toContain('DSL reference');
  });
});

describe('injectContext — variable interpolation', () => {
  it('interpolates ${varName} in user prompt with active flow', async () => {
    const store = makeStore();
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    let session = createSessionState('s1', spec);
    session = { ...session, variables: { name: 'auth module' } };
    await store.save(session);

    const result = await injectContext({ prompt: 'Refactor the ${name}', sessionId: 's1' }, store);
    expect(result.prompt).toContain('Refactor the auth module');
  });

  it('leaves unknown ${varName} as-is', async () => {
    const store = makeStore();
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Value is ${unknown}', sessionId: 's1' }, store);
    expect(result.prompt).toContain('Value is ${unknown}');
  });

  it('auto-advances literal let nodes and stores variable', async () => {
    const store = makeStore();
    const letNode = createLetNode('l1', 'greeting', { type: 'literal', value: 'hello' });
    const promptNode = createPromptNode('p1', 'work');
    const spec = createFlowSpec('test', [letNode, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('[= hello]');
    expect(result.prompt).toContain('prompt: work  <-- current');
  });

  it('auto-advances consecutive let nodes', async () => {
    const store = makeStore();
    const let1 = createLetNode('l1', 'a', { type: 'literal', value: '1' });
    const let2 = createLetNode('l2', 'b', { type: 'literal', value: '2' });
    const promptNode = createPromptNode('p1', 'work');
    const spec = createFlowSpec('test', [let1, let2, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('[= 1]');
    expect(result.prompt).toContain('[= 2]');
    expect(result.prompt).toContain('prompt: work  <-- current');
  });

  it('auto-advances prompt let node and stores text', async () => {
    const store = makeStore();
    const letNode = createLetNode('l1', 'ctx', { type: 'prompt', text: 'summarize this' });
    const promptNode = createPromptNode('p1', 'do ${ctx}');
    const spec = createFlowSpec('test', [letNode, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('[= summarize this]');
  });

  it('auto-advances run let node with command runner', async () => {
    const store = makeStore();
    const mockRunner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: 'hello world\n', stderr: '' }),
    };
    const letNode = createLetNode('l1', 'out', { type: 'run', command: 'echo hello world' });
    const promptNode = createPromptNode('p1', 'work');
    const spec = createFlowSpec('test', [letNode, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store, mockRunner);

    expect(result.prompt).toContain('[= hello world]');
    expect(result.prompt).toContain('prompt: work  <-- current');
  });

  it('interpolates variable in prompt after auto-advance', async () => {
    const store = makeStore();
    const letNode = createLetNode('l1', 'greeting', { type: 'literal', value: 'hello' });
    const promptNode = createPromptNode('p1', 'work');
    const spec = createFlowSpec('test', [letNode, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Say ${greeting}', sessionId: 's1' }, store);
    expect(result.prompt).toContain('Say hello');
  });
});

describe('buildMetaPrompt', () => {
  it('includes DSL reference section', () => {
    const result = buildMetaPrompt('keep fixing until tests pass');
    expect(result).toContain('prompt-language DSL reference');
    expect(result).toContain('while');
    expect(result).toContain('until');
    expect(result).toContain('retry');
    expect(result).toContain('if/else');
    expect(result).toContain('try/catch');
    expect(result).toContain('done when');
  });

  it('includes the original user message', () => {
    const result = buildMetaPrompt('retry the build 3 times');
    expect(result).toContain('retry the build 3 times');
    expect(result).toContain("User's original message");
  });

  it('instructs Claude to respond with only DSL', () => {
    const result = buildMetaPrompt('loop this');
    expect(result).toContain('Respond with ONLY a valid prompt-language program');
  });
});
