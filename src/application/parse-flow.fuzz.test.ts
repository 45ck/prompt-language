import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseFlow } from './parse-flow.js';
import type { FlowSpec } from '../domain/flow-spec.js';

/**
 * Helper: attempt to parse and return either the result or the caught error.
 * Used to distinguish well-formed errors from crashes (TypeError, RangeError, etc.).
 */
function safeParse(input: string): { result: FlowSpec } | { error: unknown } {
  try {
    return { result: parseFlow(input) };
  } catch (e) {
    return { error: e };
  }
}

/**
 * Assert that parsing either succeeds or throws a well-formed Error
 * (not TypeError, RangeError, or undefined-access crashes).
 */
function assertNoCrash(input: string): void {
  const outcome = safeParse(input);
  if ('error' in outcome) {
    const e = outcome.error;
    expect(e).not.toBeInstanceOf(TypeError);
    expect(e).not.toBeInstanceOf(RangeError);
    expect(e).toBeInstanceOf(Error);
    const msg = (e as Error).message;
    expect(msg).toBeDefined();
    expect(msg).not.toContain('undefined');
    expect(msg).not.toContain('Cannot read properties of');
  }
}

// ─── Section 1: Fuzz Harness (612d) ─────────────────────────────────────────

describe('Fuzz harness — parser crash resistance', () => {
  const nodeKinds = [
    'prompt',
    'run',
    'while',
    'until',
    'retry',
    'if',
    'try',
    'foreach',
    'spawn',
    'await',
    'break',
    'let',
    'var',
  ];

  /**
   * Build a minimal valid-ish single-line flow for each node kind.
   */
  function singleNodeFlow(kind: string): string {
    switch (kind) {
      case 'prompt':
        return 'flow:\n  prompt: test text';
      case 'run':
        return 'flow:\n  run: echo hello';
      case 'while':
        return 'flow:\n  while not done max 3\n    prompt: work\n  end';
      case 'until':
        return 'flow:\n  until done max 3\n    prompt: work\n  end';
      case 'retry':
        return 'flow:\n  retry max 2\n    run: echo ok\n  end';
      case 'if':
        return 'flow:\n  if tests_pass\n    prompt: yay\n  end';
      case 'try':
        return 'flow:\n  try\n    run: build\n  catch\n    prompt: fix\n  end';
      case 'foreach':
        return 'flow:\n  foreach x in "a b c"\n    prompt: do ${x}\n  end';
      case 'spawn':
        return 'flow:\n  spawn "worker"\n    prompt: do work\n  end';
      case 'await':
        return 'flow:\n  await all';
      case 'break':
        return 'flow:\n  while not done max 3\n    break\n  end';
      case 'let':
        return 'flow:\n  let x = "hello"';
      case 'var':
        return 'flow:\n  var x = "hello"';
      default:
        return `flow:\n  prompt: ${kind}`;
    }
  }

  it.each(nodeKinds)('single-node flow for "%s" parses without crashing', (kind) => {
    assertNoCrash(singleNodeFlow(kind));
  });

  it('swarm surface in preserve mode parses without crashing', () => {
    assertNoCrash(`flow:
  swarm checkout_fix
    role frontend
      prompt: work
      return \${summary}
    end
    flow:
      start frontend
      await all
    end
  end`);
    const spec = parseFlow(
      `flow:
  swarm checkout_fix
    role frontend
      prompt: work
      return \${summary}
    end
    flow:
      start frontend
      await all
    end
  end`,
      { swarmHandling: 'preserve' },
    );
    expect(spec.nodes[0]?.kind).toBe('swarm');
  });

  it('deeply nested container nodes (10 levels) do not crash', () => {
    // Nest while > if > try > while > if > try > while > if > try > while
    const containers = ['while', 'if', 'try'];
    let flow = 'flow:\n';
    const indent = (level: number) => '  '.repeat(level + 1);
    const closers: string[] = [];

    for (let i = 0; i < 10; i++) {
      const container = containers[i % containers.length]!;
      const ind = indent(i);
      switch (container) {
        case 'while':
          flow += `${ind}while not done max 2\n`;
          closers.push(`${ind}end`);
          break;
        case 'if':
          flow += `${ind}if tests_pass\n`;
          closers.push(`${ind}end`);
          break;
        case 'try':
          flow += `${ind}try\n`;
          closers.push(`${ind}end`);
          break;
      }
    }
    // Add a leaf node at the deepest level
    flow += `${'  '.repeat(11)}prompt: deep leaf\n`;
    // Close all containers in reverse
    for (let i = closers.length - 1; i >= 0; i--) {
      flow += `${closers[i]}\n`;
    }

    assertNoCrash(flow);
  });

  it('random alphanumeric variable names parse correctly', () => {
    const names = ['x', 'myVar', 'a1', 'var_name', '_private', 'UPPER', 'camelCase', 'a_b_c_d_e'];
    for (const name of names) {
      assertNoCrash(`flow:\n  let ${name} = "value"`);
    }
  });

  it('random condition expressions parse or give graceful errors', () => {
    const conditions = [
      'true',
      'false',
      'not done',
      'tests_pass',
      'x == 5',
      'x != "hello"',
      'a and b',
      'a or b',
      'not a and b or c',
      '${count} > 0',
      '${x} == ${y}',
      'x >= 10',
      'x <= 0',
    ];
    for (const cond of conditions) {
      assertNoCrash(`flow:\n  while ${cond} max 3\n    prompt: test\n  end`);
      assertNoCrash(`flow:\n  if ${cond}\n    prompt: test\n  end`);
      assertNoCrash(`flow:\n  until ${cond} max 3\n    prompt: test\n  end`);
    }
  });

  it('empty input returns empty result, not a crash', () => {
    assertNoCrash('');
    const outcome = safeParse('');
    expect('result' in outcome).toBe(true);
    if ('result' in outcome) {
      expect(outcome.result.nodes).toHaveLength(0);
    }
  });

  it('very long input (1000+ lines) does not hang or crash', () => {
    let flow = 'flow:\n';
    for (let i = 0; i < 1000; i++) {
      flow += `  prompt: line ${i}\n`;
    }
    assertNoCrash(flow);
    const outcome = safeParse(flow);
    expect('result' in outcome).toBe(true);
    if ('result' in outcome) {
      expect(outcome.result.nodes).toHaveLength(1000);
    }
  }, 10000);

  it('input with only whitespace/newlines does not crash', () => {
    assertNoCrash('   ');
    assertNoCrash('\n\n\n');
    assertNoCrash('  \n  \n  ');
    assertNoCrash('\t\t\t');
    assertNoCrash('\n\t \n  \t\n');
  });

  it('input with random Unicode characters does not crash', () => {
    // cspell:disable
    const unicodeInputs = [
      'flow:\n  prompt: 你好世界',
      'flow:\n  prompt: 🎉🚀✨',
      'flow:\n  prompt: Ñoño café résumé',
      'flow:\n  prompt: العربية',
      'flow:\n  prompt: \u0000\u0001\u0002',
      'flow:\n  prompt: null\x00byte',
      'Goal: test\n\nflow:\n  prompt: Ünîcödé ïs fün',
    ];
    // cspell:enable
    for (const input of unicodeInputs) {
      assertNoCrash(input);
    }
  });

  it('50 random flow combinations do not throw unhandled exceptions', () => {
    const leafNodes = [
      '  prompt: do something',
      '  run: echo test',
      '  let x = "value"',
      '  var y = run "echo hi"',
      '  let z = prompt "ask something"',
      '  break',
      '  await all',
      '  let items = []',
      '  let items += "val"',
    ];

    const containerStarts = [
      { open: '  while not done max 2', close: '  end' },
      { open: '  until done max 2', close: '  end' },
      { open: '  retry max 2', close: '  end' },
      { open: '  if tests_pass', close: '  end' },
      { open: '  try', close: '  end' },
      { open: '  foreach x in "a b"', close: '  end' },
      { open: '  spawn "worker"', close: '  end' },
    ];

    // Pseudorandom generator (deterministic for reproducibility)
    let seed = 42;
    function rand(max: number): number {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % max;
    }

    for (let i = 0; i < 50; i++) {
      let flow = 'flow:\n';
      const numNodes = 1 + rand(6);
      for (let j = 0; j < numNodes; j++) {
        if (rand(3) === 0 && containerStarts.length > 0) {
          const container = containerStarts[rand(containerStarts.length)]!;
          flow += `${container.open}\n`;
          // Add a child leaf
          const leaf = leafNodes[rand(leafNodes.length)]!;
          flow += `  ${leaf}\n`;
          flow += `${container.close}\n`;
        } else {
          const leaf = leafNodes[rand(leafNodes.length)]!;
          flow += `${leaf}\n`;
        }
      }
      assertNoCrash(flow);
    }
  });
});

