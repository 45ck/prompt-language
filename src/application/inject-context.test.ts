import { describe, it, expect, vi } from 'vitest';
import {
  injectContext,
  looksLikeNaturalLanguage,
  buildMetaPrompt,
  isTrivialPrompt,
  hasGatesOnly,
} from './inject-context.js';
import { InMemoryStateStore } from '../infrastructure/adapters/in-memory-state-store.js';
import { parseFlow } from './parse-flow.js';
import { createSessionState } from '../domain/session-state.js';
import { createFlowSpec } from '../domain/flow-spec.js';
import {
  createApproveNode,
  createPromptNode,
  createWhileNode,
  createRunNode,
  createIfNode,
  createTryNode,
  createRetryNode,
  createUntilNode,
  createLetNode,
  createForeachNode,
  createReviewNode,
} from '../domain/flow-node.js';
import type { CommandRunner } from './ports/command-runner.js';
import type { CaptureReader } from './ports/capture-reader.js';
import type { ProcessSpawner } from './ports/process-spawner.js';
import type { MemoryStore } from './ports/memory-store.js';
import type { RunOptions } from './ports/command-runner.js';

function makeStore(): InMemoryStateStore {
  return new InMemoryStateStore();
}

interface RecordedCommand {
  readonly command: string;
  readonly env: Readonly<Record<string, string>> | undefined;
}

function expectRecordedInterpolation(
  recorded: RecordedCommand | undefined,
  unixCommand: string,
  expectedValue: string,
): void {
  expect(recorded).toBeDefined();
  if (!recorded) return;

  if (process.platform === 'win32') {
    expect(recorded.command).toContain('%PROMPT_LANGUAGE_VAR_0%');
    expect(recorded.env?.['PROMPT_LANGUAGE_VAR_0']).toBe(expectedValue);
    return;
  }

  expect(recorded.command).toBe(unixCommand);
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
    expect(result.prompt).toContain('Do something');
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
    expect(result.prompt).toContain('Do work');
  });

  it('warns when an active flow receives a different flow definition', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Build feature', [createPromptNode('p1', 'Do work')]);
    const session = createSessionState('test-3b', spec);
    await store.save(session);

    const result = await injectContext(
      {
        prompt: 'Goal: Different\nflow:\n  prompt: New work',
        sessionId: 'test-3b',
      },
      store,
    );

    expect(result.prompt).toContain('Flow definition changed while a flow is active');
    const saved = await store.loadCurrent();
    expect(saved?.flowSpec.goal).toBe('Build feature');
  });

  // H-REL-011: Flow heartbeat summary appended at end of context
  it('appends flow heartbeat summary at end of injected context', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Build feature', [
      createPromptNode('p1', 'Do work'),
      createRunNode('r1', 'npm test'),
    ]);
    const session = createSessionState('test-summary', spec);
    await store.save(session);

    const result = await injectContext(
      { prompt: 'Continue working', sessionId: 'test-summary' },
      store,
    );

    expect(result.prompt).toContain('[prompt-language:');
    // Summary should be at the very end of the output
    const lastLine = result.prompt.trim().split('\n').pop()!;
    expect(lastLine).toMatch(/^\[prompt-language:/);
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
      [createRunNode('r1', 'fix it')],
      [createRunNode('r2', 'skip it')],
    );
    const spec = createFlowSpec('If test', [ifNode]);
    let session = createSessionState('test-if', spec);
    session = { ...session, currentNodePath: [0, 0] };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 'test-if' }, store);
    expect(result.prompt).toContain('run: fix it  <-- current');
  });

  it('marks child of IfNode elseBranch as current', async () => {
    const store = makeStore();
    const ifNode = createIfNode(
      'i1',
      'tests_fail',
      [createRunNode('r1', 'fix it')],
      [createRunNode('r2', 'skip it')],
    );
    const spec = createFlowSpec('If else test', [ifNode]);
    let session = createSessionState('test-if-else', spec);
    session = { ...session, currentNodePath: [0, 1] };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 'test-if-else' }, store);
    expect(result.prompt).toContain('run: skip it  <-- current');
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
      createRunNode('r2', 'handle error'),
    ]);
    const spec = createFlowSpec('Try catch test', [tryNode]);
    let session = createSessionState('test-try-catch', spec);
    session = { ...session, currentNodePath: [0, 1] };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 'test-try-catch' }, store);
    expect(result.prompt).toContain('run: handle error  <-- current');
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
    const untilNode = createUntilNode('u1', 'done', [createRunNode('r1', 'work')], 3);
    const spec = createFlowSpec('Until test', [untilNode]);
    let session = createSessionState('test-until', spec);
    session = { ...session, currentNodePath: [0, 0] };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 'test-until' }, store);
    expect(result.prompt).toContain('run: work  <-- current');
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
    const session = createSessionState('test-5', spec);
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
  // H#40: NL confirmation prompt instead of immediate DSL generation
  it('injects confirmation prompt for NL-looking prompt', async () => {
    const store = makeStore();
    const result = await injectContext(
      { prompt: 'keep fixing until tests pass', sessionId: 'nl-1' },
      store,
    );

    expect(result.prompt).toContain('[prompt-language]');
    expect(result.prompt).toContain('control-flow intent');
    expect(result.prompt).toContain('keep fixing until tests pass');
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

  it('routes active approve replies through runtime approval handling', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Approval flow', [createApproveNode('a1', 'Ship it?')]);
    const session = createSessionState('approve-1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'no', sessionId: 'approve-1' }, store);

    expect(result.prompt).toContain('PLO-003 Approval denied: Ship it?');
    const saved = await store.loadCurrent();
    expect(saved?.variables['approve_rejected']).toBe('true');
    expect(saved?.status).toBe('completed');
  });

  it('records approved replies without emitting approval-denied outcomes', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Approval flow', [createApproveNode('a1', 'Ship it?')]);
    const session = createSessionState('approve-2', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'yes', sessionId: 'approve-2' }, store);

    expect(result.prompt).not.toContain('PLO-003');
    const saved = await store.loadCurrent();
    expect(saved?.variables['approve_rejected']).toBe('false');
    expect(saved?.status).toBe('completed');
  });

  it('re-prompts active approve nodes on unrecognized replies', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Approval flow', [createApproveNode('a1', 'Ship it?')]);
    const session = createSessionState('approve-3', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'maybe', sessionId: 'approve-3' }, store);

    expect(result.prompt).toContain('Ship it?');
    expect(result.prompt).toContain(
      'Please respond with "yes" to approve or "no" to reject: Ship it?',
    );
  });

  it('renders review rejection outcomes when non-strict review advances to the next prompt', async () => {
    const store = makeStore();
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: '', stderr: 'bad implementation' }),
    };
    const spec = createFlowSpec('Review flow', [
      createReviewNode('rv1', [createPromptNode('p1', 'Draft')], 2, undefined, 'check.sh'),
      createPromptNode('p2', 'Revise and continue'),
    ]);
    let session = createSessionState('review-next', spec);
    session = {
      ...session,
      currentNodePath: [0, 1],
      nodeProgress: { rv1: { iteration: 2, maxIterations: 2, status: 'running' } },
    };
    await store.save(session);

    const result = await injectContext(
      { prompt: 'continue', sessionId: 'review-next' },
      store,
      runner,
    );

    expect(result.prompt).toContain(
      '[PLO-002 Review rejected: Grounded review checks failed with exit code 1. (flow[1])]',
    );
    expect(result.prompt).toContain('Revise and continue');
    const saved = await store.loadCurrent();
    expect(saved?.status).toBe('active');
    expect(saved?.variables['_review_result.pass']).toBe(false);
    expect(saved?.variables['_review_result.abstain']).toBe(false);
  });

  it('renders review rejection instead of generic completion when non-strict review ends the flow', async () => {
    const store = makeStore();
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: '', stderr: 'bad implementation' }),
    };
    const spec = createFlowSpec('Review flow', [
      createReviewNode('rv1', [createPromptNode('p1', 'Draft')], 2, undefined, 'check.sh'),
    ]);
    let session = createSessionState('review-done', spec);
    session = {
      ...session,
      currentNodePath: [0, 1],
      nodeProgress: { rv1: { iteration: 2, maxIterations: 2, status: 'running' } },
    };
    await store.save(session);

    const result = await injectContext(
      { prompt: 'continue', sessionId: 'review-done' },
      store,
      runner,
    );

    expect(result.prompt).toContain(
      '[PLO-002 Review rejected: Grounded review checks failed with exit code 1. (flow[1])]',
    );
    expect(result.prompt).not.toContain('Flow completed successfully.');
    const saved = await store.loadCurrent();
    expect(saved?.status).toBe('completed');
    expect(saved?.variables['_review_result.pass']).toBe(false);
  });

  it('renders review rejection outcomes when strict review exhausts', async () => {
    const store = makeStore();
    const runner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: '', stderr: 'bad implementation' }),
    };
    const spec = createFlowSpec('Strict review flow', [
      createReviewNode('rv1', [createPromptNode('p1', 'Draft')], 2, undefined, 'check.sh', true),
    ]);
    let session = createSessionState('review-1', spec);
    session = {
      ...session,
      currentNodePath: [0, 1],
      nodeProgress: { rv1: { iteration: 2, maxIterations: 2, status: 'running' } },
    };
    await store.save(session);

    const result = await injectContext(
      { prompt: 'continue', sessionId: 'review-1' },
      store,
      runner,
    );

    expect(result.prompt).toContain(
      'PLO-002 Review strict failed after 2/2 rounds: Grounded review checks failed with exit code 1.',
    );
    const saved = await store.loadCurrent();
    expect(saved?.status).toBe('failed');
    expect(saved?.variables['_review_result.pass']).toBe(false);
  });
});

