import { describe, it, expect } from 'vitest';
import {
  createWhileNode,
  createUntilNode,
  createRetryNode,
  createIfNode,
  createPromptNode,
  createRunNode,
  createTryNode,
  createLetNode,
  createForeachNode,
  createSpawnNode,
  createAwaitNode,
  createReviewNode,
  createForeachSpawnNode,
  createRaceNode,
  createSwarmRoleDefinition,
  createSwarmNode,
  createStartNode,
  createReturnNode,
  describeFlowNode,
  describeNodePosition,
  findNodeById,
  resolveNodeByPath,
  withNodeSource,
} from './flow-node.js';

describe('createWhileNode', () => {
  it('creates a while node with explicit max', () => {
    const node = createWhileNode('w1', 'tests_fail', [], 10);
    expect(node).toEqual({
      kind: 'while',
      id: 'w1',
      condition: 'tests_fail',
      maxIterations: 10,
      body: [],
    });
  });

  it('defaults maxIterations to 5', () => {
    const node = createWhileNode('w2', 'x', []);
    expect(node.maxIterations).toBe(5);
  });

  it('preserves body nodes', () => {
    const child = createPromptNode('p1', 'hello');
    const node = createWhileNode('w3', 'cond', [child]);
    expect(node.body).toEqual([child]);
  });
});

describe('createUntilNode', () => {
  it('creates an until node with explicit max', () => {
    const node = createUntilNode('u1', 'tests_pass', [], 8);
    expect(node).toEqual({
      kind: 'until',
      id: 'u1',
      condition: 'tests_pass',
      maxIterations: 8,
      body: [],
    });
  });

  it('defaults maxIterations to 5', () => {
    const node = createUntilNode('u2', 'done', []);
    expect(node.maxIterations).toBe(5);
  });
});

describe('createRetryNode', () => {
  it('creates a retry node with explicit attempts', () => {
    const node = createRetryNode('r1', [], 7);
    expect(node).toEqual({
      kind: 'retry',
      id: 'r1',
      maxAttempts: 7,
      body: [],
    });
  });

  it('defaults maxAttempts to 3', () => {
    const node = createRetryNode('r2', []);
    expect(node.maxAttempts).toBe(3);
  });
});

describe('createIfNode', () => {
  it('creates an if node with both branches', () => {
    const then = [createPromptNode('p1', 'yes')];
    const els = [createPromptNode('p2', 'no')];
    const node = createIfNode('i1', 'flag == true', then, els);
    expect(node).toEqual({
      kind: 'if',
      id: 'i1',
      condition: 'flag == true',
      thenBranch: then,
      elseBranch: els,
    });
  });

  it('defaults elseBranch to empty array', () => {
    const node = createIfNode('i2', 'x', []);
    expect(node.elseBranch).toEqual([]);
  });
});

describe('createPromptNode', () => {
  it('creates a prompt node', () => {
    const node = createPromptNode('p1', 'fix the bug');
    expect(node).toEqual({ kind: 'prompt', id: 'p1', text: 'fix the bug' });
  });
});

describe('createRunNode', () => {
  it('creates a run node', () => {
    const node = createRunNode('r1', 'pnpm test');
    expect(node).toEqual({ kind: 'run', id: 'r1', command: 'pnpm test' });
  });

  it('creates a run node with timeout', () => {
    const node = createRunNode('r2', 'npm test', 60000);
    expect(node).toEqual({ kind: 'run', id: 'r2', command: 'npm test', timeoutMs: 60000 });
  });

  it('omits timeoutMs when not provided', () => {
    const node = createRunNode('r3', 'echo hi');
    expect(node).not.toHaveProperty('timeoutMs');
  });
});

describe('createTryNode', () => {
  it('creates a try node with catch', () => {
    const body = [createRunNode('r1', 'pnpm build')];
    const catchBody = [createPromptNode('p1', 'fix build')];
    const node = createTryNode('t1', body, 'command_failed', catchBody);
    expect(node).toEqual({
      kind: 'try',
      id: 't1',
      body,
      catchCondition: 'command_failed',
      catchBody,
      finallyBody: [],
    });
  });
});

