import { describe, it, expect } from 'vitest';
import { extractVariableDeps, sliceVariablesForCompact, MANDATORY_VARS } from './variable-deps.js';
import { createSessionState } from './session-state.js';
import { createFlowSpec, createCompletionGate } from './flow-spec.js';
import {
  createPromptNode,
  createRunNode,
  createWhileNode,
  createIfNode,
  createLetNode,
  createForeachNode,
  createBreakNode,
  createContinueNode,
  createAwaitNode,
  createUntilNode,
} from './flow-node.js';

function makeSpec(nodes: Parameters<typeof createFlowSpec>[1], gates: string[] = []) {
  return createFlowSpec(
    'test goal',
    nodes,
    gates.map((g) => createCompletionGate(g)),
  );
}

// ── extractVariableDeps ──────────────────────────────────────────────────────

describe('extractVariableDeps', () => {
  it('extracts ${var} references from prompt node', () => {
    const node = createPromptNode('p1', 'Hello ${name}, your id is ${id}');
    const spec = makeSpec([node]);
    const deps = extractVariableDeps(node, spec)!;
    expect(deps).not.toBeNull();
    expect(deps.has('name')).toBe(true);
    expect(deps.has('id')).toBe(true);
  });

  it('extracts ${var} references from run node', () => {
    const node = createRunNode('r1', 'echo ${message}');
    const spec = makeSpec([node]);
    const deps = extractVariableDeps(node, spec)!;
    expect(deps.has('message')).toBe(true);
  });

  it('extracts condition variables from while node', () => {
    const node = createWhileNode('w1', '${count} < 5', [createPromptNode('p1', 'work')], 5);
    const spec = makeSpec([node]);
    const deps = extractVariableDeps(node, spec)!;
    expect(deps.has('count')).toBe(true);
  });

  it('extracts condition variables from until node', () => {
    const node = createUntilNode('u1', 'done == "true"', [createRunNode('r1', 'work')], 5);
    const spec = makeSpec([node]);
    const deps = extractVariableDeps(node, spec)!;
    expect(deps.has('done')).toBe(true);
  });

  it('extracts condition variables from if node', () => {
    const node = createIfNode(
      'i1',
      'command_failed',
      [createPromptNode('p1', 'fix')],
      [createPromptNode('p2', 'continue')],
    );
    const spec = makeSpec([node]);
    const deps = extractVariableDeps(node, spec)!;
    expect(deps.has('command_failed')).toBe(true);
  });

  it('includes assigned variable name for let nodes', () => {
    const node = createLetNode('l1', 'result', { type: 'literal', value: 'hello' });
    const spec = makeSpec([node]);
    const deps = extractVariableDeps(node, spec)!;
    expect(deps.has('result')).toBe(true);
  });

  it('extracts references from let-run command', () => {
    const node = createLetNode('l1', 'out', { type: 'run', command: 'cat ${file}' });
    const spec = makeSpec([node]);
    const deps = extractVariableDeps(node, spec)!;
    expect(deps.has('out')).toBe(true);
    expect(deps.has('file')).toBe(true);
  });

  it('extracts references from let-prompt text', () => {
    const node = createLetNode('l1', 'answer', { type: 'prompt', text: 'What is ${question}?' });
    const spec = makeSpec([node]);
    const deps = extractVariableDeps(node, spec)!;
    expect(deps.has('answer')).toBe(true);
    expect(deps.has('question')).toBe(true);
  });

  it('includes variable name for foreach node', () => {
    const node = createForeachNode('f1', 'item', '${items}', [createPromptNode('p1', 'process')]);
    const spec = makeSpec([node]);
    const deps = extractVariableDeps(node, spec)!;
    expect(deps.has('item')).toBe(true);
    expect(deps.has('items')).toBe(true);
  });

  it('always includes mandatory runtime vars', () => {
    const node = createPromptNode('p1', 'plain text');
    const spec = makeSpec([node]);
    const deps = extractVariableDeps(node, spec)!;
    for (const v of MANDATORY_VARS) {
      expect(deps.has(v)).toBe(true);
    }
  });

  it('returns null for uncertain interpolation syntax', () => {
    const node = createPromptNode('p1', 'nested ${${inner}}');
    const spec = makeSpec([node]);
    const deps = extractVariableDeps(node, spec);
    expect(deps).toBeNull();
  });

  it('returns empty direct refs + mandatory for break node', () => {
    const node = createBreakNode('b1');
    const spec = makeSpec([node]);
    const deps = extractVariableDeps(node, spec)!;
    // Only mandatory vars should be present
    for (const v of MANDATORY_VARS) {
      expect(deps.has(v)).toBe(true);
    }
    // No extra variable refs beyond mandatory
    const nonMandatory = [...deps].filter((v) => !MANDATORY_VARS.has(v));
    expect(nonMandatory).toHaveLength(0);
  });

  it('returns empty direct refs + mandatory for continue node', () => {
    const node = createContinueNode('c1');
    const spec = makeSpec([node]);
    const deps = extractVariableDeps(node, spec)!;
    const nonMandatory = [...deps].filter((v) => !MANDATORY_VARS.has(v));
    expect(nonMandatory).toHaveLength(0);
  });

  it('returns empty direct refs + mandatory for await node', () => {
    const node = createAwaitNode('a1', 'worker');
    const spec = makeSpec([node]);
    const deps = extractVariableDeps(node, spec)!;
    const nonMandatory = [...deps].filter((v) => !MANDATORY_VARS.has(v));
    expect(nonMandatory).toHaveLength(0);
  });

  it('resolves transitive dependencies', () => {
    // let base = "value"
    // let derived = run "echo ${base}"
    // prompt: Result is ${derived}
    const letBase = createLetNode('l1', 'base', { type: 'literal', value: 'value' });
    const letDerived = createLetNode('l2', 'derived', {
      type: 'run',
      command: 'echo ${base}',
    });
    const prompt = createPromptNode('p1', 'Result is ${derived}');
    const spec = makeSpec([letBase, letDerived, prompt]);

    const deps = extractVariableDeps(prompt, spec)!;
    expect(deps.has('derived')).toBe(true);
    // Transitive: derived depends on base
    expect(deps.has('base')).toBe(true);
  });

  it('handles circular transitive deps without infinite loop', () => {
    // let a = run "echo ${b}"
    // let b = run "echo ${a}"
    const letA = createLetNode('la', 'a', { type: 'run', command: 'echo ${b}' });
    const letB = createLetNode('lb', 'b', { type: 'run', command: 'echo ${a}' });
    const prompt = createPromptNode('p1', '${a}');
    const spec = makeSpec([letA, letB, prompt]);

    const deps = extractVariableDeps(prompt, spec)!;
    expect(deps.has('a')).toBe(true);
    expect(deps.has('b')).toBe(true);
  });
});

