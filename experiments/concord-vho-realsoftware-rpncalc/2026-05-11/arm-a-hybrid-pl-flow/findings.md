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

### Issue 3: `ci --runner ollama --model qwen3-coder:30b` hangs

With the model override applied, `ollama ps` confirms qwen3-coder:30b
is loaded (87% GPU / 13% CPU split, 19GB resident). The CLI process
stays alive but emits only:

```
[prompt-language CI] Running flow via ollama...
```

…and produces no further output for 90+ seconds across two attempts
(smoke flow with one trivial prompt, and the full rpncalc.flow).
Kill required.

The hand-rolled `runner.mjs` (used in this same experiment's
arm-a-hybrid run earlier) communicates directly with
`http://localhost:11434/api/generate` and gets responses in 1-15s
per task. So Ollama itself is working. The hang is somewhere in the
PL CLI's flow-runtime → ollama-runner path.

Possible causes (not investigated in detail):
- Default transport mode (HTTP vs CLI vs PowerShell) may not match
  this rig's setup. The runner has 3 transports per
  `ollama-prompt-turn-runner.ts` and the default may be picking the
  wrong one for Windows + WSL Bash invocation.
- Model action-rounds budgeting may be set so high that the runner
  is waiting indefinitely for a "done" signal Ollama isn't emitting
  for a single-turn `prompt:` call.
- The flow runtime may be trying to use CLI plugin features
  (`pl-claude.cmd` etc) that aren't installed for the ollama path.

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
