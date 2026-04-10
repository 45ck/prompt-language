import { describe, it, expect } from 'vitest';
import { lintFlow, levenshtein } from './lint-flow.js';
import { createFlowSpec, createCompletionGate } from './flow-spec.js';
import {
  createPromptNode,
  createRunNode,
  createWhileNode,
  createUntilNode,
  createRetryNode,
  createIfNode,
  createTryNode,
  createForeachNode,
  createBreakNode,
  createContinueNode,
  createSpawnNode,
  createLetNode,
  createRaceNode,
  createForeachSpawnNode,
  createRememberNode,
  createSendNode,
  createReceiveNode,
} from './flow-node.js';

describe('lintFlow', () => {
  it('returns no warnings for a valid flow', () => {
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'do something'), createRunNode('r1', 'npm test')],
      [],
    );
    expect(lintFlow(spec)).toEqual([]);
  });

  it('warns on missing goal', () => {
    const spec = createFlowSpec('', [createPromptNode('p1', 'hi')], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({ nodeId: '', message: 'Missing Goal' });
  });

  it('warns on empty flow', () => {
    const spec = createFlowSpec('test', [], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({ nodeId: '', message: 'Empty flow — no nodes defined' });
  });

  it('warns on empty while body', () => {
    const spec = createFlowSpec('test', [createWhileNode('w1', 'true', [], 5)], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({ nodeId: 'w1', message: 'Empty while body' });
  });

  it('warns on retry without run node', () => {
    const spec = createFlowSpec(
      'test',
      [createRetryNode('r1', [createPromptNode('p1', 'fix')], 3)],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'r1',
      message: 'Retry without run node — retry re-loops on command_failed',
    });
  });

  it('no warning for retry with run node', () => {
    const spec = createFlowSpec(
      'test',
      [createRetryNode('r1', [createRunNode('run1', 'npm test')], 3)],
      [],
    );
    expect(lintFlow(spec)).toEqual([]);
  });

  it('warns on empty if branches', () => {
    const spec = createFlowSpec('test', [createIfNode('i1', 'cond', [], [])], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'i1',
      message: 'Empty if — both branches are empty',
    });
  });

  it('warns on empty try body', () => {
    const spec = createFlowSpec(
      'test',
      [createTryNode('t1', [], 'command_failed', [createPromptNode('p1', 'rollback')])],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({ nodeId: 't1', message: 'Empty try body' });
  });

  it('warns on break outside loop', () => {
    const spec = createFlowSpec('test', [createBreakNode('b1')], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({ nodeId: 'b1', message: 'Break outside of loop' });
  });

  it('no warning for break inside loop', () => {
    const spec = createFlowSpec(
      'test',
      [createForeachNode('f1', 'item', 'a b c', [createBreakNode('b1')], 10)],
      [],
    );
    expect(lintFlow(spec)).toEqual([]);
  });

  it('warns on empty foreach body', () => {
    const spec = createFlowSpec('test', [createForeachNode('f1', 'x', 'a b', [], 10)], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({ nodeId: 'f1', message: 'Empty foreach body' });
  });

  it('warns on empty spawn body', () => {
    const spec = createFlowSpec('test', [createSpawnNode('s1', 'task', [])], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({ nodeId: 's1', message: 'Empty spawn body' });
  });

  it('no warning for spawn with body', () => {
    const spec = createFlowSpec(
      'test',
      [createSpawnNode('s1', 'task', [createRunNode('r1', 'echo hi')])],
      [],
    );
    expect(lintFlow(spec)).toEqual([]);
  });

  it('no warning when if has only then-branch non-empty', () => {
    const spec = createFlowSpec(
      'test',
      [createIfNode('i1', 'cond', [createPromptNode('p1', 'yes')], [])],
      [],
    );
    expect(lintFlow(spec)).toEqual([]);
  });

  it('warns on empty until body', () => {
    const spec = createFlowSpec('test', [createUntilNode('u1', 'done', [], 5)], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({ nodeId: 'u1', message: 'Empty until body' });
  });

  it('warns on empty retry body', () => {
    const spec = createFlowSpec('test', [createRetryNode('r1', [], 3)], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({ nodeId: 'r1', message: 'Empty retry body' });
  });

  it('no false break-outside-loop warning for break inside retry inside foreach', () => {
    const retryWithBreak = createRetryNode('re1', [createBreakNode('b1')], 3);
    const spec = createFlowSpec(
      'test',
      [createForeachNode('f1', 'item', 'a b c', [retryWithBreak], 10)],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).not.toContainEqual(
      expect.objectContaining({ message: 'Break outside of loop' }),
    );
  });

  it('lints nodes inside spawn body', () => {
    const spec = createFlowSpec(
      'test',
      [createSpawnNode('s1', 'task', [createBreakNode('b1')])],
      [],
    );
    const warnings = lintFlow(spec);
    // spawn resets insideLoop to false, so break inside spawn body should warn
    expect(warnings).toContainEqual({ nodeId: 'b1', message: 'Break outside of loop' });
  });
});

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
  });

  it('returns length for empty vs non-empty', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });

  it('computes single edit distance', () => {
    expect(levenshtein('cat', 'bat')).toBe(1);
    expect(levenshtein('cat', 'cats')).toBe(1);
    expect(levenshtein('cats', 'cat')).toBe(1);
  });

  it('computes multi-edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
});

describe('H-DX-001: unresolved variable warnings', () => {
  it('no warning when variable is defined by let', () => {
    const spec = createFlowSpec(
      'test',
      [
        createLetNode('l1', 'name', { type: 'literal', value: 'Alice' }),
        createPromptNode('p1', 'Hello ${name}'),
      ],
      [],
    );
    expect(lintFlow(spec)).toEqual([]);
  });

  it('warns on undefined variable in prompt text', () => {
    const spec = createFlowSpec('test', [createPromptNode('p1', 'Hello ${unknown}')], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'p1',
      message: 'Reference to undefined variable "${unknown}"',
    });
  });

  it('warns on undefined variable in run command', () => {
    const spec = createFlowSpec('test', [createRunNode('r1', 'echo ${missing}')], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'r1',
      message: 'Reference to undefined variable "${missing}"',
    });
  });

  it('warns on undefined variable in foreach expression', () => {
    const spec = createFlowSpec(
      'test',
      [createForeachNode('f1', 'item', '${data}', [createPromptNode('p1', 'hi')], 10)],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'f1',
      message: 'Reference to undefined variable "${data}"',
    });
  });

  it('warns on undefined variable in let literal source', () => {
    const spec = createFlowSpec(
      'test',
      [createLetNode('l1', 'msg', { type: 'literal', value: 'Hi ${person}' })],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'l1',
      message: 'Reference to undefined variable "${person}"',
    });
  });

  it('warns on undefined variable in let run source', () => {
    const spec = createFlowSpec(
      'test',
      [createLetNode('l1', 'out', { type: 'run', command: 'echo ${val}' })],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'l1',
      message: 'Reference to undefined variable "${val}"',
    });
  });

  it('warns on undefined variable in let prompt source', () => {
    const spec = createFlowSpec(
      'test',
      [createLetNode('l1', 'out', { type: 'prompt', text: 'Tell me about ${topic}' })],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'l1',
      message: 'Reference to undefined variable "${topic}"',
    });
  });

  it('does not warn on built-in auto-variables', () => {
    const spec = createFlowSpec(
      'test',
      [
        createRunNode('r1', 'npm test'),
        createPromptNode(
          'p1',
          'Exit: ${last_exit_code}, Failed: ${command_failed}, OK: ${command_succeeded}, Out: ${last_stdout}, Err: ${last_stderr}',
        ),
      ],
      [],
    );
    expect(lintFlow(spec)).toEqual([]);
  });

  it('does not warn on runtime critique, race, or approval variables', () => {
    const spec = createFlowSpec(
      'test',
      [
        createPromptNode(
          'p1',
          'Critique: ${_review_critique}, winner: ${race_winner}, rejected: ${approve_rejected}',
        ),
      ],
      [],
    );
    expect(lintFlow(spec)).toEqual([]);
  });

  it('does not warn on memory-prefetched keys', () => {
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'Lang: ${preferred_language}, Stack: ${preferred_stack}')],
      [],
      [],
      undefined,
      undefined,
      undefined,
      ['preferred_language', 'preferred_stack'],
    );
    expect(lintFlow(spec)).toEqual([]);
  });

  it('does not warn on _index and _length auto-variables', () => {
    const spec = createFlowSpec(
      'test',
      [
        createForeachNode(
          'f1',
          'item',
          'a b c',
          [createPromptNode('p1', '${item_index} of ${item_length}: ${item}')],
          10,
        ),
      ],
      [],
    );
    expect(lintFlow(spec)).toEqual([]);
  });

  it('does not warn on foreach iteration variable', () => {
    const spec = createFlowSpec(
      'test',
      [createForeachNode('f1', 'file', 'a b c', [createPromptNode('p1', 'Process ${file}')], 10)],
      [],
    );
    expect(lintFlow(spec)).toEqual([]);
  });

  it('suggests close match with "did you mean?"', () => {
    const spec = createFlowSpec(
      'test',
      [
        createLetNode('l1', 'greeting', { type: 'literal', value: 'hello' }),
        createPromptNode('p1', 'Say ${greting}'),
      ],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'p1',
      message: 'Reference to undefined variable "${greting}" — did you mean "${greeting}"?',
    });
  });

  it('does not suggest when no close match exists', () => {
    const spec = createFlowSpec(
      'test',
      [
        createLetNode('l1', 'x', { type: 'literal', value: 'val' }),
        createPromptNode('p1', 'Say ${completely_different}'),
      ],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'p1',
      message: 'Reference to undefined variable "${completely_different}"',
    });
  });

  it('finds variables defined in nested scopes', () => {
    const spec = createFlowSpec(
      'test',
      [
        createIfNode('i1', 'cond', [
          createLetNode('l1', 'inner', { type: 'literal', value: 'val' }),
        ]),
        createPromptNode('p1', 'Use ${inner}'),
      ],
      [],
    );
    // inner is collected from nested scope — no warning
    expect(lintFlow(spec)).toEqual([]);
  });

  it('finds variables defined inside try/catch/finally', () => {
    const spec = createFlowSpec(
      'test',
      [
        createTryNode(
          't1',
          [createLetNode('l1', 'result', { type: 'run', command: 'cmd' })],
          'command_failed',
          [createLetNode('l2', 'fallback', { type: 'literal', value: 'err' })],
        ),
        createPromptNode('p1', '${result} or ${fallback}'),
      ],
      [],
    );
    expect(lintFlow(spec)).toEqual([]);
  });

  it('no warning for ${var:-default} syntax with undefined var', () => {
    // ${var:-default} should still warn if var is not defined — user is referencing it
    const spec = createFlowSpec('test', [createPromptNode('p1', 'Hello ${name:-World}')], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'p1',
      message: 'Reference to undefined variable "${name}"',
    });
  });

  it('handles multiple variable refs in single node', () => {
    const spec = createFlowSpec(
      'test',
      [
        createLetNode('l1', 'first', { type: 'literal', value: 'A' }),
        createPromptNode('p1', '${first} and ${second}'),
      ],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'p1',
      message: 'Reference to undefined variable "${second}"',
    });
    expect(warnings).not.toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('${first}') }),
    );
  });

  it('checks variables inside spawn body', () => {
    const spec = createFlowSpec(
      'test',
      [createSpawnNode('s1', 'task', [createPromptNode('p1', '${undefined_var}')])],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'p1',
      message: 'Reference to undefined variable "${undefined_var}"',
    });
  });

  it('collects variables from let inside while body', () => {
    const spec = createFlowSpec(
      'test',
      [
        createWhileNode(
          'w1',
          'true',
          [createLetNode('l1', 'counter', { type: 'literal', value: '0' })],
          5,
        ),
        createPromptNode('p1', 'Count: ${counter}'),
      ],
      [],
    );
    expect(lintFlow(spec)).toEqual([]);
  });
});