// ── sliceVariablesForCompact ─────────────────────────────────────────────────

describe('sliceVariablesForCompact', () => {
  it('returns empty for state with no variables', () => {
    const spec = makeSpec([createPromptNode('p1', 'hello')]);
    const state = createSessionState('s1', spec);
    const result = sliceVariablesForCompact(state);
    expect(result.variables).toHaveLength(0);
    expect(result.fallback).toBe(false);
  });

  it('slices variables to those referenced by current node', () => {
    const spec = makeSpec([
      createLetNode('l1', 'used', { type: 'literal', value: 'yes' }),
      createPromptNode('p1', 'Value is ${used}'),
    ]);
    const state = {
      ...createSessionState('s1', spec),
      currentNodePath: [1],
      variables: { used: 'yes', unused: 'no', irrelevant: 'data' },
    };
    const result = sliceVariablesForCompact(state);
    expect(result.fallback).toBe(false);
    const keys = result.variables.map(([k]) => k);
    expect(keys).toContain('used');
    expect(keys).not.toContain('unused');
    expect(keys).not.toContain('irrelevant');
  });

  it('hides auto-variables (last_exit_code, _index, _length suffixes)', () => {
    const spec = makeSpec([createPromptNode('p1', 'hello ${name}')]);
    const state = {
      ...createSessionState('s1', spec),
      currentNodePath: [0],
      variables: {
        name: 'Alice',
        last_exit_code: '0',
        last_stdout: 'output',
        last_stderr: '',
        items_index: '2',
        items_length: '5',
      },
    };
    const result = sliceVariablesForCompact(state);
    const keys = result.variables.map(([k]) => k);
    expect(keys).toContain('name');
    expect(keys).not.toContain('last_exit_code');
    expect(keys).not.toContain('last_stdout');
    expect(keys).not.toContain('last_stderr');
    expect(keys).not.toContain('items_index');
    expect(keys).not.toContain('items_length');
  });

  it('falls back to full set on uncertain interpolation syntax', () => {
    const spec = makeSpec([createPromptNode('p1', 'nested ${${inner}}')]);
    const state = {
      ...createSessionState('s1', spec),
      currentNodePath: [0],
      variables: { inner: 'x', other: 'y' },
    };
    const result = sliceVariablesForCompact(state);
    expect(result.fallback).toBe(true);
    const keys = result.variables.map(([k]) => k);
    expect(keys).toContain('inner');
    expect(keys).toContain('other');
  });

  it('falls back to full set when slicing produces empty result with visible vars', () => {
    // Node has no variable references, but state has visible variables
    const spec = makeSpec([createRunNode('r1', 'echo hello')]);
    const state = {
      ...createSessionState('s1', spec),
      currentNodePath: [0],
      variables: { myvar: 'value' },
    };
    const result = sliceVariablesForCompact(state);
    // myvar is not referenced by the run node, but since slicing would produce
    // empty while visible vars exist, it falls back
    expect(result.fallback).toBe(true);
    const keys = result.variables.map(([k]) => k);
    expect(keys).toContain('myvar');
  });

  it('includes variables from ancestor nodes on execution path', () => {
    const spec = makeSpec([
      createWhileNode(
        'w1',
        '${counter} < 3',
        [createPromptNode('p1', 'Iteration ${counter}: do ${task}')],
        5,
      ),
    ]);
    const state = {
      ...createSessionState('s1', spec),
      currentNodePath: [0, 0], // Inside the while body at the prompt
      variables: { counter: '1', task: 'build', unrelated: 'stuff' },
    };
    const result = sliceVariablesForCompact(state);
    expect(result.fallback).toBe(false);
    const keys = result.variables.map(([k]) => k);
    expect(keys).toContain('counter'); // Referenced by while condition and prompt
    expect(keys).toContain('task'); // Referenced by prompt
    expect(keys).not.toContain('unrelated');
  });

  it('includes transitive dependencies in sliced output', () => {
    const spec = makeSpec([
      createLetNode('l1', 'base', { type: 'literal', value: '42' }),
      createLetNode('l2', 'derived', { type: 'run', command: 'echo ${base}' }),
      createPromptNode('p1', 'Result: ${derived}'),
    ]);
    const state = {
      ...createSessionState('s1', spec),
      currentNodePath: [2], // At the prompt node
      variables: { base: '42', derived: '42', other: 'irrelevant' },
    };
    const result = sliceVariablesForCompact(state);
    expect(result.fallback).toBe(false);
    const keys = result.variables.map(([k]) => k);
    expect(keys).toContain('derived'); // Direct reference
    expect(keys).toContain('base'); // Transitive dep of derived
    expect(keys).not.toContain('other');
  });

  it('sorts output alphabetically', () => {
    const spec = makeSpec([createPromptNode('p1', '${zebra} ${alpha} ${middle}')]);
    const state = {
      ...createSessionState('s1', spec),
      currentNodePath: [0],
      variables: { zebra: 'z', alpha: 'a', middle: 'm' },
    };
    const result = sliceVariablesForCompact(state);
    const keys = result.variables.map(([k]) => k);
    expect(keys).toEqual(['alpha', 'middle', 'zebra']);
  });
});

