import { describe, it, expect } from 'vitest';
import { parseFlow, parseGates, detectBareFlow, parseLibraryFile } from './parse-flow.js';
import type { FlowSpec } from '../domain/flow-spec.js';
import type {
  WhileNode,
  UntilNode,
  RetryNode,
  IfNode,
  PromptNode,
  RunNode,
  TryNode,
  LetNode,
  ForeachNode,
  BreakNode,
  ContinueNode,
  SpawnNode,
  AwaitNode,
  StartNode,
  ReturnNode,
} from '../domain/flow-node.js';

function parse(dsl: string): FlowSpec {
  return parseFlow(dsl);
}

describe('parseFlow — goal', () => {
  it('extracts the goal line', () => {
    const spec = parse('Goal: fix the auth tests\n\nflow:\n  prompt: hi');
    expect(spec.goal).toBe('fix the auth tests');
  });

  it('returns empty goal when missing', () => {
    const spec = parse('flow:\n  prompt: hi');
    expect(spec.goal).toBe('');
  });
});

describe('parseFlow — prompt and run nodes', () => {
  it('parses a single prompt node', () => {
    const spec = parse('Goal: g\n\nflow:\n  prompt: inspect failures');
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as PromptNode;
    expect(node.kind).toBe('prompt');
    expect(node.text).toBe('inspect failures');
  });

  it('parses a single run node', () => {
    const spec = parse('Goal: g\n\nflow:\n  run: pnpm test');
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as RunNode;
    expect(node.kind).toBe('run');
    expect(node.command).toBe('pnpm test');
  });

  it('parses run node with bracket timeout', () => {
    const spec = parse('Goal: g\n\nflow:\n  run: npm test [timeout 60]');
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as RunNode;
    expect(node.kind).toBe('run');
    expect(node.command).toBe('npm test');
    expect(node.timeoutMs).toBe(60000);
  });

  it('parses run node with bare timeout suffix', () => {
    const spec = parse('Goal: g\n\nflow:\n  run: npm test timeout 60');
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as RunNode;
    expect(node.kind).toBe('run');
    expect(node.command).toBe('npm test');
    expect(node.timeoutMs).toBe(60000);
  });

  it('parses run node without timeout (no timeoutMs property)', () => {
    const spec = parse('Goal: g\n\nflow:\n  run: echo hello');
    const node = spec.nodes[0] as RunNode;
    expect(node.timeoutMs).toBeUndefined();
  });

  it('does not mismatch "timeout" as command argument (D2)', () => {
    const spec = parse('Goal: g\n\nflow:\n  run: echo timeout 5');
    const node = spec.nodes[0] as RunNode;
    expect(node.command).toBe('echo timeout 5');
    expect(node.timeoutMs).toBeUndefined();
  });

  it('parses multiple sequential nodes', () => {
    const spec = parse('Goal: g\n\nflow:\n  prompt: first\n  run: cmd\n  prompt: second');
    expect(spec.nodes).toHaveLength(3);
    expect(spec.nodes[0]!.kind).toBe('prompt');
    expect(spec.nodes[1]!.kind).toBe('run');
    expect(spec.nodes[2]!.kind).toBe('prompt');
  });
});

describe('parseFlow — while loop', () => {
  it('parses a basic while loop with max', () => {
    const dsl = `Goal: g

flow:
  while not tests_pass max 4
    prompt: fix it
  end`;
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as WhileNode;
    expect(node.kind).toBe('while');
    expect(node.condition).toBe('not tests_pass');
    expect(node.maxIterations).toBe(4);
    expect(node.body).toHaveLength(1);
    expect((node.body[0] as PromptNode).text).toBe('fix it');
  });

  it('captures multi-word conditions', () => {
    const dsl = `Goal: g

flow:
  while response_code != 200 max 3
    prompt: fix the request
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as WhileNode;
    expect(node.condition).toBe('response_code != 200');
    expect(node.maxIterations).toBe(3);
  });

  it('defaults max to 5 when missing', () => {
    const dsl = `Goal: g

flow:
  while not done
    prompt: work
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as WhileNode;
    expect(node.maxIterations).toBe(5);
    expect(spec.warnings.some((w) => w.includes('Missing "max N" on while'))).toBe(true);
  });

  it('preserves sibling nodes after a while block', () => {
    const dsl = `Goal: g

flow:
  while ready max 2
    prompt: work
  end
  run: echo done`;
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(2);
    expect(spec.nodes[0]?.kind).toBe('while');
    expect(spec.nodes[1]?.kind).toBe('run');
  });
});