describe('injectContext — variable interpolation', () => {
  it('injects only variables referenced by an awaiting let capture prompt', async () => {
    const store = makeStore();
    const spec = createFlowSpec('test', [
      createLetNode('l1', 'ctx', { type: 'prompt', text: 'Summarize ${repo}' }),
      createPromptNode('p1', 'done'),
    ]);
    let session = createSessionState('slice-let', spec);
    session = { ...session, variables: { repo: 'auth module', secret: 'ignore me' } };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 'slice-let' }, store);

    expect(result.prompt).toContain('repo = auth module');
    expect(result.prompt).not.toContain('secret = ignore me');
  });

  it('keeps foreach path variables needed by ancestor loop context', async () => {
    const store = makeStore();
    const spec = createFlowSpec('test', [
      createForeachNode('fe1', 'file', '${files}', [createRunNode('r1', 'echo work')]),
    ]);
    let session = createSessionState('slice-foreach', spec);
    session = {
      ...session,
      currentNodePath: [0, 0],
      nodeProgress: {
        fe1: {
          iteration: 2,
          maxIterations: 2,
          status: 'running',
        },
      },
      variables: {
        files: '["a.ts","b.ts"]',
        file: 'b.ts',
        secret: 'ignore me',
      },
    };
    await store.save(session);

    const result = await injectContext({ prompt: 'Continue', sessionId: 'slice-foreach' }, store);

    expect(result.prompt).toContain('foreach file in ${files}');
    expect(result.prompt).toContain('[file=b.ts]');
    expect(result.prompt).not.toContain('secret = ignore me');
  });

  it('falls back to full variable injection when the active path cannot be resolved', async () => {
    const store = makeStore();
    const spec = createFlowSpec('test', [createRunNode('r1', 'echo work')]);
    let session = createSessionState('slice-fallback', spec);
    session = {
      ...session,
      currentNodePath: [99],
      variables: {
        repo: 'auth module',
        secret: 'keep visible on fallback',
      },
    };
    await store.save(session);

    const result = await injectContext({ prompt: 'Continue', sessionId: 'slice-fallback' }, store);

    expect(result.prompt).toContain('repo = auth module');
    expect(result.prompt).toContain('secret = keep visible on fallback');
  });

  it('interpolates ${varName} in captured prompt text', async () => {
    const store = makeStore();
    const spec = createFlowSpec('test', [createPromptNode('p1', 'Refactor the ${name}')]);
    let session = createSessionState('s1', spec);
    session = { ...session, variables: { name: 'auth module' } };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);
    expect(result.prompt).toContain('Refactor the auth module');
  });

  it('leaves unknown ${varName} as-is in captured prompt', async () => {
    const store = makeStore();
    const spec = createFlowSpec('test', [createPromptNode('p1', 'Value is ${unknown}')]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);
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
    expect(result.prompt).toContain('prompt: work');
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
    expect(result.prompt).toContain('prompt: work');
  });

  it('let-prompt emits capture meta-prompt on first visit', async () => {
    const store = makeStore();
    const letNode = createLetNode('l1', 'ctx', { type: 'prompt', text: 'summarize this' });
    const promptNode = createPromptNode('p1', 'do ${ctx}');
    const spec = createFlowSpec('test', [letNode, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('summarize this');
    expect(result.prompt).toContain('.prompt-language/vars/ctx');
    expect(result.prompt).toContain('[awaiting response...]');
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
    expect(result.prompt).toContain('prompt: work');
  });

  it('interpolates variable in captured prompt after let auto-advance', async () => {
    const store = makeStore();
    const letNode = createLetNode('l1', 'greeting', { type: 'literal', value: 'hello' });
    const promptNode = createPromptNode('p1', 'Say ${greeting}');
    const spec = createFlowSpec('test', [letNode, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);
    expect(result.prompt).toContain('Say hello');
  });

  it('interpolates user prompt when no prompt node captures', async () => {
    const store = makeStore();
    const spec = createFlowSpec('test', [
      createWhileNode('w1', 'cond', [createRunNode('r1', 'cmd')]),
    ]);
    let session = createSessionState('s1', spec);
    session = { ...session, variables: { name: 'auth module' } };
    await store.save(session);

    const result = await injectContext({ prompt: 'Refactor ${name}', sessionId: 's1' }, store);
    expect(result.prompt).toContain('Refactor auth module');
  });
});

describe('injectContext — memory prefetch', () => {
  it('hydrates memory keys before the first node runs', async () => {
    const store = makeStore();
    const memoryStore: MemoryStore = {
      append: vi.fn().mockResolvedValue(undefined),
      findByKey: vi.fn().mockResolvedValue({
        timestamp: '2024-01-01T00:00:00Z',
        key: 'preferred_language',
        value: 'TypeScript',
      }),
      readAll: vi.fn().mockResolvedValue([]),
    };
    const prompt =
      'Goal: test\n\nmemory:\n  preferred_language\n\nflow:\n  prompt: Use ${preferred_language}\n';

    const result = await injectContext(
      { prompt, sessionId: 'mem-1' },
      store,
      undefined,
      undefined,
      undefined,
      undefined,
      memoryStore,
    );

    expect(result.prompt).toContain('Use TypeScript');
    const saved = await store.loadCurrent();
    expect(saved?.variables['preferred_language']).toBe('TypeScript');
  });

  it('hydrates memory keys for active flows and persists the hydrated state', async () => {
    const store = makeStore();
    const memoryStore: MemoryStore = {
      append: vi.fn().mockResolvedValue(undefined),
      findByKey: vi.fn().mockResolvedValue({
        timestamp: '2024-01-01T00:00:00Z',
        key: 'preferred_language',
        value: 'TypeScript',
      }),
      readAll: vi.fn().mockResolvedValue([]),
    };
    const spec = parseFlow(
      'Goal: test\n\nmemory:\n  preferred_language\n\nflow:\n  prompt: Use ${preferred_language}\n',
    );
    const session = createSessionState('mem-active', spec);
    await store.save(session);

    const result = await injectContext(
      { prompt: 'continue', sessionId: 'mem-active' },
      store,
      undefined,
      undefined,
      undefined,
      undefined,
      memoryStore,
    );

    expect(result.prompt).toContain('Use TypeScript');
    const saved = await store.loadCurrent();
    expect(saved?.variables['preferred_language']).toBe('TypeScript');
  });
});

describe('injectContext — run node auto-advance', () => {
  it('auto-executes run node and stores exit variables', async () => {
    const store = makeStore();
    const mockRunner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: 'ok\n', stderr: '' }),
    };
    const runNode = createRunNode('r1', 'echo ok');
    const promptNode = createPromptNode('p1', 'next step');
    const spec = createFlowSpec('test', [runNode, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store, mockRunner);

    expect(result.prompt).toContain('next step');
    const saved = await store.loadCurrent();
    expect(saved?.variables['last_exit_code']).toBe(0);
    expect(saved?.variables['command_succeeded']).toBe(true);
    expect(saved?.variables['command_failed']).toBe(false);
  });

  it('stores failure variables when command fails', async () => {
    const store = makeStore();
    const mockRunner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: '', stderr: 'error' }),
    };
    const runNode = createRunNode('r1', 'fail-cmd');
    const promptNode = createPromptNode('p1', 'handle error');
    const spec = createFlowSpec('test', [runNode, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    await injectContext({ prompt: 'Go', sessionId: 's1' }, store, mockRunner);

    const saved = await store.loadCurrent();
    expect(saved?.variables['last_exit_code']).toBe(1);
    expect(saved?.variables['command_failed']).toBe(true);
    expect(saved?.variables['command_succeeded']).toBe(false);
  });

  it('does not advance run node without command runner', async () => {
    const store = makeStore();
    const runNode = createRunNode('r1', 'echo ok');
    const promptNode = createPromptNode('p1', 'next step');
    const spec = createFlowSpec('test', [runNode, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('run: echo ok  <-- current');
  });

  it('executes multiple consecutive run nodes in sequence', async () => {
    const store = makeStore();
    const commands: string[] = [];
    const mockRunner: CommandRunner = {
      run: async (cmd: string) => {
        commands.push(cmd);
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    };
    const run1 = createRunNode('r1', 'step-one');
    const run2 = createRunNode('r2', 'step-two');
    const promptNode = createPromptNode('p1', 'done');
    const spec = createFlowSpec('test', [run1, run2, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store, mockRunner);

    expect(commands).toEqual(['step-one', 'step-two']);
    expect(result.prompt).toContain('done');
  });

  it('interpolates variables in run node command', async () => {
    const store = makeStore();
    const commands: RecordedCommand[] = [];
    const mockRunner: CommandRunner = {
      run: async (cmd: string, options?: RunOptions) => {
        commands.push({ command: cmd, env: options?.env });
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    };
    const letNode = createLetNode('l1', 'file', { type: 'literal', value: 'app.js' });
    const runNode = createRunNode('r1', 'node ${file}');
    const promptNode = createPromptNode('p1', 'check output');
    const spec = createFlowSpec('test', [letNode, runNode, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    await injectContext({ prompt: 'Go', sessionId: 's1' }, store, mockRunner);

    expect(commands).toHaveLength(1);
    expectRecordedInterpolation(commands[0], "node 'app.js'", 'app.js');
  });
});

describe('injectContext — prompt node auto-advance', () => {
  it('captures prompt text and advances past it', async () => {
    const store = makeStore();
    const prompt1 = createPromptNode('p1', 'First instruction');
    const prompt2 = createPromptNode('p2', 'Second instruction');
    const spec = createFlowSpec('test', [prompt1, prompt2]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('First instruction');
    expect(result.prompt).toContain('Second instruction  <-- current');
    const saved = await store.loadCurrent();
    expect(saved?.currentNodePath).toEqual([1]);
  });

  it('advances state for next invocation', async () => {
    const store = makeStore();
    const prompt1 = createPromptNode('p1', 'Step one');
    const prompt2 = createPromptNode('p2', 'Step two');
    const spec = createFlowSpec('test', [prompt1, prompt2]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result1 = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);
    expect(result1.prompt).toContain('Step one');

    const result2 = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);
    expect(result2.prompt).toContain('Step two');
  });

  it('control-flow node stops the advance loop', async () => {
    const store = makeStore();
    const whileNode = createWhileNode('w1', 'tests_fail', [createRunNode('r1', 'npm test')]);
    const spec = createFlowSpec('test', [whileNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('while tests_fail');
    expect(result.prompt).toContain('Go');
  });

  it('mixed let → run → prompt sequence advances correctly', async () => {
    const store = makeStore();
    const commands: RecordedCommand[] = [];
    const mockRunner: CommandRunner = {
      run: async (cmd: string, options?: RunOptions) => {
        commands.push({ command: cmd, env: options?.env });
        return { exitCode: 0, stdout: 'v20\n', stderr: '' };
      },
    };
    const letNode = createLetNode('l1', 'name', { type: 'literal', value: 'test-file' });
    const runNode = createRunNode('r1', 'echo ${name}');
    const promptNode = createPromptNode('p1', 'Check ${name} output');
    const spec = createFlowSpec('test', [letNode, runNode, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store, mockRunner);

    expect(commands).toHaveLength(1);
    expectRecordedInterpolation(commands[0], "echo 'test-file'", 'test-file');
    expect(result.prompt).toContain('Check test-file output');
    const saved = await store.loadCurrent();
    expect(saved?.currentNodePath).toEqual([3]);
    expect(saved?.variables['name']).toBe('test-file');
    expect(saved?.variables['command_succeeded']).toBe(true);
  });
});

describe('injectContext — prompt capture behavior', () => {
  it('appends non-trivial user prompt alongside captured prompt node text', async () => {
    const store = makeStore();
    const spec = createFlowSpec('test', [createPromptNode('p1', 'Captured instruction')]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'User typed this', sessionId: 's1' }, store);

    expect(result.prompt).toContain('Captured instruction');
    expect(result.prompt).toContain('[User message: User typed this]');
  });

  it('does not append trivial user prompt to captured prompt node text', async () => {
    const store = makeStore();
    const spec = createFlowSpec('test', [createPromptNode('p1', 'Captured instruction')]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('Captured instruction');
    expect(result.prompt).not.toContain('[User message:');
  });

  it('captures prompt node nested inside if-thenBranch when path points to it', async () => {
    const store = makeStore();
    const ifNode = createIfNode('i1', 'tests_fail', [createPromptNode('p1', 'Fix the tests')]);
    const spec = createFlowSpec('test', [ifNode]);
    let session = createSessionState('s1', spec);
    session = { ...session, currentNodePath: [0, 0] };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);
    expect(result.prompt).toContain('Fix the tests');
  });

  it('captures leading prompt node during initial flow parse', async () => {
    const store = makeStore();
    const prompt = 'Goal: test\nflow:\n  prompt: First instruction\n  prompt: Second instruction';
    const result = await injectContext({ prompt, sessionId: 's1' }, store);

    expect(result.prompt).toContain('First instruction');
    expect(result.prompt).not.toContain('Goal: test\nflow:');
  });
});

describe('injectContext — let run edge cases', () => {
  it('does not advance let run node without command runner', async () => {
    const store = makeStore();
    const letNode = createLetNode('l1', 'out', { type: 'run', command: 'echo hi' });
    const promptNode = createPromptNode('p1', 'work');
    const spec = createFlowSpec('test', [letNode, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    const saved = await store.loadCurrent();
    expect(saved?.currentNodePath).toEqual([0]);
    expect(saved?.variables['out']).toBeUndefined();
  });

  it('interpolates variables in let run command', async () => {
    const store = makeStore();
    const commands: RecordedCommand[] = [];
    const mockRunner: CommandRunner = {
      run: async (cmd: string, options?: RunOptions) => {
        commands.push({ command: cmd, env: options?.env });
        return { exitCode: 0, stdout: 'result\n', stderr: '' };
      },
    };
    const let1 = createLetNode('l1', 'name', { type: 'literal', value: 'foo' });
    const let2 = createLetNode('l2', 'out', { type: 'run', command: 'echo ${name}' });
    const promptNode = createPromptNode('p1', 'done');
    const spec = createFlowSpec('test', [let1, let2, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    await injectContext({ prompt: 'Go', sessionId: 's1' }, store, mockRunner);

    expect(commands).toHaveLength(1);
    expectRecordedInterpolation(commands[0], "echo 'foo'", 'foo');
  });

  it('let run sets exit variables (last_exit_code, command_failed, etc.)', async () => {
    const store = makeStore();
    const mockRunner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: 'output\n', stderr: '' }),
    };
    const letNode = createLetNode('l1', 'out', { type: 'run', command: 'echo hi' });
    const promptNode = createPromptNode('p1', 'work');
    const spec = createFlowSpec('test', [letNode, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    await injectContext({ prompt: 'Go', sessionId: 's1' }, store, mockRunner);

    const saved = await store.loadCurrent();
    expect(saved?.variables['out']).toBe('output');
    expect(saved?.variables['last_exit_code']).toBe(0);
    expect(saved?.variables['command_failed']).toBe(false);
    expect(saved?.variables['command_succeeded']).toBe(true);
    expect(saved?.variables['last_stdout']).toBe('output');
    expect(saved?.variables['last_stderr']).toBe('');
  });
});

describe('injectContext — error handling and limits', () => {
  // H-REL-009: Error boundary catches runtime errors and transitions to failed
  it('catches error from command runner and transitions flow to failed', async () => {
    const store = makeStore();
    const throwingRunner: CommandRunner = {
      run: async () => {
        throw new Error('connection failed');
      },
    };
    const processSpawner: ProcessSpawner = {
      spawn: async () => ({ pid: 1 }),
      poll: async () => ({ status: 'running' }),
      terminate: async () => true,
    };
    const runNode = createRunNode('r1', 'echo ok');
    const spec = createFlowSpec('test', [runNode]);
    let session = createSessionState('s1', spec);
    session = {
      ...session,
      spawnedChildren: {
        worker: {
          name: 'worker',
          status: 'running',
          pid: 4321,
          stateDir: '/tmp/worker',
        },
      },
    };
    await store.save(session);

    const result = await injectContext(
      { prompt: 'Go', sessionId: 's1' },
      store,
      throwingRunner,
      undefined,
      processSpawner,
    );
    expect(result.prompt).toContain('[prompt-language] Flow failed:');
    expect(result.prompt).toContain('connection failed');
    expect(result.prompt).toContain('Go');

    const saved = await store.loadCurrent();
    expect(saved?.status).toBe('failed');
    expect(saved?.failureReason).toContain('connection failed');
    expect(saved?.spawnedChildren['worker']?.status).toBe('failed');
    expect(saved?.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('terminated spawned child "worker"')]),
    );
  });

  it('catches TypeError during active flow and includes error type', async () => {
    const store = makeStore();
    const throwingRunner: CommandRunner = {
      run: async () => {
        throw new TypeError('Cannot read properties of null');
      },
    };
    const runNode = createRunNode('r1', 'echo ok');
    const spec = createFlowSpec('test', [runNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store, throwingRunner);
    expect(result.prompt).toContain('[prompt-language] Flow failed:');
    expect(result.prompt).toContain('TypeError');
    expect(result.prompt).toContain('Cannot read properties of null');
  });

  it('catches error during new flow parsing and returns failure message', async () => {
    const store = makeStore();
    // A flow block that will cause autoAdvanceNodes to throw when runner throws
    const throwingRunner: CommandRunner = {
      run: async () => {
        throw new ReferenceError('runner is not defined');
      },
    };
    const prompt = 'Goal: Test\n\nflow:\n  run: failing command';
    const result = await injectContext({ prompt, sessionId: 's1' }, store, throwingRunner);
    expect(result.prompt).toContain('[prompt-language] Flow failed:');
    expect(result.prompt).toContain('runner is not defined');
  });

  it('returns failure message even when stateStore.save throws in error boundary', async () => {
    const store = makeStore();
    const throwingRunner: CommandRunner = {
      run: async () => {
        throw new Error('runner exploded');
      },
    };
    const runNode = createRunNode('r1', 'echo ok');
    const spec = createFlowSpec('test', [runNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    // Make save() throw on the second call (error boundary save)
    let saveCount = 0;
    const originalSave = store.save.bind(store);
    store.save = async (state) => {
      saveCount++;
      if (saveCount > 1) {
        throw new Error('disk full - cannot save');
      }
      return originalSave(state);
    };

    // Should NOT throw — the nested try/catch in the error boundary catches the save failure
    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store, throwingRunner);
    expect(result.prompt).toContain('[prompt-language] Flow failed:');
    expect(result.prompt).toContain('runner exploded');
    expect(result.prompt).toContain('Go');
  });

  it('warns when MAX_ADVANCES (100) limit is reached', async () => {
    const store = makeStore();
    const nodes = Array.from({ length: 101 }, (_, i) =>
      createLetNode(`l${i}`, `v${i}`, { type: 'literal', value: String(i) }),
    );
    const spec = createFlowSpec('test', nodes);
    const session = createSessionState('s1', spec);
    await store.save(session);

    await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    const saved = await store.loadCurrent();
    expect(saved?.currentNodePath).toEqual([100]);
    expect(saved?.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('Flow paused')]),
    );
  });
});

describe('isTrivialPrompt', () => {
  it('recognizes "go" as trivial', () => {
    expect(isTrivialPrompt('go')).toBe(true);
  });

  it('recognizes "Continue" (case-insensitive) as trivial', () => {
    expect(isTrivialPrompt('Continue')).toBe(true);
  });

  it('recognizes "ok!" with trailing punctuation as trivial', () => {
    expect(isTrivialPrompt('ok!')).toBe(true);
  });

  it('recognizes "keep going" as trivial', () => {
    expect(isTrivialPrompt('keep going')).toBe(true);
  });

  it('returns false for non-trivial prompt', () => {
    expect(isTrivialPrompt('Fix the auth module')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isTrivialPrompt('')).toBe(false);
  });

  // H#41: Expanded trivial prompts
  it('recognizes "okay" as trivial', () => {
    expect(isTrivialPrompt('okay')).toBe(true);
  });

  it('recognizes "yep" as trivial', () => {
    expect(isTrivialPrompt('yep')).toBe(true);
  });

  it('recognizes "sure" as trivial', () => {
    expect(isTrivialPrompt('sure')).toBe(true);
  });

  it('recognizes "go ahead" as trivial', () => {
    expect(isTrivialPrompt('go ahead')).toBe(true);
  });

  it('recognizes "sounds good" as trivial', () => {
    expect(isTrivialPrompt('sounds good')).toBe(true);
  });
});

// H#49: Abort flow detection
describe('injectContext — abort flow', () => {
  it('cancels active flow on "abort flow" phrase', async () => {
    const store = makeStore();
    const processSpawner: ProcessSpawner = {
      spawn: async () => ({ pid: 1 }),
      poll: async () => ({ status: 'running' }),
      terminate: async () => true,
    };
    const spec = parseFlow('Goal: test\n\nflow:\n  prompt: do work');
    let session = createSessionState('abort-1', spec);
    session = {
      ...session,
      spawnedChildren: {
        child: {
          name: 'child',
          status: 'running',
          pid: 2222,
          stateDir: '/tmp/child',
        },
      },
    };
    await store.save(session);

    const result = await injectContext(
      { prompt: 'abort flow please', sessionId: 'abort-1' },
      store,
      undefined,
      undefined,
      processSpawner,
    );
    expect(result.prompt).toContain('cancelled');
    const saved = await store.loadCurrent();
    expect(saved?.status).toBe('cancelled');
    expect(saved?.spawnedChildren['child']?.status).toBe('failed');
  });

  it('cancels active flow on "cancel flow"', async () => {
    const store = makeStore();
    const spec = parseFlow('Goal: test\n\nflow:\n  prompt: do work');
    const session = createSessionState('abort-2', spec);
    await store.save(session);

    const result = await injectContext(
      { prompt: 'please cancel flow now', sessionId: 'abort-2' },
      store,
    );
    expect(result.prompt).toContain('cancelled');
  });

  it('does not cancel when no active flow', async () => {
    const store = makeStore();
    const result = await injectContext({ prompt: 'abort flow', sessionId: 'abort-3' }, store);
    expect(result.prompt).toBe('abort flow');
  });
});

// H-PERF-012: Skip context for completed/failed/cancelled flows
describe('injectContext — terminal flow states', () => {
  it('returns short summary for completed flow instead of full render', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Build app', [createPromptNode('p1', 'work')]);
    let session = createSessionState('done-1', spec);
    session = { ...session, status: 'completed' };
    await store.save(session);

    const result = await injectContext({ prompt: 'What next?', sessionId: 'done-1' }, store);
    expect(result.prompt).toContain('[prompt-language] Flow completed successfully.');
    expect(result.prompt).toContain('What next?');
    expect(result.prompt).not.toContain('prompt: work');
  });

  it('renders approval denial instead of generic success for completed approve flows', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Approval flow', [createApproveNode('a1', 'Ship it?')]);
    let session = createSessionState('done-approve', spec);
    session = {
      ...session,
      status: 'completed',
      variables: { ...session.variables, approve_rejected: 'true' },
    };
    await store.save(session);

    const result = await injectContext({ prompt: 'What next?', sessionId: 'done-approve' }, store);

    expect(result.prompt).toContain('[prompt-language] PLO-003 Approval denied.');
    expect(result.prompt).toContain('What next?');
    expect(result.prompt).not.toContain('Flow completed successfully.');
  });

  it('renders review rejection instead of generic success for completed review flows', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Review flow', [createReviewNode('rv1', [], 2)]);
    let session = createSessionState('done-review', spec);
    session = {
      ...session,
      status: 'completed',
      variables: {
        ...session.variables,
        '_review_result.pass': false,
        '_review_result.abstain': false,
        '_review_result.reason': 'Needs stronger evidence.',
      },
    };
    await store.save(session);

    const result = await injectContext({ prompt: 'What next?', sessionId: 'done-review' }, store);

    expect(result.prompt).toContain(
      '[prompt-language] PLO-002 Review rejected: Needs stronger evidence.',
    );
    expect(result.prompt).not.toContain('Flow completed successfully.');
  });

  it('keeps generic success for completed abstaining review flows', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Review flow', [createReviewNode('rv1', [], 2)]);
    let session = createSessionState('done-review-abstain', spec);
    session = {
      ...session,
      status: 'completed',
      variables: {
        ...session.variables,
        '_review_result.pass': false,
        '_review_result.abstain': true,
        '_review_result.reason': 'Not enough evidence.',
      },
    };
    await store.save(session);

    const result = await injectContext(
      { prompt: 'What next?', sessionId: 'done-review-abstain' },
      store,
    );

    expect(result.prompt).toContain('[prompt-language] Flow completed successfully.');
    expect(result.prompt).not.toContain('PLO-002');
  });

  it('renders persisted runtime diagnostics instead of generic success for completed flows', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Capture flow', [createPromptNode('p1', 'work')]);
    let session = createSessionState('done-runtime-diag', spec);
    session = {
      ...session,
      status: 'completed',
      variables: {
        ...session.variables,
        '_runtime_diagnostic.code': 'PLR-005',
        '_runtime_diagnostic.summary':
          "Capture for 'answer' fell back to empty string after 3 attempts.",
      },
    };
    await store.save(session);

    const result = await injectContext(
      { prompt: 'What next?', sessionId: 'done-runtime-diag' },
      store,
    );

    expect(result.prompt).toContain(
      "[prompt-language] PLR-005 Capture for 'answer' fell back to empty string after 3 attempts.",
    );
    expect(result.prompt).not.toContain('Flow completed successfully.');
  });

  it('returns short summary for failed flow', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Deploy', [createRunNode('r1', 'deploy')]);
    let session = createSessionState('fail-1', spec);
    session = { ...session, status: 'failed' };
    await store.save(session);

    const result = await injectContext({ prompt: 'Help', sessionId: 'fail-1' }, store);
    expect(result.prompt).toContain('[prompt-language] Flow failed.');
    expect(result.prompt).toContain('Help');
    expect(result.prompt).not.toContain('run: deploy');
  });

  it('renders review rejection outcome for failed strict review flows', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Strict review flow', [
      createReviewNode('rv1', [createPromptNode('p1', 'Draft')], 2, undefined, 'check.sh', true),
    ]);
    let session = createSessionState('fail-review', spec);
    session = {
      ...session,
      status: 'failed',
      failureReason:
        'Review strict failed after 2/2 rounds: Review command failed with exit code 1.',
    };
    await store.save(session);

    const result = await injectContext({ prompt: 'Help', sessionId: 'fail-review' }, store);

    expect(result.prompt).toContain(
      '[prompt-language] PLO-002 Review strict failed after 2/2 rounds: Review command failed with exit code 1.',
    );
    expect(result.prompt).toContain('Help');
    expect(result.prompt).not.toContain('[prompt-language] Flow failed.');
  });

  it('returns short summary for cancelled flow', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Test', [createPromptNode('p1', 'stuff')]);
    let session = createSessionState('cancel-1', spec);
    session = { ...session, status: 'cancelled' };
    await store.save(session);

    const result = await injectContext({ prompt: 'Ok', sessionId: 'cancel-1' }, store);
    expect(result.prompt).toContain('[prompt-language] Flow cancelled.');
    expect(result.prompt).toContain('Ok');
    expect(result.prompt).not.toContain('prompt: stuff');
  });
});

