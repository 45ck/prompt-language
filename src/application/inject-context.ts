/**
 * InjectContext — UserPromptSubmit hook use case.
 *
 * If the prompt starts a new flow, parse it and persist session state.
 * If a flow is already active, inject step context into the prompt.
 */

import { createSessionState, markCancelled, markFailed } from '../domain/session-state.js';
import { createFlowSpec } from '../domain/flow-spec.js';
import type { StateStore } from './ports/state-store.js';
import type { CommandRunner } from './ports/command-runner.js';
import type { CaptureReader } from './ports/capture-reader.js';
import type { ProcessSpawner } from './ports/process-spawner.js';
import type { AuditLogger } from './ports/audit-logger.js';
import { parseFlow, parseGates, detectBareFlow } from './parse-flow.js';
import { renderFlow, renderFlowSummary, renderCompletionSummary } from '../domain/render-flow.js';
import { interpolate } from '../domain/interpolate.js';
import { autoAdvanceNodes, maybeCompleteFlow } from './advance-flow.js';
import { formatError } from '../domain/format-error.js';
import { lintFlow } from '../domain/lint-flow.js';
import { flowComplexityScore } from '../domain/flow-complexity.js';

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
  // Iteration intent
  '\\bforeach\\b',
  '\\bfor each\\b',
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

const NL_INTENT_PATTERNS = NL_INTENT_WORDS.map((w) => new RegExp(w, 'i'));

// H#39: Require 2+ intent matches to reduce false positives
export function looksLikeNaturalLanguage(prompt: string): boolean {
  if (FLOW_BLOCK_RE.test(prompt)) return false;
  let matches = 0;
  for (const re of NL_INTENT_PATTERNS) {
    if (re.test(prompt)) {
      matches += 1;
      if (matches >= 2) return true;
    }
  }
  return false;
}

const DSL_REFERENCE = `\
## prompt-language DSL reference

Twelve primitives (prompt, run, let/var, while, until, retry, if/else, try/catch, foreach, break, spawn/await). Blocks use indentation + explicit \`end\`.

### Structure
\`\`\`
Goal: <one-line description>

flow:
  <steps indented 2 spaces>

done when:
  <gate predicates>
\`\`\`

### done when (completion gates)
Gates are the core value — the agent cannot stop until these hold.
  done when:
    tests_pass
    lint_pass

### Gate predicates (for \`done when:\`)
**JavaScript/TypeScript:** tests_pass, tests_fail, lint_pass, lint_fail
**Python:** pytest_pass, pytest_fail
**Go:** go_test_pass, go_test_fail
**Rust:** cargo_test_pass, cargo_test_fail
**General:** file_exists <path>, diff_nonempty

### Primitives

**prompt** — Inject text as the agent's next instruction.
  prompt: Fix the failing auth tests.

**run** — Execute a shell command.
  run: npm test

**let/var** — Store a named variable for later interpolation via \`\${varName}\`.
  let greeting = "hello world"        # literal string
  let info = prompt "Summarize this"  # captures Claude's response
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

**foreach** — Iterate over a list of items.
  let files = run "find src -name '*.ts'"
  foreach file in \${files}
    run: npx tsc --noEmit \${file}
  end

**spawn/await** — Launch parallel sub-agents.
  spawn "fix-auth"
    prompt: Fix the auth bug
    run: npm test -- --grep auth
  end

  spawn "add-cache"
    prompt: Add caching
  end

  await all

### Variable interpolation
Use \`\${varName}\` in prompt and run text to substitute stored values.
  let name = "auth module"
  prompt: Refactor the \${name} for clarity.

After \`await\`, child variables are available as \`\${child-name.varName}\`.

### Variables (auto-set after each \`run:\` and \`let x = run\`)
last_exit_code, command_failed, command_succeeded,
last_stdout, last_stderr`;

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
  return FLOW_BLOCK_RE.test(prompt) || detectBareFlow(prompt);
}

