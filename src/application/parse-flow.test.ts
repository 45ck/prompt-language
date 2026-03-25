import { describe, it, expect } from 'vitest';
import { parseFlow, parseGates, detectBareFlow } from './parse-flow.js';
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