describe('variable shadowing warnings', () => {
  it('warns when nested let shadows outer let', () => {
    const spec = createFlowSpec(
      'test',
      [
        createLetNode('l1', 'name', { type: 'literal', value: 'outer' }),
        createIfNode(
          'i1',
          'cond',
          [createLetNode('l2', 'name', { type: 'literal', value: 'inner' })],
          [],
        ),
      ],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'l2',
      message:
        'Variable "name" shadows variable from an outer scope (outer definition at node "l1")',
    });
  });

  it('warns when foreach loop variable shadows outer let', () => {
    const spec = createFlowSpec(
      'test',
      [
        createLetNode('l1', 'item', { type: 'literal', value: 'top-level-item' }),
        createForeachNode('f1', 'item', 'a b c', [createPromptNode('p1', 'Process ${item}')], 10),
      ],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'f1',
      message:
        'Foreach loop variable "item" shadows variable from an outer scope (outer definition at node "l1")',
    });
  });

  it('warns when foreach_spawn loop variable shadows outer let', () => {
    const spec = createFlowSpec(
      'test',
      [
        createLetNode('l1', 'job', { type: 'literal', value: 'x' }),
        createForeachSpawnNode('fs1', 'job', 'a b c', [createPromptNode('p1', 'Process ${job}')]),
      ],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'fs1',
      message:
        'Foreach loop variable "job" shadows variable from an outer scope (outer definition at node "l1")',
    });
  });

  it('does not warn when inner declaration uses a distinct name', () => {
    const spec = createFlowSpec(
      'test',
      [
        createLetNode('l1', 'outer', { type: 'literal', value: '1' }),
        createIfNode(
          'i1',
          'cond',
          [createLetNode('l2', 'inner', { type: 'literal', value: '2' })],
          [],
        ),
      ],
      [],
    );
    expect(lintFlow(spec)).not.toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('shadows variable from an outer scope'),
      }),
    );
  });

  it('does not warn for duplicate names in sibling scopes without outer declaration', () => {
    const spec = createFlowSpec(
      'test',
      [
        createIfNode(
          'i1',
          'cond',
          [createLetNode('l1', 'name', { type: 'literal', value: 'then' })],
          [createLetNode('l2', 'name', { type: 'literal', value: 'else' })],
        ),
      ],
      [],
    );
    expect(lintFlow(spec)).not.toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('shadows variable from an outer scope'),
      }),
    );
  });

  it('does not warn for top-level reassignment of the same variable name', () => {
    const spec = createFlowSpec(
      'test',
      [
        createLetNode('l1', 'name', { type: 'literal', value: 'first' }),
        createLetNode('l2', 'name', { type: 'literal', value: 'second' }),
      ],
      [],
    );
    expect(lintFlow(spec)).not.toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('shadows variable from an outer scope'),
      }),
    );
  });
});