describe('parseFlow — until loop', () => {
  it('parses until with max', () => {
    const dsl = `Goal: g

flow:
  until tests_pass max 3
    run: pnpm test
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as UntilNode;
    expect(node.kind).toBe('until');
    expect(node.condition).toBe('tests_pass');
    expect(node.maxIterations).toBe(3);
  });

  it('captures multi-word conditions', () => {
    const dsl = `Goal: g

flow:
  until tests_pass && lint_pass max 5
    run: pnpm test
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as UntilNode;
    expect(node.condition).toBe('tests_pass && lint_pass');
    expect(node.maxIterations).toBe(5);
  });

  it('defaults max when missing', () => {
    const dsl = `Goal: g

flow:
  until tests_pass
    prompt: fix
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as UntilNode;
    expect(node.maxIterations).toBe(5);
    expect(spec.warnings.some((w) => w.includes('Missing "max N" on until'))).toBe(true);
  });

  it('preserves sibling nodes after an until block', () => {
    const dsl = `Goal: g

flow:
  until done max 3
    run: pnpm test
  end
  run: echo done`;
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(2);
    expect(spec.nodes[0]?.kind).toBe('until');
    expect(spec.nodes[1]?.kind).toBe('run');
  });
});

describe('parseFlow — retry block', () => {
  it('parses retry with max', () => {
    const dsl = `Goal: g

flow:
  retry max 3
    run: pnpm build
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as RetryNode;
    expect(node.kind).toBe('retry');
    expect(node.maxAttempts).toBe(3);
    expect(node.body).toHaveLength(1);
  });

  it('defaults max attempts to 3 when missing', () => {
    const dsl = `Goal: g

flow:
  retry
    run: pnpm build
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as RetryNode;
    expect(node.maxAttempts).toBe(3);
  });

  it('parses retry with backoff', () => {
    const dsl = `Goal: g

flow:
  retry max 5 backoff 2s
    run: pnpm build
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as RetryNode;
    expect(node.kind).toBe('retry');
    expect(node.maxAttempts).toBe(5);
    expect(node.backoffMs).toBe(2000);
  });

  it('retry without backoff has no backoffMs', () => {
    const dsl = `Goal: g

flow:
  retry max 3
    run: pnpm build
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as RetryNode;
    expect(node.backoffMs).toBeUndefined();
  });

  it('preserves sibling nodes after a retry block', () => {
    const dsl = `Goal: g

flow:
  retry max 3
    run: pnpm build
  end
  run: echo done`;
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(2);
    expect(spec.nodes[0]?.kind).toBe('retry');
    expect(spec.nodes[1]?.kind).toBe('run');
  });
});

describe('parseFlow — if/else branching', () => {
  it('parses if with then and else', () => {
    const dsl = `Goal: g

flow:
  if failure_mode == "type-error"
    prompt: fix the type error only
  else
    prompt: choose a different fix path
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as IfNode;
    expect(node.kind).toBe('if');
    expect(node.condition).toBe('failure_mode == "type-error"');
    expect(node.thenBranch).toHaveLength(1);
    expect(node.elseBranch).toHaveLength(1);
    expect((node.thenBranch[0] as PromptNode).text).toBe('fix the type error only');
    expect((node.elseBranch[0] as PromptNode).text).toBe('choose a different fix path');
  });

  it('parses if without else', () => {
    const dsl = `Goal: g

flow:
  if tests_fail
    prompt: fix
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as IfNode;
    expect(node.elseBranch).toEqual([]);
  });
});

describe('parseFlow — try/catch', () => {
  it('parses try/catch block', () => {
    const dsl = `Goal: g

flow:
  try
    run: pnpm build
  catch command_failed
    prompt: fix build errors
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as TryNode;
    expect(node.kind).toBe('try');
    expect(node.body).toHaveLength(1);
    expect(node.catchCondition).toBe('command_failed');
    expect(node.catchBody).toHaveLength(1);
  });

  it('defaults catch condition to command_failed', () => {
    const dsl = `Goal: g

flow:
  try
    run: pnpm build
  catch
    prompt: handle error
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as TryNode;
    expect(node.catchCondition).toBe('command_failed');
  });
});

describe('parseFlow — completion gates', () => {
  it('parses done when section', () => {
    const dsl = `Goal: g

flow:
  prompt: work

done when:
  tests_pass == true
  lint_pass == true`;
    const spec = parse(dsl);
    expect(spec.completionGates).toHaveLength(2);
    expect(spec.completionGates[0]!.predicate).toBe('tests_pass == true');
    expect(spec.completionGates[1]!.predicate).toBe('lint_pass == true');
  });

  it('returns empty gates when section missing', () => {
    const spec = parse('Goal: g\n\nflow:\n  prompt: work');
    expect(spec.completionGates).toEqual([]);
  });
});

describe('parseFlow — soft normalization', () => {
  it('auto-closes missing end via dedent', () => {
    const dsl = `Goal: g

flow:
  while not done max 3
    prompt: work
  prompt: after loop`;
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(2);
    expect(spec.nodes[0]!.kind).toBe('while');
    expect(spec.nodes[1]!.kind).toBe('prompt');
  });

  it('treats unknown keywords as prompt nodes', () => {
    const dsl = `Goal: g

flow:
  frobnicate the widget`;
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0]! as PromptNode;
    expect(node.kind).toBe('prompt');
    expect(node.text).toBe('frobnicate the widget');
    expect(spec.warnings.some((w) => w.includes('Unknown keyword "frobnicate the widget"'))).toBe(
      true,
    );
  });
});

describe('parseFlow — let/var statements', () => {
  it('parses let with quoted literal', () => {
    const dsl = `Goal: g\n\nflow:\n  let greeting = "hello world"`;
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as LetNode;
    expect(node.kind).toBe('let');
    expect(node.variableName).toBe('greeting');
    expect(node.source).toEqual({ type: 'literal', value: 'hello world' });
  });

  it('parses let with unquoted literal', () => {
    const dsl = `Goal: g\n\nflow:\n  let x = hello`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as LetNode;
    expect(node.source).toEqual({ type: 'literal', value: 'hello' });
  });

  it('parses let with prompt source (quoted)', () => {
    const dsl = `Goal: g\n\nflow:\n  let info = prompt "summarize this"`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as LetNode;
    expect(node.variableName).toBe('info');
    expect(node.source).toEqual({ type: 'prompt', text: 'summarize this' });
  });

  it('parses let with prompt source (unquoted)', () => {
    const dsl = `Goal: g\n\nflow:\n  let info = prompt summarize this`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as LetNode;
    expect(node.source).toEqual({ type: 'prompt', text: 'summarize this' });
  });

  it('parses let with run source (quoted)', () => {
    const dsl = `Goal: g\n\nflow:\n  let output = run "echo hi"`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as LetNode;
    expect(node.variableName).toBe('output');
    expect(node.source).toEqual({ type: 'run', command: 'echo hi' });
  });

  it('parses let with run source (unquoted)', () => {
    const dsl = `Goal: g\n\nflow:\n  let output = run echo hi`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as LetNode;
    expect(node.source).toEqual({ type: 'run', command: 'echo hi' });
  });

  it('parses var as alias for let', () => {
    const dsl = `Goal: g\n\nflow:\n  var greeting = "hello"`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as LetNode;
    expect(node.kind).toBe('let');
    expect(node.variableName).toBe('greeting');
    expect(node.source).toEqual({ type: 'literal', value: 'hello' });
  });

  it('warns on invalid syntax (missing =)', () => {
    const dsl = `Goal: g\n\nflow:\n  let x\n  prompt: work`;
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(1);
    expect(spec.nodes[0]!.kind).toBe('prompt');
    expect(spec.warnings.some((w) => w.includes('missing "="'))).toBe(true);
  });

  it('warns on invalid syntax (missing value)', () => {
    const dsl = `Goal: g\n\nflow:\n  let x =\n  prompt: work`;
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(1);
    expect(spec.nodes[0]!.kind).toBe('prompt');
    expect(spec.warnings.some((w) => w.includes('missing value'))).toBe(true);
  });

  it('parses let inside a while loop', () => {
    const dsl = `Goal: g\n\nflow:\n  while not done max 3\n    let x = "val"\n    prompt: work\n  end`;
    const spec = parse(dsl);
    const whileNode = spec.nodes[0] as WhileNode;
    expect(whileNode.body).toHaveLength(2);
    expect(whileNode.body[0]!.kind).toBe('let');
    expect(whileNode.body[1]!.kind).toBe('prompt');
  });

  it('parses mixed let and other nodes', () => {
    const dsl = `Goal: g\n\nflow:\n  let a = "1"\n  prompt: do work\n  var b = run "echo 2"\n  run: npm test`;
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(4);
    expect(spec.nodes[0]!.kind).toBe('let');
    expect(spec.nodes[1]!.kind).toBe('prompt');
    expect(spec.nodes[2]!.kind).toBe('let');
    expect(spec.nodes[3]!.kind).toBe('run');
  });

  it('parses let x = [] as empty_list source', () => {
    const dsl = `Goal: g\n\nflow:\n  let items = []`;
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as LetNode;
    expect(node.kind).toBe('let');
    expect(node.variableName).toBe('items');
    expect(node.source).toEqual({ type: 'empty_list' });
    expect(node.append).toBe(false);
  });

  it('parses let x += "val" as append literal', () => {
    const dsl = `Goal: g\n\nflow:\n  let errors += "timeout"`;
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as LetNode;
    expect(node.kind).toBe('let');
    expect(node.variableName).toBe('errors');
    expect(node.source).toEqual({ type: 'literal', value: 'timeout' });
    expect(node.append).toBe(true);
  });

  it('parses let x += run "cmd" as append run', () => {
    const dsl = `Goal: g\n\nflow:\n  let logs += run "npm test 2>&1"`;
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as LetNode;
    expect(node.variableName).toBe('logs');
    expect(node.source).toEqual({ type: 'run', command: 'npm test 2>&1' });
    expect(node.append).toBe(true);
  });

  it('parses var x += "val" as append (alias)', () => {
    const dsl = `Goal: g\n\nflow:\n  var items += "apple"`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as LetNode;
    expect(node.kind).toBe('let');
    expect(node.append).toBe(true);
    expect(node.source).toEqual({ type: 'literal', value: 'apple' });
  });

  it('warns on let x += [] (cannot append empty list)', () => {
    const dsl = `Goal: g\n\nflow:\n  let x += []\n  prompt: work`;
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(1);
    expect(spec.nodes[0]!.kind).toBe('prompt');
    expect(spec.warnings.some((w) => w.includes('Cannot append empty list'))).toBe(true);
  });

  it('parses let x += prompt "text" as append prompt', () => {
    const dsl = `Goal: g\n\nflow:\n  let notes += prompt "analyze this"`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as LetNode;
    expect(node.variableName).toBe('notes');
    expect(node.source).toEqual({ type: 'prompt', text: 'analyze this' });
    expect(node.append).toBe(true);
  });

  it('regular let = has append false', () => {
    const dsl = `Goal: g\n\nflow:\n  let x = "hello"`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as LetNode;
    expect(node.append).toBe(false);
  });
});

describe('parseFlow — robustness', () => {
  it('handles CRLF line endings', () => {
    const dsl =
      'Goal: g\r\n\r\nflow:\r\n  prompt: hello\r\n  run: npm test\r\n\r\ndone when:\r\n  tests_pass';
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(2);
    expect(spec.nodes[0]!.kind).toBe('prompt');
    expect(spec.nodes[1]!.kind).toBe('run');
    expect(spec.completionGates).toHaveLength(1);
  });

  it('handles trailing whitespace on lines', () => {
    const dsl = 'Goal: g   \n\nflow:   \n  prompt: work   \n  run: test   ';
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(2);
  });

  it('strips markdown code fences wrapping a flow block', () => {
    const dsl = '```\nGoal: g\n\nflow:\n  prompt: do it\n\ndone when:\n  done\n```';
    const stripped = dsl.replace(/^```[\w-]*\n?/m, '').replace(/\n?```\s*$/m, '');
    const spec = parse(stripped);
    expect(spec.nodes).toHaveLength(1);
    expect(spec.goal).toBe('g');
    expect(spec.completionGates).toHaveLength(1);
  });

  it('handles empty lines within flow block', () => {
    const dsl = 'Goal: g\n\nflow:\n  prompt: first\n\n  prompt: second';
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(2);
  });

  it('handles comments in flow block', () => {
    const dsl = 'Goal: g\n\nflow:\n  # This is a comment\n  prompt: work';
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(1);
    expect(spec.nodes[0]!.kind).toBe('prompt');
  });
});

describe('parseFlow — full complex flow', () => {
  it('parses the example from the spec', () => {
    const dsl = `Goal: fix the auth tests

flow:
  while not tests_pass max 4
    prompt: inspect failures and choose the highest-confidence fix
    run: pnpm test -- auth
    if failure_mode == "type-error"
      prompt: fix the type error only
    else
      prompt: choose a different fix path
    end
  end

done when:
  tests_pass == true`;
    const spec = parse(dsl);
    expect(spec.goal).toBe('fix the auth tests');
    expect(spec.nodes).toHaveLength(1);

    const whileNode = spec.nodes[0] as WhileNode;
    expect(whileNode.kind).toBe('while');
    expect(whileNode.condition).toBe('not tests_pass');
    expect(whileNode.maxIterations).toBe(4);
    expect(whileNode.body).toHaveLength(3);

    expect(whileNode.body[0]!.kind).toBe('prompt');
    expect(whileNode.body[1]!.kind).toBe('run');

    const ifNode = whileNode.body[2]! as IfNode;
    expect(ifNode.kind).toBe('if');
    expect(ifNode.thenBranch).toHaveLength(1);
    expect(ifNode.elseBranch).toHaveLength(1);

    expect(spec.completionGates).toHaveLength(1);
    expect(spec.completionGates[0]!.predicate).toBe('tests_pass == true');
  });
});

describe('parseFlow — foreach', () => {
  it('parses a basic foreach with variable expression', () => {
    const dsl = `Goal: g

flow:
  foreach file in \${files}
    run: lint \${file}
  end`;
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as ForeachNode;
    expect(node.kind).toBe('foreach');
    expect(node.variableName).toBe('file');
    expect(node.listExpression).toBe('${files}');
    expect(node.maxIterations).toBe(50);
    expect(node.body).toHaveLength(1);
    expect(node.body[0]!.kind).toBe('run');
  });

  it('parses foreach with max override', () => {
    const dsl = `Goal: g

flow:
  foreach item in \${list} max 10
    prompt: process \${item}
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as ForeachNode;
    expect(node.kind).toBe('foreach');
    expect(node.variableName).toBe('item');
    expect(node.listExpression).toBe('${list}');
    expect(node.maxIterations).toBe(10);
  });

  it('parses foreach with quoted literal list', () => {
    const dsl = `Goal: g

flow:
  foreach env in "dev staging prod"
    run: deploy --target \${env}
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as ForeachNode;
    expect(node.kind).toBe('foreach');
    expect(node.variableName).toBe('env');
    expect(node.listExpression).toBe('dev staging prod');
  });

  it('parses foreach with multiple body nodes', () => {
    const dsl = `Goal: g

flow:
  foreach f in \${files}
    prompt: Review \${f}
    run: npx tsc --noEmit \${f}
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as ForeachNode;
    expect(node.body).toHaveLength(2);
    expect(node.body[0]!.kind).toBe('prompt');
    expect(node.body[1]!.kind).toBe('run');
  });

  it('warns on invalid foreach syntax (missing in clause)', () => {
    const dsl = `Goal: g

flow:
  foreach item
    prompt: fallback
  end`;
    const spec = parse(dsl);
    expect(spec.warnings.some((w) => w.includes('Invalid foreach syntax'))).toBe(true);
  });

  it('warns on foreach with variable but missing list expression', () => {
    const dsl = `Goal: g

flow:
  foreach item in
    prompt: fallback
  end`;
    const spec = parse(dsl);
    expect(spec.warnings.some((w) => w.includes('Invalid foreach syntax'))).toBe(true);
    // Invalid foreach falls back to a prompt node
    expect(spec.nodes[0]!.kind).toBe('prompt');
  });

  it('parses foreach before other nodes', () => {
    const dsl = `Goal: g

flow:
  foreach x in "a b"
    prompt: handle \${x}
  end
  prompt: done`;
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(2);
    expect(spec.nodes[0]!.kind).toBe('foreach');
    expect(spec.nodes[1]!.kind).toBe('prompt');
  });
});

