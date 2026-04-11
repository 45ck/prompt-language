import { describe, it, expect } from 'vitest';
import {
  renderFlow,
  renderFlowSummary,
  renderCompletionSummary,
  renderTimingReport,
  renderFlowCompact,
  renderStateHash,
} from './render-flow.js';
import {
  createSessionState,
  updateNodeProgress,
  updateGateResult,
  updateGateDiagnostic,
  markFailed,
  markCompleted,
} from './session-state.js';
import {
  createFlowSpec,
  createCompletionGate,
  createRubricDefinition,
  createJudgeDefinition,
} from './flow-spec.js';
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
  createSpawnNode,
  createAwaitNode,
  createBreakNode,
  createContinueNode,
  createApproveNode,
  createReviewNode,
  createRememberNode,
  createSendNode,
  createReceiveNode,
  createForeachSpawnNode,
  createRaceNode,
  createSwarmRoleDefinition,
  createSwarmNode,
  createStartNode,
  createReturnNode,
} from './flow-node.js';
import { updateSpawnedChild } from './session-state.js';

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

  it('renders flow and node profile selections', () => {
    const spec = createFlowSpec(
      'test',
      [
        createPromptNode('p1', 'inspect', 'reviewer'),
        createIfNode(
          'if1',
          'ask:"is it safe?"',
          [createPromptNode('p2', 'ship')],
          [createPromptNode('p3', 'stop')],
          'npm test',
          2,
          'reviewer',
        ),
      ],
      [],
      [],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'default',
      {
        default: { name: 'default', systemPreamble: 'Stay concise.' },
        reviewer: { name: 'reviewer', skills: ['security-review'] },
      },
    );
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('use profile "default"');
    expect(output).toContain('prompt using profile "reviewer": inspect');
    expect(output).toContain(
      'if ask "is it safe?" using profile "reviewer" grounded-by "npm test" max-retries 2',
    );
  });

  it('renders a single run node', () => {
    const spec = createFlowSpec('test', [createRunNode('r1', 'npm test')]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('run: npm test');
  });

  it('renders rubric and judge declarations before executable nodes', () => {
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'ship it')],
      [],
      [],
      undefined,
      undefined,
      undefined,
      undefined,
      [createRubricDefinition('bugfix_quality', ['criterion correctness type boolean'])],
      [createJudgeDefinition('impl_quality', ['rubric: "bugfix_quality"'], 'bugfix_quality')],
    );
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);

    expect(output).toContain('rubric "bugfix_quality"');
    expect(output).toContain('judge "impl_quality"');
    expect(output).toContain('prompt: ship it');
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
    expect(output).toContain('~ prompt: first');
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

  // H#32: Visual progress bar
  it('renders loop progress annotations with visual bar', () => {
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
    // Math.round(2/4 * 5) = Math.round(2.5) = 3
    expect(output).toContain('[###--] 2/4');
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

  it('describes swarm, start, and return nodes in flow summaries', () => {
    const swarm = createSwarmNode(
      'sw1',
      'checkout_fix',
      [
        createSwarmRoleDefinition('role1', 'frontend', [
          createPromptNode('p1', 'Fix the UI regression'),
          createReturnNode('ret-role', '${summary}'),
        ]),
      ],
      [createStartNode('st1', ['frontend']), createReturnNode('ret1', '${summary}')],
    );
    const swarmState = createSessionState('s1', createFlowSpec('test', [swarm]));
    const startState = createSessionState(
      's2',
      createFlowSpec('test', [createStartNode('st2', ['frontend'])]),
    );
    const returnState = createSessionState(
      's3',
      createFlowSpec('test', [createReturnNode('ret2', '${summary}')]),
    );

    expect(renderFlowSummary({ ...swarmState, currentNodePath: [0] })).toContain(
      'swarm checkout_fix',
    );
    expect(renderFlowSummary({ ...startState, currentNodePath: [0] })).toContain('start frontend');
    expect(renderFlowSummary({ ...returnState, currentNodePath: [0] })).toContain(
      'return ${summary}',
    );
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

  it('renders gate failure with diagnostics', () => {
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'work')],
      [createCompletionGate('tests_pass')],
    );
    let state = createSessionState('s1', spec);
    state = updateGateResult(state, 'tests_pass', false);
    state = updateGateDiagnostic(state, 'tests_pass', {
      passed: false,
      command: 'npm test',
      exitCode: 1,
      stderr: '3 tests failed',
    });
    const output = renderFlow(state);
    expect(output).toContain('tests_pass  [fail — exit 1: "npm test": 3 tests failed]');
  });

  it('renders gate failure without stderr', () => {
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'work')],
      [createCompletionGate('lint_pass')],
    );
    let state = createSessionState('s1', spec);
    state = updateGateResult(state, 'lint_pass', false);
    state = updateGateDiagnostic(state, 'lint_pass', {
      passed: false,
      command: 'npm run lint',
      exitCode: 2,
    });
    const output = renderFlow(state);
    expect(output).toContain('lint_pass  [fail — exit 2: "npm run lint"]');
  });

  it('renders gate pass without diagnostics detail', () => {
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'work')],
      [createCompletionGate('tests_pass')],
    );
    let state = createSessionState('s1', spec);
    state = updateGateResult(state, 'tests_pass', true);
    state = updateGateDiagnostic(state, 'tests_pass', {
      passed: true,
      command: 'npm test',
      exitCode: 0,
    });
    const output = renderFlow(state);
    expect(output).toContain('tests_pass  [pass]');
    expect(output).not.toContain('exit 0');
  });

  it('renders variables section with user-defined variables', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { tests_pass: false, user_var: 'hello' } };
    const output = renderFlow(state);
    expect(output).toContain('Variables:');
    expect(output).toContain('tests_pass = false');
    expect(output).toContain('user_var = hello');
  });

  it('renders visible variables in canonical key order for equivalent state', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    const stateA = {
      ...createSessionState('s1', spec),
      variables: { zebra: 'last', alpha: 'first', middle: 'mid' },
    };
    const stateB = {
      ...createSessionState('s1', spec),
      variables: { middle: 'mid', zebra: 'last', alpha: 'first' },
    };

    const outputA = renderFlow(stateA);
    const outputB = renderFlow(stateB);

    expect(outputA).toBe(outputB);
    expect(outputA).toContain('Variables:\n  alpha = first\n  middle = mid\n  zebra = last');
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
    expect(output).toContain('[###--] 2/4');
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

  it('shows [awaiting response...] during capture phase for let-prompt', () => {
    const letNode = createLetNode('l1', 'tasks', { type: 'prompt', text: 'list bugs' });
    const spec = createFlowSpec('test', [letNode]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'l1', {
      iteration: 1,
      maxIterations: 3,
      status: 'awaiting_capture',
    });
    const output = renderFlow(state);
    expect(output).toContain('let tasks = prompt "list bugs"  [awaiting response...]');
  });

  it('shows [= value] after capture completes for let-prompt', () => {
    const letNode = createLetNode('l1', 'tasks', { type: 'prompt', text: 'list bugs' });
    const spec = createFlowSpec('test', [letNode, createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { tasks: 'bug1\nbug2' }, currentNodePath: [1] };
    const output = renderFlow(state);
    expect(output).toContain('[= bug1\nbug2]');
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
    // Math.round(2/5 * 5) = Math.round(2) = 2
    expect(output).toContain('[##---] 2/5');
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

  it('renders let x = [] for empty_list source', () => {
    const letNode = createLetNode('l1', 'items', { type: 'empty_list' });
    const spec = createFlowSpec('test', [letNode]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('let items = []');
  });

  it('renders let x += "val" for append literal', () => {
    const letNode = createLetNode('l1', 'errors', { type: 'literal', value: 'timeout' }, true);
    const spec = createFlowSpec('test', [letNode]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('let errors += "timeout"');
  });

  it('renders let x += run "cmd" for append run', () => {
    const letNode = createLetNode('l1', 'logs', { type: 'run', command: 'npm test' }, true);
    const spec = createFlowSpec('test', [letNode]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('let logs += run "npm test"');
  });

  it('shows [= ["a","b"]] annotation for list variable', () => {
    const letNode = createLetNode('l1', 'items', { type: 'empty_list' });
    const spec = createFlowSpec('test', [letNode, createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { items: '["a","b"]' } };
    const output = renderFlow(state);
    expect(output).toContain('[= ["a","b"]]');
  });

  // H#33: Truncate long variable values
  it('truncates variable values longer than 80 chars', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    const longVal = 'x'.repeat(100);
    state = { ...state, variables: { big: longVal } };
    const output = renderFlow(state);
    expect(output).toContain('big = ' + 'x'.repeat(77) + '...');
    expect(output).not.toContain('x'.repeat(100));
  });

  // H#36: Multi-line stderr in gate diagnostics
  it('shows first 3 lines of stderr in gate failure diagnostic', () => {
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'work')],
      [createCompletionGate('tests_pass')],
    );
    let state = createSessionState('s1', spec);
    state = updateGateResult(state, 'tests_pass', false);
    state = updateGateDiagnostic(state, 'tests_pass', {
      passed: false,
      command: 'npm test',
      exitCode: 1,
      stderr: 'line1 error\nline2 detail\nline3 context\nline4 ignored',
    });
    const output = renderFlow(state);
    expect(output).toContain('line1 error | line2 detail | line3 context');
    expect(output).not.toContain('line4 ignored');
  });

  // H#51: Render warnings
  it('renders warnings section when warnings exist', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')], [], ['Missing end']);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('Warnings:');
    expect(output).toContain('[!] Missing end');
  });

  it('omits warnings section when no warnings', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).not.toContain('Warnings:');
  });

  it('renders timeout annotation on run node', () => {
    const spec = createFlowSpec('test', [createRunNode('r1', 'npm test', 60000)]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('run: npm test [timeout 60s]');
  });

  it('renders ask max-retries on ask conditions', () => {
    const spec = createFlowSpec('test', [
      createWhileNode(
        'w1',
        'ask:"ready?"',
        [createPromptNode('p1', 'work')],
        4,
        undefined,
        undefined,
        'npm test',
        2,
      ),
    ]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('while ask "ready?" grounded-by "npm test" max 4 max-retries 2');
  });

  it('does not render timeout annotation when no timeout', () => {
    const spec = createFlowSpec('test', [createRunNode('r1', 'npm test')]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('run: npm test');
    expect(output).not.toContain('timeout');
  });

  it('renders a spawn block with body', () => {
    const spawn = createSpawnNode('sp1', 'fix-auth', [
      createPromptNode('p1', 'Fix auth'),
      createRunNode('r1', 'npm test'),
    ]);
    const spec = createFlowSpec('test', [spawn]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('spawn "fix-auth"');
    expect(output).toContain('prompt: Fix auth');
    expect(output).toContain('run: npm test');
    expect(output).toContain('end');
  });

  it('renders spawn with child status annotation', () => {
    const spawn = createSpawnNode('sp1', 'fix-auth', [createPromptNode('p1', 'Fix')]);
    const spec = createFlowSpec('test', [spawn, createPromptNode('p2', 'next')]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [1] };
    state = updateSpawnedChild(state, 'fix-auth', {
      name: 'fix-auth',
      status: 'completed',
      stateDir: '.prompt-language-fix-auth',
    });
    const output = renderFlow(state);
    expect(output).toContain('spawn "fix-auth"  [completed]');
  });

  it('renders await all', () => {
    const spec = createFlowSpec('test', [createAwaitNode('aw1', 'all')]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('await all');
  });

  it('renders await with specific target', () => {
    const spec = createFlowSpec('test', [createAwaitNode('aw1', 'fix-auth')]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('await "fix-auth"');
  });

  it('marks completed nodes with ~ prefix', () => {
    const spec = createFlowSpec('test', [
      createPromptNode('p1', 'step one'),
      createRunNode('r1', 'npm test'),
      createPromptNode('p2', 'step three'),
    ]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [2] };
    const output = renderFlow(state);
    expect(output).toContain('~ prompt: step one');
    expect(output).toContain('~ run: npm test');
    expect(output).toContain('> prompt: step three  <-- current');
  });

  it('marks completed nodes inside loop body', () => {
    const whileNode = createWhileNode('w1', 'not done', [
      createPromptNode('p1', 'step one'),
      createRunNode('r1', 'npm test'),
      createPromptNode('p2', 'step two'),
    ]);
    const spec = createFlowSpec('test', [whileNode]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [0, 2] };
    const output = renderFlow(state);
    expect(output).toContain('~   prompt: step one');
    expect(output).toContain('~   run: npm test');
    expect(output).toContain('>   prompt: step two  <-- current');
  });

  it('does not mark future nodes as completed', () => {
    const spec = createFlowSpec('test', [
      createPromptNode('p1', 'current'),
      createPromptNode('p2', 'future'),
    ]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [0] };
    const output = renderFlow(state);
    expect(output).toContain('> prompt: current  <-- current');
    expect(output).toContain('  prompt: future');
    expect(output).not.toContain('~ prompt: future');
  });

  // H-PERF-002: Selective variable rendering
  it('hides internal auto-set variables from Variables section', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      variables: {
        last_exit_code: 0,
        last_stdout: 'output',
        last_stderr: '',
        user_var: 'visible',
      },
    };
    const output = renderFlow(state);
    expect(output).toContain('user_var = visible');
    expect(output).not.toContain('last_exit_code');
    expect(output).not.toContain('last_stdout');
    expect(output).not.toContain('last_stderr');
  });

  it('hides auto-generated _index and _length variables', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      variables: { item_index: 2, items_length: 5, item: 'current' },
    };
    const output = renderFlow(state);
    expect(output).toContain('item = current');
    expect(output).not.toContain('item_index');
    expect(output).not.toContain('items_length');
  });

  it('hides command_failed and command_succeeded when command_failed is not true', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      variables: { command_failed: 'false', command_succeeded: 'true', user_var: 'hi' },
    };
    const output = renderFlow(state);
    expect(output).toContain('user_var = hi');
    expect(output).not.toContain('command_failed');
    expect(output).not.toContain('command_succeeded');
  });

  it('shows command_failed and command_succeeded when command_failed is true', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      variables: { command_failed: 'true', command_succeeded: 'false' },
    };
    const output = renderFlow(state);
    expect(output).toContain('command_failed = true');
    expect(output).toContain('command_succeeded = false');
  });

  it('omits Variables section when all variables are hidden', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      variables: { last_exit_code: 0, last_stdout: '', last_stderr: '' },
    };
    const output = renderFlow(state);
    expect(output).not.toContain('Variables:');
  });

  // H-DX-008: List variable display
  it('renders JSON array variables as list summaries (<=3 items)', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { myList: '["a","b","c"]' } };
    const output = renderFlow(state);
    expect(output).toContain('myList = [3 items: "a", "b", "c"]');
  });

  it('renders JSON array variables as list summaries (>3 items)', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { data: '["a","b","c","d","e"]' } };
    const output = renderFlow(state);
    expect(output).toContain('data = [5 items: "a", "b", "c", ...]');
  });

  it('renders empty JSON array with count', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { items: '[]' } };
    const output = renderFlow(state);
    expect(output).toContain('items = [0 items: ]');
  });

  it('renders non-JSON string values as-is', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { name: 'hello world' } };
    const output = renderFlow(state);
    expect(output).toContain('name = hello world');
  });

  it('renders JSON object values as-is (not arrays)', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { config: '{"key":"val"}' } };
    const output = renderFlow(state);
    expect(output).toContain('config = {"key":"val"}');
  });

  // H-REL-009: Flow failure reason in render output
  it('shows [FLOW FAILED: reason] when status is failed with failureReason', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = markFailed(state, 'TypeError: Cannot read properties of null');
    const output = renderFlow(state);
    expect(output).toContain('[FLOW FAILED: TypeError: Cannot read properties of null]');
    expect(output).toContain('Status: failed');
  });

  it('does not show [FLOW FAILED] when failed without reason', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = markFailed(state);
    const output = renderFlow(state);
    expect(output).toContain('Status: failed');
    expect(output).not.toContain('[FLOW FAILED');
  });
});

