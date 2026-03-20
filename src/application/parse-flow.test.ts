import { describe, it, expect } from 'vitest';
import { parseFlow } from './parse-flow.js';
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
    expect(spec.warnings).toContain('Missing "max N" on while — defaulting to 5');
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
    expect(spec.warnings).toContain('Missing "max N" on until — defaulting to 5');
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
    expect(spec.warnings).toContain('Unknown keyword "frobnicate the widget" — treating as prompt');
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