describe('Property-based fuzzing — parser safety', () => {
  const noNewlines = fc
    .string()
    .filter((s) => !/[\r\n]/.test(s))
    .filter((s) => s.trim().length > 0);
  const safePromptText = noNewlines.filter((s) => !/^\s|\s$/.test(s) && !s.includes('#'));

  it('prompt text with shell-special characters and unicode round-trips without crashing', () => {
    fc.assert(
      fc.property(safePromptText, (text) => {
        const spec = parseFlow(`flow:\n  prompt: ${text}`);
        expect(spec.nodes).toHaveLength(1);
        expect(spec.nodes[0]!.kind).toBe('prompt');
        expect((spec.nodes[0] as { text: string }).text).toBe(text);
      }),
      { numRuns: 1000 },
    );
  });

  it('indentation variations do not crash or change the node shape', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 8 }), (indent) => {
        const pad = ' '.repeat(indent);
        const spec = parseFlow(`${pad}flow:\n${pad}  prompt: hello`);
        expect(spec.nodes.length).toBeGreaterThanOrEqual(1);
        expect(spec.nodes[0]!.kind).toBe('prompt');
      }),
      { numRuns: 1000 },
    );
  });

  it('deeply nested valid container flows do not crash', () => {
    fc.assert(
      fc.property(fc.integer({ min: 10, max: 16 }), (depth) => {
        let flow = 'flow:\n';
        for (let i = 0; i < depth; i++) {
          flow += `${'  '.repeat(i + 1)}while not done max 2\n`;
        }
        flow += `${'  '.repeat(depth + 1)}prompt: leaf\n`;
        for (let i = depth - 1; i >= 0; i--) {
          flow += `${'  '.repeat(i + 1)}end\n`;
        }
        assertNoCrash(flow);
      }),
      { numRuns: 1000 },
    );
  });

  it('long variable names and values parse or warn gracefully', () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 120 })
          .filter((s) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s)),
        noNewlines,
        (name, value) => {
          assertNoCrash(`flow:\n  let ${name} = "${value.replace(/"/g, '\\"')}"`);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('random valid single-node flows do not throw unhandled exceptions', () => {
    const kinds = ['prompt', 'run', 'while', 'until', 'retry', 'if', 'try', 'foreach'] as const;
    fc.assert(
      fc.property(fc.constantFrom(...kinds), noNewlines, (kind, text) => {
        let flow = 'flow:\n';
        switch (kind) {
          case 'prompt':
            flow += `  prompt: ${text}`;
            break;
          case 'run':
            flow += `  run: echo ${text}`;
            break;
          case 'while':
            flow += `  while not done max 2\n    prompt: ${text}\n  end`;
            break;
          case 'until':
            flow += `  until done max 2\n    prompt: ${text}\n  end`;
            break;
          case 'retry':
            flow += `  retry max 2\n    run: echo ${text}\n  end`;
            break;
          case 'if':
            flow += `  if tests_pass\n    prompt: ${text}\n  end`;
            break;
          case 'try':
            flow += `  try\n    run: echo ${text}\n  catch\n    prompt: ${text}\n  end`;
            break;
          case 'foreach':
            flow += `  foreach item in "a b c"\n    prompt: ${text}\n  end`;
            break;
        }
        assertNoCrash(flow);
      }),
      { numRuns: 1000 },
    );
  });
});

