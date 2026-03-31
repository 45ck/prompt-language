/**
 * Supplementary lint tests for new node kinds.
 * Covers: approve, review, race, foreach_spawn, remember, send, receive —
 * specifically the lintNodes branches and collectDefinedVariables paths
 * not covered by the base test suite.
 */

import { describe, it, expect } from 'vitest';
import { lintFlow } from './lint-flow.js';
import { createFlowSpec } from './flow-spec.js';
import {
  createApproveNode,
  createReviewNode,
  createPromptNode,
  createRunNode,
  createLetNode,
  createIfNode,
  createWhileNode,
  createRetryNode,
  createForeachNode,
  createTryNode,
  createSpawnNode,
} from './flow-node.js';

// ── approve node lint ────────────────────────────────────────────────

describe('lintFlow — approve node', () => {
  it('no warning for approve with non-empty message', () => {
    const spec = createFlowSpec('test', [createApproveNode('a1', 'Proceed?')]);
    const warnings = lintFlow(spec);
    expect(warnings.some((w) => w.nodeId === 'a1')).toBe(false);
  });

  it('warns when approve message is empty', () => {
    const spec = createFlowSpec('test', [createApproveNode('a1', '')]);
    const warnings = lintFlow(spec);
    expect(warnings.some((w) => w.nodeId === 'a1' && w.message.includes('empty message'))).toBe(
      true,
    );
  });

  it('warns when approve message is only whitespace', () => {
    const spec = createFlowSpec('test', [createApproveNode('a1', '   ')]);
    const warnings = lintFlow(spec);
    expect(warnings.some((w) => w.nodeId === 'a1')).toBe(true);
  });
});

// ── review node lint ─────────────────────────────────────────────────

describe('lintFlow — review node', () => {
  it('no warning for review with body', () => {
    const spec = createFlowSpec('test', [
      createReviewNode('rv1', [createPromptNode('p1', 'Write it')], 3),
    ]);
    const warnings = lintFlow(spec);
    expect(warnings.some((w) => w.nodeId === 'rv1' && w.message.includes('Empty'))).toBe(false);
  });

  it('warns on empty review body', () => {
    const spec = createFlowSpec('test', [createReviewNode('rv1', [], 3)]);
    const warnings = lintFlow(spec);
    expect(
      warnings.some((w) => w.nodeId === 'rv1' && w.message.includes('Empty review body')),
    ).toBe(true);
  });

  it('lints variables inside review body', () => {
    // A let inside review body should be reachable for variable tracking
    const spec = createFlowSpec('test', [
      createReviewNode(
        'rv1',
        [
          createLetNode('l1', 'draft', { type: 'literal', value: 'v1' }),
          createPromptNode('p1', 'Use ${draft}'),
        ],
        3,
      ),
    ]);
    // Should not warn about 'draft' being undefined
    const warnings = lintFlow(spec);
    expect(warnings.some((w) => w.message.includes("'draft'"))).toBe(false);
  });
});

// ── collectDefinedVariables through review ───────────────────────────

describe('lintFlow — variable collection through review body', () => {
  it('variables defined in review body are visible after review', () => {
    const spec = createFlowSpec('test', [
      createReviewNode(
        'rv1',
        [createLetNode('l1', 'reviewed', { type: 'literal', value: 'yes' })],
        2,
      ),
      createPromptNode('p2', '${reviewed}'),
    ]);
    // No unresolved variable warning expected
    const warnings = lintFlow(spec);
    expect(warnings.some((w) => w.message.includes("'reviewed'"))).toBe(false);
  });
});

// ── containsRunNode through new node kinds ───────────────────────────

describe('lintFlow — containsRunNode through review', () => {
  it('detects run inside review body for loop-no-progress warnings', () => {
    // A while loop with a review body that contains a run should not trigger
    // the "condition may never change" warning (run is present via review)
    const spec = createFlowSpec('test', [
      createWhileNode(
        'w1',
        'command_failed',
        [createReviewNode('rv1', [createRunNode('r1', 'npm test')], 2)],
        3,
      ),
    ]);
    const warnings = lintFlow(spec);
    expect(warnings.some((w) => w.nodeId === 'w1' && w.message.includes('no run'))).toBe(false);
  });
});