// H#15: Break node parsing
describe('parseFlow — break', () => {
  it('parses break inside loop', () => {
    const dsl = `Goal: g

flow:
  foreach x in "a b c"
    break
  end`;
    const spec = parse(dsl);
    const fe = spec.nodes[0] as ForeachNode;
    expect(fe.body).toHaveLength(1);
    expect(fe.body[0]!.kind).toBe('break');
  });
});

// H#20: Finally clause parsing
describe('parseFlow — try/catch/finally', () => {
  it('parses try/catch/finally block', () => {
    const dsl = `Goal: g

flow:
  try
    run: deploy
  catch command_failed
    prompt: rollback
  finally
    run: cleanup
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as TryNode;
    expect(node.kind).toBe('try');
    expect(node.body).toHaveLength(1);
    expect(node.catchBody).toHaveLength(1);
    expect(node.finallyBody).toHaveLength(1);
    expect((node.finallyBody[0] as RunNode).command).toBe('cleanup');
  });

  it('parses try/finally without catch', () => {
    const dsl = `Goal: g

flow:
  try
    run: deploy
  finally
    run: cleanup
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as TryNode;
    expect(node.body).toHaveLength(1);
    expect(node.catchBody).toHaveLength(0);
    expect(node.finallyBody).toHaveLength(1);
  });

  it('parses try/catch without finally', () => {
    const dsl = `Goal: g

flow:
  try
    run: deploy
  catch
    prompt: fix
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as TryNode;
    expect(node.finallyBody).toHaveLength(0);
  });
});

// H#26: Custom gate definitions
describe('parseFlow — custom gates', () => {
  it('parses gate with custom command', () => {
    const dsl = `Goal: g

flow:
  prompt: work

done when:
  gate build_passes: npm run build`;
    const spec = parse(dsl);
    expect(spec.completionGates).toHaveLength(1);
    expect(spec.completionGates[0]!.predicate).toBe('build_passes');
    expect(spec.completionGates[0]!.command).toBe('npm run build');
  });

  it('mixes custom and builtin gates', () => {
    const dsl = `Goal: g

flow:
  prompt: work

done when:
  tests_pass
  gate deploy_ok: ./deploy-check.sh`;
    const spec = parse(dsl);
    expect(spec.completionGates).toHaveLength(2);
    expect(spec.completionGates[0]!.predicate).toBe('tests_pass');
    expect(spec.completionGates[0]!.command).toBeUndefined();
    expect(spec.completionGates[1]!.predicate).toBe('deploy_ok');
    expect(spec.completionGates[1]!.command).toBe('./deploy-check.sh');
  });
});

describe('parseGates — standalone (D3, D10)', () => {
  it('returns empty for no done-when section', () => {
    expect(parseGates('Just fix the tests')).toEqual([]);
  });

  it('parses single predicate', () => {
    const gates = parseGates('text\n\ndone when:\n  tests_pass');
    expect(gates).toHaveLength(1);
    expect(gates[0]!.predicate).toBe('tests_pass');
  });

  it('returns empty when done-when has no newline after colon', () => {
    expect(parseGates('done when: tests_pass')).toEqual([]);
  });

  it('stops at first blank line after gates (D3)', () => {
    const gates = parseGates('Fix tests.\n\ndone when:\n  tests_pass\n\nAlso update README.');
    expect(gates).toHaveLength(1);
    expect(gates[0]!.predicate).toBe('tests_pass');
  });

  it('parses multiple gates before blank line', () => {
    const gates = parseGates('Fix.\n\ndone when:\n  tests_pass\n  lint_pass\n\nExtra text.');
    expect(gates).toHaveLength(2);
  });

  it('parses custom gate', () => {
    const gates = parseGates('Fix.\n\ndone when:\n  gate build_ok: npm run build');
    expect(gates).toHaveLength(1);
    expect(gates[0]!.predicate).toBe('build_ok');
    expect(gates[0]!.command).toBe('npm run build');
  });

  it('skips leading blank lines before first gate (D3)', () => {
    const gates = parseGates('Fix.\n\ndone when:\n\n  tests_pass');
    expect(gates).toHaveLength(1);
    expect(gates[0]!.predicate).toBe('tests_pass');
  });

  it('skips multiple leading blank lines before first gate', () => {
    const gates = parseGates('Fix.\n\ndone when:\n\n\n  tests_pass\n  lint_pass');
    expect(gates).toHaveLength(2);
    expect(gates[0]!.predicate).toBe('tests_pass');
    expect(gates[1]!.predicate).toBe('lint_pass');
  });
});

describe('parseFlow — spawn blocks', () => {
  it('parses a spawn block with double-quoted name', () => {
    const spec = parse(
      'Goal: test\n\nflow:\n  spawn "fix-auth"\n    prompt: Fix the auth bug\n    run: npm test\n  end',
    );
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as SpawnNode;
    expect(node.kind).toBe('spawn');
    expect(node.name).toBe('fix-auth');
    expect(node.body).toHaveLength(2);
    expect((node.body[0] as PromptNode).kind).toBe('prompt');
    expect((node.body[1] as RunNode).kind).toBe('run');
  });

  it('parses a spawn block with single-quoted name', () => {
    const spec = parse("Goal: t\n\nflow:\n  spawn 'cache'\n    prompt: Add cache\n  end");
    const node = spec.nodes[0] as SpawnNode;
    expect(node.kind).toBe('spawn');
    expect(node.name).toBe('cache');
  });

  it('parses multiple spawn blocks followed by await', () => {
    const dsl = `Goal: parallel work

flow:
  spawn "task-a"
    prompt: Do task A
  end

  spawn "task-b"
    prompt: Do task B
  end

  await all`;
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(3);
    expect((spec.nodes[0] as SpawnNode).kind).toBe('spawn');
    expect((spec.nodes[0] as SpawnNode).name).toBe('task-a');
    expect((spec.nodes[1] as SpawnNode).kind).toBe('spawn');
    expect((spec.nodes[1] as SpawnNode).name).toBe('task-b');
    expect((spec.nodes[2] as AwaitNode).kind).toBe('await');
    expect((spec.nodes[2] as AwaitNode).target).toBe('all');
  });

  it('parses spawn with bare-word name (D5)', () => {
    const spec = parse('Goal: t\n\nflow:\n  spawn fix-auth\n    prompt: Fix it\n  end');
    expect(spec.warnings).toHaveLength(0);
    const node = spec.nodes[0] as SpawnNode;
    expect(node.kind).toBe('spawn');
    expect(node.name).toBe('fix-auth');
    expect(node.body).toHaveLength(1);
  });

  it('warns on spawn with no name at all', () => {
    const spec = parse('Goal: t\n\nflow:\n  spawn\n  end');
    expect(spec.warnings.length).toBeGreaterThan(0);
  });
});

describe('parseFlow — await nodes', () => {
  it('parses await all', () => {
    const spec = parse('Goal: t\n\nflow:\n  await all');
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as AwaitNode;
    expect(node.kind).toBe('await');
    expect(node.target).toBe('all');
  });

  it('parses await with quoted target name', () => {
    const spec = parse('Goal: t\n\nflow:\n  await "fix-auth"');
    const node = spec.nodes[0] as AwaitNode;
    expect(node.kind).toBe('await');
    expect(node.target).toBe('fix-auth');
  });

  it('parses await with bare word target', () => {
    const spec = parse('Goal: t\n\nflow:\n  await fix-auth');
    const node = spec.nodes[0] as AwaitNode;
    expect(node.kind).toBe('await');
    expect(node.target).toBe('fix-auth');
  });

  it('warns on bare await with no target', () => {
    const spec = parse('Goal: t\n\nflow:\n  await');
    expect(spec.warnings.some((w) => w.includes('Invalid await syntax'))).toBe(true);
    // Falls back to a prompt node
    expect(spec.nodes[0]!.kind).toBe('prompt');
  });
});

describe('detectBareFlow', () => {
  it('detects bare prompt: line', () => {
    expect(detectBareFlow('Goal: test\n\nprompt: Do something')).toBe(true);
  });

  it('detects bare run: line', () => {
    expect(detectBareFlow('Goal: test\n\nrun: npm test')).toBe(true);
  });

  it('detects bare let x = "val"', () => {
    expect(detectBareFlow('let x = "hello"')).toBe(true);
  });

  it('detects bare var x = "val"', () => {
    expect(detectBareFlow('var x = "hello"')).toBe(true);
  });

  it('detects bare foreach', () => {
    expect(detectBareFlow('foreach item in "a b c"\n  prompt: do ${item}\nend')).toBe(true);
  });

  it('detects bare retry max N', () => {
    expect(detectBareFlow('retry max 3\n  run: npm test\nend')).toBe(true);
  });

  it('detects bare while with max', () => {
    expect(detectBareFlow('while not tests_pass max 5\n  prompt: fix\nend')).toBe(true);
  });

  it('detects bare until with max', () => {
    expect(detectBareFlow('until tests_pass max 3\n  run: npm test\nend')).toBe(true);
  });

  it('returns false when flow: keyword already exists', () => {
    expect(detectBareFlow('Goal: test\n\nflow:\n  prompt: hi')).toBe(false);
  });

  it('returns false for plain text', () => {
    expect(detectBareFlow('Fix the failing tests please')).toBe(false);
  });

  it('returns false for "if" alone (ambiguous)', () => {
    expect(detectBareFlow('if tests_fail')).toBe(false);
  });

  it('returns false for "try" alone (ambiguous)', () => {
    expect(detectBareFlow('try something new')).toBe(false);
  });

  it('returns false for "break" (ambiguous)', () => {
    expect(detectBareFlow('break')).toBe(false);
  });

  it('skips Goal: lines', () => {
    expect(detectBareFlow('Goal: test\nSome text here')).toBe(false);
  });

  it('detects bare let +=', () => {
    expect(detectBareFlow('let items += "val"')).toBe(true);
  });

  it('detects bare var +=', () => {
    expect(detectBareFlow('var items += "val"')).toBe(true);
  });
});

describe('parseFlow — bare flow (no flow: keyword)', () => {
  it('parses bare prompt: as flow', () => {
    const spec = parse('Goal: test\n\nprompt: Do something');
    expect(spec.nodes).toHaveLength(1);
    expect(spec.nodes[0]!.kind).toBe('prompt');
    expect((spec.nodes[0] as PromptNode).text).toBe('Do something');
  });

  it('parses bare run: as flow', () => {
    const spec = parse('Goal: run test\n\nrun: npm test');
    expect(spec.nodes).toHaveLength(1);
    expect(spec.nodes[0]!.kind).toBe('run');
    expect((spec.nodes[0] as RunNode).command).toBe('npm test');
  });

  it('parses bare let + prompt sequence', () => {
    const spec = parse('Goal: test\n\nlet x = "hello"\nprompt: Say ${x}');
    expect(spec.nodes).toHaveLength(2);
    expect(spec.nodes[0]!.kind).toBe('let');
    expect(spec.nodes[1]!.kind).toBe('prompt');
  });

  it('parses bare flow with done when', () => {
    const spec = parse('Goal: test\n\nprompt: Fix it\nrun: npm test\n\ndone when:\n  tests_pass');
    expect(spec.nodes).toHaveLength(2);
    expect(spec.completionGates).toHaveLength(1);
    expect(spec.completionGates[0]!.predicate).toBe('tests_pass');
  });

  it('does not parse plain text as bare flow', () => {
    const spec = parse('Fix the failing tests please');
    expect(spec.nodes).toHaveLength(0);
  });
});

// H-LANG-002: Continue node parsing
describe('parseFlow — continue', () => {
  it('parses continue inside loop', () => {
    const dsl = `Goal: g

flow:
  foreach x in "a b c"
    continue
  end`;
    const spec = parse(dsl);
    const fe = spec.nodes[0] as ForeachNode;
    expect(fe.body).toHaveLength(1);
    expect(fe.body[0]!.kind).toBe('continue');
  });

  it('parses continue inside while loop', () => {
    const dsl = `Goal: g

flow:
  while flag max 3
    continue
  end`;
    const spec = parse(dsl);
    const wh = spec.nodes[0] as WhileNode;
    expect(wh.body).toHaveLength(1);
    expect(wh.body[0]!.kind).toBe('continue');
  });

  it('parses continue as standalone (outside loop)', () => {
    const dsl = `Goal: g

flow:
  continue`;
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(1);
    expect(spec.nodes[0]!.kind).toBe('continue');
  });
});

// H-LANG-003: else if / elif parsing
describe('parseFlow — else if / elif', () => {
  it('parses if/else if/else/end as nested IfNode', () => {
    const dsl = `Goal: g

flow:
  if condA
    prompt: A
  else if condB
    prompt: B
  else
    prompt: C
  end`;
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(1);
    const outerIf = spec.nodes[0] as IfNode;
    expect(outerIf.kind).toBe('if');
    expect(outerIf.condition).toBe('condA');
    expect(outerIf.thenBranch).toHaveLength(1);
    expect((outerIf.thenBranch[0] as PromptNode).text).toBe('A');

    // else branch contains a nested IfNode
    expect(outerIf.elseBranch).toHaveLength(1);
    const innerIf = outerIf.elseBranch[0] as IfNode;
    expect(innerIf.kind).toBe('if');
    expect(innerIf.condition).toBe('condB');
    expect(innerIf.thenBranch).toHaveLength(1);
    expect((innerIf.thenBranch[0] as PromptNode).text).toBe('B');
    expect(innerIf.elseBranch).toHaveLength(1);
    expect((innerIf.elseBranch[0] as PromptNode).text).toBe('C');
  });

  it('parses elif as alias for else if', () => {
    const dsl = `Goal: g

flow:
  if condA
    prompt: A
  elif condB
    prompt: B
  else
    prompt: C
  end`;
    const spec = parse(dsl);
    const outerIf = spec.nodes[0] as IfNode;
    expect(outerIf.condition).toBe('condA');
    expect(outerIf.elseBranch).toHaveLength(1);
    const innerIf = outerIf.elseBranch[0] as IfNode;
    expect(innerIf.kind).toBe('if');
    expect(innerIf.condition).toBe('condB');
    expect(innerIf.elseBranch).toHaveLength(1);
    expect((innerIf.elseBranch[0] as PromptNode).text).toBe('C');
  });

  it('parses chained else if without final else', () => {
    const dsl = `Goal: g

flow:
  if condA
    prompt: A
  else if condB
    prompt: B
  end`;
    const spec = parse(dsl);
    const outerIf = spec.nodes[0] as IfNode;
    expect(outerIf.elseBranch).toHaveLength(1);
    const innerIf = outerIf.elseBranch[0] as IfNode;
    expect(innerIf.condition).toBe('condB');
    expect(innerIf.elseBranch).toEqual([]);
  });

  it('parses triple chained else if', () => {
    const dsl = `Goal: g

flow:
  if condA
    prompt: A
  else if condB
    prompt: B
  else if condC
    prompt: C
  else
    prompt: D
  end`;
    const spec = parse(dsl);
    const outerIf = spec.nodes[0] as IfNode;
    expect(outerIf.condition).toBe('condA');

    const midIf = outerIf.elseBranch[0] as IfNode;
    expect(midIf.condition).toBe('condB');

    const innerIf = midIf.elseBranch[0] as IfNode;
    expect(innerIf.condition).toBe('condC');
    expect(innerIf.elseBranch).toHaveLength(1);
    expect((innerIf.elseBranch[0] as PromptNode).text).toBe('D');
  });

  it('does not produce warnings for well-formed else if', () => {
    const dsl = `Goal: g

flow:
  if condA
    prompt: A
  else if condB
    prompt: B
  end`;
    const spec = parse(dsl);
    expect(spec.warnings).toHaveLength(0);
  });
});

// ── H-INT-005: Cross-directory spawn ─────────────────────────────────

describe('parseFlow — spawn with cwd (H-INT-005)', () => {
  it('parses spawn "name" in "path" syntax', () => {
    const dsl = `Goal: test

flow:
  spawn "worker" in "/tmp/workdir"
    prompt: Do work
  end`;
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as SpawnNode;
    expect(node.kind).toBe('spawn');
    expect(node.name).toBe('worker');
    expect(node.cwd).toBe('/tmp/workdir');
    expect(node.body).toHaveLength(1);
  });

  it('parses spawn without in clause (no cwd)', () => {
    const dsl = `Goal: test

flow:
  spawn "worker"
    prompt: Do work
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as SpawnNode;
    expect(node.kind).toBe('spawn');
    expect(node.name).toBe('worker');
    expect(node.cwd).toBeUndefined();
  });

  it('parses spawn with single-quoted in path', () => {
    const dsl = `Goal: test

flow:
  spawn 'worker' in './subdir'
    run: npm test
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as SpawnNode;
    expect(node.name).toBe('worker');
    expect(node.cwd).toBe('./subdir');
  });
});

// ── H-SEC-005: Spawn variable allowlist ─────────────────────────────────

describe('parseFlow — spawn with vars (H-SEC-005)', () => {
  it('parses spawn "name" with vars x, y', () => {
    const dsl = `Goal: test

flow:
  spawn "worker" with vars greeting, count
    prompt: Do work
  end`;
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as SpawnNode;
    expect(node.kind).toBe('spawn');
    expect(node.name).toBe('worker');
    expect(node.vars).toEqual(['greeting', 'count']);
  });

  it('parses spawn without vars (no vars property)', () => {
    const dsl = `Goal: test

flow:
  spawn "worker"
    prompt: Do work
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as SpawnNode;
    expect(node.vars).toBeUndefined();
  });

  it('parses spawn with cwd and vars', () => {
    const dsl = `Goal: test

flow:
  spawn "worker" in "/tmp" with vars x
    prompt: Do work
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as SpawnNode;
    expect(node.name).toBe('worker');
    expect(node.cwd).toBe('/tmp');
    expect(node.vars).toEqual(['x']);
  });
});

// ── H-INT-010: any() gate composition ─────────────────────────────────

describe('parseGates — any() composition (H-INT-010)', () => {
  it('parses any(gate1, gate2) into composite gate', () => {
    const input = `Goal: test

done when:
  any(tests_pass, lint_pass)`;
    const gates = parseGates(input);
    expect(gates).toHaveLength(1);
    expect(gates[0]!.predicate).toBe('any(tests_pass, lint_pass)');
    expect(gates[0]!.any).toHaveLength(2);
    expect(gates[0]!.any![0]!.predicate).toBe('tests_pass');
    expect(gates[0]!.any![1]!.predicate).toBe('lint_pass');
  });

  it('parses any() alongside regular gates', () => {
    const input = `Goal: test

done when:
  any(tests_pass, pytest_pass)
  lint_pass`;
    const gates = parseGates(input);
    expect(gates).toHaveLength(2);
    expect(gates[0]!.any).toBeDefined();
    expect(gates[1]!.predicate).toBe('lint_pass');
    expect(gates[1]!.any).toBeUndefined();
  });

  it('parses any() with three sub-gates', () => {
    const input = `Goal: test

done when:
  any(tests_pass, pytest_pass, go_test_pass)`;
    const gates = parseGates(input);
    expect(gates[0]!.any).toHaveLength(3);
  });
});

// ── H-LANG-005: Pipe transform parsing ─────────────────────────────

describe('parseFlow — pipe transforms (H-LANG-005)', () => {
  it('parses let x = run "cmd" | trim', () => {
    const spec = parse('Goal: g\n\nflow:\n  let x = run "echo hello" | trim');
    const node = spec.nodes[0] as LetNode;
    expect(node.kind).toBe('let');
    expect(node.source).toEqual({ type: 'run', command: 'echo hello' });
    expect(node.transform).toBe('trim');
  });

  it('parses let x = run "cmd" | upper', () => {
    const spec = parse('Goal: g\n\nflow:\n  let x = run "echo hello" | upper');
    const node = spec.nodes[0] as LetNode;
    expect(node.source).toEqual({ type: 'run', command: 'echo hello' });
    expect(node.transform).toBe('upper');
  });

  it('parses let x = prompt "q" | lower', () => {
    const spec = parse('Goal: g\n\nflow:\n  let x = prompt "question" | lower');
    const node = spec.nodes[0] as LetNode;
    expect(node.source).toEqual({ type: 'prompt', text: 'question' });
    expect(node.transform).toBe('lower');
  });

  it('parses let x = run "cmd" | first', () => {
    const spec = parse('Goal: g\n\nflow:\n  let x = run "cmd" | first');
    const node = spec.nodes[0] as LetNode;
    expect(node.transform).toBe('first');
  });

  it('parses let x = run "cmd" | last', () => {
    const spec = parse('Goal: g\n\nflow:\n  let x = run "cmd" | last');
    const node = spec.nodes[0] as LetNode;
    expect(node.transform).toBe('last');
  });

  it('does not apply transform to literal values', () => {
    const spec = parse('Goal: g\n\nflow:\n  let x = "hello | trim"');
    const node = spec.nodes[0] as LetNode;
    expect(node.source).toEqual({ type: 'literal', value: 'hello | trim' });
    expect(node.transform).toBeUndefined();
  });

  it('does not treat unknown word after pipe as transform', () => {
    const spec = parse('Goal: g\n\nflow:\n  let x = run "echo" | unknown');
    const node = spec.nodes[0] as LetNode;
    // Unknown transform word — pipe stays as part of run command
    expect(node.source.type).toBe('run');
    expect(node.transform).toBeUndefined();
  });

  it('no transform when pipe is absent', () => {
    const spec = parse('Goal: g\n\nflow:\n  let x = run "echo hello"');
    const node = spec.nodes[0] as LetNode;
    expect(node.transform).toBeUndefined();
  });
});

// ── H-LANG-007: foreach with run command ─────────────────────────────

describe('parseFlow — foreach with run command (H-LANG-007)', () => {
  it('parses foreach item in run "cmd"', () => {
    const dsl = `Goal: g

flow:
  foreach file in run "ls -1"
    prompt: process \${file}
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as ForeachNode;
    expect(node.kind).toBe('foreach');
    expect(node.variableName).toBe('file');
    expect(node.listCommand).toBe('ls -1');
    expect(node.listExpression).toBe('');
  });

  it('parses foreach with run and max', () => {
    const dsl = `Goal: g

flow:
  foreach f in run "find . -name *.ts" max 10
    prompt: check \${f}
  end`;
    const spec = parse(dsl);
    const node = spec.nodes[0] as ForeachNode;
    expect(node.listCommand).toBe('find . -name *.ts');
    expect(node.maxIterations).toBe(10);
  });

  it('regular foreach does not set listCommand', () => {
    const spec = parse('Goal: g\n\nflow:\n  foreach x in "a b c"\n    prompt: hi\n  end');
    const node = spec.nodes[0] as ForeachNode;
    expect(node.listCommand).toBeUndefined();
    expect(node.listExpression).toBe('a b c');
  });
});