describe('injectContext — run node stdout/stderr capture', () => {
  it('stores last_stdout and last_stderr after run node', async () => {
    const store = makeStore();
    const mockRunner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: 'hello output\n', stderr: 'some warning\n' }),
    };
    const runNode = createRunNode('r1', 'echo hello');
    const promptNode = createPromptNode('p1', 'next');
    const spec = createFlowSpec('test', [runNode, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    await injectContext({ prompt: 'Go', sessionId: 's1' }, store, mockRunner);

    const saved = await store.loadCurrent();
    expect(saved?.variables['last_stdout']).toBe('hello output');
    expect(saved?.variables['last_stderr']).toBe('some warning');
  });

  it('truncates long stdout at 2000 chars', async () => {
    const store = makeStore();
    const longOutput = 'x'.repeat(3000);
    const mockRunner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: longOutput, stderr: '' }),
    };
    const runNode = createRunNode('r1', 'big-cmd');
    const promptNode = createPromptNode('p1', 'next');
    const spec = createFlowSpec('test', [runNode, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    await injectContext({ prompt: 'Go', sessionId: 's1' }, store, mockRunner);

    const saved = await store.loadCurrent();
    const stdout = saved?.variables['last_stdout'] as string;
    expect(stdout.length).toBeLessThan(2100);
    expect(stdout).toContain('... (truncated)');
  });
});

