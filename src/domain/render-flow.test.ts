import { describe, it, expect } from 'vitest';
import { renderFlow } from './render-flow.js';
import { createSessionState, updateNodeProgress, updateGateResult } from './session-state.js';
import { createFlowSpec, createCompletionGate } from './flow-spec.js';
import {
  createPromptNode,
  createRunNode,
  createWhileNode,
  createUntilNode,
  createRetryNode,
  createIfNode,
  createTryNode,
  createLetNode,
  createForeachNode,
} from './flow-node.js';

describe('renderFlow', () => {
  it('renders header with goal and status', () => {
    const spec = createFlowSpec('fix the auth tests', [createPromptNode('p1', 'hi')]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('[prompt-language] Flow: fix the auth tests | Status: active');
  });

  it('renders a single prompt node', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'do work')]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('prompt: do work');
  });

  it('renders a single run node', () => {
    const spec = createFlowSpec('test', [createRunNode('r1', 'npm test')]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('run: npm test');
  });

  it('marks current node with > prefix and <-- current suffix', () => {
    const spec = createFlowSpec('test', [
      createPromptNode('p1', 'first'),
      createRunNode('r1', 'npm test'),
    ]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [1] };
    const output = renderFlow(state);
    expect(output).toContain('> run: npm test  <-- current');
    expect(output).not.toContain('> prompt: first');
  });

  it('marks ancestor nodes with > prefix but no <-- current suffix', () => {
    const whileNode = createWhileNode('w1', 'not tests_pass', [
      createPromptNode('p1', 'fix tests'),
      createRunNode('r1', 'npm test'),
    ]);
    const spec = createFlowSpec('test', [whileNode]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [0, 1] };
    const output = renderFlow(state);
    const lines = output.split('\n');
    const whileLine = lines.find((l) => l.includes('while'));
    const runLine = lines.find((l) => l.includes('run:'));
    expect(whileLine).toMatch(/^> /);
    expect(whileLine).not.toContain('<-- current');
    expect(runLine).toContain('<-- current');
  });

  it('renders loop progress annotations', () => {
    const whileNode = createWhileNode('w1', 'not tests_pass', [createRunNode('r1', 'npm test')], 4);
    const spec = createFlowSpec('test', [whileNode]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'w1', {
      iteration: 2,
      maxIterations: 4,
      status: 'running',
    });
    state = { ...state, currentNodePath: [0, 0] };
    const output = renderFlow(state);
    expect(output).toContain('[2/4]');
  });

  it('renders while node structure', () => {
    const whileNode = createWhileNode('w1', 'not done', [createPromptNode('p1', 'work')], 5);
    const spec = createFlowSpec('test', [whileNode]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('while not done max 5');
    expect(output).toContain('end');
  });

  it('renders until node structure', () => {
    const untilNode = createUntilNode('u1', 'tests_pass', [createRunNode('r1', 'npm test')], 3);
    const spec = createFlowSpec('test', [untilNode]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('until tests_pass max 3');
  });

  it('renders retry node structure', () => {
    const retryNode = createRetryNode('re1', [createRunNode('r1', 'npm build')], 3);
    const spec = createFlowSpec('test', [retryNode]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('retry max 3');
  });

  it('renders if/else with both branches', () => {
    const ifNode = createIfNode(
      'i1',
      'tests_fail',
      [createPromptNode('p1', 'fix it')],
      [createPromptNode('p2', 'move on')],
    );
    const spec = createFlowSpec('test', [ifNode]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('if tests_fail');
    expect(output).toContain('prompt: fix it');
    expect(output).toContain('else');
    expect(output).toContain('prompt: move on');
    expect(output).toContain('end');
  });

  it('renders if without else', () => {
    const ifNode = createIfNode('i1', 'error', [createPromptNode('p1', 'handle')]);
    const spec = createFlowSpec('test', [ifNode]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('if error');
    expect(output).not.toContain('else');
  });

  it('renders try/catch structure', () => {
    const tryNode = createTryNode('t1', [createRunNode('r1', 'npm deploy')], 'command_failed', [
      createPromptNode('p1', 'roll back'),
    ]);
    const spec = createFlowSpec('test', [tryNode]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('try');
    expect(output).toContain('run: npm deploy');
    expect(output).toContain('catch command_failed');
    expect(output).toContain('prompt: roll back');
    expect(output).toContain('end');
  });

  it('renders completion gate markers - pending', () => {
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'work')],
      [createCompletionGate('tests_pass')],
    );
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('done when:');
    expect(output).toContain('tests_pass  [pending]');
  });

  it('renders completion gate markers - pass and fail', () => {
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'work')],
      [createCompletionGate('tests_pass'), createCompletionGate('lint_pass')],
    );
    let state = createSessionState('s1', spec);
    state = updateGateResult(state, 'tests_pass', true);
    state = updateGateResult(state, 'lint_pass', false);
    const output = renderFlow(state);
    expect(output).toContain('tests_pass  [pass]');
    expect(output).toContain('lint_pass  [fail]');
  });

  it('renders variables section', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { tests_pass: false, last_exit_code: 1 } };
    const output = renderFlow(state);
    expect(output).toContain('Variables:');
    expect(output).toContain('tests_pass = false');
    expect(output).toContain('last_exit_code = 1');
  });

  it('omits variables section when empty', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).not.toContain('Variables:');
  });

  it('omits done when section when no gates', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).not.toContain('done when:');
  });

  it('renders empty flow gracefully', () => {
    const spec = createFlowSpec('empty', []);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('[prompt-language] Flow: empty | Status: active');
  });

  it('handles out-of-bounds path gracefully', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [99] };
    const output = renderFlow(state);
    expect(output).toContain('[prompt-language] Flow: test');
    expect(output).not.toContain('<-- current');
  });

  it('renders complex nested flow: while > if > prompt', () => {
    const ifNode = createIfNode(
      'i1',
      'failure_mode == "type-error"',
      [createPromptNode('p2', 'fix the type error only')],
      [createPromptNode('p3', 'choose a different fix path')],
    );
    const whileNode = createWhileNode(
      'w1',
      'not tests_pass',
      [
        createPromptNode('p1', 'inspect failures and choose fix'),
        createRunNode('r1', 'pnpm test -- auth'),
        ifNode,
      ],
      4,
    );
    const spec = createFlowSpec(
      'fix the auth tests',
      [whileNode],
      [createCompletionGate('tests_pass == true')],
    );
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'w1', {
      iteration: 2,
      maxIterations: 4,
      status: 'running',
    });
    state = {
      ...state,
      currentNodePath: [0, 1],
      variables: { tests_pass: false, last_exit_code: 1 },
    };
    state = updateGateResult(state, 'tests_pass == true', false);

    const output = renderFlow(state);

    expect(output).toContain('[prompt-language] Flow: fix the auth tests | Status: active');
    expect(output).toContain('while not tests_pass max 4');
    expect(output).toContain('[2/4]');
    expect(output).toContain('run: pnpm test -- auth  <-- current');
    expect(output).toContain('if failure_mode == "type-error"');
    expect(output).toContain('else');
    expect(output).toContain('done when:');
    expect(output).toContain('tests_pass == true  [fail]');
    expect(output).toContain('Variables:');
    expect(output).toContain('tests_pass = false');
  });

  it('marks current node inside else branch', () => {
    const ifNode = createIfNode(
      'i1',
      'tests_fail',
      [createPromptNode('p1', 'fix')],
      [createPromptNode('p2', 'skip')],
    );
    const spec = createFlowSpec('test', [ifNode]);
    let state = createSessionState('s1', spec);
    // else branch: offset = thenBranch.length = 1, so index 1 = first else child
    state = { ...state, currentNodePath: [0, 1] };
    const output = renderFlow(state);
    expect(output).toContain('prompt: skip  <-- current');
  });

  it('marks current node inside catch body', () => {
    const tryNode = createTryNode('t1', [createRunNode('r1', 'npm deploy')], 'command_failed', [
      createPromptNode('p1', 'roll back'),
    ]);
    const spec = createFlowSpec('test', [tryNode]);
    let state = createSessionState('s1', spec);
    // catch body: offset = body.length = 1, so index 1 = first catch child
    state = { ...state, currentNodePath: [0, 1] };
    const output = renderFlow(state);
    expect(output).toContain('prompt: roll back  <-- current');
  });

  it('renders a let node with literal source', () => {
    const letNode = createLetNode('l1', 'greeting', { type: 'literal', value: 'hello' });
    const spec = createFlowSpec('test', [letNode]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('let greeting = "hello"');
  });

  it('renders a let node with prompt source', () => {
    const letNode = createLetNode('l1', 'info', { type: 'prompt', text: 'summarize this' });
    const spec = createFlowSpec('test', [letNode]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('let info = prompt "summarize this"');
  });

  it('renders a let node with run source', () => {
    const letNode = createLetNode('l1', 'out', { type: 'run', command: 'echo hi' });
    const spec = createFlowSpec('test', [letNode]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('let out = run "echo hi"');
  });

  it('shows resolved value annotation for let node', () => {
    const letNode = createLetNode('l1', 'greeting', { type: 'literal', value: 'hello' });
    const spec = createFlowSpec('test', [letNode, createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { greeting: 'hello' } };
    const output = renderFlow(state);
    expect(output).toContain('let greeting = "hello"  [= hello]');
  });

  it('marks let node as current', () => {
    const letNode = createLetNode('l1', 'x', { type: 'literal', value: 'val' });
    const spec = createFlowSpec('test', [letNode]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [0] };
    const output = renderFlow(state);
    expect(output).toContain('> ');
    expect(output).toContain('<-- current');
    expect(output).toContain('let x = "val"');
  });

  it('renders a foreach node structure', () => {
    const foreachNode = createForeachNode('fe1', 'file', '${files}', [
      createRunNode('r1', 'lint ${file}'),
    ]);
    const spec = createFlowSpec('test', [foreachNode]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('foreach file in ${files}');
    expect(output).toContain('run: lint ${file}');
    expect(output).toContain('end');
  });

  it('renders foreach with progress annotation', () => {
    const foreachNode = createForeachNode('fe1', 'item', '${list}', [
      createPromptNode('p1', 'process ${item}'),
    ]);
    const spec = createFlowSpec('test', [foreachNode]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'fe1', {
      iteration: 2,
      maxIterations: 5,
      status: 'running',
    });
    state = { ...state, currentNodePath: [0, 0], variables: { item: 'second' } };
    const output = renderFlow(state);
    expect(output).toContain('[2/5]');
    expect(output).toContain('[item=second]');
  });

  it('renders foreach without variable annotation when not set', () => {
    const foreachNode = createForeachNode('fe1', 'x', '${list}', [createPromptNode('p1', 'work')]);
    const spec = createFlowSpec('test', [foreachNode]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('foreach x in ${list}');
    expect(output).not.toContain('[x=');
  });

  it('marks current node inside foreach body', () => {
    const foreachNode = createForeachNode('fe1', 'f', '${files}', [
      createPromptNode('p1', 'review'),
      createRunNode('r1', 'test'),
    ]);
    const spec = createFlowSpec('test', [foreachNode]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [0, 1] };
    const output = renderFlow(state);
    expect(output).toContain('run: test  <-- current');
  });
});