describe('parseFlow — include directive (H-INT-001)', () => {
  const mockReader = (files: Record<string, string>) => (path: string) => {
    // Normalize path separators for cross-platform tests
    const normalized = path.replace(/\\/g, '/');
    for (const [key, value] of Object.entries(files)) {
      if (normalized.endsWith(key)) return value;
    }
    throw new Error(`File not found: ${path}`);
  };

  it('inlines nodes from included file', () => {
    const spec = parseFlow('Goal: test\n\nflow:\n  include "steps.flow"\n  prompt: after', {
      basePath: '/project',
      fileReader: mockReader({ 'steps.flow': 'prompt: from include\nrun: echo hi' }),
    });
    expect(spec.nodes).toHaveLength(3);
    expect((spec.nodes[0] as PromptNode).text).toBe('from include');
    expect((spec.nodes[1] as RunNode).command).toBe('echo hi');
    expect((spec.nodes[2] as PromptNode).text).toBe('after');
  });

  it('warns on circular include', () => {
    const spec = parseFlow('Goal: test\n\nflow:\n  include "a.flow"', {
      basePath: '/project',
      fileReader: mockReader({ 'a.flow': 'include "a.flow"' }),
    });
    expect(spec.warnings.some((w) => w.includes('Circular include'))).toBe(true);
  });

  it('warns on missing include file', () => {
    const spec = parseFlow('Goal: test\n\nflow:\n  include "missing.flow"', {
      basePath: '/project',
      fileReader: () => {
        throw new Error('ENOENT');
      },
    });
    expect(spec.warnings.some((w) => w.includes('Could not read'))).toBe(true);
  });

  it('rejects absolute paths', () => {
    const spec = parseFlow('Goal: test\n\nflow:\n  include "/etc/passwd"', {
      basePath: '/project',
      fileReader: mockReader({}),
    });
    expect(spec.warnings.some((w) => w.includes('Invalid include path'))).toBe(true);
  });

  it('rejects path traversal', () => {
    const spec = parseFlow('Goal: test\n\nflow:\n  include "../secret.flow"', {
      basePath: '/project',
      fileReader: mockReader({}),
    });
    expect(spec.warnings.some((w) => w.includes('Invalid include path'))).toBe(true);
  });
});

