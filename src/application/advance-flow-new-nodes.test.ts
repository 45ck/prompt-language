import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { advanceApproveNode, autoAdvanceNodes, MAX_AWAIT_POLLS } from './advance-flow.js';
import {
  createSessionState,
  updateNodeProgress,
  updateSpawnedChild,
} from '../domain/session-state.js';
import { updateRaceChildren } from '../domain/session-state.js';
import {
  createFlowSpec,
  createJudgeDefinition,
  createRubricDefinition,
} from '../domain/flow-spec.js';
import { FLOW_OUTCOME_CODES } from '../domain/diagnostic-report.js';
import {
  createApproveNode,
  createReviewNode,
  createRaceNode,
  createForeachSpawnNode,
  createRememberNode,
  createSendNode,
  createReceiveNode,
  createSpawnNode,
  createPromptNode,
  createLetNode,
} from '../domain/flow-node.js';
import type { CommandRunner } from './ports/command-runner.js';
import type { CaptureReader } from './ports/capture-reader.js';
import type { ProcessSpawner } from './ports/process-spawner.js';
import type { MemoryStore } from './ports/memory-store.js';
import type { MessageStore } from './ports/message-store.js';

// ── Helpers ──────────────────────────────────────────────────────────

function buildSession(nodes: Parameters<typeof createFlowSpec>[1]) {
  const spec = createFlowSpec('test', nodes);
  return createSessionState('s1', spec);
}

function makeRunner(exitCode = 0, stdout = '', stderr = ''): CommandRunner {
  return { run: vi.fn().mockResolvedValue({ exitCode, stdout, stderr }) };
}

function buildSessionWithJudges(nodes: Parameters<typeof createFlowSpec>[1]) {
  const spec = createFlowSpec(
    'test',
    nodes,
    [],
    [],
    undefined,
    undefined,
    undefined,
    undefined,
    [createRubricDefinition('bugfix_quality', ['criterion correctness type boolean'])],
    [
      createJudgeDefinition(
        'impl_quality',
        ['kind: model', 'rubric: "bugfix_quality"'],
        'bugfix_quality',
      ),
    ],
  );
  return createSessionState('s1', spec);
}

// ── advanceApproveNode (exported directly) ────────────────────────────

describe('advanceApproveNode', () => {
  it('returns kind:prompt with approval message when no reply given', () => {
    const node = createApproveNode('a1', 'Deploy to production?');
    const state = buildSession([node]);
    const result = advanceApproveNode(node, state, undefined);
    expect(result.kind).toBe('prompt');
    expect(result.capturedPrompt).toContain('Deploy to production?');
    expect(result.capturedPrompt).toContain('yes');
    expect(result.capturedPrompt).toContain('no');
  });

  it('includes timeoutSeconds in the node when provided', () => {
    const node = createApproveNode('a1', 'Sure?', 30);
    expect(node.timeoutSeconds).toBe(30);
  });

  it('given "yes" reply sets approve_rejected=false and advances', () => {
    const node = createApproveNode('a1', 'Proceed?');
    const state = buildSession([node]);
    const result = advanceApproveNode(node, state, 'yes');
    expect(result.kind).toBe('advance');
    expect(result.state.variables['approve_rejected']).toBe('false');
  });

  it('given "approved" (alias) sets approve_rejected=false and advances', () => {
    const node = createApproveNode('a1', 'Proceed?');
    const state = buildSession([node]);
    const result = advanceApproveNode(node, state, 'approved');
    expect(result.kind).toBe('advance');
    expect(result.state.variables['approve_rejected']).toBe('false');
  });

  it('given "no" reply sets approve_rejected=true and advances', () => {
    const node = createApproveNode('a1', 'Proceed?');
    const state = buildSession([node]);
    const result = advanceApproveNode(node, state, 'no');
    expect(result.kind).toBe('advance');
    expect(result.state.variables['approve_rejected']).toBe('true');
    expect(result.outcomes).toEqual([
      {
        code: FLOW_OUTCOME_CODES.approvalDenied,
        summary: 'Approval denied: Proceed?',
      },
    ]);
  });

  it('given "reject" (alias) sets approve_rejected=true and advances', () => {
    const node = createApproveNode('a1', 'Proceed?');
    const state = buildSession([node]);
    const result = advanceApproveNode(node, state, 'reject');
    expect(result.kind).toBe('advance');
    expect(result.state.variables['approve_rejected']).toBe('true');
    expect(result.outcomes).toEqual([
      {
        code: FLOW_OUTCOME_CODES.approvalDenied,
        summary: 'Approval denied: Proceed?',
      },
    ]);
  });

  it('given unrecognised reply re-prompts without advancing', () => {
    const node = createApproveNode('a1', 'Proceed?');
    const state = buildSession([node]);
    const result = advanceApproveNode(node, state, 'maybe later');
    expect(result.kind).toBe('prompt');
    expect(result.state.currentNodePath).toEqual(state.currentNodePath);
  });

  it('timeoutSeconds auto-advances as approved after expiry', () => {
    const node = createApproveNode('a1', 'Proceed?', 2);
    const state = buildSession([node, createPromptNode('p1', 'after')]);
    const awaitingState = {
      ...state,
      nodeProgress: {
        a1: {
          iteration: 1,
          maxIterations: 1,
          status: 'running',
          startedAt: Date.now() - 5_000,
        },
      },
    } as typeof state;

    const result = advanceApproveNode(node, awaitingState, undefined);
    expect(result.kind).toBe('advance');
    expect(result.state.variables['approve_rejected']).toBe('false');
    expect(result.state.currentNodePath).toEqual([1]);
    expect(result.state.nodeProgress['a1']?.status).toBe('completed');
  });

  it('yes reply with leading whitespace is normalised', () => {
    const node = createApproveNode('a1', 'Ok?');
    const state = buildSession([node]);
    const result = advanceApproveNode(node, state, '  YES  ');
    expect(result.kind).toBe('advance');
    expect(result.state.variables['approve_rejected']).toBe('false');
  });
});

