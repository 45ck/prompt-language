---
title: Critic / gap-finder review — Concord/VHO TODO CLI pilot
reviewer: independent agent, run 2026-05-11 by 45ck via Claude Code
role: adversarial critic — find methodological gaps, contamination, gaming
---

# Critic findings

## 1. Frontier contamination — the local model isn't building, it's filling Mad Libs

The prompts in `tasks.json` aren't tasks; they're function bodies
dictated to a code-completion engine. Examples:

- T1 (line 6): gives the **exact signature**, the **exact state
  shape** `{ items: [{id, text, done}] }`, the **exact id formula**
  "max existing id + 1 or 1 if items empty", the **exact return
  shape**, and the **output template** — qwen had to emit ~75
  tokens of a single reduce + spread. The frontier did the design;
  local did transcription.
- T6 (line 36): "Return a string of
  `JSON.stringify(state, null, 2)`." That's not a task, that's the
  answer. The 20-token "win" should not count.
- T5 (line 30): even **pre-supplies the import line** and tells the
  model not to add others. Architectural choice (sync fs, no atomic
  write, no JSON.parse error handling) was already made.
- T7 (line 42): enumerates every command branch, the `--json` flag
  handling, parseInt usage, the exact `{exitCode,stdout,stderr}`
  contract, and the exception-to-stderr mapping. There is
  essentially nothing left to design.

If you re-ran with prompts = test names + the empty `todo.mjs`,
the local pass-rate plausibly collapses to 0–1/7. The headline 5/7
is measuring instruction-following at high spec density, not coding
ability.

## 2. Test weakness — oracle written by the same author as the spec, with shared knowledge

- `T2_list_marks_done_distinctly_from_pending` (test:60–66): only
  checks `lineA !== lineB`. Local could output `"a"` and `"b "`
  (trailing space) and pass.
- `T2_list_empty_state` (test:50): regex `/no.*todo|empty/i` —
  returning the literal string "empty" passes (and qwen did exactly
  that — `todo.mjs:12`). Hostile inputs (item text containing
  "empty"? state.items === undefined behavior?) untested.
- `T6` (test:125–135): only asserts JSON.parse round-trips. The
  spec told the model the literal call. There is no behavior under
  test that wasn't dictated.
- `T3_complete_does_not_mutate_input` (test:76–81) only checks
  `original.items[0].done === false` and
  `original.items[0] !== s.items[0]` — does **not** check that
  `original.items` array itself is untouched, so a subtler shallow
  mutation would pass.
- T4: no test for "remove from middle preserves order"; no test for
  negative or non-integer id; no test for duplicate ids.