describe('H-DX-010: infinite loop lint warnings', () => {
  it('warns when while with tests_fail has no run node', () => {
    const spec = createFlowSpec(
      'test',
      [createWhileNode('w1', 'tests_fail', [createPromptNode('p1', 'fix it')], 5)],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'w1',
      message: '"tests_fail" loop body has no run: node — condition may never change',
    });
  });

  it('warns when until with tests_pass has no run node', () => {
    const spec = createFlowSpec(
      'test',
      [createUntilNode('u1', 'tests_pass', [createPromptNode('p1', 'fix it')], 5)],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'u1',
      message: '"tests_pass" loop body has no run: node — condition may never change',
    });
  });

  it('warns when while with command_failed has no run node', () => {
    const spec = createFlowSpec(
      'test',
      [createWhileNode('w1', 'command_failed', [createPromptNode('p1', 'fix')], 5)],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'w1',
      message: '"command_failed" loop body has no run: node — condition may never change',
    });
  });

  it('no warning when while with tests_fail has run node in body', () => {
    const spec = createFlowSpec(
      'test',
      [
        createWhileNode(
          'w1',
          'tests_fail',
          [createPromptNode('p1', 'fix it'), createRunNode('r1', 'npm test')],
          5,
        ),
      ],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).not.toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('condition may never change') }),
    );
  });

  it('no warning when while with tests_fail has run node nested in if', () => {
    const spec = createFlowSpec(
      'test',
      [
        createWhileNode(
          'w1',
          'tests_fail',
          [createIfNode('i1', 'cond', [createRunNode('r1', 'npm test')], [])],
          5,
        ),
      ],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).not.toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('condition may never change') }),
    );
  });

  it('no warning when condition does not reference state-changing predicate', () => {
    const spec = createFlowSpec(
      'test',
      [createWhileNode('w1', 'some_custom_flag', [createPromptNode('p1', 'do it')], 5)],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).not.toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('condition may never change') }),
    );
  });

  it('warns on compound condition with state-changing predicate', () => {
    const spec = createFlowSpec(
      'test',
      [createWhileNode('w1', 'tests_fail and lint_fail', [createPromptNode('p1', 'fix')], 5)],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'w1',
      message: '"tests_fail and lint_fail" loop body has no run: node — condition may never change',
    });
  });

  it('no warning when body has let with run source (counts as run)', () => {
    const spec = createFlowSpec(
      'test',
      [
        createWhileNode(
          'w1',
          'command_failed',
          [createLetNode('l1', 'out', { type: 'run', command: 'npm test' })],
          5,
        ),
      ],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).not.toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('condition may never change') }),
    );
  });

  it('no warning when body has run node nested in try', () => {
    const spec = createFlowSpec(
      'test',
      [
        createUntilNode(
          'u1',
          'command_succeeded',
          [
            createTryNode('t1', [createRunNode('r1', 'npm test')], 'command_failed', [
              createPromptNode('p1', 'fix'),
            ]),
          ],
          5,
        ),
      ],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).not.toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('condition may never change') }),
    );
  });

  it('no warning when body has run node inside spawn (spawn body branch)', () => {
    const spec = createFlowSpec(
      'test',
      [
        createWhileNode(
          'w1',
          'tests_fail',
          [createSpawnNode('s1', 'worker', [createRunNode('r1', 'npm test')])],
          5,
        ),
      ],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).not.toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('condition may never change') }),
    );
  });

  it('no warning when until body has run inside spawn', () => {
    const spec = createFlowSpec(
      'test',
      [
        createUntilNode(
          'u1',
          'command_succeeded',
          [createSpawnNode('s1', 'task', [createRunNode('r1', 'echo ok')])],
          5,
        ),
      ],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).not.toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('condition may never change') }),
    );
  });

  it('warns when spawn body has no run node (still no run in loop)', () => {
    const spec = createFlowSpec(
      'test',
      [
        createWhileNode(
          'w1',
          'tests_fail',
          [createSpawnNode('s1', 'worker', [createPromptNode('p1', 'just a prompt')])],
          5,
        ),
      ],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({
      nodeId: 'w1',
      message: '"tests_fail" loop body has no run: node — condition may never change',
    });
  });

  it('no warning when body has let-run inside nested foreach', () => {
    const spec = createFlowSpec(
      'test',
      [
        createWhileNode(
          'w1',
          'tests_fail',
          [
            createForeachNode(
              'f1',
              'item',
              'a b',
              [createLetNode('l1', 'out', { type: 'run', command: 'echo hi' })],
              10,
            ),
          ],
          5,
        ),
      ],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).not.toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('condition may never change') }),
    );
  });
});