// ── approve via autoAdvanceNodes (integration path) ──────────────────

describe('autoAdvanceNodes — approve node', () => {
  it('emits prompt from approve node on first call', async () => {
    const spec = createFlowSpec('test', [createApproveNode('a1', 'Ship it?')]);
    const state = createSessionState('s1', spec);
    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toContain('Ship it?');
  });
});

// ── review via autoAdvanceNodes ───────────────────────────────────────

describe('autoAdvanceNodes — review node', () => {
  it('enters review body on first advance', async () => {
    const reviewNode = createReviewNode(
      'rv1',
      [createPromptNode('p1', 'Please write the report.')],
      3,
    );
    const spec = createFlowSpec('test', [reviewNode]);
    const state = createSessionState('s1', spec);
    const { capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('Please write the report.');
  });

  it('without grounded-by: completes after body exhaustion on round 1', async () => {
    const reviewNode = createReviewNode(
      'rv1',
      [createPromptNode('p1', 'Draft')],
      3,
      /* criteria */ undefined,
      /* groundedBy */ undefined,
    );
    const after = createPromptNode('p2', 'Review done');
    const spec = createFlowSpec('test', [reviewNode, after]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      currentNodePath: [0, 1], // body exhausted
      nodeProgress: {
        rv1: { iteration: 1, maxIterations: 3, status: 'running' },
      },
    };
    // Without grounded-by, reviewPasses = true → exits immediately
    const { state: result, capturedPrompt } = await autoAdvanceNodes(state);
    expect(capturedPrompt).toBe('Review done');
    expect(result.variables['_review_result.pass']).toBe(true);
    expect(result.variables['_review_result.abstain']).toBe(false);
  });

  it('with grounded-by exiting 0: completes after body exhaustion', async () => {
    const runner = makeRunner(0);
    const reviewNode = createReviewNode(
      'rv1',
      [createPromptNode('p1', 'Draft')],
      3,
      undefined,
      'check.sh',
    );
    const after = createPromptNode('p2', 'Passed');
    const spec = createFlowSpec('test', [reviewNode, after]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      currentNodePath: [0, 1],
      nodeProgress: { rv1: { iteration: 1, maxIterations: 3, status: 'running' } },
    };
    const { state: result, capturedPrompt } = await autoAdvanceNodes(state, runner);
    expect(capturedPrompt).toBe('Passed');
    expect(result.variables['_review_result.pass']).toBe(true);
    expect(result.variables['_review_result.reason']).toBe('Grounded review checks passed.');
  });

  it('with grounded-by exiting non-zero: re-loops body and sets _review_critique', async () => {
    const runner = makeRunner(1);
    const reviewNode = createReviewNode(
      'rv1',
      [createPromptNode('p1', 'Draft')],
      3,
      undefined,
      'check.sh',
    );
    const spec = createFlowSpec('test', [reviewNode]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      currentNodePath: [0, 1],
      nodeProgress: { rv1: { iteration: 1, maxIterations: 3, status: 'running' } },
    };
    const { state: result, capturedPrompt } = await autoAdvanceNodes(state, runner);
    // Re-loops to body with critique variable set
    expect(result.variables['_review_critique']).toMatch(/round 2/i);
    expect(result.variables['_review_critique']).toMatch(/latest verdict/i);
    expect(result.variables['_review_result.pass']).toBe(false);
    expect(result.variables['_review_result.abstain']).toBe(false);
    expect(capturedPrompt).toBe('Draft');
  });

  it('with criteria: includes criteria text in critique prompt', async () => {
    const runner = makeRunner(1);
    const reviewNode = createReviewNode(
      'rv1',
      [createPromptNode('p1', 'Draft')],
      3,
      'Must be concise',
      'lint.sh',
    );
    const spec = createFlowSpec('test', [reviewNode]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      currentNodePath: [0, 1],
      nodeProgress: { rv1: { iteration: 1, maxIterations: 3, status: 'running' } },
    };
    const { state: result } = await autoAdvanceNodes(state, runner);
    expect(String(result.variables['_review_critique'])).toContain('Must be concise');
  });

  it('with grounded-by but no command runner: stores abstain verdict and re-loops', async () => {
    const reviewNode = createReviewNode(
      'rv1',
      [createPromptNode('p1', 'Draft')],
      3,
      undefined,
      'check.sh',
    );
    const spec = createFlowSpec('test', [reviewNode]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      currentNodePath: [0, 1],
      nodeProgress: { rv1: { iteration: 1, maxIterations: 3, status: 'running' } },
    };
    const { state: result, capturedPrompt } = await autoAdvanceNodes(state);
    expect(result.variables['_review_result.pass']).toBe(false);
    expect(result.variables['_review_result.abstain']).toBe(true);
    expect(result.variables['_review_result.reason']).toBe(
      'Grounded review could not run because no command runner is available.',
    );
    expect(capturedPrompt).toBe('Draft');
  });

  it('with named judge: emits a JSON capture prompt after body exhaustion', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(null),
      clear: vi.fn().mockResolvedValue(undefined),
    };
    const reviewNode = createReviewNode(
      'rv1',
      [createPromptNode('p1', 'Draft')],
      3,
      'Keep the fix minimal.',
      undefined,
      false,
      'impl_quality',
    );
    let state = buildSessionWithJudges([reviewNode]);
    state = {
      ...state,
      currentNodePath: [0, 1],
      nodeProgress: { rv1: { iteration: 1, maxIterations: 3, status: 'running' } },
      variables: {
        last_stdout: 'tests passed',
        last_stderr: '',
        command_failed: false,
      },
    };

    const result = await autoAdvanceNodes(state, undefined, captureReader);
    expect(result.kind).toBe('prompt');
    expect(result.capturedPrompt).toContain('.prompt-language/vars/__review_judge_rv1__');
    expect(result.capturedPrompt).toContain('Execute the named review judge "impl_quality"');
    expect(result.capturedPrompt).toContain('kind: model');
    expect(result.state.nodeProgress['rv1']?.status).toBe('awaiting_capture');
    expect(captureReader.clear).toHaveBeenCalledWith('__review_judge_rv1__');
  });

  it('with named judge captured pass JSON: persists verdict and advances', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue(
        JSON.stringify({
          pass: true,
          confidence: 0.88,
          reason: 'Implementation quality is acceptable.',
          evidence: ['tests passed', 'stderr empty'],
          abstain: false,
        }),
      ),
      clear: vi.fn().mockResolvedValue(undefined),
    };
    const reviewNode = createReviewNode(
      'rv1',
      [createPromptNode('p1', 'Draft')],
      3,
      undefined,
      undefined,
      false,
      'impl_quality',
    );
    const after = createPromptNode('p2', 'Judged');
    let state = buildSessionWithJudges([reviewNode, after]);
    state = {
      ...state,
      currentNodePath: [0, 1],
      nodeProgress: {
        rv1: { iteration: 1, maxIterations: 3, status: 'awaiting_capture', askRetryCount: 0 },
      },
    };

    const result = await autoAdvanceNodes(state, undefined, captureReader);
    expect(result.kind).toBe('prompt');
    expect(result.capturedPrompt).toBe('Judged');
    expect(result.state.variables['_review_result.pass']).toBe(true);
    expect(result.state.variables['_review_result.reason']).toBe(
      'Implementation quality is acceptable.',
    );
    expect(result.state.variables['_review_result.judge']).toBe('impl_quality');
  });

  it('with named judge invalid JSON: retries the judge capture prompt', async () => {
    const captureReader: CaptureReader = {
      read: vi.fn().mockResolvedValue('not valid json'),
      clear: vi.fn().mockResolvedValue(undefined),
    };
    const reviewNode = createReviewNode(
      'rv1',
      [createPromptNode('p1', 'Draft')],
      3,
      undefined,
      undefined,
      false,
      'impl_quality',
    );
    let state = buildSessionWithJudges([reviewNode]);
    state = {
      ...state,
      currentNodePath: [0, 1],
      nodeProgress: {
        rv1: { iteration: 1, maxIterations: 3, status: 'awaiting_capture', askRetryCount: 0 },
      },
    };

    const result = await autoAdvanceNodes(state, undefined, captureReader);
    expect(result.kind).toBe('prompt');
    expect(result.capturedPrompt).toContain('JSON capture');
    expect(result.state.nodeProgress['rv1']?.askRetryCount).toBe(1);
    expect(result.state.nodeProgress['rv1']?.captureFailureReason).toBe(
      'invalid judge-result JSON',
    );
  });

  it('max rounds exhausted: advances past non-strict review node', async () => {
    const runner = makeRunner(1); // still failing
    const reviewNode = createReviewNode(
      'rv1',
      [createPromptNode('p1', 'Draft')],
      2,
      undefined,
      'check.sh',
    );
    const after = createPromptNode('p2', 'Max rounds reached');
    const spec = createFlowSpec('test', [reviewNode, after]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      currentNodePath: [0, 1],
      nodeProgress: { rv1: { iteration: 2, maxIterations: 2, status: 'running' } },
    };
    const result = await autoAdvanceNodes(state, runner);
    expect(result.kind).toBe('prompt');
    expect(result.capturedPrompt).toBe('Max rounds reached');
    expect(result.state.status).toBe('active');
    expect(result.state.variables['_review_result.pass']).toBe(false);
    expect(result.outcomes).toEqual([
      {
        code: FLOW_OUTCOME_CODES.reviewRejected,
        summary: 'Review rejected: Grounded review checks failed with exit code 1. (flow[1])',
      },
    ]);
  });

  it('strict review fails closed when rounds are exhausted', async () => {
    const runner = makeRunner(1);
    const reviewNode = createReviewNode(
      'rv1',
      [createPromptNode('p1', 'Draft')],
      2,
      undefined,
      'check.sh',
      true,
    );
    const spec = createFlowSpec('test', [reviewNode]);
    let state = createSessionState('s1', spec);
    state = {
      ...state,
      currentNodePath: [0, 1],
      nodeProgress: { rv1: { iteration: 2, maxIterations: 2, status: 'running' } },
    };
    const result = await autoAdvanceNodes(state, runner);
    expect(result.kind).toBe('advance');
    expect(result.state.status).toBe('failed');
    expect(result.state.failureReason).toContain('Review strict failed after 2/2 rounds');
    expect(result.state.nodeProgress['rv1']?.status).toBe('failed');
    expect(result.state.variables['_review_result.pass']).toBe(false);
    expect(result.outcomes).toEqual([
      {
        code: FLOW_OUTCOME_CODES.reviewRejected,
        summary:
          'Review strict failed after 2/2 rounds: Grounded review checks failed with exit code 1. (flow[1])',
      },
    ]);
  });
});