// ── Integration: renderFlowCompact with variable slicing ─────────────────────

import { renderFlowCompact } from './render-flow.js';

describe('renderFlowCompact includes sliced variables', () => {
  it('renders vars line in compact output when variables exist', () => {
    const spec = makeSpec([createPromptNode('p1', 'Hello ${name}')]);
    const state = {
      ...createSessionState('s1', spec),
      currentNodePath: [0],
      variables: { name: 'Alice' },
    };
    const output = renderFlowCompact(state);
    expect(output).toContain('vars:');
    expect(output).toContain('name=Alice');
  });

  it('omits vars line when no visible variables', () => {
    const spec = makeSpec([createPromptNode('p1', 'plain text')]);
    const state = createSessionState('s1', spec);
    const output = renderFlowCompact(state);
    expect(output).not.toContain('vars:');
  });

  it('truncates long variable values in compact output', () => {
    const spec = makeSpec([createPromptNode('p1', '${data}')]);
    const longValue = 'x'.repeat(50);
    const state = {
      ...createSessionState('s1', spec),
      currentNodePath: [0],
      variables: { data: longValue },
    };
    const output = renderFlowCompact(state);
    expect(output).toContain('data=');
    expect(output).toContain('...');
    // Value should be truncated to 30 chars max
    const varsLine = output.split('\n').find((l) => l.startsWith('vars:'))!;
    expect(varsLine.length).toBeLessThan(100);
  });
});
