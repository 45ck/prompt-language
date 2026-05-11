---
title: Real PL flow runtime — integration findings (2026-05-11 night)
status: ad-hoc evidence — non-claim-eligible per program-status §3a
operator: 45ck
date: 2026-05-11
purpose: test whether `prompt-language ci --runner ollama` actually works as advertised against a real flow file (the missing piece from the day's pilots)
related-bead: prompt-language-j0je
---

# Real PL flow runtime — integration findings

## Setup

Bead `prompt-language-j0je` asked: rebuild rpncalc using the actual
PL flow DSL (`prompt-language ci --runner ollama`) instead of my
hand-rolled `runner.mjs`. Goals:

- Test whether the actual runtime works as advertised
- Test whether `retry max N` recovers any failed routes
- Measure scaffolding cost reduction vs hand-rolled runner

## What I built

- `rpncalc.flow` — 7 routable functions expressed as `let X = prompt:` +
  `run:` (replace stub) + `run:` (oracle gate) + `if command_failed
  → repair prompt`. ~107 lines of flow DSL.
- `replace-stub.mjs` — small helper that takes raw model output via
  `PL_RAW=...` env or stdin and replaces a named stub in the
  workspace (since flow can't write files directly with the
  Ollama runner).
- `workspace/rpncalc.mjs` — fresh skeleton with throw-stubs for all
  7 functions.

The flow shape is genuinely shorter than my `runner.mjs` (~107 vs
~236 lines), so the "scaffolding cost drops" hypothesis would have
been testable.

## What broke

### Issue 1: validator warnings on multi-line prompts

`node bin/cli.mjs validate rpncalc.flow` produces warnings like:

```
[!] line 7, col 7: Unknown keyword "Implement this JavaScript function..."
    — treating as prompt. Valid keywords: prompt, run, let, var, ...
```

The `prompt: |` heredoc continuation lines aren't cleanly recognized
— they get tokenised as if each continuation line were its own
keyword. The marketing-factory `marketing.flow` reference example
exhibits the **same** warnings, so the parser apparently runs the
flow despite the noise. Not a blocker but worth a parser fix.

### Issue 2: `--runner ollama` defaults to gemma4:31b

Per `src/infrastructure/adapters/ollama-prompt-turn-runner.ts:129`:

```js
function resolveOllamaModel(model?: string): string {
  if (model?.startsWith('ollama/')) {
    return model.slice('ollama/'.length);
  }
  return model ?? 'gemma4:31b';
}
```

Default model is `gemma4:31b`. On this rig, gemma4 returns empty
visible output (only thinking tokens — see the cross-family review
findings doc where gemma4:26b also returned empty). This is a
program-level mis-default for the current state of Ollama's
gemma4 thinking-token behavior.

Workaround: pass `--model qwen3-coder:30b` to override.

### Issue 3: `ci --runner ollama` hangs — actual architecture mismatch

With the model override applied, `ollama ps` confirms qwen3-coder:30b
is loaded (87% GPU / 13% CPU split, 19GB resident). The CLI process
stays alive but emits only `[prompt-language CI] Running flow via
ollama...` for 90+ seconds, then either continues silently or (with
explicit `PROMPT_LANGUAGE_OLLAMA_ACTION_ROUNDS=1`) errors with:

```
PLR-007 Prompt runner exited with code 1.
Ollama runner exceeded the action round limit (1).
```

The session state's `_runtime_diagnostic` confirms the same at the
default budget (8 rounds). So the runner is **iterating a multi-
round agentic loop, not making a single-turn generation call**.

Per `src/infrastructure/adapters/ollama-prompt-turn-runner.ts:1072`:

```js
const madeProgress = workspaceActions > 0 ||
                     !promptRequiresWorkspaceAction(prompt);
```

The runner only stops iterating when EITHER (a) the prompt didn't
require a workspace action and so a single round is sufficient, OR
(b) the model performed a workspace action (i.e. wrote a file via
some tool-use protocol).

For my flow `prompt: implement this function...`, the runner's
heuristic likely classifies it as requiring workspace action
(verbs like "implement"), but qwen3-coder via Ollama produces only
text — no tool calls, no file writes. So the runner iterates
through all 8 rounds without ever seeing the workspace action it
expects, then errors out.

**This is not a bug; it's a fundamental architectural mismatch.**

After deeper diagnosis (line 1071 of
`ollama-prompt-turn-runner.ts`):

```js
if (reachedDone && !actionFailed) { ... break out of loop ... }
```

The runner ONLY stops iterating when the model emits a `done`
action. The action types it parses (around line 1029-1063) are:

- `list_files`
- `read_file`
- `write_file`
- `run_command`
- `done`

So the PL ollama runner is **not a single-turn text-generation
adapter** — it's an **agentic tool-use harness** that requires the
model to emit structured tool calls in a specific protocol, ending
in `done`. Plain text responses never reach `reachedDone`, so the
loop runs all 8 rounds and exits with PLR-007.

I verified this empirically: even my "What is 2 plus 2? Reply with
just the number" smoke prompt (which doesn't match
`promptRequiresWorkspaceAction`'s verb regex) hits the action-round
limit. The verb-regex is only used to format the failure message;
the actual loop exit requires `reachedDone`.

For my flow's `prompt: implement this function` to work with this
runner, qwen3-coder via Ollama would need to be specifically
prompted (or fine-tuned) to:

1. Use a `write_file` action to save the function code to the
   workspace
2. Then emit a `done` action

This is the protocol the H11/H14/H15 harness-arena routes presumably
use — they're model-specific routing policies that include the
tool-call instructions.

**To make a clean single-turn code-generation flow work, one of:**

1. Add a `--runner ollama-text` mode that does single-turn
   generation and returns the assistant text (no action loop). The
   simplest fix; would unlock my flow shape.
2. Build a system prompt for qwen3-coder that teaches it the PL
   tool protocol (write_file + done). Higher effort; effectively
   reinventing what hand-rolled runner.mjs does.
3. Use `--runner aider` or `--runner opencode` instead — those
   harnesses already wrap local models with proper tool-use
   protocols. Potentially the cleanest option but requires those
   harnesses installed.

   **Tested empirically (2026-05-11 night):** with aider 0.86.2
   installed, `prompt-language ci --runner aider --model
   ollama/qwen3-coder:30b <text-smoke.flow>` ALSO hangs after
   "Running flow via aider..." for 90+ seconds with no further
   output. So switching runners does not unlock end-to-end on this
   rig. The issue may not be runner-specific — could be in the PL
   flow-runtime layer above the runner adapter, or in how runners
   are invoked from the PL CLI process. Worth a separate
   investigation.

The hand-rolled `runner.mjs` from the morning's pilots avoids this
entirely by calling `/api/generate` directly and treating the
response as text to be applied programmatically. **That pattern is
genuinely simpler for code-substitution use cases** than the PL
ollama runner's agentic-tool-use protocol.

This is itself an important finding about the PL program: **the
shipped `--runner ollama` is for agentic tool-use, not for the
spec-quality routing pattern the day's pilots demonstrate**. The
two use cases want different runtime shapes.

## What this means for bead `prompt-language-j0je`

The bead expected: produce the program's first cryptographically-
attested hybrid run by wiring the existing 5 shipped pieces (witness
chain, cross-family reviewer, attestation, routing, flow DSL) into
a single attested bundle.

**That's not achievable in one session from a cold start.** The flow
DSL → ollama runner path has at least three real integration issues
(parser noise, default model, hang) that need investigating before
the unified bundle can run end-to-end. The witness chain and
attestation parts only matter once the flow can complete a single
prompt successfully.

## Honest recommendation

Reopen `prompt-language-j0je` with a narrower acceptance criterion
and split into two beads:

1. **Fix the ollama-runner default + transport** (this rig: Windows
   + WSL Bash + AMD Vulkan path) so that
   `prompt-language ci --runner ollama --model qwen3-coder:30b
   <single-turn flow>` returns a response within 30s. Current
   behavior is to hang. Without this, no end-to-end PL flow against
   local models is possible on this rig.
2. **After (1) is fixed**, attempt the unified attested rpncalc run.

The hand-rolled `runner.mjs` from the morning's tinymd/rpncalc
pilots remains the only working routing path on this rig today.
That itself is a finding: **the actual PL flow DSL is not yet a
drop-in replacement for hand-rolled Ollama orchestration on this
hardware setup**, contrary to the implication in the day's earlier
synthesis.

## Files

- `rpncalc.flow` — the .flow file (~107 lines, parses with warnings
  but doesn't run cleanly)
- `replace-stub.mjs` — workspace-write helper since flow can't write
  files directly via Ollama runner
- `workspace/rpncalc.mjs` — fresh skeleton (untouched by this session
  because the flow never completed a prompt)
- `findings.md` — this file

## Cross-references

- The morning's working hand-rolled rpncalc pilot:
  [`../arm-a-hybrid/`](../arm-a-hybrid/) and
  [`../runner.mjs`](../runner.mjs) and
  [`../results/report.md`](../results/report.md)
- Ollama runner source:
  [`src/infrastructure/adapters/ollama-prompt-turn-runner.ts`](../../../../src/infrastructure/adapters/ollama-prompt-turn-runner.ts)
- Bead: `prompt-language-j0je`
