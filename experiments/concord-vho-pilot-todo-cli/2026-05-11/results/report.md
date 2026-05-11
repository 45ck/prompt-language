---
title: Concord/VHO TODO CLI pilot — report (preliminary, 2026-05-11)
status: ad-hoc evidence — non-claim-eligible per program-status §3a
operator: 45ck
host: i7-14700K / RX 7600 XT 16GB / 64GB RAM
date: 2026-05-11
---

# Pilot report — TODO CLI via hybrid local/frontier routing

## Headline

7 bounded tasks. **Headline raw result: 5/7 closed by local model on
first-attempt oracle pass; 2/7 marked frontier-required.** Final
assembled CLI passes 24/24 tests after frontier repair of the 2
remaining tasks.

| ID | Function   | Route closing the task    | Notes                                                                |
| -- | ---------- | ------------------------- | -------------------------------------------------------------------- |
| T1 | add        | **frontier-required\***   | Both locals' code was correct; oracle had hidden T4 dependency       |
| T2 | list       | local-fast (qwen3-coder)  | Pass                                                                 |
| T3 | complete   | local-fast (qwen3-coder)  | Pass                                                                 |
| T4 | remove     | local-fast (qwen3-coder)  | Pass                                                                 |
| T5 | save_load  | local-fast (qwen3-coder)  | Pass                                                                 |
| T6 | formatJson | local-fast (qwen3-coder)  | Pass                                                                 |
| T7 | runCli     | **frontier-required\***   | Local code reasonable; T7 oracle calls add() which T1 rolled back to stub |

\*The two frontier-required tasks both failed because of inter-task
test dependencies the oracle did not isolate, not because local
output was wrong. See "Methodology bug" below.

## What the local models actually produced (frontier-required tasks)

### T1 add — qwen3-coder:30b

```js
export function add(state, text) {
  const maxId = state.items.reduce((max, item) => Math.max(max, item.id), 0);
  const newItem = { id: maxId + 1 || 1, text, done: false };
  return { items: [...state.items, newItem] };
}
```

