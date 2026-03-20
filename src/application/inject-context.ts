/**
 * InjectContext — UserPromptSubmit hook use case.
 *
 * If the prompt starts a new flow, parse it and persist session state.
 * If a flow is already active, inject step context into the prompt.
 */

import {
  createSessionState,
  advanceNode,
  updateVariable,
  updateNodeProgress,
  markCompleted,
  allGatesPassing,
} from '../domain/session-state.js';
import type { SessionState } from '../domain/session-state.js';
import type { FlowNode } from '../domain/flow-node.js';
import type { StateStore } from './ports/state-store.js';
import type { CommandRunner } from './ports/command-runner.js';
import { parseFlow } from './parse-flow.js';
import { renderFlow } from '../domain/render-flow.js';
import { interpolate, shellInterpolate } from '../domain/interpolate.js';
import { evaluateCondition } from '../domain/evaluate-condition.js';
import { resolveBuiltinCommand, isInvertedPredicate } from './evaluate-completion.js';

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

### Variables (auto-set after each \`run:\` and \`let x = run\`)
last_exit_code, command_failed, command_succeeded,
last_stdout, last_stderr

### Gate predicates (for \`done when:\`)
tests_pass, tests_fail, lint_pass, lint_fail,
file_exists <path>, diff_nonempty`;

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

const MAX_OUTPUT_LENGTH = 2000;

function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_LENGTH) return output;
  return output.slice(0, MAX_OUTPUT_LENGTH) + '\n... (truncated)';
}

const TRIVIAL_PROMPTS = new Set([
  'go',
  'continue',
  'ok',
  'yes',
  'y',
  'next',
  'proceed',
  'keep going',
  'do it',
  'run it',
  'start',
  'begin',
]);

export function isTrivialPrompt(prompt: string): boolean {
  return TRIVIAL_PROMPTS.has(
    prompt
      .trim()
      .toLowerCase()
      .replace(/[.!]+$/, ''),
  );
}

/**
 * Evaluate a flow condition using variable lookup, falling back to command execution.
 * Returns null if the condition cannot be resolved.
 */
async function evaluateFlowCondition(
  condition: string,
  variables: Readonly<Record<string, string | number | boolean>>,
  commandRunner?: CommandRunner,
): Promise<boolean | null> {
  const pureResult = evaluateCondition(condition, variables);
  if (pureResult !== null) return pureResult;

  if (!commandRunner) return null;

  const command = resolveBuiltinCommand(condition);
  if (!command) return null;

  const result = await commandRunner.run(command);
  const inverted = isInvertedPredicate(condition);
  return inverted ? result.exitCode !== 0 : result.exitCode === 0;
}

/**
 * When a run node fails inside a try body, find the catch jump target.
 * Returns the path to the first catch child, or null if no try ancestor.
 */
function findTryCatchJump(
  nodes: readonly FlowNode[],
  path: readonly number[],
): readonly number[] | null {
  for (let depth = path.length - 1; depth >= 1; depth--) {
    const ancestorPath = path.slice(0, depth);
    const ancestor = resolveCurrentNode(nodes, ancestorPath);
    if (ancestor?.kind !== 'try') continue;

    const childIdx = path[depth]!;
    if (childIdx < ancestor.body.length && ancestor.catchBody.length > 0) {
      return [...ancestorPath, ancestor.body.length];
    }
  }
  return null;
}

/**
 * Handle body exhaustion: when resolveCurrentNode returns null and we're
 * inside a parent scope (path.length >= 2), decide whether to loop or exit.
 */
async function handleBodyExhaustion(
  state: SessionState,
  commandRunner?: CommandRunner,
): Promise<SessionState | null> {
  const path = state.currentNodePath;
  if (path.length <= 1) return null;

  const parentPath = path.slice(0, -1);
  const parentNode = resolveCurrentNode(state.flowSpec.nodes, parentPath);
  if (!parentNode) return null;

  let current = state;

  switch (parentNode.kind) {
    case 'while': {
      const condResult = await evaluateFlowCondition(
        parentNode.condition,
        current.variables,
        commandRunner,
      );
      const progress = current.nodeProgress[parentNode.id];
      const iteration = progress?.iteration ?? 1;

      if (condResult === true && iteration < parentNode.maxIterations) {
        current = updateNodeProgress(current, parentNode.id, {
          iteration: iteration + 1,
          maxIterations: parentNode.maxIterations,
          status: 'running',
        });
        current = advanceNode(current, [...parentPath, 0]);
      } else {
        current = updateNodeProgress(current, parentNode.id, {
          iteration,
          maxIterations: parentNode.maxIterations,
          status: 'completed',
        });
        current = advanceNode(current, advancePath(parentPath));
      }
      return current;
    }

    case 'until': {
      const condResult = await evaluateFlowCondition(
        parentNode.condition,
        current.variables,
        commandRunner,
      );
      const progress = current.nodeProgress[parentNode.id];
      const iteration = progress?.iteration ?? 1;

      if (condResult === false && iteration < parentNode.maxIterations) {
        current = updateNodeProgress(current, parentNode.id, {
          iteration: iteration + 1,
          maxIterations: parentNode.maxIterations,
          status: 'running',
        });
        current = advanceNode(current, [...parentPath, 0]);
      } else {
        current = updateNodeProgress(current, parentNode.id, {
          iteration,
          maxIterations: parentNode.maxIterations,
          status: 'completed',
        });
        current = advanceNode(current, advancePath(parentPath));
      }
      return current;
    }

    case 'retry': {
      const commandFailed = current.variables['command_failed'];
      const progress = current.nodeProgress[parentNode.id];
      const iteration = progress?.iteration ?? 1;

      if (commandFailed === true && iteration < parentNode.maxAttempts) {
        current = updateNodeProgress(current, parentNode.id, {
          iteration: iteration + 1,
          maxIterations: parentNode.maxAttempts,
          status: 'running',
        });
        current = advanceNode(current, [...parentPath, 0]);
      } else {
        current = updateNodeProgress(current, parentNode.id, {
          iteration,
          maxIterations: parentNode.maxAttempts,
          status: 'completed',
        });
        current = advanceNode(current, advancePath(parentPath));
      }
      return current;
    }

    case 'if':
    case 'try': {
      current = advanceNode(current, advancePath(parentPath));
      return current;
    }

    default:
      return null;
  }
}

interface AutoAdvanceResult {
  readonly state: SessionState;
  readonly capturedPrompt: string | null;
}

async function autoAdvanceNodes(
  state: SessionState,
  commandRunner?: CommandRunner,
): Promise<AutoAdvanceResult> {
  const MAX_ADVANCES = 100;
  let advances = 0;
  let current = state;

  while (advances < MAX_ADVANCES) {
    const node = resolveCurrentNode(current.flowSpec.nodes, current.currentNodePath);

    if (!node) {
      const exhaustionResult = await handleBodyExhaustion(current, commandRunner);
      if (!exhaustionResult) break;
      current = exhaustionResult;
      advances += 1;
      continue;
    }

    switch (node.kind) {
      case 'let': {
        let value: string;
        let tryCatchJump: readonly number[] | null = null;
        switch (node.source.type) {
          case 'literal':
            value = node.source.value;
            break;
          case 'prompt':
            value = node.source.text;
            break;
          case 'run': {
            if (!commandRunner) return { state: current, capturedPrompt: null };
            const letCmd = shellInterpolate(node.source.command, current.variables);
            const result = await commandRunner.run(letCmd);
            value = result.stdout.trimEnd();
            current = updateVariable(current, 'last_exit_code', result.exitCode);
            current = updateVariable(current, 'command_failed', result.exitCode !== 0);
            current = updateVariable(current, 'command_succeeded', result.exitCode === 0);
            current = updateVariable(
              current,
              'last_stdout',
              truncateOutput(result.stdout.trimEnd()),
            );
            current = updateVariable(
              current,
              'last_stderr',
              truncateOutput(result.stderr.trimEnd()),
            );
            if (result.exitCode !== 0) {
              tryCatchJump = findTryCatchJump(current.flowSpec.nodes, current.currentNodePath);
            }
            break;
          }
        }
        current = updateVariable(current, node.variableName, value);
        if (tryCatchJump) {
          current = advanceNode(current, tryCatchJump);
        } else {
          current = advanceNode(current, advancePath(current.currentNodePath));
        }
        advances += 1;
        break;
      }
      case 'run': {
        if (!commandRunner) return { state: current, capturedPrompt: null };
        const command = shellInterpolate(node.command, current.variables);
        const result = await commandRunner.run(command);
        current = updateVariable(current, 'last_exit_code', result.exitCode);
        current = updateVariable(current, 'command_failed', result.exitCode !== 0);
        current = updateVariable(current, 'command_succeeded', result.exitCode === 0);
        current = updateVariable(current, 'last_stdout', truncateOutput(result.stdout.trimEnd()));
        current = updateVariable(current, 'last_stderr', truncateOutput(result.stderr.trimEnd()));

        if (result.exitCode !== 0) {
          const jumpTarget = findTryCatchJump(current.flowSpec.nodes, current.currentNodePath);
          if (jumpTarget) {
            current = advanceNode(current, jumpTarget);
            advances += 1;
            break;
          }
        }

        current = advanceNode(current, advancePath(current.currentNodePath));
        advances += 1;
        break;
      }
      case 'prompt': {
        const capturedPrompt = interpolate(node.text, current.variables);
        current = advanceNode(current, advancePath(current.currentNodePath));
        return { state: current, capturedPrompt };
      }
      case 'while': {
        const condResult = await evaluateFlowCondition(
          node.condition,
          current.variables,
          commandRunner,
        );
        if (condResult === null) return { state: current, capturedPrompt: null };
        if (condResult) {
          current = updateNodeProgress(current, node.id, {
            iteration: 1,
            maxIterations: node.maxIterations,
            status: 'running',
          });
          current = advanceNode(current, [...current.currentNodePath, 0]);
        } else {
          current = advanceNode(current, advancePath(current.currentNodePath));
        }
        advances += 1;
        break;
      }
      case 'until': {
        const condResult = await evaluateFlowCondition(
          node.condition,
          current.variables,
          commandRunner,
        );
        if (condResult === null) return { state: current, capturedPrompt: null };
        if (!condResult) {
          current = updateNodeProgress(current, node.id, {
            iteration: 1,
            maxIterations: node.maxIterations,
            status: 'running',
          });
          current = advanceNode(current, [...current.currentNodePath, 0]);
        } else {
          current = advanceNode(current, advancePath(current.currentNodePath));
        }
        advances += 1;
        break;
      }
      case 'retry': {
        current = updateNodeProgress(current, node.id, {
          iteration: 1,
          maxIterations: node.maxAttempts,
          status: 'running',
        });
        current = advanceNode(current, [...current.currentNodePath, 0]);
        advances += 1;
        break;
      }
      case 'if': {
        const condResult = await evaluateFlowCondition(
          node.condition,
          current.variables,
          commandRunner,
        );
        if (condResult === null) return { state: current, capturedPrompt: null };
        if (condResult) {
          current = advanceNode(current, [...current.currentNodePath, 0]);
        } else if (node.elseBranch.length > 0) {
          current = advanceNode(current, [...current.currentNodePath, node.thenBranch.length]);
        } else {
          current = advanceNode(current, advancePath(current.currentNodePath));
        }
        advances += 1;
        break;
      }
      case 'try': {
        current = advanceNode(current, [...current.currentNodePath, 0]);
        advances += 1;
        break;
      }
    }
  }

  if (advances >= MAX_ADVANCES) {
    current = {
      ...current,
      warnings: [
        ...current.warnings,
        'MAX_ADVANCES (100) reached; auto-advance stopped to prevent infinite loop.',
      ],
    };
  }

  return { state: current, capturedPrompt: null };
}

function maybeCompleteFlow(state: SessionState): SessionState {
  if (state.status !== 'active') return state;
  // If still inside a control-flow scope, body exhaustion needs handling first
  if (state.currentNodePath.length > 1) return state;
  const node = resolveCurrentNode(state.flowSpec.nodes, state.currentNodePath);
  if (node !== null) return state;
  if (state.flowSpec.completionGates.length === 0 || allGatesPassing(state)) {
    return markCompleted(state);
  }
  return state;
}

export async function injectContext(
  input: InjectContextInput,
  stateStore: StateStore,
  commandRunner?: CommandRunner,
): Promise<InjectContextOutput> {
  const existing = await stateStore.loadCurrent();

  if (existing?.status === 'active') {
    const { state: advanced, capturedPrompt } = await autoAdvanceNodes(existing, commandRunner);
    const completed = maybeCompleteFlow(advanced);
    if (completed !== existing) {
      await stateStore.save(completed);
    }
    const ctx = renderFlow(completed);
    if (capturedPrompt) {
      const output = isTrivialPrompt(input.prompt)
        ? `${ctx}\n\n${capturedPrompt}`
        : `${ctx}\n\n${capturedPrompt}\n\n[User message: ${input.prompt}]`;
      return { prompt: output };
    }
    const interpolated = interpolate(input.prompt, completed.variables);
    return { prompt: `${ctx}\n\n${interpolated}` };
  }

  if (hasFlowBlock(input.prompt)) {
    const spec = parseFlow(input.prompt);
    const session = createSessionState(input.sessionId, spec);
    const { state: advanced, capturedPrompt } = await autoAdvanceNodes(session, commandRunner);
    const completed = maybeCompleteFlow(advanced);
    await stateStore.save(completed);
    const ctx = renderFlow(completed);
    if (capturedPrompt) {
      return { prompt: `${ctx}\n\n${capturedPrompt}` };
    }
    return { prompt: `${ctx}\n\n${input.prompt}` };
  }

  if (looksLikeNaturalLanguage(input.prompt)) {
    return { prompt: buildMetaPrompt(input.prompt) };
  }

  return { prompt: input.prompt };
}