describe('injectContext — while loop iteration', () => {
  it('enters while body when condition is true via variable', async () => {
    const store = makeStore();
    const whileNode = createWhileNode(
      'w1',
      'command_failed',
      [createPromptNode('p1', 'Fix it')],
      3,
    );
    const spec = createFlowSpec('test', [whileNode]);
    let session = createSessionState('s1', spec);
    session = { ...session, variables: { command_failed: true } };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('Fix it');
    const saved = await store.loadCurrent();
    expect(saved?.nodeProgress['w1']?.iteration).toBe(1);
  });

  it('skips while body when condition is false', async () => {
    const store = makeStore();
    const whileNode = createWhileNode(
      'w1',
      'command_failed',
      [createPromptNode('p1', 'Fix it')],
      3,
    );
    const promptAfter = createPromptNode('p2', 'All done');
    const spec = createFlowSpec('test', [whileNode, promptAfter]);
    let session = createSessionState('s1', spec);
    session = { ...session, variables: { command_failed: false } };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('All done');
  });

  it('loops while body when condition stays true', async () => {
    const store = makeStore();
    const mockRunner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: '', stderr: '' }),
    };
    const whileNode = createWhileNode(
      'w1',
      'command_failed',
      [createRunNode('r1', 'npm test'), createPromptNode('p1', 'Fix it')],
      3,
    );
    const spec = createFlowSpec('test', [whileNode]);
    let session = createSessionState('s1', spec);
    session = { ...session, variables: { command_failed: true } };
    await store.save(session);

    // First invocation: enters while, runs npm test (fails), hits prompt
    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store, mockRunner);
    expect(result.prompt).toContain('Fix it');

    // Second invocation: body exhausted, re-evaluates condition (still true), loops
    const result2 = await injectContext({ prompt: 'Go', sessionId: 's1' }, store, mockRunner);
    expect(result2.prompt).toContain('Fix it');
    const saved = await store.loadCurrent();
    expect(saved?.nodeProgress['w1']?.iteration).toBe(2);
  });

  it('exits while loop when max iterations reached', async () => {
    const store = makeStore();
    const whileNode = createWhileNode(
      'w1',
      'command_failed',
      [createPromptNode('p1', 'Fix it')],
      2,
    );
    const promptAfter = createPromptNode('p2', 'Done looping');
    const spec = createFlowSpec('test', [whileNode, promptAfter]);
    let session = createSessionState('s1', spec);
    session = {
      ...session,
      variables: { command_failed: true },
      currentNodePath: [0, 1],
      nodeProgress: { w1: { iteration: 2, maxIterations: 2, status: 'running' } },
    };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('Done looping');
  });
});

