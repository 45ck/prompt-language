/**
 * InjectContext — UserPromptSubmit hook use case.
 *
 * If the prompt starts a new flow, parse it and persist session state.
 * If a flow is already active, inject step context into the prompt.
 */

import { createSessionState, advanceNode, updateVariable } from '../domain/session-state.js';
import type { SessionState } from '../domain/session-state.js';
import type { FlowNode } from '../domain/flow-node.js';
import type { StateStore } from './ports/state-store.js';
import type { CommandRunner } from './ports/command-runner.js';
import { parseFlow } from './parse-flow.js';
import { renderFlow } from '../domain/render-flow.js';
import { interpolate } from '../domain/interpolate.js';

const FLOW_BLOCK_RE = /^\s*flow:\s*$/m;

const NL_INTENT_WORDS = [
  // Multi-word intent phrases (high precision)
  '\\bkeep going\\b',
  '\\bkeep running\\b',
  '\\bkeep fixing\\b',
  '\\bkeep trying\\b',
  "\\bdon't stop\\b",
  '\\bdont stop\\b',
  '\\bdo not stop\\b',
  '\\btry again\\b',
  '\\btry up to\\b',
  '\\bnot done\\b',
  '\\bon failure\\b',
  '\\bon error\\b',
  '\\bcatch failures\\b',
  // Single-word DSL keywords (only match standalone DSL verbs)
  '\\bretry\\b',
  '\\bloop\\b',
  '\\brepeat\\b',
  '\\bfallback\\b',
  // Quantified intent (require number context)
  '\\b\\d+\\s+times\\b',
  // Compound patterns (bounded distance prevents cross-sentence matching)
  '\\brun\\b.{1,20}\\buntil\\b',
  '\\bfix\\b.{1,20}\\buntil\\b',
  '\\bkeep\\b.{1,20}\\buntil\\b',
  '\\bloop\\b.{1,20}\\buntil\\b',
  '\\bstop\\b.{1,20}\\buntil\\b',
  '\\bwhile\\b.{1,20}\\bfail',
  '\\buntil\\b.{1,20}\\bpass',
  '\\bif\\b.{1,30}\\bthen\\b',
  '\\bif\\b.{1,20}\\bfail',
  '\\bif\\b.{1,20}\\berror',
];

const NL_INTENT_RE = new RegExp(NL_INTENT_WORDS.join('|'), 'i');

export function looksLikeNaturalLanguage(prompt: string): boolean {
  if (FLOW_BLOCK_RE.test(prompt)) return false;
  return NL_INTENT_RE.test(prompt);
}

const DSL_REFERENCE = `\
## prompt-language DSL reference

Six primitives plus try/catch and let/var. Blocks use indentation + explicit \`end\`.

### Structure
\`\`\`
Goal: <one-line description>

flow:
  <steps indented 2 spaces>

done when:
  <gate predicates>
\`\`\`

### Primitives

**prompt** — Inject text as the agent's next instruction.
  prompt: Fix the failing auth tests.

**run** — Execute a shell command.
  run: npm test

**let/var** — Store a named variable for later interpolation via \`\${varName}\`.
  let greeting = "hello world"        # literal string
  let info = prompt "Summarize this"  # stores prompt text as context
  var output = run "echo hi"          # executes command, stores stdout

**while** — Loop while condition is true. Requires \`max N\`.
  while tests_fail max 5
    prompt: Fix the tests.
    run: npm test
  end

**until** — Loop until condition becomes true. Requires \`max N\`.
  until tests_pass max 5
    prompt: Fix the tests.
    run: npm test
  end

**retry** — Retry a block on failure. Requires \`max N\`.
  retry max 3
    run: npm run build
  end

**if/else** — Conditional branching.
  if lint_fail
    prompt: Fix lint errors.
    run: npm run lint
  else
    prompt: Lint passed. Move on.
  end

**try/catch** — Execute and catch failures.
  try
    run: npm run deploy
  catch command_failed
    prompt: Deploy failed. Roll back.
  end

### Variable interpolation
Use \`\${varName}\` in prompt and run text to substitute stored values.
  let name = "auth module"
  prompt: Refactor the \${name} for clarity.

### done when
Completion gates — the agent cannot stop until these hold.
  done when:
    tests_pass
    lint_pass

### Built-in variables (auto-set after each run)
last_exit_code, command_failed, command_succeeded,
tests_pass, tests_fail, lint_pass, lint_fail,
file_exists, diff_nonempty`;