// H-REL-011: Flow heartbeat summary
describe('renderFlowSummary', () => {
  it('produces compact single-line summary with step info', () => {
    const spec = createFlowSpec('test', [
      createPromptNode('p1', 'first step'),
      createRunNode('r1', 'npm test'),
      createPromptNode('p2', 'third step'),
    ]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [1] };
    const summary = renderFlowSummary(state);
    expect(summary).toContain('[prompt-language:');
    expect(summary).toContain('step 2/3');
    expect(summary).toContain('"run: npm test"');
    expect(summary).toContain('vars: 0');
    expect(summary).toMatch(/^\[.*\]$/);
  });

  it('includes gate pass count when gates exist', () => {
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'work')],
      [createCompletionGate('tests_pass'), createCompletionGate('lint_pass')],
    );
    let state = createSessionState('s1', spec);
    state = updateGateResult(state, 'tests_pass', true);
    const summary = renderFlowSummary(state);
    expect(summary).toContain('gates: 1/2 passed');
  });

  it('omits gate info when no gates', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    const state = createSessionState('s1', spec);
    const summary = renderFlowSummary(state);
    expect(summary).not.toContain('gates');
  });

  it('includes variable count', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { a: '1', b: '2', c: '3' } };
    const summary = renderFlowSummary(state);
    expect(summary).toContain('vars: 3');
  });

  it('truncates long node descriptions', () => {
    const longText = 'a'.repeat(60);
    const spec = createFlowSpec('test', [createPromptNode('p1', longText)]);
    const state = createSessionState('s1', spec);
    const summary = renderFlowSummary(state);
    expect(summary.length).toBeLessThanOrEqual(200);
    expect(summary).toContain('...');
  });

  it('shows "done" when path resolves to no node', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [99] };
    const summary = renderFlowSummary(state);
    expect(summary).toContain('"done"');
  });

  it('counts nodes in nested structures', () => {
    const whileNode = createWhileNode('w1', 'not done', [
      createPromptNode('p1', 'fix'),
      createRunNode('r1', 'npm test'),
    ]);
    const spec = createFlowSpec('test', [whileNode, createPromptNode('p2', 'finish')]);
    const state = createSessionState('s1', spec);
    const summary = renderFlowSummary(state);
    // 1 while + 2 body + 1 prompt = 4 total nodes
    expect(summary).toContain('/4');
  });
});