This is **functionally correct**. Verified by substitution into the
final assembled CLI — 24/24 tests pass with this implementation.
The router rejected it because T1's test slice includes
`T1_add_after_remove_does_not_reuse_id`, which calls `todo.remove()`,
which was still a `NOT_IMPLEMENTED:remove` throw-stub at T1 execution
time (T4 hadn't run yet).

### T7 runCli — qwen3-coder:30b

The local impl is structurally right (switch-case on command, loads
state, calls add/complete/remove/list/formatJson, returns
`{exitCode, stdout, stderr}`). It has one real bug: calls
`add(state, arg1)` and discards the return value, then calls
`save(opts.todoFile, state)` with arguments swapped. The frontier
repair fixes both: `state = add(state, args.join(' '))` and
`save(state, todoFile)`.

But T7's tests **also** cannot pass while T1 (add) is rolled back to a
stub, so the oracle cannot distinguish "local got runCli wrong" from
"local got runCli right but its add stub throws."

## Methodology bug (the real finding)

The router rolls back the workspace on local failure to keep state
clean across tasks. But the test slices have **transitive
dependencies** that the rollback breaks:

- T1's test calls T4 functions
- T7's tests call T1, T3, T4, T5, T6 functions

Once a task is rolled back, downstream tests that depend on it cannot
pass. The router's "local failed" verdict therefore conflates two
different conditions:

1. The local model produced wrong code (real failure).
2. The local model produced right code but a downstream stub broke
   the oracle (false failure, induced by the experimental design).

This experiment cannot distinguish (1) from (2) without manual
inspection of the manifest.

**Methodology lesson for harness-arena and similar oracles:** every
test slice must run against either a fully-implemented workspace or a
slice-isolated workspace. Concretely: either implement all functions
before testing any (which removes the routing signal), or mock all
not-yet-implemented functions during each task's oracle, or use a
strict per-task isolated module that doesn't depend on other tasks.

The harness-arena `oracles/` already does this correctly — each
oracle (e.g. `h14-tdd-red-green-oracle.mjs`, `h15-api-endpoint-oracle.mjs`)
tests only its own surface, with private fixtures, and does not
import the workspace's broader module graph. That design choice is
vindicated by this pilot's failure to replicate it.

## Honest revised verdict

If T1 and T7 are scored on local code quality (frontier-inspected)
rather than oracle pass:

- **T1 add:** local-pass (qwen3-coder code was correct)
- **T7 runCli:** local-partial (structure right, save argument bug;
  one minor frontier patch to ship)

That gives a revised picture: **6/7 closed by local with one bug
fix on the hardest task.** Frontier was meaningfully needed only on
the actual hardest task (CLI dispatcher).

This is a stronger result than the raw 5/7 — but the revision is a
manual frontier judgment on local code, not an automated oracle, so
**it does not count as evidence for the §2a tracker either**. It
counts as engineering signal that the hypothesis was not falsified
by this small test, with the explicit caveat that the oracle
methodology must be fixed before the experiment can be repeated
defensibly.

## Cost picture (rough)

- Local tokens consumed across all 7 tasks (5 successful + 2
  rolled-back attempts × 2 models): **1084 eval tokens total**.
- Frontier (Claude) tokens consumed: not measured in this experiment.
  The frontier wrote spec.md (~1500 tokens), tasks.json (~3000
  tokens), todo.test.mjs (~2500 tokens), router.mjs (~3000 tokens),
  this report (~1500 tokens), plus the T1/T7 repair (~400 tokens).
  Order of 10-15k tokens of frontier output, which is a large fixed
  cost relative to the 1084 local tokens.

The honest reading: at **this scale** (one 7-task app), the frontier
fixed-cost dominates. The hybrid pattern is hypothesised to amortise
when the same scaffolding (spec + tests + router) is reused across
many runs, and the marginal cost per run is ~1000 local tokens with
no frontier intervention. This pilot does not test that amortisation
claim — it would need 3+ apps reusing the same scaffold.

## What this pilot supports / does not support

**Supports:**

- A single small bounded app can be assembled with most subtasks
  driven by `qwen3-coder:30b` plus deterministic gates (5/7 raw,
  6/7 generously) on this rig.
- The 30B coder model produces reasonable function-body code on
  bounded inputs at this prompt-format strictness.
- A test-driven router with rollback is implementable in ~250 LOC
  of plain JS without PL flow syntax — but the oracle isolation
  problem is non-trivial.

**Does not support:**

- That hybrid is cheaper than frontier-only at any scale (no matched
  baseline arm; frontier scaffolding cost not measured).
- That the routing pattern generalises beyond this app shape.
- That qwen3-coder is reliably producing correct code rather than
  pattern-matching shapes (per the 2026-05-11 strict-format-fit
  smoke Finding 2, with adversarial follow-up showing 0/3 on
  isPrime).
- Anything claim-eligible per program-status.md §3a.

## What to do next (concrete)

1. **Re-run with isolated oracles.** Either inline-stub all other
   functions during each task's test, or write per-task private
   fixtures that don't import the workspace's broader graph. Compare
   the per-task local-pass rate to the 5/7 raw and 6/7 revised here.
2. **Add a frontier-only baseline arm.** Have Claude implement all
   7 tasks directly without any local routing. Compare frontier
   tokens consumed end-to-end. This is what would actually make the
   §2a tracker have a number.
3. **Run k≥3 per task per role.** The 2026-05-11 strict-format-fit
   smoke proved temperature=0 is non-deterministic on this Ollama
   stack. A single attempt's verdict is fragile.
4. **Fold useful pieces into harness-arena, not into this pilot.**
   The reusable scaffolding (spec/tasks/oracle/router pattern) should
   become a harness-arena route shape, not a one-off. Lookup agent
   confirmed real building blocks already exist at
   `experiments/harness-arena/h11/h14/h15-*-routing-policy.mjs`,
   `src/infrastructure/adapters/ollama-prompt-turn-runner.ts`, and
   `experiments/harness-arena/oracles/`.

## Cross-references

- Spec: [`../spec.md`](../spec.md)
- Manifest (per-task raw data): [`./manifest.json`](./manifest.json)
- Final assembled CLI: [`../workspace/todo.mjs`](../workspace/todo.mjs)
- Tests: [`../oracle/todo.test.mjs`](../oracle/todo.test.mjs)
- Router: [`../router.mjs`](../router.mjs)
- Hybrid-efficiency tracker the experiment feeds:
  [`../../../docs/strategy/program-status.md`](../../../docs/strategy/program-status.md#2a-hybrid-efficiency-tracker)
- Kill rule: [`../../../docs/strategy/thesis.md`](../../../docs/strategy/thesis.md#kill-rule)
- Companion strict-format-fit smoke (same day):
  [`../../local-format-fit-smoke/2026-05-11/`](../../local-format-fit-smoke/2026-05-11/)

## Reviewer agents (completed)

Two independent agents reviewed the experiment in parallel after the
preliminary report was drafted. Both found issues that materially
weaken the headline result. Their reports are appended verbatim.

### Confirmation agent verdict (summary)

Independent verdict: **weak proof-of-life, not evidence for the
support condition.** Confirms the methodology bug (T1's hidden T4
dependency) and grades T7's failures as REAL local bugs (qwen3-coder
called pure functions and discarded return values; devstral reversed
`save()` arg order AND passed `list()` output to `formatJson()`,
which I missed in my preliminary report). Confirms no
hardcoded-prime-list-style cheating recurred — oracles strong enough
on T2-T6 that memorised lookup wouldn't generalise. Recommends
filing as: *"hybrid path completed the app; per-task local-success
rate not reliably measurable from this run due to inter-task oracle
coupling; T7-class coordination tasks remain a credible
frontier-escalation candidate."*

Full text in [`./review-confirmation.md`](./review-confirmation.md).

### Critic agent verdict (summary)

Independent verdict: **the 5/7 headline is not evidence the routing
pattern works on real software**. Six concrete gap categories:

1. **Frontier contamination — spec-as-answer-key.** The prompts in
   tasks.json dictate signatures, state shape, exact formulas, return
   types, and output templates so densely that local was
   transcribing English-to-JS, not coding. T6 in particular tells the
   model literally "Return a string of `JSON.stringify(state, null,
   2)`" — that's the answer, not a task. If prompts were starved
   to "test names + empty stub", local pass-rate plausibly collapses
   to 0-1/7.
2. **Weak oracles.** Specific issues identified:
   - `T2_list_empty_state` regex `/no.*todo|empty/i` lets literal
     `"empty"` pass; qwen did exactly that.
   - `T2_list_marks_done_distinctly_from_pending` only checks
     `lineA !== lineB` — trailing whitespace would pass.
   - `T3_complete_does_not_mutate_input` doesn't check the array
     itself is untouched.
   - "Concurrent saves" promised in spec.md:69 but no such test
     exists. **Spec lies about the oracle.**
3. **Cherry-picked tasks.** All 7 are pure-ish functions with fixed
   dictated signatures. Notably absent: multi-file change, debugging
   existing failing tests, schema migration, performance work,
   security-sensitive code (path traversal in `TODO_FILE`? JSON bombs
   in `load`?). The 7 tasks are the curriculum of "write one ~10-line
   pure function from a complete spec" — exactly the shape qwen3-coder
   is benchmarked on.
4. **Frontier tokens uncounted (the killer).** `local_tokens_total`
   = 1,084. **Uncounted frontier tokens this session: ~8-12k**
   (spec ~1.5k + tasks.json ~1.8k + tests ~1.4k + router ~1.7k +
   T1/T7 repair ~600 + reading attempt logs ~2-4k input). A
   frontier-only baseline would have written `todo.mjs` + tests in
   ~3-4k output tokens in one shot. **The hybrid is roughly 2-3×
   MORE expensive in frontier tokens than frontier-only would have
   been**, while also consuming 94 seconds of local GPU. The
   "hybrid efficiency" framing is *inverted* at this scale; it can
   only become favorable amortised over many runs reusing the same
   scaffolding — which this experiment doesn't demonstrate.
5. **Not reproducible as written.** Missing: model digest /
   quantisation / Modelfile pin, Ollama version, llama.cpp commit,
   seed parameter, num_ctx, package.json/Node version pin. The spec
   lists `worker.mjs` and `run.mjs` as deliverables but only
   `router.mjs` exists. The HERE-path math in `todo.test.mjs:14`
   uses `replace(/\\/g,'/')` — Windows-only assumption that would
   misbehave on POSIX.
6. **Generalisability — n=1 everything.** One app, one rig, one
   operator, one task class. Critic's required next experiments:
   spec-density ablation; adversarial oracle written by a different
   author; cross-app replication on 3 distinct app shapes;
   k≥3 with seed sweep; frontier-only baseline arm with fully
   accounted token + wall-time cost; cold-cache run after
   `ollama stop`.

**Bonus catches in the harness itself** (real bugs I shipped):
- `router.mjs:extractFnBody` has dead logic — strips fences, then
  re-runs a regex on raw and may return a different string than the
  pre-stripped one.
- `router.mjs` fallback wraps body as `export function ${fnName}()`
  — **drops the parameter list**. Any task that hit this path
  would silently produce a 0-arity function. Nobody noticed because
  no task hit it.
- `oracleStderrTail` is `""` for every failed task in the manifest.
  Diagnostic capture is broken; the repair frontier (me) had no
  visibility into *why* T1/T7 failed.
- `complete`'s reference-equality not-found check
  (`workspace/todo.mjs:21-32`) is the same hardcoded-shape pattern
  Finding 2 from the strict-format-fit smoke flagged. Smelly even
  though it passes oracle.

Full text in [`./review-critic.md`](./review-critic.md).

## Combined verdict and concrete next steps

Both independent reviews agree the experiment is **proof-of-life
only and overclaimed at that**. The headline 5/7 (or generously
revised 6/7) cannot be cited as evidence for the hybrid hypothesis
without acknowledging:

- inter-task oracle coupling makes local pass-rate unmeasurable
- prompt density is so high that local is transcribing, not coding
- frontier scaffolding cost (8-12k tokens) dwarfs local savings at
  this scale and inverts the efficiency claim
- a real frontier-only baseline arm has never been measured

This pilot is **filed as engineering signal only** and is **not
promoted into the §2a hybrid-efficiency tracker** in
`docs/strategy/program-status.md`. The critic's 6 concrete next
experiments are the path forward; until at least items 1, 4, and 5
are addressed, the routing pattern cannot be honestly cited beyond
"a small bounded app of this shape was assembled with most subtasks
driven by a local model."

The harness-arena's existing route-policy infrastructure
(`experiments/harness-arena/h11/h14/h15-*-routing-policy.mjs` plus
`oracles/`) was already designed to address most of these issues.
This pilot's failure to replicate that design — by reinventing a
weaker oracle — is itself useful evidence that the harness-arena's
careful private-oracle design is correct.

## Lessons for skill packaging

The user's request included "if so create skills and techniques that
clade code/codex can use with symphony or whatever or even just
byitself to save tkens etc." Based on this pilot's findings, **a
skill that promises token savings via local routing should not be
shipped from this evidence base.** Specifically:

- **Don't ship a "hybrid routing" skill yet.** This pilot has no
  evidence the pattern saves frontier tokens at any practical scale.
  Wait for the spec-density ablation and frontier-only baseline.
- **Don't ship a "local-first coder" skill that targets qwen3-coder
  on this rig** without addressing the spec-as-answer-key bias.
  Otherwise the skill will only "work" when the user provides
  detailed prompts that already contain the answer.
- **Do consider shipping a "frontier writes tests, then implements
  itself" skill** — strict-TDD with adversarial cases up front, all
  done by the frontier. This pilot's *test design* (with critic's
  fixes) is more valuable as a pattern than the routing.
- **Do consider an "experiment scaffolding" skill** that produces
  the spec.md / tasks.json / oracle pattern (with critic's
  isolation fixes) as a reusable template for any local-vs-frontier
  comparison.

Both agents' full texts are checked in alongside this report so the
artifact is auditable end to end.