describe('continue node lint warnings', () => {
  it('warns on continue outside of loop', () => {
    const spec = createFlowSpec('test', [createContinueNode('c1')], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({ nodeId: 'c1', message: 'Continue outside of loop' });
  });

  it('no warning for continue inside while loop', () => {
    const spec = createFlowSpec(
      'test',
      [createWhileNode('w1', 'true', [createContinueNode('c1')], 5)],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).not.toContainEqual(
      expect.objectContaining({ message: 'Continue outside of loop' }),
    );
  });

  it('no warning for continue inside foreach loop', () => {
    const spec = createFlowSpec(
      'test',
      [createForeachNode('f1', 'item', 'a b c', [createContinueNode('c1')], 10)],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).not.toContainEqual(
      expect.objectContaining({ message: 'Continue outside of loop' }),
    );
  });

  it('warns on continue inside spawn (spawn resets insideLoop)', () => {
    const spec = createFlowSpec(
      'test',
      [
        createForeachNode(
          'f1',
          'item',
          'a b c',
          [createSpawnNode('s1', 'task', [createContinueNode('c1')])],
          10,
        ),
      ],
      [],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual({ nodeId: 'c1', message: 'Continue outside of loop' });
  });
});

describe('H-SEC-007: gaslighting lint rule', () => {
  it('warns when all run nodes are inside if blocks and gates reference tests_pass', () => {
    const spec = createFlowSpec(
      'test',
      [
        createIfNode('i1', 'command_failed', [createRunNode('r1', 'npm test')], []),
        createPromptNode('p1', 'fix it'),
      ],
      [createCompletionGate('tests_pass')],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('agent could skip execution entirely'),
      }),
    );
  });

  it('no warning when run node is unconditional', () => {
    const spec = createFlowSpec(
      'test',
      [createRunNode('r1', 'npm test'), createPromptNode('p1', 'fix it')],
      [createCompletionGate('tests_pass')],
    );
    const warnings = lintFlow(spec);
    expect(warnings).not.toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('agent could skip execution entirely'),
      }),
    );
  });

  it('no warning when gates do not reference side-effect predicates', () => {
    const spec = createFlowSpec(
      'test',
      [createIfNode('i1', 'cond', [createRunNode('r1', 'npm test')], [])],
      [createCompletionGate('file_exists report.txt')],
    );
    const warnings = lintFlow(spec);
    expect(warnings).not.toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('agent could skip execution entirely'),
      }),
    );
  });

  it('no warning when there are no run nodes at all', () => {
    const spec = createFlowSpec(
      'test',
      [createPromptNode('p1', 'just prompts')],
      [createCompletionGate('tests_pass')],
    );
    const warnings = lintFlow(spec);
    expect(warnings).not.toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('agent could skip execution entirely'),
      }),
    );
  });

  it('warns with let-run inside conditional', () => {
    const spec = createFlowSpec(
      'test',
      [
        createIfNode(
          'i1',
          'cond',
          [createLetNode('l1', 'out', { type: 'run', command: 'npm test' })],
          [],
        ),
      ],
      [createCompletionGate('command_succeeded')],
    );
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('agent could skip execution entirely'),
      }),
    );
  });
});