// ── race via autoAdvanceNodes ─────────────────────────────────────────

describe('autoAdvanceNodes — race node', () => {
  it('without processSpawner: sets race_winner to empty string and advances', async () => {
    const spawnA = createSpawnNode('s1', 'alpha', [createPromptNode('pa', 'work')]);
    const raceNode = createRaceNode('r1', [spawnA]);
    const after = createLetNode('l1', 'done', { type: 'literal', value: 'yes' });
    const spec = createFlowSpec('test', [raceNode, after]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state, undefined, undefined, undefined);
    expect(result.variables['race_winner']).toBe('');
    expect(result.variables['done']).toBe('yes');
  });

  it('launches all children on first advance and returns pause', async () => {
    const spawner: ProcessSpawner = {
      spawn: vi.fn().mockResolvedValue({ pid: 101 }),
      poll: vi.fn().mockResolvedValue({ status: 'running' }),
    };
    const spawnA = createSpawnNode('s1', 'alpha', [createPromptNode('pa', 'work')]);
    const spawnB = createSpawnNode('s2', 'beta', [createPromptNode('pb', 'work')]);
    const raceNode = createRaceNode('r1', [spawnA, spawnB]);
    const spec = createFlowSpec('test', [raceNode]);
    const state = createSessionState('s1', spec);

    const result = await autoAdvanceNodes(state, undefined, undefined, spawner);
    // First call launches children and returns pause (race blocks waiting for winner)
    expect(result.kind).toBe('pause');
    expect(spawner.spawn).toHaveBeenCalledTimes(2);
    expect(result.state.spawnedChildren['alpha']).toBeDefined();
    expect(result.state.spawnedChildren['beta']).toBeDefined();
  });

  it('when first child completes on poll: sets race_winner to child name', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(((
      _pid: number,
      signal?: NodeJS.Signals | number,
    ) => {
      if (signal === 0) return true;
      return true;
    }) as typeof process.kill);
    const spawner: ProcessSpawner = {
      spawn: vi.fn().mockResolvedValueOnce({ pid: 42 }).mockResolvedValueOnce({ pid: 43 }),
      poll: vi.fn().mockImplementation(async (stateDir: string) => {
        if (stateDir.includes('alpha')) {
          return { status: 'completed', variables: { result: 'ok' } };
        }
        return { status: 'running' };
      }),
      terminate: vi.fn().mockResolvedValue(true),
    };
    const spawnA = createSpawnNode('s1', 'alpha', [createPromptNode('pa', 'work')]);
    const spawnB = createSpawnNode('s2', 'beta', [createPromptNode('pb', 'work')]);
    const raceNode = createRaceNode('r1', [spawnA, spawnB]);
    const spec = createFlowSpec('test', [raceNode]);

    // Pre-build state as if children were already launched
    let state = createSessionState('s1', spec);
    state = updateRaceChildren(state, 'r1', ['alpha', 'beta']);
    state = updateSpawnedChild(state, 'alpha', {
      name: 'alpha',
      status: 'running',
      pid: 42,
      stateDir: '.prompt-language-alpha',
    });
    state = updateSpawnedChild(state, 'beta', {
      name: 'beta',
      status: 'running',
      pid: 43,
      stateDir: '.prompt-language-beta',
    });
    state = updateNodeProgress(state, 'r1', {
      iteration: 1,
      maxIterations: MAX_AWAIT_POLLS,
      status: 'running',
      startedAt: Date.now(),
    });

    const { state: result } = await autoAdvanceNodes(state, undefined, undefined, spawner);
    expect(result.variables['race_winner']).toBe('alpha');
    // Winner variables are imported without child-name prefix
    expect(result.variables['result']).toBe('ok');
    expect(spawner.terminate).toHaveBeenCalledWith(43);
    killSpy.mockRestore();
    platformSpy.mockRestore();
  });

  it('when all children fail: sets race_winner to empty string', async () => {
    const spawner: ProcessSpawner = {
      spawn: vi.fn().mockResolvedValue({ pid: 42 }),
      poll: vi.fn().mockResolvedValue({ status: 'failed' }),
    };
    const spawnA = createSpawnNode('s1', 'alpha', [createPromptNode('pa', 'work')]);
    const raceNode = createRaceNode('r1', [spawnA]);
    const spec = createFlowSpec('test', [raceNode]);

    let state = createSessionState('s1', spec);
    state = updateRaceChildren(state, 'r1', ['alpha']);
    state = updateSpawnedChild(state, 'alpha', {
      name: 'alpha',
      status: 'running',
      pid: 42,
      stateDir: '.prompt-language-alpha',
    });
    state = updateNodeProgress(state, 'r1', {
      iteration: 1,
      maxIterations: MAX_AWAIT_POLLS,
      status: 'running',
      startedAt: Date.now(),
    });

    const { state: result } = await autoAdvanceNodes(state, undefined, undefined, spawner);
    expect(result.variables['race_winner']).toBe('');
  });

  it('poll limit: times out after MAX_AWAIT_POLLS when children keep running', async () => {
    const spawner: ProcessSpawner = {
      spawn: vi.fn().mockResolvedValue({ pid: 42 }),
      poll: vi.fn().mockResolvedValue({ status: 'running' }),
    };
    const spawnA = createSpawnNode('s1', 'alpha', [createPromptNode('pa', 'work')]);
    const raceNode = createRaceNode('r1', [spawnA]);
    const spec = createFlowSpec('test', [raceNode]);

    let state = createSessionState('s1', spec);
    state = updateRaceChildren(state, 'r1', ['alpha']);
    state = updateSpawnedChild(state, 'alpha', {
      name: 'alpha',
      status: 'running',
      pid: 42,
      stateDir: '.prompt-language-alpha',
    });
    state = updateNodeProgress(state, 'r1', {
      iteration: MAX_AWAIT_POLLS - 1,
      maxIterations: MAX_AWAIT_POLLS,
      status: 'running',
      startedAt: Date.now(),
    });

    const { state: result } = await autoAdvanceNodes(state, undefined, undefined, spawner);
    expect(result.variables['race_winner']).toBe('');
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('Race timeout after')]),
    );
  });

  it('wall-clock timeout: sets race_winner to empty string with warning', async () => {
    const spawner: ProcessSpawner = {
      spawn: vi.fn().mockResolvedValue({ pid: 42 }),
      poll: vi.fn().mockResolvedValue({ status: 'running' }),
    };
    const spawnA = createSpawnNode('s1', 'alpha', [createPromptNode('pa', 'work')]);
    const raceNode = createRaceNode('r1', [spawnA], 0); // 0s timeout — already expired
    const spec = createFlowSpec('test', [raceNode]);

    let state = createSessionState('s1', spec);
    state = updateRaceChildren(state, 'r1', ['alpha']);
    state = updateSpawnedChild(state, 'alpha', {
      name: 'alpha',
      status: 'running',
      pid: 42,
      stateDir: '.prompt-language-alpha',
    });
    state = updateNodeProgress(state, 'r1', {
      iteration: 1,
      maxIterations: MAX_AWAIT_POLLS,
      status: 'running',
      startedAt: Date.now() - 5000, // started 5s ago
    });

    const { state: result } = await autoAdvanceNodes(state, undefined, undefined, spawner);
    expect(result.variables['race_winner']).toBe('');
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('timed out')]));
  });

  it('failed child spawn adds warning and does not add to child names', async () => {
    const spawner: ProcessSpawner = {
      spawn: vi.fn().mockResolvedValue({ pid: 0 }), // pid=0 means failed
      poll: vi.fn().mockResolvedValue({ status: 'running' }),
    };
    const spawnA = createSpawnNode('s1', 'alpha', [createPromptNode('pa', 'work')]);
    const raceNode = createRaceNode('r1', [spawnA]);
    const spec = createFlowSpec('test', [raceNode]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state, undefined, undefined, spawner);
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('alpha')]));
    expect(result.spawnedChildren['alpha']?.status).toBe('failed');
  });
});