describe('renderFlow — H-DX-005 capture failure diagnostics', () => {
  it('shows capture failure reason when retrying', () => {
    const letNode = createLetNode('l1', 'answer', { type: 'prompt', text: 'What is 2+2?' });
    const spec = createFlowSpec('test', [letNode]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'l1', {
      iteration: 2,
      maxIterations: 3,
      status: 'awaiting_capture',
      captureFailureReason: 'capture file empty or not found',
    });
    state = { ...state, currentNodePath: [0] };
    const output = renderFlow(state);
    expect(output).toContain('[capture failed: capture file empty or not found — retry 2/3]');
  });

  it('shows awaiting response when no failure reason', () => {
    const letNode = createLetNode('l1', 'answer', { type: 'prompt', text: 'What is 2+2?' });
    const spec = createFlowSpec('test', [letNode]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'l1', {
      iteration: 1,
      maxIterations: 3,
      status: 'awaiting_capture',
    });
    state = { ...state, currentNodePath: [0] };
    const output = renderFlow(state);
    expect(output).toContain('[awaiting response...]');
    expect(output).not.toContain('[capture failed');
  });
});

describe('renderFlow — prompt-language-7b1a capture reminder', () => {
  it('shows active-capture reminder with variable file path when awaiting capture', () => {
    const letNode = createLetNode('l1', 'tasks', { type: 'prompt', text: 'List next steps' });
    const spec = createFlowSpec('test', [letNode]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'l1', {
      iteration: 1,
      maxIterations: 3,
      status: 'awaiting_capture',
    });
    const output = renderFlow(state);
    expect(output).toContain(
      '[Capture active: write response to .prompt-language/vars/tasks using Write tool]',
    );
  });

  it('does not show active-capture reminder when capture is not awaiting', () => {
    const letNode = createLetNode('l1', 'tasks', { type: 'prompt', text: 'List next steps' });
    const spec = createFlowSpec('test', [letNode]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'l1', {
      iteration: 1,
      maxIterations: 3,
      status: 'running',
    });
    const output = renderFlow(state);
    expect(output).not.toContain('[Capture active: write response to .prompt-language/vars/');
  });

  it('does not show active-capture reminder for stale awaiting capture on a non-current node', () => {
    const letNode = createLetNode('l1', 'tasks', { type: 'prompt', text: 'List next steps' });
    const spec = createFlowSpec('test', [letNode, createPromptNode('p1', 'continue')]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'l1', {
      iteration: 1,
      maxIterations: 3,
      status: 'awaiting_capture',
    });
    state = { ...state, currentNodePath: [1] };
    const output = renderFlow(state);
    expect(output).not.toContain(
      '[Capture active: write response to .prompt-language/vars/tasks using Write tool]',
    );
  });
});