describe('injectContext — until loop iteration', () => {
  it('enters until body when condition is false', async () => {
    const store = makeStore();
    const untilNode = createUntilNode(
      'u1',
      'command_succeeded',
      [createPromptNode('p1', 'Try again')],
      3,
    );
    const spec = createFlowSpec('test', [untilNode]);
    let session = createSessionState('s1', spec);
    session = { ...session, variables: { command_succeeded: false } };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('Try again');
    const saved = await store.loadCurrent();
    expect(saved?.nodeProgress['u1']?.iteration).toBe(1);
  });

  it('skips until body when condition is already true', async () => {
    const store = makeStore();
    const untilNode = createUntilNode(
      'u1',
      'command_succeeded',
      [createPromptNode('p1', 'Try again')],
      3,
    );
    const promptAfter = createPromptNode('p2', 'Already done');
    const spec = createFlowSpec('test', [untilNode, promptAfter]);
    let session = createSessionState('s1', spec);
    session = { ...session, variables: { command_succeeded: true } };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('Already done');
  });

  it('exits until loop when condition becomes true', async () => {
    const store = makeStore();
    const untilNode = createUntilNode(
      'u1',
      'command_succeeded',
      [createPromptNode('p1', 'Try again')],
      5,
    );
    const promptAfter = createPromptNode('p2', 'Finished');
    const spec = createFlowSpec('test', [untilNode, promptAfter]);
    let session = createSessionState('s1', spec);
    session = {
      ...session,
      variables: { command_succeeded: true },
      currentNodePath: [0, 1],
      nodeProgress: { u1: { iteration: 1, maxIterations: 5, status: 'running' } },
    };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('Finished');
  });
});

describe('injectContext — retry', () => {
  it('enters retry body on first encounter', async () => {
    const store = makeStore();
    const mockRunner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: '', stderr: 'fail' }),
    };
    const retryNode = createRetryNode(
      're1',
      [createRunNode('r1', 'npm build'), createPromptNode('p1', 'Fix build')],
      3,
    );
    const spec = createFlowSpec('test', [retryNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store, mockRunner);

    expect(result.prompt).toContain('Fix build');
    const saved = await store.loadCurrent();
    expect(saved?.nodeProgress['re1']?.iteration).toBe(1);
  });

  it('retries when command_failed is true after body', async () => {
    const store = makeStore();
    const mockRunner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: '', stderr: '' }),
    };
    const retryNode = createRetryNode(
      're1',
      [createRunNode('r1', 'npm build'), createPromptNode('p1', 'Fix build')],
      3,
    );
    const spec = createFlowSpec('test', [retryNode]);
    let session = createSessionState('s1', spec);
    session = {
      ...session,
      variables: { command_failed: true },
      currentNodePath: [0, 2],
      nodeProgress: { re1: { iteration: 1, maxIterations: 3, status: 'running' } },
    };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store, mockRunner);

    expect(result.prompt).toContain('Fix build');
    const saved = await store.loadCurrent();
    expect(saved?.nodeProgress['re1']?.iteration).toBe(2);
  });

  it('exits retry when command succeeds', async () => {
    const store = makeStore();
    const retryNode = createRetryNode('re1', [createPromptNode('p1', 'Fix')], 3);
    const promptAfter = createPromptNode('p2', 'Build passed');
    const spec = createFlowSpec('test', [retryNode, promptAfter]);
    let session = createSessionState('s1', spec);
    session = {
      ...session,
      variables: { command_failed: false },
      currentNodePath: [0, 1],
      nodeProgress: { re1: { iteration: 1, maxIterations: 3, status: 'running' } },
    };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('Build passed');
  });
});

describe('injectContext — if/else branching', () => {
  it('enters thenBranch when condition is true', async () => {
    const store = makeStore();
    const ifNode = createIfNode(
      'i1',
      'command_failed',
      [createPromptNode('p1', 'Fix the error')],
      [createPromptNode('p2', 'All good')],
    );
    const spec = createFlowSpec('test', [ifNode]);
    let session = createSessionState('s1', spec);
    session = { ...session, variables: { command_failed: true } };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('Fix the error');
  });

  it('enters elseBranch when condition is false', async () => {
    const store = makeStore();
    const ifNode = createIfNode(
      'i1',
      'command_failed',
      [createPromptNode('p1', 'Fix the error')],
      [createPromptNode('p2', 'All good')],
    );
    const spec = createFlowSpec('test', [ifNode]);
    let session = createSessionState('s1', spec);
    session = { ...session, variables: { command_failed: false } };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('All good');
  });

  it('skips if entirely when condition is false and no elseBranch', async () => {
    const store = makeStore();
    const ifNode = createIfNode('i1', 'command_failed', [createPromptNode('p1', 'Fix the error')]);
    const promptAfter = createPromptNode('p2', 'Moving on');
    const spec = createFlowSpec('test', [ifNode, promptAfter]);
    let session = createSessionState('s1', spec);
    session = { ...session, variables: { command_failed: false } };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('Moving on');
  });

  it('advances past if after body exhaustion', async () => {
    const store = makeStore();
    const ifNode = createIfNode('i1', 'command_failed', [createPromptNode('p1', 'Fix the error')]);
    const promptAfter = createPromptNode('p2', 'After if');
    const spec = createFlowSpec('test', [ifNode, promptAfter]);
    let session = createSessionState('s1', spec);
    session = {
      ...session,
      variables: { command_failed: true },
      currentNodePath: [0, 1],
    };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('After if');
  });
});

describe('injectContext — try/catch', () => {
  it('enters try body on first encounter', async () => {
    const store = makeStore();
    const mockRunner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    };
    const tryNode = createTryNode(
      't1',
      [createRunNode('r1', 'npm build'), createPromptNode('p1', 'Build ok')],
      'command_failed',
      [createPromptNode('p2', 'Build failed')],
    );
    const spec = createFlowSpec('test', [tryNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store, mockRunner);

    expect(result.prompt).toContain('Build ok');
  });

  it('jumps to catch when run fails in try body', async () => {
    const store = makeStore();
    const mockRunner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: '', stderr: 'boom' }),
    };
    const tryNode = createTryNode(
      't1',
      [createRunNode('r1', 'npm build'), createPromptNode('p1', 'Build ok')],
      'command_failed',
      [createPromptNode('p2', 'Caught failure')],
    );
    const spec = createFlowSpec('test', [tryNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store, mockRunner);

    expect(result.prompt).toContain('Caught failure');
  });

  it('advances past try after catch body exhaustion', async () => {
    const store = makeStore();
    const tryNode = createTryNode('t1', [createRunNode('r1', 'npm build')], 'command_failed', [
      createPromptNode('p2', 'Handle error'),
    ]);
    const promptAfter = createPromptNode('p3', 'After try');
    const spec = createFlowSpec('test', [tryNode, promptAfter]);
    let session = createSessionState('s1', spec);
    // path [0, 2] = past the catch body (body.length=1, catch has 1 node at index 1, so 2 is past)
    session = { ...session, currentNodePath: [0, 2] };
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('After try');
  });

  it('jumps to catch when let-run fails inside try body', async () => {
    const store = makeStore();
    const mockRunner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: '', stderr: 'cmd failed' }),
    };
    const tryNode = createTryNode(
      't1',
      [createLetNode('l1', 'result', { type: 'run', command: 'exit 1' })],
      'command_failed',
      [createPromptNode('p2', 'Handle let-run error')],
    );
    const spec = createFlowSpec('test', [tryNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store, mockRunner);

    expect(result.prompt).toContain('Handle let-run error');
    const saved = await store.loadCurrent();
    expect(saved?.variables['command_failed']).toBe(true);
    expect(saved?.variables['command_succeeded']).toBe(false);
    expect(saved?.variables['result']).toBe('');
  });

  it('skips subsequent try-body nodes and captures output when let-run fails', async () => {
    const store = makeStore();
    const mockRunner: CommandRunner = {
      run: async () => ({ exitCode: 1, stdout: 'partial output', stderr: 'error details' }),
    };
    const tryNode = createTryNode(
      't1',
      [
        createLetNode('l1', 'result', { type: 'run', command: 'failing-cmd' }),
        createPromptNode('p1', 'This should be skipped'),
      ],
      'command_failed',
      [createPromptNode('p2', 'Caught the failure')],
    );
    const spec = createFlowSpec('test', [tryNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store, mockRunner);

    // The captured instruction should be from the catch body, not the skipped try-body prompt
    expect(result.prompt).toContain('Caught the failure');
    const saved = await store.loadCurrent();
    expect(saved?.variables['result']).toBe('partial output');
    expect(saved?.variables['command_failed']).toBe(true);
    expect(saved?.variables['command_succeeded']).toBe(false);
    // Path advanced past the try node entirely after the catch prompt was captured.
    expect(saved?.currentNodePath).toEqual([1]);
  });
});

describe('injectContext — flow auto-completion', () => {
  it('marks flow completed when all nodes exhausted and no gates', async () => {
    const store = makeStore();
    const spec = createFlowSpec('test', [createPromptNode('p1', 'Do work')]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    // First call: captures prompt, advances to [1] (past all nodes)
    await injectContext({ prompt: 'Go', sessionId: 's1' }, store);
    // Second call: nodes exhausted, no gates → auto-complete
    await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    const saved = await store.loadCurrent();
    expect(saved?.status).toBe('completed');
  });

  it('does not auto-complete when gates are present and not passing', async () => {
    const store = makeStore();
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'Do work')],
      [{ predicate: 'tests_pass' }],
    );
    const session = createSessionState('s1', spec);
    await store.save(session);

    await injectContext({ prompt: 'Go', sessionId: 's1' }, store);
    await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    const saved = await store.loadCurrent();
    expect(saved?.status).toBe('active');
  });

  it('does not mark flow completed while delivering the last captured prompt', async () => {
    const store = makeStore();
    const spec = createFlowSpec('test', [
      createPromptNode('p1', 'First step'),
      createPromptNode('p2', 'Last step'),
    ]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    // Call 1: captures p1, advances to [1]
    await injectContext({ prompt: 'Go', sessionId: 's1' }, store);
    let saved = await store.loadCurrent();
    expect(saved?.status).toBe('active');

    // Call 2: captures p2, advances to [2] — still active (prompt being delivered)
    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);
    saved = await store.loadCurrent();
    expect(saved?.status).toBe('active');
    expect(result.prompt).toContain('Status: active');
    expect(result.prompt).toContain('Last step');

    // Call 3: no more nodes, no captured prompt → completes
    await injectContext({ prompt: 'Go', sessionId: 's1' }, store);
    saved = await store.loadCurrent();
    expect(saved?.status).toBe('completed');
  });

  it('does not mark flow completed during initial parse when delivering captured prompt', async () => {
    const store = makeStore();
    const result = await injectContext(
      { prompt: 'Goal: test\nflow:\n  prompt: Only step', sessionId: 's1' },
      store,
    );
    const saved = await store.loadCurrent();
    expect(saved?.status).toBe('active');
    expect(result.prompt).toContain('Status: active');
  });

  it('auto-completes when gates are all passing', async () => {
    const store = makeStore();
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'Do work')],
      [{ predicate: 'tests_pass' }],
    );
    let session = createSessionState('s1', spec);
    session = {
      ...session,
      gateResults: { tests_pass: true },
      currentNodePath: [1],
    };
    await store.save(session);

    await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    const saved = await store.loadCurrent();
    expect(saved?.status).toBe('completed');
  });
});