// ── H-LANG-011: Labeled loops ─────────────────────────────────────────

describe('parseFlow — labeled loops', () => {
  it('parses labeled while loop', () => {
    const spec = parse('Goal: test\n\nflow:\n  outer: while true max 3\n    prompt: do\n  end');
    const node = spec.nodes[0] as WhileNode;
    expect(node.kind).toBe('while');
    expect(node.label).toBe('outer');
    expect(node.condition).toBe('true');
    expect(node.maxIterations).toBe(3);
  });

  it('parses labeled until loop', () => {
    const spec = parse('Goal: test\n\nflow:\n  myloop: until done max 5\n    prompt: work\n  end');
    const node = spec.nodes[0] as UntilNode;
    expect(node.kind).toBe('until');
    expect(node.label).toBe('myloop');
    expect(node.condition).toBe('done');
  });

  it('parses labeled retry', () => {
    const spec = parse('Goal: test\n\nflow:\n  attempt: retry max 3\n    run: build\n  end');
    const node = spec.nodes[0] as RetryNode;
    expect(node.kind).toBe('retry');
    expect(node.label).toBe('attempt');
  });

  it('parses labeled foreach', () => {
    const spec = parse(
      'Goal: test\n\nflow:\n  items: foreach x in "a b c"\n    prompt: do ${x}\n  end',
    );
    const node = spec.nodes[0] as ForeachNode;
    expect(node.kind).toBe('foreach');
    expect(node.label).toBe('items');
    expect(node.variableName).toBe('x');
  });

  it('parses break with label', () => {
    const spec = parse('Goal: test\n\nflow:\n  outer: while true max 5\n    break outer\n  end');
    const whileNode = spec.nodes[0] as WhileNode;
    const breakNode = whileNode.body[0] as BreakNode;
    expect(breakNode.kind).toBe('break');
    expect(breakNode.label).toBe('outer');
  });

  it('parses continue with label', () => {
    const spec = parse('Goal: test\n\nflow:\n  outer: while true max 5\n    continue outer\n  end');
    const whileNode = spec.nodes[0] as WhileNode;
    const contNode = whileNode.body[0] as ContinueNode;
    expect(contNode.kind).toBe('continue');
    expect(contNode.label).toBe('outer');
  });
});

// ── H-LANG-008: Loop timeout ──────────────────────────────────────────

describe('parseFlow — loop timeout', () => {
  it('parses while with timeout', () => {
    const spec = parse(
      'Goal: test\n\nflow:\n  while true max 10 timeout 30\n    prompt: work\n  end',
    );
    const node = spec.nodes[0] as WhileNode;
    expect(node.kind).toBe('while');
    expect(node.timeoutSeconds).toBe(30);
    expect(node.maxIterations).toBe(10);
  });

  it('parses until with timeout', () => {
    const spec = parse(
      'Goal: test\n\nflow:\n  until done max 5 timeout 60\n    prompt: work\n  end',
    );
    const node = spec.nodes[0] as UntilNode;
    expect(node.timeoutSeconds).toBe(60);
  });

  it('parses retry with timeout', () => {
    const spec = parse('Goal: test\n\nflow:\n  retry max 3 timeout 120\n    run: build\n  end');
    const node = spec.nodes[0] as RetryNode;
    expect(node.timeoutSeconds).toBe(120);
  });
});

// ── H-ASK-002: ask condition retry budget ────────────────────────────

describe('parseFlow — ask condition retry budget', () => {
  it('parses while ask with max-retries and grounded-by', () => {
    const spec = parse(
      'Goal: test\n\nflow:\n  while ask "ready?" grounded-by "npm test" max-retries 2 max 4\n    prompt: work\n  end',
    );
    const node = spec.nodes[0] as WhileNode;
    expect(node.kind).toBe('while');
    expect(node.condition).toBe('ask:"ready?"');
    expect(node.maxIterations).toBe(4);
    expect(node.askMaxRetries).toBe(2);
    expect(node.groundedBy).toBe('npm test');
  });

  it('parses until ask with max-retries', () => {
    const spec = parse(
      'Goal: test\n\nflow:\n  until ask "done?" max-retries 3 max 5\n    prompt: work\n  end',
    );
    const node = spec.nodes[0] as UntilNode;
    expect(node.kind).toBe('until');
    expect(node.askMaxRetries).toBe(3);
    expect(node.maxIterations).toBe(5);
  });

  it('parses if ask with max-retries', () => {
    const spec = parse(
      'Goal: test\n\nflow:\n  if ask "safe?" grounded-by "npm test" max-retries 1\n    prompt: work\n  end',
    );
    const node = spec.nodes[0] as IfNode;
    expect(node.kind).toBe('if');
    expect(node.askMaxRetries).toBe(1);
    expect(node.groundedBy).toBe('npm test');
  });
});

// ── H-LANG-009: env: section ──────────────────────────────────────────

describe('parseFlow — env section', () => {
  it('parses env section with key=value pairs', () => {
    const spec = parse(
      'Goal: test\n\nenv:\n  NODE_ENV=test\n  DEBUG=true\n\nflow:\n  prompt: hello',
    );
    expect(spec.env).toEqual({ NODE_ENV: 'test', DEBUG: 'true' });
  });

  it('env is undefined when no env section', () => {
    const spec = parse('Goal: test\n\nflow:\n  prompt: hello');
    expect(spec.env).toBeUndefined();
  });

  // Bead 8kt5: parseEnv works when env: is the last section
  it('parses env section when it is the last section in input', () => {
    const spec = parse('Goal: test\n\nenv:\n  NODE_ENV=production\n  PORT=3000');
    expect(spec.env).toEqual({ NODE_ENV: 'production', PORT: '3000' });
  });

  it('parses env section before done when:', () => {
    const spec = parse('Goal: test\n\nenv:\n  NODE_ENV=test\n\ndone when:\n  tests_pass');
    expect(spec.env).toEqual({ NODE_ENV: 'test' });
  });
});

// ── H-LANG-010: Gate all() and N_of() ─────────────────────────────────