it('continues polling when children still running (returns pause on second call)', async () => {
  const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
  const killSpy = vi.spyOn(process, 'kill').mockImplementation(((
    _pid: number,
    signal?: NodeJS.Signals | number,
  ) => {
    if (signal === 0) return true;
    return true;
  }) as typeof process.kill);
  const spawner: ProcessSpawner = {
    spawn: vi.fn().mockResolvedValue({ pid: 42 }),
    poll: vi.fn().mockResolvedValue({ status: 'running' }),
  };
  const spawnA = createSpawnNode('s1', 'alpha', [createPromptNode('pa', 'work')]);
  const raceNode = createRaceNode('r1', [spawnA]);
  const spec = createFlowSpec('test', [raceNode]);

  // First call: launch children (returns pause)
  const state = createSessionState('s1', spec);
  const r1 = await autoAdvanceNodes(state, undefined, undefined, spawner);
  expect(r1.kind).toBe('pause');

  // Second call: children still running → exercises line 1323 (poll returns pause again)
  const r2 = await autoAdvanceNodes(r1.state, undefined, undefined, spawner);
  expect(r2.kind).toBe('pause');
  killSpy.mockRestore();
  platformSpy.mockRestore();
});

// ── foreach-spawn via autoAdvanceNodes ───────────────────────────────