// Coverage: formatGateDiagnostic stdout fallback (H-DX-004)
describe('renderFlow — formatGateDiagnostic stdout fallback', () => {
  it('shows stdout when stderr is empty', () => {
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'work')],
      [createCompletionGate('tests_pass')],
    );
    let state = createSessionState('s1', spec);
    state = updateGateResult(state, 'tests_pass', false);
    state = updateGateDiagnostic(state, 'tests_pass', {
      passed: false,
      command: 'npm test',
      exitCode: 1,
      stderr: '',
      stdout: 'FAIL src/app.test.js',
    });
    const output = renderFlow(state);
    expect(output).toContain('FAIL src/app.test.js');
    expect(output).toContain('[fail');
  });

  it('prefers stderr over stdout when both present', () => {
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'work')],
      [createCompletionGate('lint_pass')],
    );
    let state = createSessionState('s1', spec);
    state = updateGateResult(state, 'lint_pass', false);
    state = updateGateDiagnostic(state, 'lint_pass', {
      passed: false,
      command: 'npm run lint',
      exitCode: 2,
      stderr: 'lint error found',
      stdout: 'stdout noise',
    });
    const output = renderFlow(state);
    expect(output).toContain('lint error found');
    expect(output).not.toContain('stdout noise');
  });

  it('shows nothing extra when both stderr and stdout are empty', () => {
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'work')],
      [createCompletionGate('tests_pass')],
    );
    let state = createSessionState('s1', spec);
    state = updateGateResult(state, 'tests_pass', false);
    state = updateGateDiagnostic(state, 'tests_pass', {
      passed: false,
      command: 'npm test',
      exitCode: 1,
      stderr: '',
      stdout: '',
    });
    const output = renderFlow(state);
    expect(output).toContain('tests_pass  [fail — exit 1: "npm test"]');
  });
});