// ─── Section 2: Edge Case Fixtures (42b7) ───────────────────────────────────

describe('Edge case fixtures — parser boundary conditions', () => {
  it('Unicode in prompt text parses correctly', () => {
    const spec = parseFlow('flow:\n  prompt: Say こんにちは');
    expect(spec.nodes).toHaveLength(1);
    expect(spec.nodes[0]!.kind).toBe('prompt');
    expect((spec.nodes[0] as { text: string }).text).toBe('Say こんにちは');
  });

  it('Unicode in variable values parses correctly', () => {
    const spec = parseFlow('flow:\n  let greeting = "こんにちは"');
    expect(spec.nodes).toHaveLength(1);
    expect(spec.nodes[0]!.kind).toBe('let');
    expect((spec.nodes[0] as { source: { value: string } }).source.value).toBe('こんにちは');
  });

  it('Unicode in variable names is handled gracefully', () => {
    // May reject or accept — should not crash
    assertNoCrash('flow:\n  let café = "latte"');
  });

  it('deeply nested 10 levels: while > if > try > ...', () => {
    const dsl = `flow:
  while not a max 2
    if b
      try
        while not c max 2
          if d
            try
              while not e max 2
                if f
                  try
                    prompt: deep leaf
                  end
                end
              end
            end
          end
        end
      end
    end
  end`;
    const spec = parseFlow(dsl);
    expect(spec.nodes).toHaveLength(1);
    expect(spec.nodes[0]!.kind).toBe('while');
  });

  it('empty body for while: no children', () => {
    const spec = parseFlow('flow:\n  while not done max 3\n  end');
    expect(spec.nodes).toHaveLength(1);
    expect(spec.nodes[0]!.kind).toBe('while');
    expect((spec.nodes[0] as unknown as { body: unknown[] }).body).toHaveLength(0);
  });

  it('empty body for until: no children', () => {
    const spec = parseFlow('flow:\n  until done max 3\n  end');
    expect(spec.nodes).toHaveLength(1);
    expect((spec.nodes[0] as unknown as { body: unknown[] }).body).toHaveLength(0);
  });

  it('empty body for retry: no children', () => {
    const spec = parseFlow('flow:\n  retry max 3\n  end');
    expect(spec.nodes).toHaveLength(1);
    expect((spec.nodes[0] as unknown as { body: unknown[] }).body).toHaveLength(0);
  });

  it('empty body for if: no children in then branch', () => {
    const spec = parseFlow('flow:\n  if tests_pass\n  end');
    expect(spec.nodes).toHaveLength(1);
    expect((spec.nodes[0] as unknown as { thenBranch: unknown[] }).thenBranch).toHaveLength(0);
  });

  it('empty body for try: no children in body', () => {
    const spec = parseFlow('flow:\n  try\n  end');
    expect(spec.nodes).toHaveLength(1);
    expect((spec.nodes[0] as unknown as { body: unknown[] }).body).toHaveLength(0);
  });

  it('empty body for foreach: no children', () => {
    const spec = parseFlow('flow:\n  foreach x in "a b c"\n  end');
    expect(spec.nodes).toHaveLength(1);
    expect((spec.nodes[0] as unknown as { body: unknown[] }).body).toHaveLength(0);
  });

  it('empty body for spawn: no children', () => {
    const spec = parseFlow('flow:\n  spawn "worker"\n  end');
    expect(spec.nodes).toHaveLength(1);
    expect((spec.nodes[0] as unknown as { body: unknown[] }).body).toHaveLength(0);
  });

  it('maximum-length single line (10,000 chars) does not crash', () => {
    const longText = 'x'.repeat(10000);
    assertNoCrash(`flow:\n  prompt: ${longText}`);
    const outcome = safeParse(`flow:\n  prompt: ${longText}`);
    expect('result' in outcome).toBe(true);
    if ('result' in outcome) {
      expect((outcome.result.nodes[0] as { text: string }).text).toBe(longText);
    }
  });

  it('mixed tabs and spaces indentation does not crash', () => {
    const dsl = 'flow:\n\tprompt: tab indented\n  prompt: space indented';
    assertNoCrash(dsl);
  });

  it('Windows CRLF line endings parse correctly', () => {
    const dsl =
      'Goal: test\r\n\r\nflow:\r\n  prompt: hello\r\n  run: echo ok\r\n\r\ndone when:\r\n  tests_pass';
    const spec = parseFlow(dsl);
    expect(spec.nodes).toHaveLength(2);
    expect(spec.completionGates.length).toBeGreaterThanOrEqual(1);
  });

  it('trailing whitespace on every line does not affect parsing', () => {
    const dsl = 'Goal: g   \n\nflow:   \n  prompt: first   \n  run: echo ok   ';
    const spec = parseFlow(dsl);
    expect(spec.nodes).toHaveLength(2);
  });

  it('flow with only comments results in empty nodes', () => {
    const dsl = 'flow:\n  # comment one\n  # comment two\n  # comment three';
    const spec = parseFlow(dsl);
    expect(spec.nodes).toHaveLength(0);
  });

  it('duplicate variable names both parse (last one wins at runtime)', () => {
    const dsl = 'flow:\n  let x = "a"\n  let x = "b"';
    const spec = parseFlow(dsl);
    expect(spec.nodes).toHaveLength(2);
    expect(spec.nodes[0]!.kind).toBe('let');
    expect(spec.nodes[1]!.kind).toBe('let');
  });

  it('reserved-looking variable name "if" is handled gracefully', () => {
    // "let if = ..." — the parser sees "let " then tries to find variable name
    assertNoCrash('flow:\n  let if = "test"');
  });

  it('reserved-looking variable name "while" is handled gracefully', () => {
    assertNoCrash('flow:\n  let while = "test"');
  });

  it('variable names with numbers parse correctly', () => {
    const spec = parseFlow('flow:\n  let var1 = "test"');
    expect(spec.nodes).toHaveLength(1);
    expect((spec.nodes[0] as { variableName: string }).variableName).toBe('var1');
  });

  it('empty string value parses correctly', () => {
    const spec = parseFlow('flow:\n  let x = ""');
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as { source: { type: string; value: string } };
    expect(node.source.type).toBe('literal');
    expect(node.source.value).toBe('');
  });

  it('string value with escaped quotes does not crash', () => {
    assertNoCrash('flow:\n  let x = "say \\"hello\\""');
  });

  it('foreach with empty iterable string does not crash', () => {
    assertNoCrash('flow:\n  foreach item in ""\n    prompt: ${item}\n  end');
  });

  it('nested variable interpolation syntax ${${var}} does not crash', () => {
    assertNoCrash('flow:\n  prompt: ${${var}}');
    const outcome = safeParse('flow:\n  prompt: ${${var}}');
    expect('result' in outcome).toBe(true);
    if ('result' in outcome) {
      // Parser should preserve the text as-is; interpolation is at runtime
      expect((outcome.result.nodes[0] as { text: string }).text).toBe('${${var}}');
    }
  });

  it('very long variable name (100+ chars) does not crash', () => {
    const longName = 'a'.repeat(120);
    assertNoCrash(`flow:\n  let ${longName} = "value"`);
    const outcome = safeParse(`flow:\n  let ${longName} = "value"`);
    expect('result' in outcome).toBe(true);
    if ('result' in outcome) {
      expect((outcome.result.nodes[0] as { variableName: string }).variableName).toBe(longName);
    }
  });

  it('flow: keyword indented with leading spaces still works', () => {
    const dsl = '  flow:\n    prompt: hello';
    const spec = parseFlow(dsl);
    // extractFlowBlock uses /^\s*flow:\s*\n/im so indented flow: should work
    expect(spec.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it('multiple "flow:" sections: only first is used', () => {
    const dsl = 'flow:\n  prompt: first\n\nflow:\n  prompt: second';
    const spec = parseFlow(dsl);
    // The regex matches the first "flow:" — second should be ignored or partially picked up
    assertNoCrash(dsl);
    expect(spec.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it('"done when:" without "flow:" parses gates only', () => {
    const dsl = 'Goal: fix\n\ndone when:\n  tests_pass';
    const spec = parseFlow(dsl);
    expect(spec.completionGates).toHaveLength(1);
    expect(spec.completionGates[0]!.predicate).toBe('tests_pass');
    expect(spec.nodes).toHaveLength(0);
  });

  it('"flow:" without "done when:" parses nodes only', () => {
    const dsl = 'flow:\n  prompt: work';
    const spec = parseFlow(dsl);
    expect(spec.nodes).toHaveLength(1);
    expect(spec.completionGates).toHaveLength(0);
  });

  it('if/else with multiple nodes in each branch', () => {
    const dsl = `flow:
  if tests_fail
    prompt: analyze
    run: npm test
    prompt: fix
  else
    prompt: celebrate
    run: npm run deploy
  end`;
    const spec = parseFlow(dsl);
    const node = spec.nodes[0] as unknown as { thenBranch: unknown[]; elseBranch: unknown[] };
    expect(node.thenBranch).toHaveLength(3);
    expect(node.elseBranch).toHaveLength(2);
  });

  it('try with catch condition string', () => {
    const dsl = `flow:
  try
    run: deploy
  catch deployment_failed
    prompt: rollback
  end`;
    const spec = parseFlow(dsl);
    const node = spec.nodes[0] as { catchCondition: string };
    expect(node.catchCondition).toBe('deployment_failed');
  });

  it('comment after node content is stripped', () => {
    const dsl = 'flow:\n  prompt: do work # this is a comment';
    const spec = parseFlow(dsl);
    expect(spec.nodes).toHaveLength(1);
    expect((spec.nodes[0] as { text: string }).text).toBe('do work');
  });

  it('only "end" keyword on a line (not inside container) does not crash', () => {
    assertNoCrash('flow:\n  end');
  });

  it('multiple consecutive "end" keywords do not crash', () => {
    assertNoCrash('flow:\n  end\n  end\n  end');
  });

  it('spawn with empty body parses', () => {
    const spec = parseFlow('flow:\n  spawn "empty-task"\n  end');
    expect(spec.nodes).toHaveLength(1);
    expect(spec.nodes[0]!.kind).toBe('spawn');
  });

  it('await without argument is handled gracefully', () => {
    assertNoCrash('flow:\n  await');
  });

  it('let with single-quoted value', () => {
    const spec = parseFlow("flow:\n  let x = 'hello'");
    expect(spec.nodes).toHaveLength(1);
    expect((spec.nodes[0] as { source: { value: string } }).source.value).toBe('hello');
  });

  it('foreach with variable reference as list expression', () => {
    const spec = parseFlow('flow:\n  foreach item in ${myList}\n    prompt: ${item}\n  end');
    expect(spec.nodes).toHaveLength(1);
    expect((spec.nodes[0] as { listExpression: string }).listExpression).toBe('${myList}');
  });

  it('whitespace-only lines between nodes are skipped', () => {
    const dsl = 'flow:\n  prompt: first\n  \n    \n  prompt: second';
    const spec = parseFlow(dsl);
    expect(spec.nodes).toHaveLength(2);
  });

  it('run node with very long command does not crash', () => {
    const longCmd = 'echo ' + 'x'.repeat(5000);
    assertNoCrash(`flow:\n  run: ${longCmd}`);
  });

  it('let with run source with complex command', () => {
    const spec = parseFlow('flow:\n  let output = run "cat file.txt | grep error | wc -l"');
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as { source: { type: string; command: string } };
    expect(node.source.type).toBe('run');
    expect(node.source.command).toBe('cat file.txt | grep error | wc -l');
  });

  it('goal with special characters does not crash', () => {
    assertNoCrash('Goal: fix the "auth" tests & deploy\n\nflow:\n  prompt: go');
    const spec = parseFlow('Goal: fix the "auth" tests & deploy\n\nflow:\n  prompt: go');
    expect(spec.goal).toBe('fix the "auth" tests & deploy');
  });

  it('gate predicate with file_exists and path argument', () => {
    const spec = parseFlow('flow:\n  prompt: work\n\ndone when:\n  file_exists output.txt');
    expect(spec.completionGates).toHaveLength(1);
    expect(spec.completionGates[0]!.predicate).toBe('file_exists output.txt');
  });

  it('multiple gates including custom gate', () => {
    const spec = parseFlow(
      'flow:\n  prompt: work\n\ndone when:\n  tests_pass\n  lint_pass\n  gate build_ok: npm run build',
    );
    expect(spec.completionGates).toHaveLength(3);
    expect(spec.completionGates[2]!.predicate).toBe('build_ok');
    expect(spec.completionGates[2]!.command).toBe('npm run build');
  });
});

// ─── Section 3: Error Message Quality (rtm0) ────────────────────────────────

describe('Error message quality — parse failure diagnostics', () => {
  it('missing "end" for while warns about auto-closed block', () => {
    const spec = parseFlow('flow:\n  while not done max 3\n    prompt: work');
    expect(spec.nodes).toHaveLength(1);
    expect(spec.nodes[0]!.kind).toBe('while');
    expect(spec.warnings.some((w) => /auto-closed|missing.*end/i.test(w))).toBe(true);
  });

  it('missing "end" for if warns about auto-closed block', () => {
    const spec = parseFlow('flow:\n  if tests_pass\n    prompt: yay');
    expect(spec.warnings.some((w) => /auto-closed|missing.*end/i.test(w))).toBe(true);
  });

  it('missing "end" for try warns about auto-closed block', () => {
    const spec = parseFlow('flow:\n  try\n    run: build');
    expect(spec.warnings.some((w) => /auto-closed|missing.*end/i.test(w))).toBe(true);
  });

  it('missing "end" for foreach warns about auto-closed block', () => {
    const spec = parseFlow('flow:\n  foreach x in "a b"\n    prompt: do ${x}');
    expect(spec.warnings.some((w) => /auto-closed|missing.*end/i.test(w))).toBe(true);
  });

  it('missing "end" for spawn warns about auto-closed block', () => {
    const spec = parseFlow('flow:\n  spawn "worker"\n    prompt: work');
    expect(spec.warnings.some((w) => /auto-closed|missing.*end/i.test(w))).toBe(true);
  });

  it('unknown node kind produces a warning mentioning the unknown keyword', () => {
    const spec = parseFlow('flow:\n  frobnicate the widget');
    expect(spec.warnings.some((w) => w.includes('Unknown keyword'))).toBe(true);
    expect(spec.warnings.some((w) => w.includes('frobnicate the widget'))).toBe(true);
  });

  it('unknown node kind is treated as prompt (graceful degradation)', () => {
    const spec = parseFlow('flow:\n  xyzzy plugh');
    expect(spec.nodes).toHaveLength(1);
    expect(spec.nodes[0]!.kind).toBe('prompt');
    expect((spec.nodes[0] as { text: string }).text).toBe('xyzzy plugh');
  });

  it('warnings include line number information', () => {
    const spec = parseFlow('flow:\n  frobnicate something');
    // The warn() function prepends "line N:" to messages
    expect(spec.warnings.some((w) => /^line \d+:/.test(w))).toBe(true);
  });

  it('warnings do not contain raw stack traces', () => {
    const spec = parseFlow('flow:\n  let x\n  frobnicate\n  while no_max\n    prompt: x\n  end');
    for (const w of spec.warnings) {
      expect(w).not.toMatch(/at \w+\s*\(/); // no "at functionName(" patterns
      expect(w).not.toContain('.ts:');
      expect(w).not.toContain('.js:');
    }
  });

  it('warnings are not generic "parse error" without context', () => {
    const spec = parseFlow('flow:\n  let x\n  frobnicate');
    for (const w of spec.warnings) {
      // Each warning should contain specific context, not just "parse error"
      expect(w.length).toBeGreaterThan(10);
      expect(w.toLowerCase()).not.toBe('parse error');
    }
  });

  it('malformed let missing variable name warns with helpful message', () => {
    const spec = parseFlow('flow:\n  let = "val"');
    expect(spec.warnings.some((w) => /missing variable name|missing "="/i.test(w))).toBe(true);
  });

  it('malformed let missing equals sign warns with helpful message', () => {
    const spec = parseFlow('flow:\n  let x');
    expect(spec.warnings.some((w) => /missing "="/i.test(w))).toBe(true);
  });

  it('malformed let missing value warns with helpful message', () => {
    const spec = parseFlow('flow:\n  let x =');
    expect(spec.warnings.some((w) => /missing value/i.test(w))).toBe(true);
  });

  it('while without condition still parses (defaults)', () => {
    // "while" alone is below the "if lower.startsWith('while ')" check
    // because there's no space after, so it might be treated differently.
    // "while " requires content after the space.
    assertNoCrash('flow:\n  while\n    prompt: work\n  end');
  });

  it('while without max produces a helpful warning', () => {
    const spec = parseFlow('flow:\n  while not done\n    prompt: work\n  end');
    expect(spec.warnings.some((w) => /missing.*max/i.test(w))).toBe(true);
  });

  it('until without max produces a helpful warning', () => {
    const spec = parseFlow('flow:\n  until done\n    prompt: work\n  end');
    expect(spec.warnings.some((w) => /missing.*max/i.test(w))).toBe(true);
  });

  it('invalid foreach syntax warns with the offending line', () => {
    const spec = parseFlow('flow:\n  foreach item\n    prompt: test\n  end');
    expect(spec.warnings.some((w) => /invalid foreach syntax/i.test(w))).toBe(true);
  });

  it('invalid spawn syntax warns with helpful message', () => {
    const spec = parseFlow('flow:\n  spawn\n  end');
    expect(spec.warnings.length).toBeGreaterThan(0);
  });

  it('invalid await syntax warns with helpful message', () => {
    const spec = parseFlow('flow:\n  await');
    expect(spec.warnings.some((w) => /invalid await syntax|unknown keyword/i.test(w))).toBe(true);
  });

  it('let x += [] warns about appending empty list', () => {
    const spec = parseFlow('flow:\n  let x += []');
    expect(spec.warnings.some((w) => /cannot append empty list/i.test(w))).toBe(true);
  });

  it('multiple warnings for multiple issues are all collected', () => {
    const dsl = `flow:
  let x
  frobnicate
  while not done
    prompt: work
  end
  let y =`;
    const spec = parseFlow(dsl);
    // Should have at least 3 warnings: let x (missing =), frobnicate (unknown), while (no max), let y (missing value)
    expect(spec.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('error messages for let/var include the offending syntax', () => {
    const spec = parseFlow('flow:\n  let = "val"\n  let y');
    for (const w of spec.warnings) {
      // Each let/var warning should include the original text
      expect(w.length).toBeGreaterThan(15);
    }
  });

  it('mismatched end does not cause undefined behavior', () => {
    // Extra end after all blocks are closed
    const dsl = 'flow:\n  if tests_pass\n    prompt: done\n  end\n  end';
    assertNoCrash(dsl);
  });

  it('container node with only comments in body warns or produces empty body', () => {
    const dsl = 'flow:\n  while not done max 3\n    # only comments\n    # another comment\n  end';
    const spec = parseFlow(dsl);
    // Should have empty body, not crash
    const node = spec.nodes[0] as unknown as { body: unknown[] };
    expect(node.body).toHaveLength(0);
  });
});