describe('lintFlow — race / foreach_spawn / remember / send / receive nodes', () => {
  it('warns on empty race node', () => {
    const spec = createFlowSpec('test', [createRaceNode('r1', [])], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('Empty race') }),
    );
  });

  it('no warnings for race with spawn children', () => {
    const spawn = createSpawnNode('s1', 'worker', [createPromptNode('p1', 'go')]);
    const spec = createFlowSpec('test', [createRaceNode('r1', [spawn])], []);
    expect(lintFlow(spec)).not.toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('Empty race') }),
    );
  });

  it('warns on empty foreach_spawn body', () => {
    const spec = createFlowSpec('test', [createForeachSpawnNode('fs1', 'item', 'items', [])], []);
    const warnings = lintFlow(spec);
    expect(warnings).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('Empty foreach_spawn') }),
    );
  });

  it('no warnings for foreach_spawn with body', () => {
    const spec = createFlowSpec(
      'test',
      [createForeachSpawnNode('fs1', 'item', 'items', [createPromptNode('p1', 'process ${item}')])],
      [],
    );
    expect(lintFlow(spec)).not.toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('Empty foreach_spawn') }),
    );
  });

  it('no warnings for remember, send, receive nodes', () => {
    const spec = createFlowSpec(
      'test',
      [
        createRememberNode('m1', 'some fact'),
        createSendNode('snd1', 'parent', 'hello'),
        createReceiveNode('rcv1', 'msg', 'parent'),
      ],
      [],
    );
    expect(lintFlow(spec)).toEqual([]);
  });

  it('foreach_spawn defines its variable (no unresolved-var warning)', () => {
    const spec = createFlowSpec(
      'test',
      [createForeachSpawnNode('fs1', 'item', 'a b c', [createPromptNode('p1', 'process ${item}')])],
      [],
    );
    expect(lintFlow(spec)).not.toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('item') }),
    );
  });

  it('receive defines its variable (no unresolved-var warning)', () => {
    const spec = createFlowSpec(
      'test',
      [createReceiveNode('rcv1', 'msg', 'parent'), createPromptNode('p1', 'got: ${msg}')],
      [],
    );
    expect(lintFlow(spec)).not.toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('msg') }),
    );
  });
});