// Coverage: renderFlowSummary helpers (countAllNodes, resolveNodeByPath, describeNode, findStepIndex)
describe('renderFlowSummary — helper coverage', () => {
  it('counts empty node list as 0', () => {
    const spec = createFlowSpec('empty', []);
    const state = createSessionState('s1', spec);
    const summary = renderFlowSummary(state);
    expect(summary).toContain('step 0/0');
  });

  it('counts if/else branches recursively', () => {
    const ifNode = createIfNode(
      'i1',
      'cond',
      [createPromptNode('p1', 'then'), createRunNode('r1', 'cmd')],
      [createPromptNode('p2', 'else')],
    );
    const spec = createFlowSpec('test', [ifNode]);
    const state = createSessionState('s1', spec);
    const summary = renderFlowSummary(state);
    // 1 if + 2 then + 1 else = 4
    expect(summary).toContain('/4');
  });

  it('counts try/catch/finally recursively', () => {
    const tryNode = createTryNode(
      't1',
      [createRunNode('r1', 'deploy')],
      'error',
      [createPromptNode('p1', 'rollback')],
      [createRunNode('r2', 'cleanup')],
    );
    const spec = createFlowSpec('test', [tryNode]);
    const state = createSessionState('s1', spec);
    const summary = renderFlowSummary(state);
    // 1 try + 1 body + 1 catch + 1 finally = 4
    expect(summary).toContain('/4');
  });

  it('counts spawn node body recursively', () => {
    const spawnNode = createSpawnNode('sp1', 'child', [
      createPromptNode('p1', 'task'),
      createRunNode('r1', 'test'),
    ]);
    const spec = createFlowSpec('test', [spawnNode]);
    const state = createSessionState('s1', spec);
    const summary = renderFlowSummary(state);
    // 1 spawn + 2 body = 3
    expect(summary).toContain('/3');
  });

  it('resolves nested path inside while body', () => {
    const whileNode = createWhileNode('w1', 'not done', [
      createPromptNode('p1', 'first'),
      createRunNode('r1', 'npm test'),
    ]);
    const spec = createFlowSpec('test', [whileNode]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [0, 1] };
    const summary = renderFlowSummary(state);
    expect(summary).toContain('"run: npm test"');
  });

  it('resolves path through if then/else concatenation', () => {
    const ifNode = createIfNode(
      'i1',
      'cond',
      [createPromptNode('p1', 'then-step')],
      [createRunNode('r1', 'else-cmd')],
    );
    const spec = createFlowSpec('test', [ifNode]);
    let state = createSessionState('s1', spec);
    // else branch: offset = thenBranch.length = 1, so [0, 1] = first else child
    state = { ...state, currentNodePath: [0, 1] };
    const summary = renderFlowSummary(state);
    expect(summary).toContain('"run: else-cmd"');
  });

  it('resolves path through try body/catch/finally concatenation', () => {
    const tryNode = createTryNode(
      't1',
      [createRunNode('r1', 'deploy')],
      'error',
      [createPromptNode('p1', 'rollback')],
      [createRunNode('r2', 'cleanup')],
    );
    const spec = createFlowSpec('test', [tryNode]);
    let state = createSessionState('s1', spec);
    // catch body: offset = body.length = 1, so [0, 1] = first catch child
    state = { ...state, currentNodePath: [0, 1] };
    const summary = renderFlowSummary(state);
    expect(summary).toContain('"prompt: rollback"');
  });

  it('describes let node as "let varName"', () => {
    const letNode = createLetNode('l1', 'greeting', { type: 'literal', value: 'hi' });
    const spec = createFlowSpec('test', [letNode]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [0] };
    const summary = renderFlowSummary(state);
    expect(summary).toContain('"let greeting"');
  });

  it('describes foreach node as "foreach varName"', () => {
    const foreachNode = createForeachNode('fe1', 'item', '${list}', [
      createPromptNode('p1', 'work'),
    ]);
    const spec = createFlowSpec('test', [foreachNode]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [0] };
    const summary = renderFlowSummary(state);
    expect(summary).toContain('"foreach item"');
  });

  it('describes break node', () => {
    const whileNode = createWhileNode('w1', 'true', [createBreakNode('b1')]);
    const spec = createFlowSpec('test', [whileNode]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [0, 0] };
    const summary = renderFlowSummary(state);
    expect(summary).toContain('"break"');
  });

  it('describes spawn node with name', () => {
    const spawnNode = createSpawnNode('sp1', 'worker', [createPromptNode('p1', 'task')]);
    const spec = createFlowSpec('test', [spawnNode]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [0] };
    const summary = renderFlowSummary(state);
    expect(summary).toContain('spawn "worker"');
  });

  it('describes await node', () => {
    const spec = createFlowSpec('test', [createAwaitNode('aw1', 'all')]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [0] };
    const summary = renderFlowSummary(state);
    expect(summary).toContain('"await all"');
  });

  it('shows empty path as done', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [] };
    const summary = renderFlowSummary(state);
    expect(summary).toContain('"done"');
  });

  it('shows all gates passed', () => {
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'work')],
      [createCompletionGate('tests_pass'), createCompletionGate('lint_pass')],
    );
    let state = createSessionState('s1', spec);
    state = updateGateResult(state, 'tests_pass', true);
    state = updateGateResult(state, 'lint_pass', true);
    const summary = renderFlowSummary(state);
    expect(summary).toContain('gates: 2/2 passed');
  });

  it('shows step number using flattened index', () => {
    const ifNode = createIfNode(
      'i1',
      'cond',
      [createPromptNode('p1', 'then')],
      [createPromptNode('p2', 'else')],
    );
    const spec = createFlowSpec('test', [ifNode, createRunNode('r1', 'final')]);
    let state = createSessionState('s1', spec);
    // r1 is after ifNode in top level, flatten order: if, then-prompt, else-prompt, run
    state = { ...state, currentNodePath: [1] };
    const summary = renderFlowSummary(state);
    expect(summary).toContain('step 4/4');
  });
});