const DONE_WHEN_RE = /^\s*done\s+when:/im;

export function hasGatesOnly(prompt: string): boolean {
  return DONE_WHEN_RE.test(prompt) && !hasFlowBlock(prompt);
}

// H#41: Expanded trivial prompts set
const TRIVIAL_PROMPTS = new Set([
  'go',
  'continue',
  'ok',
  'okay',
  'yes',
  'y',
  'yep',
  'yeah',
  'yup',
  'sure',
  'k',
  'next',
  'proceed',
  'keep going',
  'go ahead',
  'sounds good',
  'lets go',
  'do it',
  'run it',
  'start',
  'begin',
  'right',
]);

const DRY_RUN_RE = /\b-{0,2}dry[-\s]?run\b/i;

export function isDryRun(prompt: string): boolean {
  return DRY_RUN_RE.test(prompt);
}

function removeDryRun(prompt: string): string {
  return prompt
    .replace(DRY_RUN_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function isTrivialPrompt(prompt: string): boolean {
  return TRIVIAL_PROMPTS.has(
    prompt
      .trim()
      .toLowerCase()
      .replace(/[.!]+$/, ''),
  );
}

export async function injectContext(
  input: InjectContextInput,
  stateStore: StateStore,
  commandRunner?: CommandRunner,
  captureReader?: CaptureReader,
  processSpawner?: ProcessSpawner,
  auditLogger?: AuditLogger,
): Promise<InjectContextOutput> {
  const existing = await stateStore.loadCurrent();

  // H#49: Abort flow escape hatch
  if (existing?.status === 'active') {
    const lower = input.prompt.trim().toLowerCase();
    const ABORT_PHRASES = ['abort flow', 'cancel flow', 'stop flow', 'reset flow'];
    if (ABORT_PHRASES.some((phrase) => lower.includes(phrase))) {
      await stateStore.save(markCancelled(existing));
      await stateStore.clearPendingPrompt();
      return { prompt: '[prompt-language] Flow cancelled by user.' };
    }
  }

  // NL-to-DSL round-trip: if user previously saw a confirmation and now confirms.
  // Active flows take precedence — clear pending and let the flow handle the prompt.
  const pendingPrompt = await stateStore.loadPendingPrompt();
  if (pendingPrompt) {
    await stateStore.clearPendingPrompt();
    if (existing?.status !== 'active' && isTrivialPrompt(input.prompt)) {
      return { prompt: buildMetaPrompt(pendingPrompt) };
    }
    // User sent a non-trivial prompt or has an active flow — fall through
  }

  // H-PERF-012: Skip full render for terminal flow states
  if (existing?.status === 'completed') {
    return { prompt: `[prompt-language] Flow completed successfully.\n\n${input.prompt}` };
  }
  if (existing?.status === 'failed') {
    return { prompt: `[prompt-language] Flow failed.\n\n${input.prompt}` };
  }
  if (existing?.status === 'cancelled') {
    return { prompt: `[prompt-language] Flow cancelled.\n\n${input.prompt}` };
  }

  if (existing?.status === 'active') {
    // H-REL-003: Checkpoint/Resume — detect resumed session
    const isResumed = existing.sessionId !== input.sessionId;
    try {
      const { state: advanced, capturedPrompt } = await autoAdvanceNodes(
        existing,
        commandRunner,
        captureReader,
        processSpawner,
        auditLogger,
      );
      const toSave = capturedPrompt ? advanced : maybeCompleteFlow(advanced);
      if (toSave !== existing) {
        await stateStore.save(toSave);
      }
      // H-DX-009: Emit completion summary when flow just completed
      if (toSave.status === 'completed' && existing.status === 'active') {
        const completionMsg = renderCompletionSummary(toSave);
        const ctx = renderFlow(toSave);
        return { prompt: `${ctx}\n\n[${completionMsg}]\n\n${input.prompt}` };
      }
      const ctx = renderFlow(toSave);
      const summary = renderFlowSummary(toSave);
      const resumeTag = isResumed ? `[resumed from ${summary}]\n` : '';
      if (capturedPrompt) {
        const output = isTrivialPrompt(input.prompt)
          ? `${ctx}\n\n${resumeTag}${capturedPrompt}\n\n${summary}`
          : `${ctx}\n\n${resumeTag}${capturedPrompt}\n\n[User message: ${input.prompt}]\n\n${summary}`;
        return { prompt: output };
      }
      const interpolated = interpolate(input.prompt, toSave.variables);
      return { prompt: `${ctx}\n\n${resumeTag}${interpolated}\n\n${summary}` };
    } catch (err: unknown) {
      const reason = formatError(err);
      const failed = markFailed(existing, reason);
      try {
        await stateStore.save(failed);
      } catch {
        // Save failed — avoid crash loop; proceed with failure message regardless
      }
      return { prompt: `[prompt-language] Flow failed: ${reason}\n\n${input.prompt}` };
    }
  }

  // H-DX-003: Dry-run / parse-only mode — parse, lint, score without persisting state
  if (hasFlowBlock(input.prompt) && isDryRun(input.prompt)) {
    const spec = parseFlow(input.prompt);
    const session = createSessionState(input.sessionId, spec);
    const rendered = renderFlow(session);
    const complexity = flowComplexityScore(spec);
    const warnings = lintFlow(spec);
    const lines = [`[prompt-language dry-run]`, rendered, '', `Complexity: ${complexity}/5`];
    if (warnings.length > 0) {
      lines.push('Warnings:');
      for (const w of warnings) {
        lines.push(`  - ${w.message}`);
      }
    }
    const cleanedPrompt = removeDryRun(input.prompt);
    lines.push('', cleanedPrompt);
    return { prompt: lines.join('\n') };
  }

  if (hasFlowBlock(input.prompt)) {
    try {
      const spec = parseFlow(input.prompt);
      const session = createSessionState(input.sessionId, spec);
      const { state: advanced, capturedPrompt } = await autoAdvanceNodes(
        session,
        commandRunner,
        captureReader,
        processSpawner,
        auditLogger,
      );
      const toSave = capturedPrompt ? advanced : maybeCompleteFlow(advanced);
      await stateStore.save(toSave);
      const ctx = renderFlow(toSave);
      const summary = renderFlowSummary(toSave);
      if (capturedPrompt) {
        return { prompt: `${ctx}\n\n${capturedPrompt}\n\n${summary}` };
      }
      return { prompt: `${ctx}\n\n${input.prompt}\n\n${summary}` };
    } catch (err: unknown) {
      const reason = formatError(err);
      return { prompt: `[prompt-language] Flow failed: ${reason}\n\n${input.prompt}` };
    }
  }

  // Gate-only mode: done when: without flow: — parse gates, save state, pass prompt through
  if (hasGatesOnly(input.prompt)) {
    const gates = parseGates(input.prompt);
    if (gates.length > 0) {
      const goal = /^Goal:\s*(.+)/im.exec(input.prompt)?.[1]?.trim() ?? '';
      const spec = createFlowSpec(goal, [], gates);
      const session = createSessionState(input.sessionId, spec);
      await stateStore.save(session);
      return { prompt: input.prompt };
    }
  }

  // H#40: NL-to-DSL confirmation step — save prompt and ask user to confirm
  if (looksLikeNaturalLanguage(input.prompt)) {
    await stateStore.savePendingPrompt(input.prompt);
    return {
      prompt:
        '[prompt-language] I detected control-flow intent in your message. ' +
        'If you want me to create a structured flow from this, reply "yes" or include a `flow:` block. ' +
        "Otherwise, I'll treat it as a regular prompt.\n\n" +
        `Original message: ${input.prompt}`,
    };
  }

  return { prompt: input.prompt };
}
