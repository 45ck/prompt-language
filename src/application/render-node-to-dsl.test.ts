import { describe, expect, it } from 'vitest';
import {
  createApproveNode,
  createAwaitNode,
  createBreakNode,
  createContinueNode,
  createForeachNode,
  createForeachSpawnNode,
  createIfNode,
  createLetNode,
  createPromptNode,
  createRaceNode,
  createReceiveNode,
  createRememberNode,
  createRetryNode,
  createReviewNode,
  createRunNode,
  createSendNode,
  createSpawnNode,
  createStartNode,
  createSwarmNode,
  createSwarmRoleDefinition,
  createTryNode,
  createUntilNode,
  createWhileNode,
  createReturnNode,
} from '../domain/flow-node.js';
import { renderNodeToDsl, renderNodesToDsl, renderSpawnBody } from './render-node-to-dsl.js';

describe('render-node-to-dsl', () => {
  it('renders prompt and run with newline normalization', () => {
    const prompt = createPromptNode('p1', 'line 1\nline 2', 'reviewer');
    const run = createRunNode('r1', 'echo one\necho two', 30_000);

    expect(renderNodeToDsl(prompt, 1)).toEqual([
      '  prompt using profile "reviewer": line 1 line 2',
    ]);
    expect(renderNodeToDsl(run, 2)).toEqual(['    run: echo one echo two [timeout 30]']);
  });

  it('renders let nodes for all source variants', () => {
    const cases = [
      createLetNode('l1', 'a', { type: 'literal', value: 'x\\"y\nz' }),
      createLetNode('l2', 'b', { type: 'prompt', text: 'Answer?', profile: 'planner' }),
      createLetNode('l3', 'c', {
        type: 'prompt_json',
        text: 'Return JSON',
        schema: '{ "k": "v" }',
        profile: 'extractor',
      }),
      createLetNode('l4', 'd', { type: 'run', command: 'git status' }),
      createLetNode('l5', 'e', { type: 'memory', key: 'theme' }, true),
      createLetNode('l6', 'f', { type: 'empty_list' }),
      createLetNode('l7', 'g', { type: 'literal', value: 'fixed' }, false, undefined, 'const'),
      createLetNode('l8', 'h', { type: 'literal', value: 'legacy' }, false, undefined, 'var'),
    ] as const;

    expect(renderNodeToDsl(cases[0], 0)).toEqual(['let a = "x\\\\\\"y\\nz"']);
    expect(renderNodeToDsl(cases[1], 0)).toEqual([
      'let b = prompt using profile "planner" "Answer?"',
    ]);
    expect(renderNodeToDsl(cases[2], 0)).toEqual([
      'let c = prompt using profile "extractor" "Return JSON" as json {\n{ "k": "v" }\n}',
    ]);
    expect(renderNodeToDsl(cases[3], 0)).toEqual(['let d = run "git status"']);
    expect(renderNodeToDsl(cases[4], 0)).toEqual(['let e += memory "theme"']);
    expect(renderNodeToDsl(cases[5], 0)).toEqual(['let f = []']);
    expect(renderNodeToDsl(cases[6], 0)).toEqual(['const g = "fixed"']);
    expect(renderNodeToDsl(cases[7], 0)).toEqual(['var h = "legacy"']);
  });

  it('renders while/until/retry with nested body lines', () => {
    const whileNode = createWhileNode(
      'w1',
      'ask:"tests still fail?"',
      [createRunNode('w1-r', 'npm test')],
      3,
      undefined,
      undefined,
      'npm test',
      2,
      'reviewer',
    );
    const untilNode = createUntilNode(
      'u1',
      'ask:"ship it?"',
      [createPromptNode('u1-p', 'Fix it')],
      4,
      undefined,
      undefined,
      undefined,
      1,
      'shipper',
    );
    const retryNode = createRetryNode(
      'rt1',
      [createRunNode('rt1-r', 'npm run lint')],
      5,
      undefined,
      undefined,
      2_000,
    );

    expect(renderNodeToDsl(whileNode, 0)).toEqual([
      'while ask "tests still fail?" using profile "reviewer" grounded-by "npm test" max-retries 2 max 3',
      '  run: npm test',
      'end',
    ]);
    expect(renderNodeToDsl(untilNode, 1)).toEqual([
      '  until ask "ship it?" using profile "shipper" max-retries 1 max 4',
      '    prompt: Fix it',
      '  end',
    ]);
    expect(renderNodeToDsl(retryNode, 0)).toEqual([
      'retry max 5 backoff 2s',
      '  run: npm run lint',
      'end',
    ]);
  });

  it('renders loop timeouts when present', () => {
    const whileNode = createWhileNode(
      'w-time',
      'command_failed',
      [createRunNode('w-run', 'npm test')],
      3,
      undefined,
      15,
    );
    const untilNode = createUntilNode(
      'u-time',
      'done',
      [createPromptNode('u-prompt', 'Wait')],
      4,
      undefined,
      20,
    );
    const retryNode = createRetryNode(
      'r-time',
      [createRunNode('r-run', 'npm run lint')],
      2,
      undefined,
      25,
      1_000,
    );

    expect(renderNodeToDsl(whileNode, 0)).toEqual([
      'while command_failed max 3 timeout 15',
      '  run: npm test',
      'end',
    ]);
    expect(renderNodeToDsl(untilNode, 0)).toEqual([
      'until done max 4 timeout 20',
      '  prompt: Wait',
      'end',
    ]);
    expect(renderNodeToDsl(retryNode, 0)).toEqual([
      'retry max 2 timeout 25 backoff 1s',
      '  run: npm run lint',
      'end',
    ]);
  });

  it('renders if with and without else branch', () => {
    const withElse = createIfNode(
      'if1',
      'command_failed',
      [createPromptNode('if1-p', 'Fix failure')],
      [createPromptNode('if1-e', 'Ship')],
    );
    const withoutElse = createIfNode(
      'if2',
      'command_succeeded',
      [createRunNode('if2-r', 'echo ok')],
      [],
    );

    expect(renderNodeToDsl(withElse, 0)).toEqual([
      'if command_failed',
      '  prompt: Fix failure',
      'else',
      '  prompt: Ship',
      'end',
    ]);
    expect(renderNodeToDsl(withoutElse, 0)).toEqual([
      'if command_succeeded',
      '  run: echo ok',
      'end',
    ]);
  });

  it('renders try with optional catch/finally sections', () => {
    const withAll = createTryNode(
      't1',
      [createRunNode('t1-r', 'npm test')],
      'command_failed',
      [createPromptNode('t1-c', 'Investigate')],
      [createRunNode('t1-f', 'echo cleanup')],
    );
    const bodyOnly = createTryNode(
      't2',
      [createPromptNode('t2-p', 'Do it')],
      'command_failed',
      [],
      [],
    );

    expect(renderNodeToDsl(withAll, 0)).toEqual([
      'try',
      '  run: npm test',
      'catch command_failed',
      '  prompt: Investigate',
      'finally',
      '  run: echo cleanup',
      'end',
    ]);
    expect(renderNodeToDsl(bodyOnly, 0)).toEqual(['try', '  prompt: Do it', 'end']);
  });

  it('renders foreach using expression and run-list forms', () => {
    const expressionNode = createForeachNode(
      'f1',
      'item',
      '"a b c"',
      [createRunNode('f1-r', 'echo ${item}')],
      5,
    );
    const runListNode = createForeachNode(
      'f2',
      'item',
      '"unused"',
      [createPromptNode('f2-p', 'Handle ${item}')],
      5,
      undefined,
      'printf "x y z"',
    );

    expect(renderNodeToDsl(expressionNode, 0)).toEqual([
      'foreach item in "a b c"',
      '  run: echo ${item}',
      'end',
    ]);
    expect(renderNodeToDsl(runListNode, 0)).toEqual([
      'foreach item in run "printf "x y z""',
      '  prompt: Handle ${item}',
      'end',
    ]);
  });

  it('renders spawn, await, break, and continue nodes', () => {
    const spawn = createSpawnNode(
      's1',
      'worker',
      [createPromptNode('s1-p', 'Child prompt')],
      'packages/api',
    );
    const awaitAll = createAwaitNode('a1', 'all');
    const awaitOne = createAwaitNode('a2', 'worker', 45);
    const breakNode = createBreakNode('b1');
    const continueNode = createContinueNode('c1');

    expect(renderNodeToDsl(spawn, 0)).toEqual([
      'spawn "worker" in "packages/api"',
      '  prompt: Child prompt',
      'end',
    ]);
    expect(renderNodeToDsl(awaitAll, 0)).toEqual(['await all']);
    expect(renderNodeToDsl(awaitOne, 0)).toEqual(['await "worker" timeout 45']);
    expect(renderNodeToDsl(breakNode, 1)).toEqual(['  break']);
    expect(renderNodeToDsl(continueNode, 1)).toEqual(['  continue']);
  });

  it('renders spawn metadata, multi-target await, and swarm syntax nodes', () => {
    const spawn = createSpawnNode(
      's-meta',
      'worker',
      [createPromptNode('s-meta-p', 'Child prompt')],
      'packages/api',
      ['summary', 'files'],
      'sonnet',
      'tests_fail',
    );
    const swarm = createSwarmNode(
      'sw1',
      'checkout_fix',
      [
        createSwarmRoleDefinition(
          'role1',
          'frontend',
          [createPromptNode('role1-p', 'Fix the UI'), createReturnNode('role1-r', '${summary}')],
          'apps/web',
          ['summary'],
          'sonnet',
        ),
      ],
      [createStartNode('st1', ['frontend']), createAwaitNode('aw1', ['frontend', 'backend'])],
    );

    expect(renderNodeToDsl(spawn, 0)).toEqual([
      'spawn "worker" in "packages/api" model "sonnet" if tests_fail with vars summary, files',
      '  prompt: Child prompt',
      'end',
    ]);
    expect(renderNodeToDsl(createAwaitNode('a3', ['frontend', 'backend']), 0)).toEqual([
      'await frontend backend',
    ]);
    expect(renderNodeToDsl(swarm, 0)).toEqual([
      'swarm checkout_fix',
      '  role frontend model "sonnet" in "apps/web" with vars summary',
      '    prompt: Fix the UI',
      '    return ${summary}',
      '  end',
      '  flow:',
      '    start frontend',
      '    await frontend backend',
      '  end',
      'end',
    ]);
  });

  it('renders approve and review metadata lines', () => {
    const approveNoTimeout = createApproveNode('ap1', 'Ship this?');
    const approveWithTimeout = createApproveNode('ap2', 'Ship this?', 120);
    const review = createReviewNode(
      'rv1',
      [createRunNode('rv1-r', 'npm test')],
      2,
      'All tests must pass',
      'npm test',
    );

    expect(renderNodeToDsl(approveNoTimeout, 0)).toEqual(['approve "Ship this?"']);
    expect(renderNodeToDsl(approveWithTimeout, 0)).toEqual(['approve "Ship this?" timeout 2m']);
    expect(renderNodeToDsl(review, 0)).toEqual([
      'review max 2',
      '  criteria: "All tests must pass"',
      '  grounded-by: npm test',
      '  run: npm test',
      'end',
    ]);
  });

  it('renders review strict using judge in the header', () => {
    const review = createReviewNode(
      'rv2',
      [createPromptNode('rv2-p', 'Repair the implementation')],
      3,
      undefined,
      undefined,
      true,
      'impl_quality',
    );

    expect(renderNodeToDsl(review, 0)).toEqual([
      'review strict using judge "impl_quality" max 3',
      '  prompt: Repair the implementation',
      'end',
    ]);
  });

  it('renders race and foreach-spawn wrappers', () => {
    const race = createRaceNode(
      'rc1',
      [
        createSpawnNode('rc1-s1', 'a', [createRunNode('rc1-s1-r', 'echo a')]),
        createSpawnNode('rc1-s2', 'b', [createRunNode('rc1-s2-r', 'echo b')]),
      ],
      60,
    );
    const foreachSpawn = createForeachSpawnNode(
      'fs1',
      'item',
      'alpha beta',
      [createRunNode('fs1-r', 'echo ${item}')],
      5,
    );

    expect(renderNodeToDsl(race, 0)).toEqual([
      'race timeout 60',
      '  spawn "a"',
      '    run: echo a',
      '  end',
      '  spawn "b"',
      '    run: echo b',
      '  end',
      'end',
    ]);
    expect(renderNodeToDsl(foreachSpawn, 0)).toEqual([
      'foreach-spawn item in "alpha beta"',
      '  run: echo ${item}',
      'end',
    ]);
  });

  it('renders remember/send/receive variants', () => {
    const rememberText = createRememberNode('rm1', 'persist this');
    const rememberKeyValue = createRememberNode('rm2', undefined, 'theme', 'dark');
    const sendNode = createSendNode('sd1', 'worker', 'hello');
    const receiveDefault = createReceiveNode('rcv1', 'msg');
    const receiveFrom = createReceiveNode('rcv2', 'msg', 'worker', 30);

    expect(renderNodeToDsl(rememberText, 0)).toEqual(['remember "persist this"']);
    expect(renderNodeToDsl(rememberKeyValue, 0)).toEqual(['remember key="theme" value="dark"']);
    expect(renderNodeToDsl(sendNode, 0)).toEqual(['send "worker" "hello"']);
    expect(renderNodeToDsl(receiveDefault, 0)).toEqual(['receive msg']);
    expect(renderNodeToDsl(receiveFrom, 0)).toEqual(['receive msg from "worker" timeout 30']);
  });

  it('renders helper wrappers for node arrays and spawn body content', () => {
    const nodes = [createPromptNode('p2', 'Hello'), createRunNode('r2', 'echo world')];
    const spawn = createSpawnNode('s2', 'child', nodes);

    expect(renderNodesToDsl(nodes, 1)).toEqual(['  prompt: Hello', '  run: echo world']);
    expect(renderSpawnBody(spawn)).toBe('  prompt: Hello\n  run: echo world');
  });
});