// H-DX-002: Timing annotation on completed loop nodes
describe('renderFlow — timing annotation', () => {
  it('shows elapsed time on completed loop node when > 0.5s', () => {
    const whileNode = createWhileNode('w1', 'cond', [createRunNode('r1', 'npm test')], 3);
    const spec = createFlowSpec('test', [whileNode, createPromptNode('p2', 'done')]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'w1', {
      iteration: 2,
      maxIterations: 3,
      status: 'completed',
      startedAt: Date.now() - 4200,
      completedAt: Date.now(),
    });
    state = { ...state, currentNodePath: [1] };
    const output = renderFlow(state);
    expect(output).toContain('[4.2s]');
  });

  it('omits timing annotation when elapsed <= 0.5s', () => {
    const whileNode = createWhileNode('w1', 'cond', [createRunNode('r1', 'npm test')], 3);
    const spec = createFlowSpec('test', [whileNode, createPromptNode('p2', 'done')]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'w1', {
      iteration: 1,
      maxIterations: 3,
      status: 'completed',
      startedAt: Date.now() - 200,
      completedAt: Date.now(),
    });
    state = { ...state, currentNodePath: [1] };
    const output = renderFlow(state);
    expect(output).not.toMatch(/\[\d+\.\d+s\]/);
  });

  it('omits timing when no startedAt or completedAt', () => {
    const whileNode = createWhileNode('w1', 'cond', [createRunNode('r1', 'npm test')], 3);
    const spec = createFlowSpec('test', [whileNode]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'w1', {
      iteration: 1,
      maxIterations: 3,
      status: 'running',
    });
    state = { ...state, currentNodePath: [0, 0] };
    const output = renderFlow(state);
    expect(output).not.toMatch(/\[\d+\.\d+s\]/);
  });

  it('shows elapsed time on completed run nodes', () => {
    const spec = createFlowSpec('test', [createRunNode('r1', 'npm test')]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'r1', {
      iteration: 1,
      maxIterations: 1,
      status: 'completed',
      startedAt: Date.now() - 1800,
      completedAt: Date.now(),
    });
    state = { ...state, currentNodePath: [1] };
    const output = renderFlow(state);
    expect(output).toContain('run: npm test [1.8s]');
  });
});