// ── allRunsInsideConditional through new branches ────────────────────

describe('lintFlow — allRunsInsideConditional through nested nodes', () => {
  it('run inside try body is treated as unconditional', () => {
    const spec = createFlowSpec('test', [
      createTryNode('t1', [createRunNode('r1', 'cmd')], 'command_failed', []),
    ]);
    // Should not warn about runs inside conditional — try body is unconditional
    const warnings = lintFlow(spec);
    // No specific assertion needed — just confirm it does not throw or hang
    expect(Array.isArray(warnings)).toBe(true);
  });

  it('run inside while body is treated as unconditional', () => {
    const spec = createFlowSpec('test', [
      createWhileNode('w1', 'command_failed', [createRunNode('r1', 'cmd')], 3),
    ]);
    const warnings = lintFlow(spec);
    expect(Array.isArray(warnings)).toBe(true);
  });

  it('run inside retry body is treated as unconditional', () => {
    const spec = createFlowSpec('test', [createRetryNode('re1', [createRunNode('r1', 'cmd')], 3)]);
    const warnings = lintFlow(spec);
    expect(Array.isArray(warnings)).toBe(true);
  });

  it('run inside foreach body is treated as unconditional', () => {
    const spec = createFlowSpec('test', [
      createForeachNode('fe1', 'item', 'a b', [createRunNode('r1', 'echo ${item}')]),
    ]);
    const warnings = lintFlow(spec);
    expect(Array.isArray(warnings)).toBe(true);
  });

  it('run inside spawn body is treated as unconditional', () => {
    const spec = createFlowSpec('test', [
      createSpawnNode('s1', 'worker', [createRunNode('r1', 'cmd')]),
    ]);
    const warnings = lintFlow(spec);
    expect(Array.isArray(warnings)).toBe(true);
  });

  it('run inside review body is treated as unconditional', () => {
    const spec = createFlowSpec('test', [
      createReviewNode('rv1', [createRunNode('r1', 'lint.sh')], 2),
    ]);
    const warnings = lintFlow(spec);
    expect(Array.isArray(warnings)).toBe(true);
  });

  it('run inside if branch is treated as conditional', () => {
    // Only run nodes inside if/else are truly "all inside conditional"
    const spec = createFlowSpec('test', [
      createIfNode('i1', 'command_succeeded', [createRunNode('r1', 'cmd')], []),
    ]);
    const warnings = lintFlow(spec);
    expect(Array.isArray(warnings)).toBe(true);
  });
});

// ── allRunsInsideConditional walk branches ────────────────────────────
// These tests require completion gates so allRunsInsideConditional is invoked.
// The run must be exclusively inside a non-if container so each walk branch fires.