describe('autoAdvanceNodes — foreach-spawn node', () => {
  it('without processSpawner: advances past node without spawning', async () => {
    const feSpawn = createForeachSpawnNode('fs1', 'item', 'a b c', [
      createPromptNode('p1', 'work on ${item}'),
    ]);
    const after = createLetNode('l1', 'finished', { type: 'literal', value: 'yes' });
    const spec = createFlowSpec('test', [feSpawn, after]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state);
    expect(result.variables['finished']).toBe('yes');
    // No children spawned
    expect(Object.keys(result.spawnedChildren)).toHaveLength(0);
  });

  it('spawns one child per list item and sets loop variable', async () => {
    const spawner: ProcessSpawner = {
      spawn: vi.fn().mockResolvedValue({ pid: 10 }),
      poll: vi.fn().mockResolvedValue({ status: 'running' }),
    };
    const feSpawn = createForeachSpawnNode('fs1', 'item', 'alpha beta gamma', [
      createPromptNode('p1', 'work on ${item}'),
    ]);
    const spec = createFlowSpec('test', [feSpawn]);
    const state = createSessionState('s1', spec);

    await autoAdvanceNodes(state, undefined, undefined, spawner);
    expect(spawner.spawn).toHaveBeenCalledTimes(3);

    const calls = (spawner.spawn as ReturnType<typeof vi.fn>).mock.calls as [
      Parameters<ProcessSpawner['spawn']>[0],
    ][];
    expect(calls[0]![0].variables['item']).toBe('alpha');
    expect(calls[1]![0].variables['item']).toBe('beta');
    expect(calls[2]![0].variables['item']).toBe('gamma');
  });

  it('respects maxItems cap', async () => {
    const spawner: ProcessSpawner = {
      spawn: vi.fn().mockResolvedValue({ pid: 10 }),
      poll: vi.fn().mockResolvedValue({ status: 'running' }),
    };
    const feSpawn = createForeachSpawnNode(
      'fs1',
      'item',
      'a b c d e',
      [createPromptNode('p1', '${item}')],
      2, // maxItems = 2
    );
    const spec = createFlowSpec('test', [feSpawn]);
    const state = createSessionState('s1', spec);

    await autoAdvanceNodes(state, undefined, undefined, spawner);
    expect(spawner.spawn).toHaveBeenCalledTimes(2);
  });

  it('failed spawn emits warning and marks child as failed', async () => {
    const spawner: ProcessSpawner = {
      spawn: vi.fn().mockResolvedValue({ pid: 0 }),
      poll: vi.fn().mockResolvedValue({ status: 'running' }),
    };
    const feSpawn = createForeachSpawnNode('fs1', 'item', 'alpha', [
      createPromptNode('p1', '${item}'),
    ]);
    const spec = createFlowSpec('test', [feSpawn]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state, undefined, undefined, spawner);
    expect(result.spawnedChildren['item_0']?.status).toBe('failed');
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('item_0')]));
  });
});