describe('createLetNode', () => {
  it('creates a let node with literal source', () => {
    const node = createLetNode('l1', 'greeting', { type: 'literal', value: 'hello' });
    expect(node).toEqual({
      kind: 'let',
      id: 'l1',
      declarationKind: 'let',
      variableName: 'greeting',
      source: { type: 'literal', value: 'hello' },
      append: false,
    });
  });

  it('creates a let node with prompt source', () => {
    const node = createLetNode('l2', 'info', { type: 'prompt', text: 'summarize this' });
    expect(node).toEqual({
      kind: 'let',
      id: 'l2',
      declarationKind: 'let',
      variableName: 'info',
      source: { type: 'prompt', text: 'summarize this' },
      append: false,
    });
  });

  it('creates a let node with run source', () => {
    const node = createLetNode('l3', 'output', { type: 'run', command: 'echo hi' });
    expect(node).toEqual({
      kind: 'let',
      id: 'l3',
      declarationKind: 'let',
      variableName: 'output',
      source: { type: 'run', command: 'echo hi' },
      append: false,
    });
  });

  it('creates a let node with append=true', () => {
    const node = createLetNode('l4', 'items', { type: 'literal', value: 'x' }, true);
    expect(node).toEqual({
      kind: 'let',
      id: 'l4',
      declarationKind: 'let',
      variableName: 'items',
      source: { type: 'literal', value: 'x' },
      append: true,
    });
  });

  it('creates a let node with empty_list source', () => {
    const node = createLetNode('l5', 'items', { type: 'empty_list' });
    expect(node).toEqual({
      kind: 'let',
      id: 'l5',
      declarationKind: 'let',
      variableName: 'items',
      source: { type: 'empty_list' },
      append: false,
    });
  });

  it('creates a const node with declaration metadata', () => {
    const node = createLetNode(
      'l6',
      'answer',
      { type: 'literal', value: '42' },
      false,
      undefined,
      'const',
    );
    expect(node).toEqual({
      kind: 'let',
      id: 'l6',
      declarationKind: 'const',
      variableName: 'answer',
      source: { type: 'literal', value: '42' },
      append: false,
    });
  });
});

describe('createForeachNode', () => {
  it('creates a foreach node with explicit max', () => {
    const body = [createPromptNode('p1', 'process item')];
    const node = createForeachNode('fe1', 'item', '${files}', body, 10);
    expect(node).toEqual({
      kind: 'foreach',
      id: 'fe1',
      variableName: 'item',
      listExpression: '${files}',
      maxIterations: 10,
      body,
    });
  });

  it('defaults maxIterations to 50', () => {
    const node = createForeachNode('fe2', 'x', '${list}', []);
    expect(node.maxIterations).toBe(50);
  });

  it('preserves body nodes', () => {
    const child = createRunNode('r1', 'lint ${file}');
    const node = createForeachNode('fe3', 'file', '${files}', [child]);
    expect(node.body).toEqual([child]);
  });
});

describe('createSpawnNode', () => {
  it('creates a spawn node with name and body', () => {
    const body = [createPromptNode('p1', 'fix bug'), createRunNode('r1', 'npm test')];
    const node = createSpawnNode('sp1', 'fix-auth', body);
    expect(node).toEqual({
      kind: 'spawn',
      id: 'sp1',
      name: 'fix-auth',
      body,
    });
  });

  it('creates a spawn node with empty body', () => {
    const node = createSpawnNode('sp2', 'empty', []);
    expect(node.kind).toBe('spawn');
    expect(node.body).toEqual([]);
  });

  it('creates a spawn node with cwd', () => {
    const body = [createPromptNode('p1', 'work')];
    const node = createSpawnNode('sp3', 'worker', body, '/tmp/work');
    expect(node).toEqual({
      kind: 'spawn',
      id: 'sp3',
      name: 'worker',
      body,
      cwd: '/tmp/work',
    });
  });

  it('omits cwd when not provided', () => {
    const node = createSpawnNode('sp4', 'no-cwd', []);
    expect(node).not.toHaveProperty('cwd');
  });
});

describe('createAwaitNode', () => {
  it('creates an await all node', () => {
    const node = createAwaitNode('aw1', 'all');
    expect(node).toEqual({
      kind: 'await',
      id: 'aw1',
      target: 'all',
    });
  });

  it('creates an await node targeting a specific child', () => {
    const node = createAwaitNode('aw2', 'fix-auth');
    expect(node).toEqual({
      kind: 'await',
      id: 'aw2',
      target: 'fix-auth',
    });
  });

  it('creates an await node targeting multiple roles', () => {
    const node = createAwaitNode('aw3', ['frontend', 'backend']);
    expect(node).toEqual({
      kind: 'await',
      id: 'aw3',
      target: ['frontend', 'backend'],
    });
  });
});