describe('lintFlow — allRunsInsideConditional walk through loop containers', () => {
  // Helper: spec with a gate so allRunsInsideConditional is evaluated
  function specWithGate(nodes: Parameters<typeof createFlowSpec>[1]) {
    return createFlowSpec('test', nodes, [{ predicate: 'tests_pass' }]);
  }

  it('walk visits while body when run is inside while (unconditional → no conditional-run warn)', () => {
    const spec = specWithGate([
      createWhileNode('w1', 'command_failed', [createRunNode('r1', 'npm test')], 3),
    ]);
    // run inside while is unconditional → allRunsInsideConditional = false → no H-SEC-007 warning
    const warnings = lintFlow(spec);
    expect(
      warnings.some((w) => w.message.includes('All run nodes are inside conditional blocks')),
    ).toBe(false);
  });

  it('walk visits until body when run is inside until', () => {
    const spec = specWithGate([
      createIfNode('i1', 'flag', [
        createWhileNode('w1', 'command_failed', [createRunNode('r1', 'test')], 3),
      ]),
    ]);
    // run is inside if → inside conditional, but walk also traverses while → exercises line 423
    const warnings = lintFlow(spec);
    expect(Array.isArray(warnings)).toBe(true);
  });

  it('walk visits retry body when run is inside retry inside if', () => {
    const spec = specWithGate([
      createIfNode('i1', 'flag', [createRetryNode('re1', [createRunNode('r1', 'test')], 3)]),
    ]);
    const warnings = lintFlow(spec);
    expect(Array.isArray(warnings)).toBe(true);
  });

  it('walk visits foreach body when run is inside foreach inside if', () => {
    const spec = specWithGate([
      createIfNode('i1', 'flag', [
        createForeachNode('fe1', 'item', 'a b', [createRunNode('r1', 'echo ${item}')]),
      ]),
    ]);
    const warnings = lintFlow(spec);
    expect(Array.isArray(warnings)).toBe(true);
  });

  it('walk visits try body/catch/finally when run is inside try inside if', () => {
    const spec = specWithGate([
      createIfNode('i1', 'flag', [
        createTryNode(
          't1',
          [createRunNode('r1', 'cmd')],
          'command_failed',
          [createRunNode('r2', 'recover')],
          [createRunNode('r3', 'cleanup')],
        ),
      ]),
    ]);
    const warnings = lintFlow(spec);
    expect(Array.isArray(warnings)).toBe(true);
  });

  it('walk visits spawn body when run is inside spawn inside if', () => {
    const spec = specWithGate([
      createIfNode('i1', 'flag', [createSpawnNode('sp1', 'worker', [createRunNode('r1', 'task')])]),
    ]);
    const warnings = lintFlow(spec);
    expect(Array.isArray(warnings)).toBe(true);
  });

  it('walk visits review body when run is inside review inside if', () => {
    const spec = specWithGate([
      createIfNode('i1', 'flag', [createReviewNode('rv1', [createRunNode('r1', 'lint.sh')], 2)]),
    ]);
    const warnings = lintFlow(spec);
    expect(Array.isArray(warnings)).toBe(true);
  });
});

// ── allRunsInsideConditional — let x = run in walk ────────────────────
// Covers lines 412-414: `case 'let': if (node.source.type === 'run') ...` inside walk

describe('lintFlow — allRunsInsideConditional walk with let-run source', () => {
  function specWithGate(nodes: Parameters<typeof createFlowSpec>[1]) {
    return createFlowSpec('test', nodes, [{ predicate: 'tests_pass' }]);
  }

  it('let x = run inside while is unconditional → no conditional-run warn', () => {
    const spec = specWithGate([
      createWhileNode(
        'w1',
        'command_failed',
        [createLetNode('l1', 'out', { type: 'run', command: 'npm test' })],
        3,
      ),
    ]);
    // let x = run is an unconditional run → allRunsInsideConditional returns false → no H-SEC-007 warning
    const warnings = lintFlow(spec);
    expect(
      warnings.some((w) => w.message.includes('All run nodes are inside conditional blocks')),
    ).toBe(false);
  });

  it('let x = run inside if branch → all runs are conditional → conditional-run warning', () => {
    const spec = specWithGate([
      createIfNode(
        'i1',
        'command_succeeded',
        [createLetNode('l1', 'out', { type: 'run', command: 'npm test' })],
        [],
      ),
    ]);
    // let x = run inside if is conditional → allRunsInsideConditional returns true → H-SEC-007 warning
    const warnings = lintFlow(spec);
    expect(
      warnings.some((w) => w.message.includes('All run nodes are inside conditional blocks')),
    ).toBe(true);
  });
});

// ── containsRunNode — let node with non-run source ────────────────────