describe('renderTimingReport', () => {
  it('renders a slowest-first timing table', () => {
    const spec = createFlowSpec('test', [
      createRunNode('r1', 'npm test'),
      createPromptNode('p1', 'done'),
    ]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'r1', {
      iteration: 1,
      maxIterations: 1,
      status: 'completed',
      startedAt: 0,
      completedAt: 45_000,
    });
    state = updateNodeProgress(state, 'p1', {
      iteration: 1,
      maxIterations: 1,
      status: 'completed',
      startedAt: 0,
      completedAt: 2_000,
    });

    const report = renderTimingReport(state);
    expect(report).toContain('| Duration | Node | Path |');
    expect(report).toContain('| 45.0s | run: npm test | 0 |');
    expect(report).toContain('| 2.0s | prompt: done | 1 |');
    expect(report.indexOf('run: npm test')).toBeLessThan(report.indexOf('prompt: done'));
  });

  it('returns a placeholder when no node timings exist', () => {
    const state = createSessionState('s1', createFlowSpec('test', [createPromptNode('p1', 'hi')]));
    expect(renderTimingReport(state)).toBe('No node timing data recorded');
  });
});

// H-DX-009: Flow completion summary
describe('renderCompletionSummary', () => {
  it('produces summary with node count and var count', () => {
    const spec = createFlowSpec('test', [
      createPromptNode('p1', 'a'),
      createRunNode('r1', 'npm test'),
    ]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { myVar: 'hello', last_exit_code: 0 } };
    state = markCompleted(state);
    const summary = renderCompletionSummary(state);
    expect(summary).toContain('Flow completed');
    expect(summary).toContain('2 nodes');
    expect(summary).toContain('vars: 1 set');
  });

  it('includes iteration info for loops', () => {
    const spec = createFlowSpec('test', [
      createWhileNode('w1', 'cond', [createRunNode('r1', 'cmd')], 5),
    ]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'w1', {
      iteration: 3,
      maxIterations: 5,
      status: 'completed',
    });
    state = markCompleted(state);
    const summary = renderCompletionSummary(state);
    expect(summary).toContain('3/5 iterations');
  });

  it('includes gate info when gates present', () => {
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'work')],
      [createCompletionGate('tests_pass'), createCompletionGate('lint_pass')],
    );
    let state = createSessionState('s1', spec);
    state = { ...state, gateResults: { tests_pass: true, lint_pass: true } };
    state = markCompleted(state);
    const summary = renderCompletionSummary(state);
    expect(summary).toContain('gates: 2/2');
  });

  it('omits iteration info when no loops', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = markCompleted(state);
    const summary = renderCompletionSummary(state);
    expect(summary).not.toContain('iterations');
  });

  it('includes a slowest-node hint when any node exceeds 30 seconds', () => {
    const spec = createFlowSpec('test', [createRunNode('r1', 'npm test')]);
    let state = createSessionState('s1', spec);
    state = updateNodeProgress(state, 'r1', {
      iteration: 1,
      maxIterations: 1,
      status: 'completed',
      startedAt: 0,
      completedAt: 45_000,
    });
    state = markCompleted(state);
    const summary = renderCompletionSummary(state);
    expect(summary).toContain('slowest node: run: npm test (45.0s)');
  });
});

// H-PERF-005: Compact context format
describe('renderFlowCompact', () => {
  it('produces abbreviated output with short markers', () => {
    const spec = createFlowSpec('test goal', [
      createPromptNode('p1', 'first'),
      createRunNode('r1', 'npm test'),
    ]);
    const state = createSessionState('s1', spec);
    const compact = renderFlowCompact(state);
    expect(compact).toContain('[pl] test goal | active');
    expect(compact).toContain('P:');
    expect(compact).toContain('R: npm test');
  });

  it('marks current node with >', () => {
    const spec = createFlowSpec('test', [
      createPromptNode('p1', 'first'),
      createRunNode('r1', 'npm test'),
    ]);
    let state = createSessionState('s1', spec);
    state = { ...state, currentNodePath: [1] };
    const compact = renderFlowCompact(state);
    const lines = compact.split('\n');
    expect(lines.find((l) => l.includes('R: npm test'))?.startsWith('>')).toBe(true);
  });

  it('shows gate status with +/-/? markers', () => {
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'work')],
      [createCompletionGate('tests_pass'), createCompletionGate('lint_pass')],
    );
    let state = createSessionState('s1', spec);
    state = { ...state, gateResults: { tests_pass: true, lint_pass: false } };
    const compact = renderFlowCompact(state);
    expect(compact).toContain('+tests_pass');
    expect(compact).toContain('-lint_pass');
  });

  it('shows let variable values abbreviated', () => {
    const letNode = createLetNode('l1', 'greeting', { type: 'literal', value: 'hello' });
    const spec = createFlowSpec('test', [letNode, createPromptNode('p1', 'work')]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { greeting: 'hello' }, currentNodePath: [1] };
    const compact = renderFlowCompact(state);
    expect(compact).toContain('L greeting =');
    expect(compact).toContain('[hello]');
  });
});