describe('parseGates — composite gates', () => {
  it('parses all() gate', () => {
    const gates = parseGates('done when:\n  all(tests_pass, lint_pass)');
    expect(gates).toHaveLength(1);
    expect(gates[0]!.all).toHaveLength(2);
    expect(gates[0]!.all![0]!.predicate).toBe('tests_pass');
    expect(gates[0]!.all![1]!.predicate).toBe('lint_pass');
  });

  it('parses N_of() gate', () => {
    const gates = parseGates('done when:\n  2_of(tests_pass, lint_pass, build_pass)');
    expect(gates).toHaveLength(1);
    expect(gates[0]!.nOf).toBeDefined();
    expect(gates[0]!.nOf!.n).toBe(2);
    expect(gates[0]!.nOf!.gates).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Library system tests
// ---------------------------------------------------------------------------

describe('parseLibraryFile', () => {
  const LIBRARY_CONTENT = `library: testing

export flow fix_and_test(max_retries = "3"):
  retry max \${max_retries}
    run: npm test
    if command_failed
      prompt: Fix the failing tests.
    end
  end

export gates ci_pass():
  tests_pass
  lint_pass

export prompt review_findings(topic = "the code"):
  Please review \${topic} and summarize findings.
`;

  it('parses library name', () => {
    const lib = parseLibraryFile(LIBRARY_CONTENT);
    expect(lib.name).toBe('testing');
  });

  it('parses export flow with default param', () => {
    const lib = parseLibraryFile(LIBRARY_CONTENT);
    const exp = lib.exports.get('fix_and_test');
    expect(exp).toBeDefined();
    expect(exp!.kind).toBe('flow');
    expect(exp!.params).toHaveLength(1);
    expect(exp!.params[0]!.name).toBe('max_retries');
    expect(exp!.params[0]!.default).toBe('3');
  });

  it('parses export gates', () => {
    const lib = parseLibraryFile(LIBRARY_CONTENT);
    const exp = lib.exports.get('ci_pass');
    expect(exp).toBeDefined();
    expect(exp!.kind).toBe('gates');
    expect(exp!.body).toContain('tests_pass');
    expect(exp!.body).toContain('lint_pass');
  });

  it('parses export prompt', () => {
    const lib = parseLibraryFile(LIBRARY_CONTENT);
    const exp = lib.exports.get('review_findings');
    expect(exp).toBeDefined();
    expect(exp!.kind).toBe('prompt');
    expect(exp!.params[0]!.name).toBe('topic');
    expect(exp!.params[0]!.default).toBe('the code');
    expect(exp!.body).toContain('${topic}');
  });

  it('returns empty map for file with no exports', () => {
    const lib = parseLibraryFile('library: empty\n\n# no exports here\n');
    expect(lib.name).toBe('empty');
    expect(lib.exports.size).toBe(0);
  });
});

describe('parseFlow — anonymous import inlines flow content', () => {
  const SHARED_FLOW = `Goal: shared steps

flow:
  run: npm test
  prompt: Review results.
`;

  it('inlines anonymous import flow block into parent', () => {
    const mainDsl = `Goal: main task

import "shared.flow"

flow:
  prompt: Start here.
`;
    const spec = parseFlow(mainDsl, {
      basePath: '/fake',
      fileReader: (p: string) => {
        if (p.endsWith('shared.flow')) return SHARED_FLOW;
        throw new Error(`unexpected: ${p}`);
      },
    });
    // The inlined flow block replaces the import line; nodes from shared file appear
    const kinds = spec.nodes.map((n) => n.kind);
    expect(kinds).toContain('run');
    expect(kinds).toContain('prompt');
  });

  it('adds imported file path to spec.imports for namespaced import', () => {
    const libContent = `library: testing

export prompt greet():
  Hello from library.
`;
    const spec = parseFlow(
      `Goal: test\n\nimport "lib.flow" as testing\n\nflow:\n  use testing.greet()\n`,
      {
        basePath: '/fake',
        fileReader: (p: string) => {
          if (p.endsWith('lib.flow')) return libContent;
          throw new Error(`unexpected: ${p}`);
        },
      },
    );
    expect(spec.imports).toBeDefined();
    expect(spec.imports!.some((p) => p.endsWith('lib.flow'))).toBe(true);
  });
});

describe('parseFlow — use namespace.symbol expansion', () => {
  const LIB_CONTENT = `library: testing

export flow fix_and_test(max_retries = "3"):
  retry max \${max_retries}
    run: npm test
    if command_failed
      prompt: Fix the failing tests.
    end
  end

export prompt review_findings(topic = "the code"):
  Please review \${topic} and summarize findings.
`;

  function makeSpec(flowBody: string): ReturnType<typeof parseFlow> {
    return parseFlow(`Goal: test\n\nimport "lib.flow" as testing\n\nflow:\n${flowBody}\n`, {
      basePath: '/fake',
      fileReader: (p: string) => {
        if (p.endsWith('lib.flow')) return LIB_CONTENT;
        throw new Error(`unexpected: ${p}`);
      },
    });
  }

  it('expands use testing.fix_and_test() to retry nodes using default param', () => {
    const spec = makeSpec('  use testing.fix_and_test()');
    expect(spec.nodes).toHaveLength(1);
    expect(spec.nodes[0]!.kind).toBe('retry');
  });

  it('expands use testing.fix_and_test() with overridden param', () => {
    const spec = makeSpec('  use testing.fix_and_test(max_retries = "5")');
    expect(spec.nodes).toHaveLength(1);
    const retry = spec.nodes[0] as import('../domain/flow-node.js').RetryNode;
    expect(retry.kind).toBe('retry');
    expect(retry.maxAttempts).toBe(5);
  });

  it('expands use testing.fix_and_test() with multiple args', () => {
    const spec = makeSpec('  use testing.fix_and_test(max_retries = "5", extra = "ignored")');
    expect(spec.nodes).toHaveLength(1);
    const retry = spec.nodes[0] as import('../domain/flow-node.js').RetryNode;
    expect(retry.kind).toBe('retry');
    expect(retry.maxAttempts).toBe(5);
  });

  it('expands use testing.review_findings() to prompt node', () => {
    const spec = makeSpec('  use testing.review_findings()');
    expect(spec.nodes).toHaveLength(1);
    expect(spec.nodes[0]!.kind).toBe('prompt');
    const p = spec.nodes[0] as import('../domain/flow-node.js').PromptNode;
    expect(p.text).toContain('the code');
  });

  it('expands use testing.review_findings() with custom topic', () => {
    const spec = makeSpec('  use testing.review_findings(topic = "the API design")');
    const p = spec.nodes[0] as import('../domain/flow-node.js').PromptNode;
    expect(p.text).toContain('the API design');
  });

  it('warns on unknown namespace', () => {
    const spec = makeSpec('  use unknown.foo()');
    expect(spec.warnings.some((w) => w.includes('Unknown namespace'))).toBe(true);
  });

  it('warns on unknown symbol', () => {
    const spec = makeSpec('  use testing.nonexistent()');
    expect(spec.warnings.some((w) => w.includes('Unknown symbol'))).toBe(true);
  });

  it('warns on invalid use syntax', () => {
    const spec = parseFlow('Goal: test\n\nimport "lib.flow" as testing\n\nflow:\n  use testing\n', {
      basePath: '/fake',
      fileReader: (p: string) => {
        if (p.endsWith('lib.flow')) return LIB_CONTENT;
        throw new Error(`unexpected: ${p}`);
      },
    });
    expect(spec.warnings.some((w) => w.includes('Invalid use syntax'))).toBe(true);
  });
});

describe('parseFlow — import cycle detection', () => {
  it('warns on circular import and skips the repeat', () => {
    const callCount: Record<string, number> = {};
    const spec = parseFlow(`Goal: test\n\nimport "a.flow"\n\nflow:\n  prompt: hi\n`, {
      basePath: '/fake',
      fileReader: (p: string) => {
        const key = p.replace(/\\/g, '/');
        callCount[key] = (callCount[key] ?? 0) + 1;
        // Simulate a.flow that imports itself (circular)
        if (key.endsWith('a.flow')) {
          if ((callCount[key] ?? 0) > 1) throw new Error('read twice');
          return `Goal: a\n\nimport "a.flow"\n\nflow:\n  run: echo a\n`;
        }
        throw new Error(`unexpected: ${p}`);
      },
    });
    expect(spec.warnings.some((w) => w.toLowerCase().includes('circular'))).toBe(true);
  });
});

describe('parseFlow — missing import file warning', () => {
  it('emits warning when import file cannot be read', () => {
    const spec = parseFlow(`Goal: test\n\nimport "missing.flow"\n\nflow:\n  prompt: hi\n`, {
      basePath: '/fake',
      fileReader: () => {
        throw new Error('ENOENT');
      },
    });
    expect(spec.warnings.some((w) => w.includes('missing.flow'))).toBe(true);
  });
});

// ── Feature: let x = prompt "..." as json { ... } ─────────────────────────
describe('parseLetLine — prompt_json single-line as json', () => {
  it('parses a single-line as-json schema into prompt_json source', () => {
    const spec = parse(
      'Goal: test\n\nflow:\n  let x = prompt "analyze" as json { severity: "low" | "high" }',
    );
    const node = spec.nodes[0] as LetNode;
    expect(node.kind).toBe('let');
    expect(node.variableName).toBe('x');
    expect(node.source.type).toBe('prompt_json');
    if (node.source.type === 'prompt_json') {
      expect(node.source.text).toBe('analyze');
      expect(node.source.schema).toContain('severity');
    }
  });

  it('stores the schema text for a single-line declaration', () => {
    const spec = parse('Goal: test\n\nflow:\n  let result = prompt "scan" as json { count: 0 }');
    const node = spec.nodes[0] as LetNode;
    expect(node.source.type).toBe('prompt_json');
    if (node.source.type === 'prompt_json') {
      expect(node.source.schema).toContain('count');
    }
  });
});

describe('parseLetLine — prompt_json multi-line as json', () => {
  it('parses a multi-line schema block into prompt_json source', () => {
    const dsl = [
      'Goal: test',
      '',
      'flow:',
      '  let analysis = prompt "review" as json {',
      '    severity: "low" | "high",',
      '    files: string[]',
      '  }',
    ].join('\n');
    const spec = parse(dsl);
    const node = spec.nodes[0] as LetNode;
    expect(node.kind).toBe('let');
    expect(node.variableName).toBe('analysis');
    expect(node.source.type).toBe('prompt_json');
    if (node.source.type === 'prompt_json') {
      expect(node.source.text).toBe('review');
      expect(node.source.schema).toContain('severity');
      expect(node.source.schema).toContain('files');
    }
  });

  it('does not include the closing brace in the schema text', () => {
    const dsl = [
      'Goal: test',
      '',
      'flow:',
      '  let x = prompt "scan" as json {',
      '    key: "value"',
      '  }',
    ].join('\n');
    const spec = parse(dsl);
    const node = spec.nodes[0] as LetNode;
    if (node.source.type === 'prompt_json') {
      expect(node.source.schema).not.toContain('}');
    }
  });

  it('continues parsing subsequent nodes after a multi-line as-json block', () => {
    const dsl = [
      'Goal: test',
      '',
      'flow:',
      '  let x = prompt "scan" as json {',
      '    field: "value"',
      '  }',
      '  prompt: next step',
    ].join('\n');
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(2);
    expect(spec.nodes[1]!.kind).toBe('prompt');
  });
});

import type { ApproveNode, ReviewNode } from '../domain/flow-node.js';

describe('parseFlow — approve node', () => {
  it('parses approve with double-quoted message', () => {
    const spec = parse(
      'Goal: g\n\nflow:\n  approve "Please review these changes before deploying"',
    );
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as ApproveNode;
    expect(node.kind).toBe('approve');
    expect(node.message).toBe('Please review these changes before deploying');
    expect(node.timeoutSeconds).toBeUndefined();
  });

  it('parses approve with single-quoted message', () => {
    const spec = parse("Goal: g\n\nflow:\n  approve 'Deploy to production?'");
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as ApproveNode;
    expect(node.kind).toBe('approve');
    expect(node.message).toBe('Deploy to production?');
  });

  it('parses approve with timeout', () => {
    const spec = parse('Goal: g\n\nflow:\n  approve "Deploy to production?" timeout 60');
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as ApproveNode;
    expect(node.kind).toBe('approve');
    expect(node.message).toBe('Deploy to production?');
    expect(node.timeoutSeconds).toBe(60);
  });

  it('falls back to prompt node and emits warning on invalid approve syntax', () => {
    const spec = parse('Goal: g\n\nflow:\n  approve missing-quotes');
    expect(spec.nodes).toHaveLength(1);
    expect(spec.nodes[0]!.kind).toBe('prompt');
    expect(spec.warnings.some((w) => w.includes('Invalid approve syntax'))).toBe(true);
  });

  it('assigns unique ids to approve nodes', () => {
    const spec = parse(
      'Goal: g\n\nflow:\n  approve "First gate"\n  approve "Second gate" timeout 30',
    );
    expect(spec.nodes).toHaveLength(2);
    expect(spec.nodes[0]!.id).not.toBe(spec.nodes[1]!.id);
  });
});

describe('parseFlow — review block', () => {
  it('parses review with max only', () => {
    const dsl = [
      'Goal: g',
      '',
      'flow:',
      '  review max 3',
      '    prompt: Do the work',
      '    run: npm test',
      '  end',
    ].join('\n');
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as ReviewNode;
    expect(node.kind).toBe('review');
    expect(node.maxRounds).toBe(3);
    expect(node.criteria).toBeUndefined();
    expect(node.groundedBy).toBeUndefined();
    expect(node.body).toHaveLength(2);
  });

  it('parses review with criteria and max', () => {
    const dsl = [
      'Goal: g',
      '',
      'flow:',
      '  review criteria: "Code must pass all tests" max 5',
      '    prompt: Fix the code',
      '  end',
    ].join('\n');
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as ReviewNode;
    expect(node.kind).toBe('review');
    expect(node.maxRounds).toBe(5);
    expect(node.criteria).toBe('Code must pass all tests');
    expect(node.groundedBy).toBeUndefined();
  });

  it('parses review with grounded-by and max', () => {
    const dsl = [
      'Goal: g',
      '',
      'flow:',
      '  review grounded-by "npm test" max 3',
      '    prompt: Fix the failures',
      '  end',
    ].join('\n');
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as ReviewNode;
    expect(node.kind).toBe('review');
    expect(node.maxRounds).toBe(3);
    expect(node.groundedBy).toBe('npm test');
    expect(node.criteria).toBeUndefined();
  });

  it('parses review with criteria, grounded-by, and max', () => {
    const dsl = [
      'Goal: g',
      '',
      'flow:',
      '  review criteria: "Be thorough" grounded-by "npm test" max 3',
      '    prompt: Do the work',
      '  end',
    ].join('\n');
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as ReviewNode;
    expect(node.kind).toBe('review');
    expect(node.maxRounds).toBe(3);
    expect(node.criteria).toBe('Be thorough');
    expect(node.groundedBy).toBe('npm test');
  });

  it('parses review with single-quoted grounded-by', () => {
    const dsl = [
      'Goal: g',
      '',
      'flow:',
      "  review grounded-by 'node verify.js' max 2",
      '    prompt: Implement',
      '  end',
    ].join('\n');
    const spec = parse(dsl);
    const node = spec.nodes[0] as ReviewNode;
    expect(node.groundedBy).toBe('node verify.js');
  });

  it('falls back to prompt node and emits warning on review missing max', () => {
    const dsl = ['Goal: g', '', 'flow:', '  review criteria: "xyz"', '  end'].join('\n');
    const spec = parse(dsl);
    expect(spec.nodes[0]!.kind).toBe('prompt');
    expect(spec.warnings.some((w) => w.includes('Invalid review syntax'))).toBe(true);
  });

  it('review body nodes are correctly populated', () => {
    const dsl = [
      'Goal: g',
      '',
      'flow:',
      '  review max 2',
      '    prompt: Step one',
      '    run: echo done',
      '    prompt: Step two',
      '  end',
    ].join('\n');
    const spec = parse(dsl);
    const node = spec.nodes[0] as ReviewNode;
    expect(node.body).toHaveLength(3);
    expect(node.body[0]!.kind).toBe('prompt');
    expect(node.body[1]!.kind).toBe('run');
    expect(node.body[2]!.kind).toBe('prompt');
  });

  it('review node gets a unique id', () => {
    const dsl = [
      'Goal: g',
      '',
      'flow:',
      '  review max 1',
      '    prompt: work',
      '  end',
      '  review max 2',
      '    prompt: more work',
      '  end',
    ].join('\n');
    const spec = parse(dsl);
    expect(spec.nodes[0]!.id).not.toBe(spec.nodes[1]!.id);
  });

  it('parses review strict using judge', () => {
    const dsl = [
      'Goal: g',
      '',
      'judge "impl_quality"',
      '  kind: model',
      'end',
      '',
      'flow:',
      '  review strict using judge "impl_quality" max 3',
      '    prompt: Do the work',
      '  end',
    ].join('\n');
    const spec = parse(dsl);
    const node = spec.nodes[0] as ReviewNode;
    expect(node.kind).toBe('review');
    expect(node.strict).toBe(true);
    expect(node.judgeName).toBe('impl_quality');
    expect(node.maxRounds).toBe(3);
  });
});

describe('parseFlow — rubric and judge declarations', () => {
  it('parses top-level rubric and judge blocks', () => {
    const dsl = [
      'Goal: g',
      '',
      'rubric "bugfix_quality"',
      '  criterion correctness type boolean weight 0.50',
      '  pass when:',
      '    correctness == true',
      'end',
      '',
      'judge "impl_quality"',
      '  kind: model',
      '  rubric: "bugfix_quality"',
      'end',
      '',
      'flow:',
      '  prompt: continue',
    ].join('\n');
    const spec = parse(dsl);

    expect(spec.rubrics).toHaveLength(1);
    expect(spec.rubrics?.[0]?.name).toBe('bugfix_quality');
    expect(spec.rubrics?.[0]?.lines).toEqual([
      'criterion correctness type boolean weight 0.50',
      'pass when:',
      '  correctness == true',
    ]);
    expect(spec.judges).toHaveLength(1);
    expect(spec.judges?.[0]?.name).toBe('impl_quality');
    expect(spec.judges?.[0]?.rubric).toBe('bugfix_quality');
  });

  it('warns and skips judge syntax inside done when', () => {
    const dsl = [
      'Goal: g',
      '',
      'flow:',
      '  prompt: continue',
      '',
      'done when:',
      '  judge "impl_quality"',
    ].join('\n');
    const spec = parse(dsl);

    expect(spec.completionGates).toEqual([]);
    expect(
      spec.warnings.some((warning) => warning.includes('Unsupported judge/rubric gate syntax')),
    ).toBe(true);
  });
});

describe('parseFlow — ask conditions', () => {
  it('parses while ask with grounded-by and max-retries', () => {
    const dsl = [
      'Goal: g',
      '',
      'flow:',
      '  while ask "is it ready?" grounded-by "npm test" max-retries 2 max 3',
      '    prompt: keep working',
      '  end',
    ].join('\n');
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as WhileNode;
    expect(node.kind).toBe('while');
    expect(node.groundedBy).toBe('npm test');
    expect(node.askMaxRetries).toBe(2);
    expect(node.maxIterations).toBe(3);
  });

  it('parses until ask with max-retries even when option order changes', () => {
    const dsl = [
      'Goal: g',
      '',
      'flow:',
      '  until ask "done yet?" max-retries 4 grounded-by "cat status.txt" max 5',
      '    prompt: keep going',
      '  end',
    ].join('\n');
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as UntilNode;
    expect(node.kind).toBe('until');
    expect(node.groundedBy).toBe('cat status.txt');
    expect(node.askMaxRetries).toBe(4);
    expect(node.maxIterations).toBe(5);
  });

  it('parses if ask with max-retries', () => {
    const dsl = [
      'Goal: g',
      '',
      'flow:',
      '  if ask "should proceed?" grounded-by "check.sh" max-retries 1',
      '    prompt: then',
      '  else',
      '    prompt: else',
      '  end',
    ].join('\n');
    const spec = parse(dsl);
    expect(spec.nodes).toHaveLength(1);
    const node = spec.nodes[0] as IfNode;
    expect(node.kind).toBe('if');
    expect(node.groundedBy).toBe('check.sh');
    expect(node.askMaxRetries).toBe(1);
    expect(node.thenBranch).toHaveLength(1);
    expect(node.elseBranch).toHaveLength(1);
  });
});

// ── Import path validation edge cases ─────────────────────────────────────
describe('parseFlow — import path validation', () => {
  it('warns and skips an absolute import path', () => {
    const spec = parseFlow('Goal: g\n\nimport "/etc/passwd.flow"\n\nflow:\n  prompt: hi\n', {
      basePath: '/proj',
      fileReader: () => 'Goal: x\nflow:\n  prompt: y',
    });
    expect(spec.warnings.some((w) => w.includes('/etc/passwd.flow'))).toBe(true);
    expect(spec.warnings.some((w) => w.includes('Invalid import path'))).toBe(true);
  });

  it('warns and skips an import with a disallowed extension', () => {
    const spec = parseFlow('Goal: g\n\nimport "script.sh"\n\nflow:\n  prompt: hi\n', {
      basePath: '/proj',
      fileReader: () => 'content',
    });
    expect(spec.warnings.some((w) => w.includes('Invalid import path'))).toBe(true);
  });

  it('does not duplicate a namespace already in registry during recursive import', () => {
    // Outer imports ns "lib"; inner also imports ns "lib" — second should be skipped
    const fileReaderMap: Record<string, string> = {
      '/proj/outer.flow':
        'Goal: outer\n\nimport "inner.flow"\nimport "lib.flow" as lib\n\nflow:\n  prompt: hi\n',
      '/proj/inner.flow': 'Goal: inner\n\nimport "lib.flow" as lib\n\nflow:\n  prompt: inner\n',
      '/proj/lib.flow': 'library: lib\nexport prompt greet():\n  hello\n',
    };
    const spec = parseFlow('Goal: g\n\nimport "outer.flow"\n\nflow:\n  prompt: go\n', {
      basePath: '/proj',
      fileReader: (p: string) => {
        if (fileReaderMap[p]) return fileReaderMap[p];
        throw new Error(`ENOENT: ${p}`);
      },
    });
    // Should parse without errors (no crash from duplicate namespace)
    expect(spec.goal).toBe('g');
  });
});

// ── resolveImports — anonymous import propagates sub-namespace ─────────

describe('parseFlow — anonymous import propagates namespaced imports', () => {
  it('propagates sub-namespaced library from anonymous import to parent registry', () => {
    // outer.flow is imported anonymously; it imports lib.flow as "utils"
    // The parent should then be able to use "utils" namespace
    const libContent = `library: utils\nexport prompt greet():\n  hello\n`;
    const outerContent = `Goal: outer\n\nimport "lib.flow" as utils\n\nflow:\n  prompt: from outer\n`;
    const spec = parseFlow(`Goal: main\n\nimport "outer.flow"\n\nflow:\n  use utils.greet()\n`, {
      basePath: '/proj',
      fileReader: (p: string) => {
        if (p.endsWith('outer.flow')) return outerContent;
        if (p.endsWith('lib.flow')) return libContent;
        throw new Error(`unexpected: ${p}`);
      },
    });
    // The utils.greet() should expand to a prompt node
    expect(spec.nodes.some((n) => n.kind === 'prompt')).toBe(true);
  });
});

// ── expandUseNode — unknown namespace (no import) ─────────────────────

describe('parseFlow — use without import emits unknown-namespace warning', () => {
  it('warns when use references a namespace that was never imported', () => {
    const spec = parseFlow(`Goal: test\n\nflow:\n  use mylib.do_something()\n`);
    expect(spec.warnings.some((w) => w.includes('Unknown namespace') && w.includes('mylib'))).toBe(
      true,
    );
  });
});

// ── expandUseNode — missing required argument ─────────────────────────

describe('parseFlow — use with missing required argument', () => {
  it('warns when required argument is missing in use call', () => {
    const libContent = `library: mylib\nexport flow process(required_arg):\n  prompt: do ${'{required_arg}'}\n`;
    const spec = parseFlow(
      `Goal: test\n\nimport "mylib.flow" as mylib\n\nflow:\n  use mylib.process()\n`,
      {
        basePath: '/fake',
        fileReader: (p: string) => {
          if (p.endsWith('mylib.flow')) return libContent;
          throw new Error(`unexpected: ${p}`);
        },
      },
    );
    expect(spec.warnings.some((w) => w.includes('Missing required argument'))).toBe(true);
  });
});

// ── expandUseNode — gates export cannot be used as flow node ─────────

describe('parseFlow — use gates export emits warning', () => {
  it('warns when trying to use a gates export as a flow node', () => {
    // A library with an "export gates" section (kind = 'gates'), used via `use`
    const libContent = `library: mylib

export gates must_pass:
  tests_pass
`;
    const spec = parseFlow(
      `Goal: test\n\nimport "mylib.flow" as mylib\n\nflow:\n  use mylib.must_pass()\n`,
      {
        basePath: '/fake',
        fileReader: (p: string) => {
          if (p.endsWith('mylib.flow')) return libContent;
          throw new Error(`unexpected: ${p}`);
        },
      },
    );
    // Should warn and not create a node for the gates export
    expect(spec.warnings.some((w) => w.includes('Cannot use export gates'))).toBe(true);
  });
});

describe('parseFlow — swarm surface', () => {
  it('lowers authored swarm syntax into ordinary runtime nodes', () => {
    const spec = parse(`Goal: g

flow:
  swarm checkout_fix
    role frontend model "sonnet" in "apps/web" with vars issue, files
      prompt: Fix the UI regression
      return ${'${summary}'}
    end
    role backend
      run: npm test
    end
    flow:
      start frontend, backend
      await frontend backend
    end
  end`);

    expect(spec.warnings).toEqual([]);
    expect(spec.nodes).toHaveLength(6);
    expect(spec.nodes.map((node) => node.kind)).toEqual([
      'spawn',
      'spawn',
      'await',
      'receive',
      'await',
      'receive',
    ]);

    const frontend = spec.nodes[0] as SpawnNode;
    expect(frontend).toMatchObject({
      kind: 'spawn',
      name: 'frontend',
      model: 'sonnet',
      cwd: 'apps/web',
      vars: ['issue', 'files'],
    });
    expect(frontend.body.map((node) => node.kind)).toEqual(['prompt', 'send']);
    expect(frontend.body[1]).toMatchObject({
      kind: 'send',
      target: 'parent',
      message: '${summary}',
    });

    expect((spec.nodes[2] as AwaitNode).target).toBe('frontend');
    expect(spec.nodes[3]).toMatchObject({
      kind: 'receive',
      variableName: '__checkout_fix_frontend_returned',
      from: 'frontend',
      timeoutSeconds: 30,
    });
    expect((spec.nodes[4] as AwaitNode).target).toBe('backend');
  });

  it('warns when role is used outside a swarm block', () => {
    const spec = parse(`Goal: g

flow:
  role frontend
    prompt: hi
  end`);

    expect(spec.warnings).toContain('line 1: "role" is only valid inside a swarm block');
  });

  it('warns when start is used outside swarm flow', () => {
    const spec = parse(`Goal: g

flow:
  start frontend`);

    expect(spec.warnings).toContain('line 1: "start" is only valid inside swarm flow:');
    expect((spec.nodes[0] as StartNode).targets).toEqual(['frontend']);
  });

  it('warns when return is used outside a role', () => {
    const spec = parse(`Goal: g

flow:
  return ${'${summary}'}`);

    expect(spec.warnings).toContain('line 1: "return" is only valid inside a role');
    expect((spec.nodes[0] as ReturnNode).expression).toBe('${summary}');
  });

  it('propagates lowering warnings from authored swarm blocks', () => {
    const spec = parse(`Goal: g

flow:
  swarm checkout_fix
    role frontend
      prompt: Fix the UI regression
    end
    flow:
      start backend
    end
  end`);

    expect(spec.warnings).toContain('swarm checkout_fix start references unknown role "backend"');
    expect(spec.nodes).toEqual([]);
  });

  it('surfaces lowering warnings for malformed authored role headers', () => {
    const spec = parse(`Goal: g

flow:
  swarm checkout_fix
    role "frontend"
      prompt: Fix the UI regression
    end
    flow:
      start role
    end
  end`);

    expect(spec.warnings).toEqual([
      'Invalid swarm role header: "role "frontend""',
      'swarm checkout_fix start references unknown role "role"',
    ]);
  });

  it('surfaces lowering warnings for authored swarm flows with undeclared starts', () => {
    const spec = parse(`Goal: g

flow:
  swarm checkout_fix
    flow:
      start frontend
    end
    flow:
      start frontend
    end
  end`);

    expect(spec.warnings).toEqual(['swarm checkout_fix start references unknown role "frontend"']);
  });

  it('surfaces lowering warnings when authored swarm blocks have no lowering flow body', () => {
    const spec = parse(`Goal: g

flow:
  swarm checkout_fix
    prompt: Fix the UI regression
  end`);

    expect(spec.warnings).toEqual(['swarm checkout_fix has no lowering flow body']);
  });

  it('warns on invalid start, await, and return syntax and recovers as prompt nodes', () => {
    const spec = parse(`Goal: g

flow:
  start
  await
  return`);

    expect(spec.warnings).toContain(
      'line 1: Invalid start syntax: "start" — expected start <role>[, <role>...]',
    );
    expect(spec.warnings).toContain(
      'line 2: Invalid await syntax: "await" — expected await all or await "name"',
    );
    expect(spec.warnings).toContain(
      'line 3: Invalid return syntax: "return" — expected return <expression>',
    );
    expect(spec.nodes.map((node) => node.kind)).toEqual(['prompt', 'prompt', 'prompt']);
  });

  it('lowers authored swarm blocks inside use-expanded library flows', () => {
    const libContent = `library: testing

export flow parallel_fix():
  swarm checkout_fix
    role frontend
      prompt: Fix the UI regression
      return \${summary}
    end
    flow:
      start frontend
      await all
    end
  end
`;

    const spec = parseFlow(
      `Goal: test

import "lib.flow" as testing

flow:
  use testing.parallel_fix()
`,
      {
        basePath: '/fake',
        fileReader: (path: string) => {
          if (path.endsWith('lib.flow')) return libContent;
          throw new Error(`unexpected: ${path}`);
        },
      },
    );

    expect(spec.warnings).toEqual([]);
    expect(spec.nodes.map((node) => node.kind)).toEqual(['spawn', 'await', 'receive']);
  });
});

describe('parseFlow — top-level declaration recovery', () => {
  it('warns when a rubric block is auto-closed by dedent', () => {
    const spec = parse(`Goal: g

rubric "bugfix_quality"
  criterion correctness type boolean
judge "impl_quality"
  rubric: "bugfix_quality"
end

flow:
  prompt: hi`);

    expect(spec.warnings).toContain(
      'line 3: Missing "end" for rubric "bugfix_quality" — auto-closed block',
    );
    expect(spec.rubrics?.[0]?.name).toBe('bugfix_quality');
    expect(spec.judges?.[0]?.name).toBe('impl_quality');
  });

  it('warns when a judge block is auto-closed at end of file', () => {
    const spec = parse(`Goal: g

judge "impl_quality"
  rubric: "bugfix_quality"`);

    expect(spec.warnings).toContain(
      'line 3: Missing "end" for judge "impl_quality" — auto-closed block',
    );
    expect(spec.judges?.[0]?.name).toBe('impl_quality');
  });
});