describe('swarm AST helpers', () => {
  it('creates a role definition with model, cwd, and vars', () => {
    const body = [createPromptNode('p1', 'work')];
    const role = createSwarmRoleDefinition(
      'role1',
      'frontend',
      body,
      '/tmp/ui',
      ['issue', 'files'],
      'sonnet',
    );

    expect(role).toEqual({
      id: 'role1',
      name: 'frontend',
      body,
      cwd: '/tmp/ui',
      vars: ['issue', 'files'],
      model: 'sonnet',
    });
  });

  it('creates swarm, start, and return nodes', () => {
    const role = createSwarmRoleDefinition('role1', 'frontend', [createPromptNode('p1', 'work')]);
    const flow = [createStartNode('st1', ['frontend']), createReturnNode('ret1', '${summary}')];
    const node = createSwarmNode('sw1', 'checkout_fix', [role], flow);

    expect(node).toEqual({
      kind: 'swarm',
      id: 'sw1',
      name: 'checkout_fix',
      roles: [role],
      flow,
    });
  });
});

describe('findNodeById', () => {
  it('finds a top-level node', () => {
    const p1 = createPromptNode('p1', 'hello');
    const r1 = createRunNode('r1', 'echo');
    expect(findNodeById([p1, r1], 'r1')).toBe(r1);
  });

  it('returns null when id not found', () => {
    const p1 = createPromptNode('p1', 'hello');
    expect(findNodeById([p1], 'missing')).toBeNull();
  });

  it('finds node nested in while body', () => {
    const inner = createRunNode('r1', 'test');
    const w = createWhileNode('w1', 'cond', [inner]);
    expect(findNodeById([w], 'r1')).toBe(inner);
  });

  it('finds node nested in if thenBranch', () => {
    const inner = createPromptNode('p1', 'yes');
    const ifNode = createIfNode('i1', 'flag', [inner]);
    expect(findNodeById([ifNode], 'p1')).toBe(inner);
  });

  it('finds node nested in if elseBranch', () => {
    const inner = createPromptNode('p2', 'no');
    const ifNode = createIfNode('i1', 'flag', [], [inner]);
    expect(findNodeById([ifNode], 'p2')).toBe(inner);
  });

  it('finds node nested in try body', () => {
    const inner = createRunNode('r1', 'deploy');
    const tryNode = createTryNode('t1', [inner], 'command_failed', []);
    expect(findNodeById([tryNode], 'r1')).toBe(inner);
  });

  it('finds node nested in try catchBody', () => {
    const inner = createPromptNode('p1', 'fix it');
    const tryNode = createTryNode('t1', [], 'command_failed', [inner]);
    expect(findNodeById([tryNode], 'p1')).toBe(inner);
  });

  it('finds node nested in try finallyBody', () => {
    const inner = createRunNode('r1', 'cleanup');
    const tryNode = createTryNode('t1', [], 'command_failed', [], [inner]);
    expect(findNodeById([tryNode], 'r1')).toBe(inner);
  });

  it('finds node nested in foreach body', () => {
    const inner = createPromptNode('p1', 'process');
    const fe = createForeachNode('fe1', 'item', 'a b c', [inner]);
    expect(findNodeById([fe], 'p1')).toBe(inner);
  });

  it('finds node nested in spawn body', () => {
    const inner = createRunNode('r1', 'test');
    const sp = createSpawnNode('sp1', 'worker', [inner]);
    expect(findNodeById([sp], 'r1')).toBe(inner);
  });

  it('finds deeply nested node (try > foreach > let)', () => {
    const letNode = createLetNode('l1', 'x', { type: 'literal', value: 'v' });
    const fe = createForeachNode('fe1', 'item', 'a b', [letNode]);
    const tryNode = createTryNode('t1', [fe], 'command_failed', []);
    expect(findNodeById([tryNode], 'l1')).toBe(letNode);
  });

  it('returns empty array produces null', () => {
    expect(findNodeById([], 'any')).toBeNull();
  });

  it('finds node nested in review body', () => {
    const inner = createPromptNode('p1', 'draft');
    const reviewNode = createReviewNode('rv1', [inner], 3);
    expect(findNodeById([reviewNode], 'p1')).toBe(inner);
  });

  it('finds node nested in foreach_spawn body', () => {
    const inner = createRunNode('r1', 'work');
    const fsNode = createForeachSpawnNode('fs1', 'item', 'a b', [inner]);
    expect(findNodeById([fsNode], 'r1')).toBe(inner);
  });

  it('finds node nested in race children', () => {
    const inner = createRunNode('r1', 'echo');
    const spawnChild = createSpawnNode('sp1', 'worker', [inner]);
    const raceNode = createRaceNode('rc1', [spawnChild]);
    expect(findNodeById([raceNode], 'r1')).toBe(inner);
  });

  it('finds node nested in swarm role body and swarm flow', () => {
    const roleRun = createRunNode('r-role', 'npm test');
    const start = createStartNode('st1', ['frontend']);
    const swarm = createSwarmNode(
      'sw1',
      'checkout_fix',
      [createSwarmRoleDefinition('role1', 'frontend', [roleRun])],
      [start],
    );

    expect(findNodeById([swarm], 'r-role')).toBe(roleRun);
    expect(findNodeById([swarm], 'st1')).toBe(start);
  });

  it('continues searching after composite nodes miss in nested branches', () => {
    const target = createPromptNode('target', 'found me');
    const nodes = [
      createWhileNode('w1', 'cond', [createPromptNode('p-miss-1', 'miss')]),
      createReviewNode('rv1', [createPromptNode('p-miss-2', 'miss')], 2),
      createRaceNode('rc1', [
        createSpawnNode('sp1', 'worker', [createRunNode('r-miss-1', 'echo miss')]),
      ]),
      createIfNode(
        'i1',
        'flag',
        [createPromptNode('p-miss-3', 'miss')],
        [createPromptNode('p-miss-4', 'miss')],
      ),
      createTryNode(
        't1',
        [createRunNode('r-miss-2', 'echo miss')],
        'command_failed',
        [createPromptNode('p-miss-5', 'miss')],
        [createPromptNode('p-miss-6', 'miss')],
      ),
      createSwarmNode(
        'sw1',
        'checkout_fix',
        [createSwarmRoleDefinition('role1', 'frontend', [createPromptNode('p-miss-7', 'miss')])],
        [createStartNode('st1', ['frontend'])],
      ),
      target,
    ];

    expect(findNodeById(nodes, 'target')).toBe(target);
  });
});