// H-PERF-001: Render state hash
describe('renderStateHash', () => {
  it('returns same hash for same state', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'work')]);
    const state = createSessionState('s1', spec);
    expect(renderStateHash(state)).toBe(renderStateHash(state));
  });

  it('returns different hash when path changes', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'a'), createPromptNode('p2', 'b')]);
    const state1 = createSessionState('s1', spec);
    const state2 = { ...state1, currentNodePath: [1] };
    expect(renderStateHash(state1)).not.toBe(renderStateHash(state2));
  });

  it('returns different hash when gate results change', () => {
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'work')],
      [createCompletionGate('tests_pass')],
    );
    const state1 = createSessionState('s1', spec);
    const state2 = { ...state1, gateResults: { tests_pass: true } };
    expect(renderStateHash(state1)).not.toBe(renderStateHash(state2));
  });

  it('canonicalizes equivalent gate and node-progress objects before hashing', () => {
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'work'), createRunNode('r1', 'npm test')],
      [createCompletionGate('lint_pass'), createCompletionGate('tests_pass')],
    );
    const base = createSessionState('s1', spec);
    const stateA = {
      ...base,
      gateResults: { lint_pass: false, tests_pass: true },
      nodeProgress: {
        p1: {
          iteration: 1,
          maxIterations: 1,
          status: 'completed' as const,
          startedAt: 10,
          completedAt: 20,
        },
        r1: {
          iteration: 1,
          maxIterations: 1,
          status: 'running' as const,
        },
      },
    };
    const stateB = {
      ...base,
      gateResults: { tests_pass: true, lint_pass: false },
      nodeProgress: {
        r1: {
          maxIterations: 1,
          iteration: 1,
          status: 'running' as const,
        },
        p1: {
          completedAt: 20,
          startedAt: 10,
          status: 'completed' as const,
          maxIterations: 1,
          iteration: 1,
        },
      },
    };

    expect(renderStateHash(stateA)).toBe(renderStateHash(stateB));
  });
});

describe('renderFlowSummary — node descriptions', () => {
  it('describes continue, approve, review, remember, send, and receive nodes', () => {
    const cases = [
      { node: createContinueNode('c1'), expected: 'continue' },
      { node: createApproveNode('a1', 'Ship it?'), expected: 'approve "Ship it?"' },
      {
        node: createReviewNode(
          'rv1',
          [createPromptNode('p1', 'draft')],
          2,
          undefined,
          undefined,
          true,
          'impl_quality',
        ),
        expected: 'review strict using judge',
      },
      { node: createRememberNode('m1', 'fact'), expected: 'remember' },
      { node: createSendNode('s1', 'parent', 'hi'), expected: 'send to "parent"' },
      { node: createReceiveNode('r1', 'msg'), expected: 'receive msg' },
    ] as const;

    for (const { node, expected } of cases) {
      const spec = createFlowSpec('test', [node]);
      const state = createSessionState('s1', spec);
      const summary = renderFlowSummary(state);
      expect(summary).toContain(expected);
    }
  });

  it('describes retry, race, and foreach-spawn nodes', () => {
    const cases = [
      {
        node: createRetryNode('re1', [createRunNode('r1', 'npm test')], 4),
        expected: 'retry max 4',
      },
      {
        node: createRaceNode('ra1', [
          createSpawnNode('sp1', 'worker', [createPromptNode('p1', 'go')]),
        ]),
        expected: 'race',
      },
      {
        node: createForeachSpawnNode('fs1', 'item', '${items}', [
          createRunNode('r2', 'work ${item}'),
        ]),
        expected: 'foreach-spawn item',
      },
    ] as const;

    for (const { node, expected } of cases) {
      const spec = createFlowSpec('test', [node]);
      const state = createSessionState('s1', spec);
      const summary = renderFlowSummary(state);
      expect(summary).toContain(expected);
    }
  });
});

// ── Feature: prompt_json source rendering ────────────────────────────────
describe('renderFlow — prompt_json let node', () => {
  it('renders a short prompt_json schema inline', () => {
    const node = createLetNode('n1', 'analysis', {
      type: 'prompt_json',
      text: 'scan the code',
      schema: 'severity: "low" | "high"',
    });
    const spec = createFlowSpec('test', [node]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('prompt "scan the code" as json');
    expect(output).toContain('severity');
  });

  it('truncates a schema longer than 40 characters in the preview', () => {
    const longSchema = 'severity: "low" | "high", files: string[], count: number';
    const node = createLetNode('n1', 'result', {
      type: 'prompt_json',
      text: 'analyze',
      schema: longSchema,
    });
    const spec = createFlowSpec('test', [node]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('...');
    // The full long schema should not appear verbatim
    expect(output).not.toContain(longSchema);
  });

  it('renders the variable name with = operator for non-append', () => {
    const node = createLetNode('n1', 'myVar', {
      type: 'prompt_json',
      text: 'check',
      schema: 'ok: boolean',
    });
    const spec = createFlowSpec('test', [node]);
    const state = createSessionState('s1', spec);
    const output = renderFlow(state);
    expect(output).toContain('let myVar =');
  });
});