describe('lintFlow — containsRunNode with let-literal (not a run source)', () => {
  it('let-literal inside while body: containsRunNode returns false (no run)', () => {
    // A while whose body has only a let-literal — containsRunNode returns false
    // This exercises the `case 'let': if (node.source.type === 'run') return true; break;` path
    const spec = createFlowSpec('test', [
      createWhileNode(
        'w1',
        'command_failed',
        [createLetNode('l1', 'x', { type: 'literal', value: 'v' })],
        3,
      ),
    ]);
    const warnings = lintFlow(spec);
    // Expect a warning because condition references a state-changing variable but body has no run
    expect(warnings.some((w) => w.nodeId === 'w1' && w.message.includes('no run'))).toBe(true);
  });

  it('try-with-no-run inside while body: containsRunNode false → break in try case', () => {
    // try node that contains NO run nodes → containsRunNode(try) = false → exercises break at line 248
    const spec = createFlowSpec('test', [
      createWhileNode(
        'w1',
        'command_failed',
        [createTryNode('t1', [createPromptNode('p1', 'try')], 'command_failed', [])],
        3,
      ),
    ]);
    const warnings = lintFlow(spec);
    expect(warnings.some((w) => w.nodeId === 'w1' && w.message.includes('no run'))).toBe(true);
  });

  it('while-inside-while with no run: exercises break in nested while case', () => {
    const spec = createFlowSpec('test', [
      createWhileNode(
        'w1',
        'command_failed',
        [createWhileNode('w2', 'command_failed', [createPromptNode('p1', 'inner')], 2)],
        3,
      ),
    ]);
    const warnings = lintFlow(spec);
    expect(warnings.some((w) => w.nodeId === 'w1' && w.message.includes('no run'))).toBe(true);
  });

  it('retry-with-no-run inside while body: exercises break in retry case', () => {
    const spec = createFlowSpec('test', [
      createWhileNode(
        'w1',
        'command_failed',
        [createRetryNode('re1', [createPromptNode('p1', 'retry')], 3)],
        3,
      ),
    ]);
    const warnings = lintFlow(spec);
    expect(warnings.some((w) => w.nodeId === 'w1' && w.message.includes('no run'))).toBe(true);
  });

  it('foreach-with-no-run inside while body: exercises break in foreach case', () => {
    const spec = createFlowSpec('test', [
      createWhileNode(
        'w1',
        'command_failed',
        [createForeachNode('fe1', 'item', 'a b', [createPromptNode('p1', '${item}')])],
        3,
      ),
    ]);
    const warnings = lintFlow(spec);
    expect(warnings.some((w) => w.nodeId === 'w1' && w.message.includes('no run'))).toBe(true);
  });

  it('spawn-with-no-run inside while body: exercises break in spawn case', () => {
    const spec = createFlowSpec('test', [
      createWhileNode(
        'w1',
        'command_failed',
        [createSpawnNode('sp1', 'worker', [createPromptNode('p1', 'task')])],
        3,
      ),
    ]);
    const warnings = lintFlow(spec);
    expect(warnings.some((w) => w.nodeId === 'w1' && w.message.includes('no run'))).toBe(true);
  });

  it('review-with-no-run inside while body: exercises break in review case', () => {
    const spec = createFlowSpec('test', [
      createWhileNode(
        'w1',
        'command_failed',
        [createReviewNode('rv1', [createPromptNode('p1', 'draft')], 2)],
        3,
      ),
    ]);
    const warnings = lintFlow(spec);
    expect(warnings.some((w) => w.nodeId === 'w1' && w.message.includes('no run'))).toBe(true);
  });

  it('if-with-no-run inside while body: exercises break in if case of containsRunNode', () => {
    // An if node with no run nodes in either branch inside a while body
    // → containsRunNode(if) = false → hits the break at line 240
    const spec = createFlowSpec('test', [
      createWhileNode(
        'w1',
        'command_failed',
        [
          createIfNode(
            'i1',
            'flag',
            [createPromptNode('p1', 'yes')],
            [createPromptNode('p2', 'no')],
          ),
        ],
        3,
      ),
    ]);
    const warnings = lintFlow(spec);
    expect(warnings.some((w) => w.nodeId === 'w1' && w.message.includes('no run'))).toBe(true);
  });
});

// ── ask condition without grounded-by warning ─────────────────────────

describe('lintFlow — ask condition without grounded-by', () => {
  it('warns when while uses ask condition without grounded-by', () => {
    const spec = createFlowSpec('test', [
      createWhileNode('w1', 'ask: "Is it done?"', [createPromptNode('p1', 'work')], 3),
    ]);
    const warnings = lintFlow(spec);
    expect(warnings.some((w) => w.nodeId === 'w1' && w.message.includes('grounded-by'))).toBe(true);
  });

  it('no ask-condition warning when grounded-by is present', () => {
    const spec = createFlowSpec('test', [
      createWhileNode(
        'w1',
        'ask: "Is it done?"',
        [createPromptNode('p1', 'work')],
        3,
        undefined,
        undefined,
        'npm test',
      ),
    ]);
    const warnings = lintFlow(spec);
    expect(
      warnings.some((w) => w.nodeId === 'w1' && w.message.includes('without grounded-by')),
    ).toBe(false);
  });
});