export function buildMetaPrompt(userPrompt: string): string {
  return `\
[prompt-language] I detected control-flow intent in your message. \
Please respond with a valid prompt-language \`flow:\` block that captures what you want.

${DSL_REFERENCE}

---

**User's original message:**
${userPrompt}

---

Respond with ONLY a valid prompt-language program (Goal + flow: block + optional done when:). \
Do not explain — just emit the DSL. The program will be parsed and executed automatically.`;
}

export interface InjectContextInput {
  readonly prompt: string;
  readonly sessionId: string;
}

export interface InjectContextOutput {
  readonly prompt: string;
}

function hasFlowBlock(prompt: string): boolean {
  return FLOW_BLOCK_RE.test(prompt);
}

function resolveCurrentNode(nodes: readonly FlowNode[], path: readonly number[]): FlowNode | null {
  if (path.length === 0) return null;
  const idx = path[0]!;
  const node = nodes[idx];
  if (!node) return null;
  if (path.length === 1) return node;
  const rest = path.slice(1);
  switch (node.kind) {
    case 'while':
    case 'until':
    case 'retry':
      return resolveCurrentNode(node.body, rest);
    case 'if':
      return resolveCurrentNode([...node.thenBranch, ...node.elseBranch], rest);
    case 'try':
      return resolveCurrentNode([...node.body, ...node.catchBody], rest);
    default:
      return null;
  }
}

function advancePath(path: readonly number[]): readonly number[] {
  if (path.length === 0) return [0];
  const last = path[path.length - 1]!;
  return [...path.slice(0, -1), last + 1];
}

async function autoAdvanceLetNodes(
  state: SessionState,
  commandRunner?: CommandRunner,
): Promise<SessionState> {
  const MAX_ADVANCES = 100;
  let advances = 0;
  let current = state;

  while (advances < MAX_ADVANCES) {
    const node = resolveCurrentNode(current.flowSpec.nodes, current.currentNodePath);
    if (node?.kind !== 'let') break;

    const letNode = node;
    let value: string;

    switch (letNode.source.type) {
      case 'literal':
        value = letNode.source.value;
        break;
      case 'prompt':
        value = letNode.source.text;
        break;
      case 'run':
        if (commandRunner) {
          const result = await commandRunner.run(letNode.source.command);
          value = result.stdout.trimEnd();
        } else {
          value = '';
        }
        break;
    }

    current = updateVariable(current, letNode.variableName, value);
    current = advanceNode(current, advancePath(current.currentNodePath));
    advances += 1;
  }

  return current;
}

export async function injectContext(
  input: InjectContextInput,
  stateStore: StateStore,
  commandRunner?: CommandRunner,
): Promise<InjectContextOutput> {
  const existing = await stateStore.loadCurrent();

  if (existing?.status === 'active') {
    const advanced = await autoAdvanceLetNodes(existing, commandRunner);
    if (advanced !== existing) {
      await stateStore.save(advanced);
    }
    const ctx = renderFlow(advanced);
    const interpolated = interpolate(input.prompt, advanced.variables);
    return { prompt: `${ctx}\n\n${interpolated}` };
  }

  if (hasFlowBlock(input.prompt)) {
    const spec = parseFlow(input.prompt);
    let session = createSessionState(input.sessionId, spec);
    session = await autoAdvanceLetNodes(session, commandRunner);
    await stateStore.save(session);
    const ctx = renderFlow(session);
    return { prompt: `${ctx}\n\n${input.prompt}` };
  }

  if (looksLikeNaturalLanguage(input.prompt)) {
    return { prompt: buildMetaPrompt(input.prompt) };
  }

  return { prompt: input.prompt };
}