describe('node position helpers', () => {
  it('describes flow nodes with human-readable labels', () => {
    expect(describeFlowNode(createWhileNode('w1', 'tests_fail', []))).toBe('while tests_fail');
    expect(describeFlowNode(createPromptNode('p1', 'Inspect'))).toBe('prompt');
    expect(describeFlowNode(createSpawnNode('sp1', 'worker', []))).toBe('spawn "worker"');
  });

  it('resolves nested nodes by path across composite sections', () => {
    const catchNode = createPromptNode('catch1', 'recover');
    const raceChild = createSpawnNode('sp1', 'worker', [createRunNode('r1', 'npm test')]);
    const nodes = [
      withNodeSource(
        createTryNode('t1', [], 'command_failed', [catchNode], [createPromptNode('f1', 'cleanup')]),
        { line: 10, column: 3 },
      ),
      createRaceNode('rc1', [raceChild]),
    ];

    expect(resolveNodeByPath(nodes, [0, 0])).toBe(catchNode);
    expect(resolveNodeByPath(nodes, [1, 1])).toBe(raceChild.body[0]);
  });

  it('describes nested positions with branch labels and source context', () => {
    const elsePrompt = withNodeSource(createPromptNode('p1', 'else branch'), {
      line: 12,
      column: 7,
      text: '      prompt: else branch',
    });
    const raceRun = withNodeSource(createRunNode('r1', 'npm test'), {
      line: 20,
      column: 9,
      text: '        run: npm test',
    });
    const nodes = [
      createIfNode('i1', 'flag', [createPromptNode('p0', 'then')], [elsePrompt]),
      createRaceNode('rc1', [createSpawnNode('sp1', 'worker', [raceRun])]),
    ];

    expect(describeNodePosition(nodes, [0, 1])).toBe('if flag > else > prompt at line 12, col 7');
    expect(describeNodePosition(nodes, [1, 1])).toBe(
      'race > spawn "worker" > run at line 20, col 9',
    );
  });

  it('resolveNodeByPath — while, if.then, if.else, foreach, review, swarm flow', () => {
    const inWhile = createPromptNode('pw', 'w');
    const inThen = createPromptNode('pt', 't');
    const inElse = createPromptNode('pe', 'e');
    const inForeach = createPromptNode('pf', 'f');
    const inReview = createPromptNode('pr', 'r');
    const inRole = createPromptNode('prole', 'rl');
    const inFlow = createPromptNode('pflow', 'fl');

    const nodes = [
      createWhileNode('w1', 'cond', [inWhile]),
      createIfNode('i1', 'cond', [inThen], [inElse]),
      createForeachNode('fe1', 'item', 'a b', [inForeach]),
      createReviewNode('rv1', [inReview], 1),
      createSwarmNode(
        'sw1',
        'team',
        [createSwarmRoleDefinition('role1', 'worker', [inRole])],
        [inFlow],
      ),
    ];

    expect(resolveNodeByPath(nodes, [0, 0])).toBe(inWhile);
    expect(resolveNodeByPath(nodes, [1, 0])).toBe(inThen);
    expect(resolveNodeByPath(nodes, [1, 1])).toBe(inElse);
    expect(resolveNodeByPath(nodes, [2, 0])).toBe(inForeach);
    expect(resolveNodeByPath(nodes, [3, 0])).toBe(inReview);
    expect(resolveNodeByPath(nodes, [4, 0])).toBe(inRole);
    expect(resolveNodeByPath(nodes, [4, 1])).toBe(inFlow);
  });

  it('resolveNodeByPath — returns null for out-of-range and terminal-node children', () => {
    const terminal = createPromptNode('p1', 'x');
    const w = createWhileNode('w1', 'cond', [terminal]);
    expect(resolveNodeByPath([w], [0, 5])).toBeNull();
    // Empty path
    expect(resolveNodeByPath([], [])).toBeNull();
    // Path into a terminal node (prompt has no children scopes)
    expect(resolveNodeByPath([terminal], [0, 0])).toBeNull();
  });

  it('resolveNodeByPath — indexes through race children and their bodies', () => {
    const body1 = createPromptNode('b1', 'one');
    const body2 = createPromptNode('b2', 'two');
    const spawn1 = createSpawnNode('sp1', 'a', [body1]);
    const spawn2 = createSpawnNode('sp2', 'b', [body2]);
    const race = createRaceNode('rc1', [spawn1, spawn2]);
    // race child scope has one slot for the spawn, then its body as nested
    expect(resolveNodeByPath([race], [0, 0])).toBe(spawn1);
    expect(resolveNodeByPath([race], [0, 1])).toBe(body1);
    expect(resolveNodeByPath([race], [0, 2])).toBe(spawn2);
    expect(resolveNodeByPath([race], [0, 3])).toBe(body2);
  });

  it('describeNodePosition — breadcrumb across if.then, try.catch, race body, swarm role', () => {
    const thenP = createPromptNode('pt', 't');
    const catchP = createPromptNode('pc', 'c');
    const raceBody = createRunNode('rbody', 'echo');
    const roleP = createPromptNode('rp', 'role');

    const nodes = [
      createIfNode('i1', 'flag', [thenP], []),
      createTryNode('t1', [], 'command_failed', [catchP], []),
      createRaceNode('rc1', [createSpawnNode('sp1', 'w', [raceBody])]),
      createSwarmNode('sw1', 'team', [createSwarmRoleDefinition('r1', 'worker', [roleP])], []),
    ];

    expect(describeNodePosition(nodes, [0, 0])).toContain('prompt');
    expect(describeNodePosition(nodes, [1, 0])).toContain('catch');
    expect(describeNodePosition(nodes, [2, 1])).toContain('run');
    expect(describeNodePosition(nodes, [3, 0])).toContain('role worker');
  });

  it('covers root, missing-path, try-finally, and swarm role/flow labels', () => {
    const finallyRun = withNodeSource(createRunNode('rf', 'cleanup'), {
      line: 30,
      column: 5,
      text: '    run: cleanup',
    });
    const rolePrompt = withNodeSource(createPromptNode('rp', 'role work'), {
      line: 40,
      column: 7,
      text: '      prompt: role work',
    });
    const flowStart = withNodeSource(createStartNode('st1', ['worker']), {
      line: 44,
      column: 7,
      text: '      start worker',
    });

    const nodes = [
      createTryNode(
        't1',
        [createPromptNode('pb', 'body')],
        'command_failed',
        [createPromptNode('pc', 'catch')],
        [finallyRun],
      ),
      createSwarmNode(
        'sw1',
        'team',
        [createSwarmRoleDefinition('role1', 'worker', [rolePrompt])],
        [flowStart],
      ),
    ];

    expect(describeNodePosition(nodes, [])).toBe('flow root');
    expect(describeNodePosition(nodes, [9])).toBe('flow[10]');
    expect(describeNodePosition(nodes, [0, 5])).toContain('[missing 6]');
    expect(describeNodePosition(nodes, [0, 2])).toBe('try > finally > run at line 30, col 5');
    expect(describeNodePosition(nodes, [1, 0])).toBe(
      'swarm team > role worker > prompt at line 40, col 7',
    );
    expect(describeNodePosition(nodes, [1, 1])).toBe(
      'swarm team > flow > start worker at line 44, col 7',
    );
  });
});