// ── remember via autoAdvanceNodes ────────────────────────────────────

describe('autoAdvanceNodes — remember node', () => {
  let mockMemoryStore: MemoryStore;

  beforeEach(() => {
    mockMemoryStore = {
      append: vi.fn().mockResolvedValue(undefined),
      findByKey: vi.fn().mockResolvedValue(undefined),
      readAll: vi.fn().mockResolvedValue([]),
    };
  });

  it('text form: calls memoryStore.append with text field', async () => {
    const remNode = createRememberNode('rm1', 'The sky is blue');
    const spec = createFlowSpec('test', [remNode]);
    const state = createSessionState('s1', spec);

    await autoAdvanceNodes(state, undefined, undefined, undefined, undefined, mockMemoryStore);
    expect(mockMemoryStore.append).toHaveBeenCalledOnce();
    const entry = (mockMemoryStore.append as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as Parameters<MemoryStore['append']>[0];
    expect(entry.text).toBe('The sky is blue');
    expect(entry.key).toBeUndefined();
  });

  it('key-value form: calls memoryStore.append with key and value', async () => {
    const remNode = createRememberNode('rm1', undefined, 'user', 'Alice');
    const spec = createFlowSpec('test', [remNode]);
    const state = createSessionState('s1', spec);

    await autoAdvanceNodes(state, undefined, undefined, undefined, undefined, mockMemoryStore);
    const entry = (mockMemoryStore.append as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as Parameters<MemoryStore['append']>[0];
    expect(entry.key).toBe('user');
    expect(entry.value).toBe('Alice');
    expect(entry.text).toBeUndefined();
  });

  it('interpolates variables in text', async () => {
    const remNode = createRememberNode('rm1', 'Hello ${name}');
    const spec = createFlowSpec('test', [remNode]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { name: 'World' } };

    await autoAdvanceNodes(state, undefined, undefined, undefined, undefined, mockMemoryStore);
    const entry = (mockMemoryStore.append as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as Parameters<MemoryStore['append']>[0];
    expect(entry.text).toBe('Hello World');
  });

  it('interpolates variables in value', async () => {
    const remNode = createRememberNode('rm1', undefined, 'greeting', 'Hello ${name}');
    const spec = createFlowSpec('test', [remNode]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { name: 'Alice' } };

    await autoAdvanceNodes(state, undefined, undefined, undefined, undefined, mockMemoryStore);
    const entry = (mockMemoryStore.append as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as Parameters<MemoryStore['append']>[0];
    expect(entry.value).toBe('Hello Alice');
  });

  it('auto-advances past remember node', async () => {
    const remNode = createRememberNode('rm1', 'note');
    const after = createLetNode('l1', 'x', { type: 'literal', value: 'done' });
    const spec = createFlowSpec('test', [remNode, after]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      undefined,
      undefined,
      mockMemoryStore,
    );
    expect(result.variables['x']).toBe('done');
  });

  it('without memoryStore: still advances past node', async () => {
    const remNode = createRememberNode('rm1', 'note');
    const after = createLetNode('l1', 'x', { type: 'literal', value: 'done' });
    const spec = createFlowSpec('test', [remNode, after]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state);
    expect(result.variables['x']).toBe('done');
  });
});

// ── memory source via autoAdvanceNodes ─────────────────────────────────

describe('autoAdvanceNodes — memory let source', () => {
  it('reads a stored key and advances', async () => {
    const mockMemoryStore: MemoryStore = {
      append: vi.fn().mockResolvedValue(undefined),
      findByKey: vi.fn().mockResolvedValue({
        timestamp: '2024-01-01T00:00:00Z',
        key: 'preferred-language',
        value: 'TypeScript',
      }),
      readAll: vi.fn().mockResolvedValue([]),
    };
    const letNode = createLetNode('l1', 'lang', { type: 'memory', key: 'preferred-language' });
    const after = createLetNode('l2', 'done', { type: 'literal', value: 'yes' });
    const spec = createFlowSpec('test', [letNode, after]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      undefined,
      undefined,
      mockMemoryStore,
    );
    expect(mockMemoryStore.findByKey).toHaveBeenCalledWith('preferred-language');
    expect(result.variables['lang']).toBe('TypeScript');
    expect(result.variables['done']).toBe('yes');
  });

  it('without memoryStore: stores empty string and advances', async () => {
    const letNode = createLetNode('l1', 'lang', { type: 'memory', key: 'preferred-language' });
    const after = createLetNode('l2', 'done', { type: 'literal', value: 'yes' });
    const spec = createFlowSpec('test', [letNode, after]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state);
    expect(result.variables['lang']).toBe('');
    expect(result.variables['done']).toBe('yes');
  });
});

// ── send via autoAdvanceNodes ─────────────────────────────────────────

describe('autoAdvanceNodes — send node', () => {
  let mockMessageStore: MessageStore;

  beforeEach(() => {
    mockMessageStore = {
      send: vi.fn().mockResolvedValue(undefined),
      receive: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('calls messageStore.send with target and message', async () => {
    const sendNode = createSendNode('sn1', 'parent', 'Hello parent');
    const spec = createFlowSpec('test', [sendNode]);
    const state = createSessionState('s1', spec);

    await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockMessageStore,
    );
    expect(mockMessageStore.send).toHaveBeenCalledWith('parent', 'Hello parent');
  });

  it('interpolates variables in message', async () => {
    const sendNode = createSendNode('sn1', 'parent', 'Result: ${output}');
    const spec = createFlowSpec('test', [sendNode]);
    let state = createSessionState('s1', spec);
    state = { ...state, variables: { output: '42' } };

    await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockMessageStore,
    );
    expect(mockMessageStore.send).toHaveBeenCalledWith('parent', 'Result: 42');
  });

  it('auto-advances past send node', async () => {
    const sendNode = createSendNode('sn1', 'child', 'go');
    const after = createLetNode('l1', 'sent', { type: 'literal', value: 'true' });
    const spec = createFlowSpec('test', [sendNode, after]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockMessageStore,
    );
    expect(result.variables['sent']).toBe('true');
  });

  it('without messageStore: still advances past node', async () => {
    const sendNode = createSendNode('sn1', 'parent', 'ping');
    const after = createLetNode('l1', 'x', { type: 'literal', value: '1' });
    const spec = createFlowSpec('test', [sendNode, after]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state);
    expect(result.variables['x']).toBe('1');
  });
});

// ── receive via autoAdvanceNodes ──────────────────────────────────────

describe('autoAdvanceNodes — receive node', () => {
  it('when message available: stores in variable and advances', async () => {
    const mockMessageStore: MessageStore = {
      send: vi.fn().mockResolvedValue(undefined),
      receive: vi.fn().mockResolvedValue('hello from parent'),
    };
    const recNode = createReceiveNode('rc1', 'inbox_msg');
    const after = createLetNode('l1', 'done', { type: 'literal', value: 'yes' });
    const spec = createFlowSpec('test', [recNode, after]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockMessageStore,
    );
    expect(result.variables['inbox_msg']).toBe('hello from parent');
    expect(result.variables['done']).toBe('yes');
  });

  it('first call with no message: returns kind:advance with pause internally, records progress', async () => {
    const mockMessageStore: MessageStore = {
      send: vi.fn().mockResolvedValue(undefined),
      receive: vi.fn().mockResolvedValue(undefined),
    };
    const recNode = createReceiveNode('rc1', 'inbox_msg');
    const spec = createFlowSpec('test', [recNode]);
    const state = createSessionState('s1', spec);

    const result = await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockMessageStore,
    );
    // No message — receive node blocks, autoAdvanceNodes returns pause
    expect(result.kind).toBe('pause');
    // Node progress should be recorded (startedAt set)
    expect(result.state.nodeProgress['rc1']).toBeDefined();
  });

  it('second call with still no message: does not double-record progress', async () => {
    const mockMessageStore: MessageStore = {
      send: vi.fn().mockResolvedValue(undefined),
      receive: vi.fn().mockResolvedValue(undefined),
    };
    const recNode = createReceiveNode('rc1', 'inbox_msg');
    const spec = createFlowSpec('test', [recNode]);
    let state = createSessionState('s1', spec);

    // Simulate first call: inject existing progress
    state = updateNodeProgress(state, 'rc1', {
      iteration: 1,
      maxIterations: 1,
      status: 'running',
      startedAt: Date.now(),
    });

    const result = await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockMessageStore,
    );
    // Still blocked — returns pause
    expect(result.kind).toBe('pause');
    // Still at receive node (blocked)
    expect(result.state.currentNodePath).toEqual([0]);
  });

  it('without messageStore: stores empty string and advances', async () => {
    const recNode = createReceiveNode('rc1', 'inbox_msg');
    const after = createLetNode('l1', 'x', { type: 'literal', value: '1' });
    const spec = createFlowSpec('test', [recNode, after]);
    const state = createSessionState('s1', spec);

    const { state: result } = await autoAdvanceNodes(state);
    expect(result.variables['inbox_msg']).toBe('');
    expect(result.variables['x']).toBe('1');
  });

  it('timeout: stores empty string and advances when elapsed >= timeoutSeconds', async () => {
    const mockMessageStore: MessageStore = {
      send: vi.fn().mockResolvedValue(undefined),
      receive: vi.fn().mockResolvedValue(undefined), // no message
    };
    const recNode = createReceiveNode('rc1', 'inbox_msg', 'parent', 0); // 0s timeout
    const spec = createFlowSpec('test', [recNode]);
    let state = createSessionState('s1', spec);

    // Inject progress with startedAt far in the past to trigger timeout
    state = updateNodeProgress(state, 'rc1', {
      iteration: 1,
      maxIterations: 1,
      status: 'running',
      startedAt: Date.now() - 10000, // 10s ago
    });

    const { state: result } = await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockMessageStore,
    );
    expect(result.variables['inbox_msg']).toBe('');
    // Path should advance past receive node
    expect(result.currentNodePath).not.toEqual([0]);
  });

  it('receive uses specified from source', async () => {
    const mockMessageStore: MessageStore = {
      send: vi.fn().mockResolvedValue(undefined),
      receive: vi.fn().mockResolvedValue('msg from child'),
    };
    const recNode = createReceiveNode('rc1', 'inbox_msg', 'worker');
    const spec = createFlowSpec('test', [recNode]);
    const state = createSessionState('s1', spec);

    await autoAdvanceNodes(
      state,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockMessageStore,
    );
    expect(mockMessageStore.receive).toHaveBeenCalledWith('worker');
  });
});

// ── While/until wall-clock timeout ───────────────────────────────────────────
describe('autoAdvanceNodes — condition-loop wall-clock timeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('exits a while loop when timeoutSeconds elapses', async () => {
    const { createWhileNode } = await import('../domain/flow-node.js');
    const body = [createPromptNode('p1', 'do work')];
    // timeoutSeconds: 1 means loop exits after 1s
    const whileNode = createWhileNode('wh1', 'command_failed', body, 5, undefined, 1);
    const promptAfter = createPromptNode('p2', 'after timeout');
    const spec = createFlowSpec('test', [whileNode, promptAfter]);
    let state = createSessionState('s1', spec);

    // Set command_failed = true so condition evaluates to "enter body"
    state = { ...state, variables: { ...state.variables, command_failed: true } };

    // Simulate the loop having started 10 seconds ago (well past the 1s timeout)
    const pastTime = Date.now() - 10_000;
    state = updateNodeProgress(state, 'wh1', {
      iteration: 1,
      maxIterations: 5,
      status: 'running',
      startedAt: pastTime,
      loopStartedAt: pastTime,
    });
    // currentNodePath = [0, 1] — body exhausted, re-evaluating loop condition
    state = { ...state, currentNodePath: [0, 1] };

    // Result should advance past the while node due to timeout
    const { state: result, capturedPrompt } = await autoAdvanceNodes(state);
    expect(result.warnings.some((w) => w.includes('timed out'))).toBe(true);
    expect(capturedPrompt).toBe('after timeout');
  });
});