- T7: no test for `add` with text containing spaces survives
  round-trip (qwen's first attempt at T7 used `arg1` only — would
  have failed a "buy organic milk" test, which doesn't exist). No
  test for `--json` order-independence (`['--json','list']`). No
  stdin/stderr-only-on-error contract test.
- **Critically: no test for the rolled-back state.** Because
  router.mjs:183 rolls back to the stub between attempts, T2/T3/T4/
  T5/T6 were tested against `add()` _throwing_ — the test suite
  never verified the assembled file works end-to-end with all
  functions populated. The post-hoc workspace passes only because
  the frontier wrote `runCli` last and everything happened to
  compose.

Also: `complete`'s implementation (workspace/todo.mjs:21–32)
detects "not found" by reference equality after `.map`. This passes
the existing tests but is a real bug: if `state.items[0].id === id`
and the item already has `done:true`, the new object is still
`!==` the old one, so detection works there — but if the input
contains object identities that map preserves, it could mis-throw.
It's smelly hardcoded-shape logic of exactly the kind Finding 2
from the smoke flagged.

## 3. Cherry-picked task design

Every task is a **pure-ish function with a fixed signature dictated
up front**. Notably absent:

- **Multi-file or cross-module change** (the entire app is one
  file).
- **Debugging an existing failing test** — local never has to read
  code it didn't write.
- **Modifying an existing implementation** (every task replaces a
  stub, never an impl).
- **Performance / algorithmic** work — nothing is non-trivial; no
  big-O concern.
- **Security-sensitive** code (path traversal in `TODO_FILE`? JSON
  bombs in `load`? None of these are tested or required).
- **Concurrent saves to same path** — explicitly promised in
  spec.md:69 ("concurrent saves") but **no such test exists** in
  todo.test.mjs. Spec lies about the oracle.
- **Schema migration / backward compatibility** — what if
  `.todo.json` was written by an older version? Untested.

The 7 tasks are the curriculum of "write one ~10-line pure function
from a complete spec," repeated 7 times. This is the shape
qwen3-coder is benchmarked on.

## 4. Metric gaming — frontier tokens uncounted

`local_tokens_total` = 1,084. **Uncounted frontier tokens spent by
Claude this session:**

- spec.md (~1,500 tokens written)
- tasks.json (~1,800 tokens of dense prompts)
- todo.test.mjs (~1,400 tokens)
- router.mjs (~1,700 tokens)
- T1 + T7 manual repair (the frontier wrote ~50 lines of working
  impl — call it ~600 tokens output, plus reading all attempt logs
  and oracle stderr, ~2–4k input)
- This very critique session

Conservative estimate: **~8–12k frontier tokens to save 1,084 local
tokens.** A frontier-only baseline would have written `todo.mjs` +
tests in ~3–4k output tokens in one shot. The hybrid is **roughly
2–3× more expensive in frontier tokens** than frontier-only would
have been, while also consuming 94 seconds of local GPU. The
"hybrid efficiency" framing is inverted at this scale; it can only
become favorable amortized over many runs reusing the same
scaffolding — which this experiment doesn't demonstrate.

Also: `local_wall_ms_total` ignores frontier wall time entirely.
And `prompt_eval_count` is captured (router.mjs:41) but never
summed into the manifest — input tokens to local are invisible.

## 5. Reproducibility — not reproducible as written

Missing for a third party to reproduce:

- **No model digest / quantization / Modelfile pin.**
  `qwen3-coder:30b` and `devstral-small-2:24b` are tags that can be
  re-pushed. Need sha256 from `ollama show --modelfile`.
- **No Ollama version, CUDA/ROCm version, llama.cpp commit.**
  Sampler implementation differs across versions even at temp 0.
- **No seed parameter.** router.mjs:31 sets `temperature: 0` but no
  `seed`, and ollama's effective behavior at temp=0 is not
  deterministic across context-window resets, KV-cache states, or
  batch boundaries (per the program's own 2026-05-11
  strict-format-fit smoke).
- **No `num_ctx`.** Default may differ per model/install; long
  prompts can be silently truncated.
- **No `worker.mjs` or `run.mjs`** despite spec.md:128–130 listing
  them as deliverables. Only `router.mjs` exists.
- **No `results/report.md`** despite spec.md:133.
- **No package.json / Node version pin** (uses `node:test` which
  has changed semantics across 18/20/22).
- **`.todo.json` env override** is in the spec (spec.md:39) but
  never tested.
- The HERE path math in todo.test.mjs:14 uses `replace(/\\/g,'/')`
  — Windows-only assumption that will silently misbehave on POSIX
  where backslashes in paths are legal characters.

A third party gets a different result on attempt one with high
probability.

## 6. Generalisability — proof-of-life only, and overclaimed even at that

This is **n=1 app, n=1 rig, n=1 operator, n=1 task class**
(single-file pure-functional CRUD with dictated signatures).
Spec.md:120 admits this in the "What this is NOT" section, then the
manifest's `closedByLocal: 5` headline immediately invites readers
to forget it. To support the hybrid hypothesis at portfolio scale
you'd need at minimum:

1. **Spec-density ablation** — re-run the same 7 tasks with
   progressively starved prompts (just signature; just test names;
   just English description) and chart pass-rate vs spec density.
   Without this, you cannot distinguish "local can code" from
   "local can transcribe."
2. **Adversarial oracle** — have a _different_ model (or human
   red-team) write the tests _without_ seeing the prompts. Current
   setup is the same author writing both sides of the contract.
3. **Cross-app replication** — pick 3 distinct app shapes (e.g. an
   HTTP server with middleware, a parser/AST transform, a stateful
   TUI) and rerun. If qwen drops below 50% on any of them, the
   routing pattern doesn't generalize.
4. **k≥3 with seed sweep** — current k=1 means T2/T3/T6 passes are
   coin-flips per the program's own non-determinism finding.
   Manifest needs `pass@k` not `pass`.
5. **Frontier-only baseline arm** with fully accounted token +
   wall-time cost. Without it the "hybrid is efficient" claim has
   no counterfactual.
6. **Cold-cache run** (after `ollama stop`) — current numbers may
   be benefiting from a hot KV cache from prior runs.

Until those exist, citing this beyond "we got something working
once on this rig" is dishonest. The spec is admirably hedged in
§"What this is NOT"; the risk is the manifest's `closedByLocal: 5/7`
getting quoted in isolation.

## Bonus: bugs in the harness itself

- router.mjs:46–54 `extractFnBody` has dead logic — strips fences,
  then re-runs a regex on `raw` and may return a different string
  than `s`; the early-stripped `s` is shadowed if the regex matches.
  Inconsistent extraction across attempts.
- router.mjs:72 fallback wraps body as
  `export function ${fnName}() {…}` — **drops the parameter
  list**. Any task that hit this path would silently produce a
  0-arity function and fail bizarrely; nobody noticed because no
  task hit it.
- router.mjs:82 `replaceTwoStubs` regex `\\n\\}` requires the
  closing brace on its own line preceded by a newline — fragile to
  formatting variance and would have failed silently on either
  model emitting `}` inline.
- `oracleStderrTail` is `""` for every failed task in the manifest.
  That means the critic (and the frontier doing repair) had no
  visibility into _why_ T1/T7 failed — diagnostic capture is broken.
  T1's actual failure cause is unrecorded; the spread `...state` in
  devstral's T1 attempt looks correct, so the failure was likely
  the inter-task `remove` dependency, but we can't confirm from the
  artifacts.

**Bottom line:** the 5/7 headline is not evidence the routing
pattern works on real software. It's evidence that two ~30B local
models can transcribe extremely dense English-to-JS specs for
~10-line pure functions, when the test author and the prompt author
are the same agent and the tests are soft. Frontier contamination,
spec-as-answer-key, and uncounted frontier cost together flip the
efficiency story. Before this can be cited beyond proof-of-life,
items 1–6 in §6 above are non-negotiable.