describe('injectContext — while with builtin condition', () => {
  it('evaluates builtin condition via command runner', async () => {
    const store = makeStore();
    let callCount = 0;
    const mockRunner: CommandRunner = {
      run: async (cmd: string) => {
        callCount++;
        if (cmd === 'npm test') {
          return { exitCode: 1, stdout: '', stderr: 'tests failed' };
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    };
    const whileNode = createWhileNode('w1', 'tests_fail', [createPromptNode('p1', 'Fix tests')], 3);
    const spec = createFlowSpec('test', [whileNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store, mockRunner);

    expect(result.prompt).toContain('Fix tests');
    expect(callCount).toBe(1);
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

  it('includes foreach in DSL reference', () => {
    const result = buildMetaPrompt('foreach file in list');
    expect(result).toContain('foreach');
  });
});

describe('injectContext — foreach iteration', () => {
  it('iterates over whitespace-delimited list', async () => {
    const store = makeStore();
    const letNode = createLetNode('l1', 'items', { type: 'literal', value: 'a b c' });
    const foreachNode = createForeachNode('fe1', 'item', '${items}', [
      createPromptNode('p1', 'process ${item}'),
    ]);
    const spec = createFlowSpec('test', [letNode, foreachNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    // First call: auto-advances let, enters foreach, sets item=a, captures prompt
    const result1 = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);
    expect(result1.prompt).toContain('process a');

    const saved1 = await store.loadCurrent();
    expect(saved1?.variables['item']).toBe('a');
    expect(saved1?.variables['item_index']).toBe(0);
    expect(saved1?.variables['item_length']).toBe(3);
  });

  it('advances through foreach iterations', async () => {
    const store = makeStore();
    const letNode = createLetNode('l1', 'items', { type: 'literal', value: 'x y' });
    const foreachNode = createForeachNode('fe1', 'item', '${items}', [
      createPromptNode('p1', 'process ${item}'),
    ]);
    const promptAfter = createPromptNode('p2', 'All done');
    const spec = createFlowSpec('test', [letNode, foreachNode, promptAfter]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    // First: let auto-advances, foreach enters with item=x
    const result1 = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);
    expect(result1.prompt).toContain('process x');

    // Second: body exhausted, item=y, re-enter body
    const result2 = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);
    expect(result2.prompt).toContain('process y');

    // Third: body exhausted, no more items, advance past foreach
    const result3 = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);
    expect(result3.prompt).toContain('All done');
  });

  it('skips foreach with empty list', async () => {
    const store = makeStore();
    const letNode = createLetNode('l1', 'items', { type: 'literal', value: '' });
    const foreachNode = createForeachNode('fe1', 'item', '${items}', [
      createPromptNode('p1', 'should not appear'),
    ]);
    const promptAfter = createPromptNode('p2', 'Skipped');
    const spec = createFlowSpec('test', [letNode, foreachNode, promptAfter]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);
    expect(result.prompt).toContain('Skipped');
  });

  it('caps iterations at maxIterations', async () => {
    const store = makeStore();
    const letNode = createLetNode('l1', 'items', { type: 'literal', value: 'a b c d e' });
    const foreachNode = createForeachNode(
      'fe1',
      'item',
      '${items}',
      [createPromptNode('p1', 'process ${item}')],
      2,
    );
    const promptAfter = createPromptNode('p2', 'Done');
    const spec = createFlowSpec('test', [letNode, foreachNode, promptAfter]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    // First: item=a
    const result1 = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);
    expect(result1.prompt).toContain('process a');

    // Second: item=b
    const result2 = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);
    expect(result2.prompt).toContain('process b');

    // Third: max reached, advance past
    const result3 = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);
    expect(result3.prompt).toContain('Done');
  });

  it('sets loop variable per iteration for run nodes', async () => {
    const store = makeStore();
    const commands: RecordedCommand[] = [];
    const mockRunner: CommandRunner = {
      run: async (cmd: string, options?: RunOptions) => {
        commands.push({ command: cmd, env: options?.env });
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    };
    const letNode = createLetNode('l1', 'files', { type: 'literal', value: 'a.ts b.ts' });
    const foreachNode = createForeachNode('fe1', 'f', '${files}', [
      createRunNode('r1', 'lint ${f}'),
      createPromptNode('p1', 'check ${f}'),
    ]);
    const spec = createFlowSpec('test', [letNode, foreachNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    // First: let auto-advances, foreach enters with f=a.ts, run executes, prompt captures
    const result1 = await injectContext({ prompt: 'Go', sessionId: 's1' }, store, mockRunner);
    expect(result1.prompt).toContain('check a.ts');
    expectRecordedInterpolation(commands[0], "lint 'a.ts'", 'a.ts');

    // Second: body exhausted, f=b.ts, re-enter
    const result2 = await injectContext({ prompt: 'Go', sessionId: 's1' }, store, mockRunner);
    expect(result2.prompt).toContain('check b.ts');
    expectRecordedInterpolation(commands[1], "lint 'b.ts'", 'b.ts');
  });

  it('parses and executes foreach from DSL text', async () => {
    const store = makeStore();
    const prompt = `Goal: lint files

flow:
  let files = "src/a.ts src/b.ts"
  foreach file in \${files}
    prompt: Review \${file}
  end`;
    const result = await injectContext({ prompt, sessionId: 's1' }, store);
    expect(result.prompt).toContain('Review src/a.ts');
  });
});

describe('injectContext — let-prompt capture', () => {
  function makeCaptureReader(files: Record<string, string> = {}): CaptureReader {
    const store = new Map<string, string>(Object.entries(files));
    return {
      read: async (varName: string) => store.get(varName) ?? null,
      clear: async (varName: string) => {
        store.delete(varName);
      },
    };
  }

  it('emits capture meta-prompt on first visit (phase 1)', async () => {
    const store = makeStore();
    const captureReader = makeCaptureReader();
    const letNode = createLetNode('l1', 'tasks', { type: 'prompt', text: 'List the bugs' });
    const promptNode = createPromptNode('p1', 'Fix ${tasks}');
    const spec = createFlowSpec('test', [letNode, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext(
      { prompt: 'Go', sessionId: 's1' },
      store,
      undefined,
      captureReader,
    );

    expect(result.prompt).toContain('List the bugs');
    expect(result.prompt).toContain('.prompt-language/vars/tasks');
    expect(result.prompt).toContain('Write tool');
    const saved = await store.loadCurrent();
    expect(saved?.nodeProgress['l1']?.status).toBe('awaiting_capture');
    expect(saved?.currentNodePath).toEqual([0]);
  });

  it('reads captured file on return visit (phase 2)', async () => {
    const store = makeStore();
    const captureReader = makeCaptureReader({ tasks: 'bug1\nbug2\nbug3' });
    const letNode = createLetNode('l1', 'tasks', { type: 'prompt', text: 'List the bugs' });
    const promptNode = createPromptNode('p1', 'Fix ${tasks}');
    const spec = createFlowSpec('test', [letNode, promptNode]);
    let session = createSessionState('s1', spec);
    session = {
      ...session,
      currentNodePath: [0],
      nodeProgress: {
        l1: { iteration: 1, maxIterations: 3, status: 'awaiting_capture' },
      },
    };
    await store.save(session);

    const result = await injectContext(
      { prompt: 'Go', sessionId: 's1' },
      store,
      undefined,
      captureReader,
    );

    expect(result.prompt).toContain('Fix bug1\nbug2\nbug3');
    const saved = await store.loadCurrent();
    expect(saved?.variables['tasks']).toBe('bug1\nbug2\nbug3');
    expect(saved?.currentNodePath).toEqual([2]);
  });

  it('retries when capture file is missing', async () => {
    const store = makeStore();
    const captureReader = makeCaptureReader();
    const letNode = createLetNode('l1', 'out', { type: 'prompt', text: 'Summarize' });
    const spec = createFlowSpec('test', [letNode, createPromptNode('p1', 'work')]);
    let session = createSessionState('s1', spec);
    session = {
      ...session,
      currentNodePath: [0],
      nodeProgress: {
        l1: { iteration: 1, maxIterations: 3, status: 'awaiting_capture' },
      },
    };
    await store.save(session);

    const result = await injectContext(
      { prompt: 'Go', sessionId: 's1' },
      store,
      undefined,
      captureReader,
    );

    expect(result.prompt).toContain('.prompt-language/vars/out');
    expect(result.prompt).toContain('not found');
    const saved = await store.loadCurrent();
    expect(saved?.nodeProgress['l1']?.iteration).toBe(2);
    expect(saved?.currentNodePath).toEqual([0]);
  });

  it('fails open with empty string after max retries', async () => {
    const store = makeStore();
    const captureReader = makeCaptureReader();
    const letNode = createLetNode('l1', 'out', { type: 'prompt', text: 'Summarize' });
    const spec = createFlowSpec('test', [letNode, createPromptNode('p1', 'work')]);
    let session = createSessionState('s1', spec);
    session = {
      ...session,
      currentNodePath: [0],
      nodeProgress: {
        l1: { iteration: 3, maxIterations: 3, status: 'awaiting_capture' },
      },
    };
    await store.save(session);

    const result = await injectContext(
      { prompt: 'Go', sessionId: 's1' },
      store,
      undefined,
      captureReader,
    );

    expect(result.prompt).toContain('work');
    expect(result.prompt).toContain(
      "[PLR-005 Capture for 'out' fell back to empty string after 3 attempts. (flow[1])]",
    );
    const saved = await store.loadCurrent();
    expect(saved?.variables['out']).toBe('');
    expect(saved?.variables['_runtime_diagnostic.code']).toBe('PLR-005');
    expect(saved?.variables['_runtime_diagnostic.summary']).toBe(
      "Capture for 'out' fell back to empty string after 3 attempts. (flow[1])",
    );
    expect(saved?.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('fell back to empty string after 3 attempts'),
      ]),
    );
  });

  it('interpolates variables in let-prompt text', async () => {
    const store = makeStore();
    const captureReader = makeCaptureReader();
    const let1 = createLetNode('l1', 'module', { type: 'literal', value: 'auth' });
    const let2 = createLetNode('l2', 'tasks', {
      type: 'prompt',
      text: 'Inspect the ${module} module',
    });
    const spec = createFlowSpec('test', [let1, let2]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext(
      { prompt: 'Go', sessionId: 's1' },
      store,
      undefined,
      captureReader,
    );

    expect(result.prompt).toContain('Inspect the auth module');
  });

  it('works without captureReader (fallback behavior)', async () => {
    const store = makeStore();
    const letNode = createLetNode('l1', 'out', { type: 'prompt', text: 'Summarize' });
    const spec = createFlowSpec('test', [letNode, createPromptNode('p1', 'work')]);
    let session = createSessionState('s1', spec);
    session = {
      ...session,
      currentNodePath: [0],
      nodeProgress: {
        l1: { iteration: 3, maxIterations: 3, status: 'awaiting_capture' },
      },
    };
    await store.save(session);

    // No captureReader — phase 2 without reader should fail-open at max retries
    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('work');
    const saved = await store.loadCurrent();
    expect(saved?.variables['out']).toBe('');
  });

  it('let-prompt + foreach integration: captures and iterates', async () => {
    const store = makeStore();
    const captureReader = makeCaptureReader({ colors: 'red\ngreen\nblue' });
    const letNode = createLetNode('l1', 'colors', { type: 'prompt', text: 'List three colors' });
    const foreachNode = createForeachNode('fe1', 'color', '${colors}', [
      createPromptNode('p1', 'Paint ${color}'),
    ]);
    const spec = createFlowSpec('test', [letNode, foreachNode]);

    // Simulate state after phase 1 (awaiting capture)
    let session = createSessionState('s1', spec);
    session = {
      ...session,
      currentNodePath: [0],
      nodeProgress: {
        l1: { iteration: 1, maxIterations: 3, status: 'awaiting_capture' },
      },
    };
    await store.save(session);

    // Phase 2: read capture, advance let, enter foreach, capture first prompt
    const result = await injectContext(
      { prompt: 'Go', sessionId: 's1' },
      store,
      undefined,
      captureReader,
    );

    expect(result.prompt).toContain('Paint red');
    const saved = await store.loadCurrent();
    expect(saved?.variables['colors']).toBe('red\ngreen\nblue');
    expect(saved?.variables['color']).toBe('red');
  });
});

describe('injectContext — list variable advancement', () => {
  it('auto-advances let x = [] and sets x_length=0', async () => {
    const store = makeStore();
    const letNode = createLetNode('l1', 'items', { type: 'empty_list' });
    const promptNode = createPromptNode('p1', 'work');
    const spec = createFlowSpec('test', [letNode, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('prompt: work');
    const saved = await store.loadCurrent();
    expect(saved?.variables['items']).toBe('[]');
    expect(saved?.variables['items_length']).toBe(0);
  });

  it('auto-advances let x += "val" and creates ["val"]', async () => {
    const store = makeStore();
    const initNode = createLetNode('l1', 'items', { type: 'empty_list' });
    const appendNode = createLetNode('l2', 'items', { type: 'literal', value: 'apple' }, true);
    const promptNode = createPromptNode('p1', 'work');
    const spec = createFlowSpec('test', [initNode, appendNode, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('prompt: work');
    const saved = await store.loadCurrent();
    expect(saved?.variables['items']).toBe('["apple"]');
    expect(saved?.variables['items_length']).toBe(1);
  });

  it('sequential appends produce correct array', async () => {
    const store = makeStore();
    const init = createLetNode('l1', 'items', { type: 'empty_list' });
    const append1 = createLetNode('l2', 'items', { type: 'literal', value: 'a' }, true);
    const append2 = createLetNode('l3', 'items', { type: 'literal', value: 'b' }, true);
    const append3 = createLetNode('l4', 'items', { type: 'literal', value: 'c' }, true);
    const promptNode = createPromptNode('p1', 'Summary: ${items}');
    const spec = createFlowSpec('test', [init, append1, append2, append3, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('Summary: ["a","b","c"]');
    const saved = await store.loadCurrent();
    expect(saved?.variables['items']).toBe('["a","b","c"]');
    expect(saved?.variables['items_length']).toBe(3);
  });

  it('foreach iterates over list variable', async () => {
    const store = makeStore();
    const init = createLetNode('l1', 'items', { type: 'empty_list' });
    const append1 = createLetNode('l2', 'items', { type: 'literal', value: 'x' }, true);
    const append2 = createLetNode('l3', 'items', { type: 'literal', value: 'y' }, true);
    const foreachNode = createForeachNode('fe1', 'item', '${items}', [
      createPromptNode('p1', 'Process ${item}'),
    ]);
    const spec = createFlowSpec('test', [init, append1, append2, foreachNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    // First foreach iteration captures prompt for first item
    expect(result.prompt).toContain('Process x');
    const saved = await store.loadCurrent();
    expect(saved?.variables['item']).toBe('x');
  });

  it('let x += run "cmd" appends stdout', async () => {
    const store = makeStore();
    const mockRunner: CommandRunner = {
      run: async () => ({ exitCode: 0, stdout: 'cherry\n', stderr: '' }),
    };
    const init = createLetNode('l1', 'fruits', { type: 'empty_list' });
    const appendLit = createLetNode('l2', 'fruits', { type: 'literal', value: 'apple' }, true);
    const appendRun = createLetNode('l3', 'fruits', { type: 'run', command: 'echo cherry' }, true);
    const promptNode = createPromptNode('p1', 'Fruits: ${fruits}');
    const spec = createFlowSpec('test', [init, appendLit, appendRun, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store, mockRunner);

    expect(result.prompt).toContain('Fruits: ["apple","cherry"]');
    const saved = await store.loadCurrent();
    expect(saved?.variables['fruits']).toBe('["apple","cherry"]');
    expect(saved?.variables['fruits_length']).toBe(2);
  });

  it('append to undefined variable auto-creates array', async () => {
    const store = makeStore();
    const appendNode = createLetNode('l1', 'items', { type: 'literal', value: 'first' }, true);
    const promptNode = createPromptNode('p1', 'work');
    const spec = createFlowSpec('test', [appendNode, promptNode]);
    const session = createSessionState('s1', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'Go', sessionId: 's1' }, store);

    expect(result.prompt).toContain('prompt: work');
    const saved = await store.loadCurrent();
    expect(saved?.variables['items']).toBe('["first"]');
    expect(saved?.variables['items_length']).toBe(1);
  });
});

// H#39: Single-keyword prompts no longer trigger (2+ matches required)
describe('looksLikeNaturalLanguage — foreach', () => {
  it('detects "foreach" with compound intent', () => {
    expect(looksLikeNaturalLanguage('foreach file in the list, retry if it fails')).toBe(true);
  });

  it('detects "for each" with compound intent', () => {
    expect(looksLikeNaturalLanguage('for each file, run the linter and loop until passing')).toBe(
      true,
    );
  });

  it('rejects single "foreach" keyword (H#39: 2+ matches needed)', () => {
    expect(looksLikeNaturalLanguage('foreach file in the list, lint it')).toBe(false);
  });

  it('rejects single "for each" keyword (H#39: 2+ matches needed)', () => {
    expect(looksLikeNaturalLanguage('for each file, run the linter')).toBe(false);
  });
});

describe('hasGatesOnly', () => {
  it('returns true for done-when without flow block', () => {
    expect(hasGatesOnly('Fix the tests.\n\ndone when:\n  tests_pass')).toBe(true);
  });

  it('returns false when flow block is present', () => {
    expect(hasGatesOnly('Goal: g\n\nflow:\n  prompt: work\n\ndone when:\n  tests_pass')).toBe(
      false,
    );
  });

  it('returns false when no done-when section', () => {
    expect(hasGatesOnly('Just fix the tests please.')).toBe(false);
  });

  it('handles case-insensitive done when', () => {
    expect(hasGatesOnly('Fix it.\n\nDone When:\n  tests_pass')).toBe(true);
  });

  it('returns false for prose containing "done when:" mid-sentence (D5)', () => {
    expect(hasGatesOnly('The task is done when: all tests pass')).toBe(false);
  });

  it('returns true when done when: starts its own line with indentation', () => {
    expect(hasGatesOnly('Fix it.\n\n  done when:\n    tests_pass')).toBe(true);
  });
});

describe('injectContext — gate-only mode', () => {
  it('creates session with gates but no flow nodes', async () => {
    const store = makeStore();
    const prompt = 'Fix the failing tests.\n\ndone when:\n  tests_pass';
    const result = await injectContext({ prompt, sessionId: 'gate-1' }, store);

    expect(result.prompt).toBe(prompt);
    const saved = await store.loadCurrent();
    expect(saved).not.toBeNull();
    expect(saved?.flowSpec.nodes).toEqual([]);
    expect(saved?.flowSpec.completionGates).toHaveLength(1);
    expect(saved?.flowSpec.completionGates[0]!.predicate).toBe('tests_pass');
    expect(saved?.status).toBe('active');
  });

  it('preserves goal in gate-only mode', async () => {
    const store = makeStore();
    const prompt = 'Goal: fix auth\n\nFix the auth tests.\n\ndone when:\n  tests_pass';
    const result = await injectContext({ prompt, sessionId: 'gate-2' }, store);

    expect(result.prompt).toBe(prompt);
    const saved = await store.loadCurrent();
    expect(saved?.flowSpec.goal).toBe('fix auth');
  });

  it('passes through prompt unmodified', async () => {
    const store = makeStore();
    const prompt = 'Do the work.\n\ndone when:\n  tests_pass\n  lint_pass';
    const result = await injectContext({ prompt, sessionId: 'gate-3' }, store);

    expect(result.prompt).toBe(prompt);
  });

  it('parses multiple gates in gate-only mode', async () => {
    const store = makeStore();
    const prompt = 'Fix it.\n\ndone when:\n  tests_pass\n  lint_pass';
    await injectContext({ prompt, sessionId: 'gate-4' }, store);

    const saved = await store.loadCurrent();
    expect(saved?.flowSpec.completionGates).toHaveLength(2);
  });

  it('parses custom gates in gate-only mode (D9)', async () => {
    const store = makeStore();
    const prompt = 'Build the project.\n\ndone when:\n  gate build_ok: npm run build';
    await injectContext({ prompt, sessionId: 'gate-custom' }, store);
    const saved = await store.loadCurrent();
    expect(saved?.flowSpec.completionGates).toHaveLength(1);
    expect(saved?.flowSpec.completionGates[0]!.predicate).toBe('build_ok');
    expect(saved?.flowSpec.completionGates[0]!.command).toBe('npm run build');
  });

  it('active flow takes precedence over gate-only detection', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Existing', [createPromptNode('p1', 'work')]);
    const session = createSessionState('gate-5', spec);
    await store.save(session);

    const result = await injectContext(
      { prompt: 'Continue.\n\ndone when:\n  tests_pass', sessionId: 'gate-5' },
      store,
    );

    expect(result.prompt).toContain('[prompt-language] Flow: Existing');
  });
});

describe('injectContext — bare flow (no flow: keyword)', () => {
  it('activates flow from bare prompt: line', async () => {
    const store = makeStore();
    const prompt = 'Goal: test\n\nprompt: Do something';
    const result = await injectContext({ prompt, sessionId: 'bare-1' }, store);
    expect(result.prompt).toContain('[prompt-language]');
    expect(result.prompt).toContain('Do something');
    const saved = await store.loadCurrent();
    expect(saved).not.toBeNull();
  });

  it('activates flow from bare run: line', async () => {
    const store = makeStore();
    const prompt = 'Goal: run test\n\nrun: npm test';
    const result = await injectContext({ prompt, sessionId: 'bare-2' }, store);
    expect(result.prompt).toContain('[prompt-language]');
  });

  it('activates flow from bare let statement', async () => {
    const store = makeStore();
    const prompt = 'Goal: test\n\nlet x = "hello"\nprompt: Say ${x}';
    const result = await injectContext({ prompt, sessionId: 'bare-3' }, store);
    expect(result.prompt).toContain('[prompt-language]');
    expect(result.prompt).toContain('Say hello');
  });

  it('does not activate bare flow for plain text', async () => {
    const store = makeStore();
    const result = await injectContext(
      { prompt: 'Fix the failing tests', sessionId: 'bare-4' },
      store,
    );
    expect(result.prompt).toBe('Fix the failing tests');
  });

  it('does not activate bare flow when flow: keyword present', async () => {
    const store = makeStore();
    const prompt = 'Goal: test\n\nflow:\n  prompt: hi';
    const result = await injectContext({ prompt, sessionId: 'bare-5' }, store);
    // Should be handled by the normal flow: block path, not bare detection
    expect(result.prompt).toContain('[prompt-language]');
  });
});

describe('injectContext — NL-to-DSL round-trip', () => {
  it('saves pending prompt when NL intent detected', async () => {
    const store = makeStore();
    const nlPrompt = 'keep fixing until tests pass';
    await injectContext({ prompt: nlPrompt, sessionId: 'rt-1' }, store);

    const pending = await store.loadPendingPrompt();
    expect(pending).toBe(nlPrompt);
  });

  it('returns meta-prompt with DSL reference when user confirms with "yes"', async () => {
    const store = makeStore();
    const originalPrompt = 'keep fixing until tests pass';

    // Step 1: NL detection — saves pending prompt, returns confirmation
    const result1 = await injectContext({ prompt: originalPrompt, sessionId: 'rt-2' }, store);
    expect(result1.prompt).toContain('control-flow intent');

    // Step 2: User confirms — pending prompt loaded, meta-prompt returned
    const result2 = await injectContext({ prompt: 'yes', sessionId: 'rt-2' }, store);
    expect(result2.prompt).toContain('prompt-language DSL reference');
    expect(result2.prompt).toContain(originalPrompt);
    expect(result2.prompt).toContain('Respond with ONLY a valid prompt-language program');
  });

  it('clears pending prompt after confirmation', async () => {
    const store = makeStore();
    await store.savePendingPrompt('loop until done');

    await injectContext({ prompt: 'yes', sessionId: 'rt-3' }, store);

    const pending = await store.loadPendingPrompt();
    expect(pending).toBeNull();
  });

  it('clears pending prompt and passes through when user sends non-trivial reply', async () => {
    const store = makeStore();
    const originalPrompt = 'retry the build 3 times on failure';

    // Step 1: NL detection
    await injectContext({ prompt: originalPrompt, sessionId: 'rt-4' }, store);
    expect(await store.loadPendingPrompt()).toBe(originalPrompt);

    // Step 2: User sends a different instruction (not confirming)
    const result = await injectContext(
      { prompt: 'Actually, just fix the auth module', sessionId: 'rt-4' },
      store,
    );
    expect(result.prompt).toBe('Actually, just fix the auth module');
    expect(await store.loadPendingPrompt()).toBeNull();
  });

  it('does not trigger meta-prompt when no pending prompt exists and user says "yes"', async () => {
    const store = makeStore();
    const result = await injectContext({ prompt: 'yes', sessionId: 'rt-5' }, store);
    expect(result.prompt).toBe('yes');
  });

  it('active flow takes precedence over pending prompt confirmation', async () => {
    const store = makeStore();
    await store.savePendingPrompt('retry the build until it passes');
    const spec = createFlowSpec('Active flow', [createPromptNode('p1', 'do work')]);
    const session = createSessionState('rt-6', spec);
    await store.save(session);

    const result = await injectContext({ prompt: 'yes', sessionId: 'rt-6' }, store);

    expect(await store.loadPendingPrompt()).toBeNull();
    expect(result.prompt).toContain('[prompt-language] Flow: Active flow');
  });

  it('accepts all trivial confirmations: "go", "ok", "sure", "yep"', async () => {
    for (const confirm of ['go', 'ok', 'sure', 'yep', 'Go ahead', 'sounds good']) {
      const store = makeStore();
      await store.savePendingPrompt('loop until tests pass and retry on failure');

      const result = await injectContext(
        { prompt: confirm, sessionId: 'rt-confirm-' + confirm },
        store,
      );
      expect(result.prompt).toContain('prompt-language DSL reference');
      expect(result.prompt).toContain('loop until tests pass and retry on failure');
    }
  });

  it('meta-prompt includes foreach and spawn/await in DSL reference', async () => {
    const store = makeStore();
    await store.savePendingPrompt('for each file lint it and retry on failure');

    const result = await injectContext({ prompt: 'yes', sessionId: 'rt-7' }, store);
    expect(result.prompt).toContain('foreach');
    expect(result.prompt).toContain('spawn');
    expect(result.prompt).toContain('await');
  });

  it('abort flow clears pending prompt', async () => {
    const store = makeStore();
    await store.savePendingPrompt('retry until done');
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    const session = createSessionState('rt-8', spec);
    await store.save(session);

    await injectContext({ prompt: 'abort flow', sessionId: 'rt-8' }, store);

    expect(await store.loadPendingPrompt()).toBeNull();
  });
});

describe('injectContext — H-DX-003 dry-run mode', () => {
  it('returns dry-run output with rendered flow and complexity without persisting state', async () => {
    const store = makeStore();
    const prompt = 'dry-run\nGoal: test\nflow:\n  prompt: Do something\ndone when:\n  tests_pass';
    const result = await injectContext({ prompt, sessionId: 'dr-1' }, store);

    expect(result.prompt).toContain('[prompt-language dry-run]');
    expect(result.prompt).toContain('Complexity:');
    expect(result.prompt).toContain('prompt: Do something');
    // Should NOT persist state
    const saved = await store.loadCurrent();
    expect(saved).toBeNull();
  });

  it('detects --dry-run flag', async () => {
    const store = makeStore();
    const prompt = '--dry-run\nGoal: test\nflow:\n  prompt: Work\ndone when:\n  tests_pass';
    const result = await injectContext({ prompt, sessionId: 'dr-2' }, store);

    expect(result.prompt).toContain('[prompt-language dry-run]');
    expect(await store.loadCurrent()).toBeNull();
  });

  it('strips dry-run from the forwarded prompt text', async () => {
    const store = makeStore();
    const prompt = 'dry-run\nGoal: test\nflow:\n  prompt: Work';
    const result = await injectContext({ prompt, sessionId: 'dr-3' }, store);

    expect(result.prompt).toContain('[prompt-language dry-run]');
    // The cleaned prompt should not contain the dry-run keyword as a standalone word
    const lines = result.prompt.split('\n');
    const afterComplexity = lines.slice(lines.findIndex((l) => l.startsWith('Complexity:')) + 1);
    const cleanedPart = afterComplexity.join('\n').trim();
    expect(cleanedPart).not.toMatch(/(?:^|\s)(?:--|)dry-?run\b/i);
  });

  it('shows lint warnings in dry-run output', async () => {
    const store = makeStore();
    // Empty while body triggers lint warning
    const prompt = 'dry-run\nflow:\n  while tests_fail max 3\n  end';
    const result = await injectContext({ prompt, sessionId: 'dr-4' }, store);

    expect(result.prompt).toContain('[prompt-language dry-run]');
    expect(result.prompt).toContain('Warnings:');
    expect(result.prompt).toContain('Empty while body');
  });
});

// ── H-REL-003: Checkpoint/Resume ──────────────────────────────────────

describe('injectContext — checkpoint/resume', () => {
  it('adds resumed tag when sessionId differs from stored state', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Resume test', [
      createPromptNode('p1', 'Step 1'),
      createPromptNode('p2', 'Step 2'),
    ]);
    let session = createSessionState('old-session', spec);
    session = { ...session, currentNodePath: [1] }; // at step 2
    await store.save(session);

    const result = await injectContext({ prompt: 'continue', sessionId: 'new-session' }, store);
    expect(result.prompt).toContain('resumed from');
    expect(result.prompt).toContain('Step 2');
  });

  it('does not add resumed tag when sessionId matches', async () => {
    const store = makeStore();
    const spec = createFlowSpec('Same session', [
      createPromptNode('p1', 'Step 1'),
      createPromptNode('p2', 'Step 2'),
    ]);
    let session = createSessionState('same-id', spec);
    session = { ...session, currentNodePath: [1] };
    await store.save(session);

    const result = await injectContext({ prompt: 'continue', sessionId: 'same-id' }, store);
    expect(result.prompt).not.toContain('resumed from');
    expect(result.prompt).toContain('Step 2');
  });
});
