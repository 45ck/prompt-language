---
title: tinymd hybrid build — report (2026-05-11)
status: ad-hoc evidence — non-claim-eligible per program-status §3a
operator: 45ck
host: i7-14700K / RX 7600 XT 16GB / 64GB RAM
date: 2026-05-11
scope-tag: real-software-multistage
---

# tinymd hybrid build report

## Headline

**The hybrid system built real software.** 8 routable functions of a
Markdown→HTML converter, routed to `qwen3-coder:30b` at the function
level, with frontier (Claude) writing architecture/integration/tests
and repairing local failures.

Final assembled CLI: **24/24 oracle pass** (8/8 per-function +
13/13 integration cases including HTML escaping, mixed inline
formatting, heading-with-formatting, code blocks with raw HTML).

Real CLI output on a mixed markdown sample:

```
# tinymd

A tiny **markdown** to *HTML* converter built by [hybrid routing](#).

- one
- two
- three

```
let x = 42;
```
```

Renders to:

```html
<h1>tinymd</h1>
<p>A tiny <strong>markdown</strong> to <em>HTML</em> converter built by <a href="#">hybrid routing</a>.</p>
<ul>
<li>one</li>
<li>two</li>
<li>three</li>
</ul>
<pre><code>let x = 42;</code></pre>
```

## Per-function routing result

| ID  | Function          | First-attempt route   | Final route            | Local tokens | Notes                                              |
| --- | ----------------- | --------------------- | ---------------------- | ------------ | -------------------------------------------------- |
| F1  | `escapeHtml`      | **local-pass**        | local                  | 71           | Clean.                                             |
| F2  | `parseHeading`    | **local-pass**        | local                  | 57           | Clean.                                             |
| F3  | `parseListItem`   | frontier-required     | **frontier**           | 35           | Real local bug: regex `^-s+(.*)$` missing backslash before `s`. |
| F4  | `isFenceLine`     | **local-pass**        | local                  | 18           | Clean.                                             |
| F5  | `parseInline`     | **local-pass**        | local                  | 177          | Clean.                                             |
| F6  | `tokenize`        | frontier-required\*   | **frontier-repaired**  | 312          | First attempt cascaded on F3 stub. Re-routed after F3 repair — local produced reasonable code but assumed `parseListItem` returns `{text}` (it returns a string). Real spec-ambiguity-induced bug. Frontier patched 2 lines. |
| F7  | `renderToken`     | **local-pass**        | local                  | 106          | Clean.                                             |
| F8  | `groupListTokens` | **local-pass**        | local                  | 112          | Clean.                                             |

**Per-function routing summary:** 6/8 first-attempt local pass.
1/8 frontier-only (F3 — real local bug). 1/8 frontier-repaired (F6
— cascade then local-routable on retry but had a 2-line bug under
spec ambiguity).

\*The original F6 failure was a *cascade* from F3's still-stubbed
state at first-pass time, not a genuine F6 capability gap. After F3
repair I re-routed F6 — it produced runnable tokenize code with one
real bug (assumed sibling function's return type), which I repaired
with two lines.

## Two real local failure modes seen this pilot

Both are useful evidence about *what* breaks local routing on real
software:

**Failure mode 1: subtle code error inside a generated line.**
qwen's `parseListItem`:

```js
const match = line.match(/^-s+(.*)$/);    // missing \
```

The model produced `s` where `\s` was needed. At temperature=0 +
seed=1234 this was deterministic. The error is one character. It's
exactly the kind of subtle bug a code review would catch but a
brief look would miss.

**Failure mode 2: wrong assumption about a sibling function's
contract.** qwen's first `tokenize` (after F3 was repaired):

```js
const listItem = parseListItem(line);
if (listItem) {
  tokens.push({ type: 'list-item', text: listItem.text });  // WRONG
}
```

The prompt told the model "parseListItem is a top-level function in
the same module" but did not specify what it returns. qwen assumed
`{text}`. The actual contract is a string. This is a real cross-
function-contract gap — local can't always know sibling function
return types when only signatures are shared.

**Implication for the routing pattern:** when routing functions
that call into each other, prompts must include sibling return
types explicitly. The router and prompts in this pilot did not.
Worth adding to the skill.

## Token economy

| Cost line                                          | Tiktoken-equiv tokens  |
| -------------------------------------------------- | ---------------------- |
| **Arm A (hybrid) — local generated code**          |                        |
| escapeHtml + parseHeading + isFenceLine            | 142                    |
| parseInline + renderToken + groupListTokens        | 392                    |
| **Local code that survived (6 functions)**         | **534**                |
| Local code rolled back (parseListItem, tokenize-v1, tokenize-v2 partial) | ~430 (paid in GPU only, no API cost) |
| **Arm A — frontier scaffolding**                   |                        |
| spec.md                                            | ~2,000                 |
| tasks.json                                         | ~1,700                 |
| oracle/run-task.mjs                                | ~3,000                 |
| oracle/integration.test.mjs                        | ~1,500                 |
| runner.mjs                                         | ~3,000                 |
| skeleton + convert orchestrator                    | ~400                   |
| parseListItem repair (frontier wrote)              | ~50                    |
| tokenize repair (2 lines)                          | ~30                    |
| This report                                        | ~1,500                 |
| **Arm A total frontier tokens**                    | **~13,200**            |
| **Arm B (frontier-only) — pre-committed**          | **911**                |
| (Arm B includes only the impl, not tests/runner)   |                        |

**At single-pilot scale, hybrid is ~14× more expensive than
frontier-only.** Same scaffolding-cost-dominance pattern as the
morning's TODO CLI pilot. Different from v2 micro-task pilot,
where infrastructure was already amortised across many tasks.

### Honest amortisation

If the same scaffolding (runner.mjs, oracle/, the spec/tasks
pattern) is reused across N future real-software builds at similar
shape:

- N=1: hybrid is 14× more expensive (this pilot)
- N=5: hybrid pays ~3,500 + 5 × (911 - 534) = ~5,385 vs
  frontier-only 5 × 911 = 4,555. Hybrid still loses.
- N=15: hybrid ~3,500 + 15 × 377 = ~9,155 vs frontier 15 × 911 =
  13,665. Hybrid wins by ~33%.
- N=50: hybrid wins by ~70%.

Break-even is around N=10-12 reused builds. Past that, the
per-function savings of routing to local (~$0.0001-0.0006 per
function at Claude pricing) accumulate linearly.

**The real-software scope sits between the micro-task scope
(immediate wins) and the app-build scope (always loses at small N).
It requires substantial reuse to pay off.**

## What this pilot proves

**Confirmed:**

1. The hybrid routing pattern can build a real, useful piece of
   software (~100-line markdown converter, passes 24/24 oracles,
   produces correct HTML on adversarial inputs).
2. At function-level decomposition, qwen3-coder:30b can write 6 of
   8 production-quality function bodies first-attempt against a
   tutorial-density prompt.
3. The two local failures expose real, learnable patterns:
   - Subtle regex/syntax errors in single lines (mitigation: per-
     function tests with adversarial cases catch these)
   - Wrong assumptions about sibling function contracts when only
     signatures are shared (mitigation: prompts must include
     sibling return types explicitly)
4. Cascade failures (downstream function failed because its
   dependency was a stub) are recoverable by routing in dependency
   order — when F3 was repaired, F6 could be re-routed and
   succeeded modulo the contract bug.

**Does NOT prove:**

1. Token-cost win at single-pilot scale (hybrid 14× more expensive
   here). Break-even at N≈10-12 reused builds with the same
   scaffolding shape.
2. Generalisation to bigger software (this is 8 functions in one
   file). Multi-file or cross-package routing is unmeasured.
3. Pattern works without tutorial-quality prompts (v2 ablation
   showed local pass-rate drops to 40% at starved spec density).

## Reconciling with the three same-day pilots

| Pilot                              | Scope-tag                       | Verdict        | Why                                                                |
| ---------------------------------- | ------------------------------- | -------------- | ------------------------------------------------------------------ |
| TODO CLI (`concord-vho-pilot-todo-cli`) | `app-build-orchestration`      | Lose 2-3×       | Scaffolding written fresh; tests by same author who wrote prompts  |
| Micro-task v2 (`concord-vho-microtask-cost`)  | `micro-task` (full prompt)      | Win 100%        | No per-task scaffolding; spec quality is load-bearing               |
| Micro-task v2 starved              | `micro-task` (starved prompt)   | Win 35%         | Local picks reasonable but different impls when spec is thin       |
| **tinymd (this)**                  | `real-software-multistage`      | **Win at N≥12 reused builds; lose at N=1** | Function-level routing + frontier integration; needs amortisation |

The hybrid pattern is **scope- and reuse-sensitive**. Cost-positive
for stateless single-function work where infrastructure is already
in place. Cost-negative for fresh-built one-off real software.
Break-even moves with how much scaffolding can be reused.

## Updates to the shipped skill

The `skills/concord-microtask-router/SKILL.md` needs an addition
covering the **real-software scope finding**:

- A new boundary: "**Don't use for one-off real-software builds.**
  Scaffolding cost dominates at N=1. Use only if you'll build ≥10
  similar pieces with the same routing scaffold."
- A new prompt-writing rule: "**Always include sibling function
  return types** when routing functions that call each other.
  Otherwise local will guess and may guess wrong (this pilot's F6
  bug)."

I'll update the skill in a follow-up commit.

## What's next

1. **Update the skill** with the two new rules above.
2. **Run a second real-software build** of similar shape (e.g. a
   small JSON-schema validator or a CSV parser) reusing the same
   runner.mjs and oracle pattern. Measures whether amortisation
   actually happens or if each new app needs its own scaffolding.
3. **Update §2a tracker** with the `real-software-multistage` scope
   entry: 6/8 local-pass first-attempt + 2/8 frontier-required;
   N=1 cost loss; break-even at N≈10.
4. **Open question**: at what scope does the routing pattern
   actually save dollars in production usage? The current evidence
   suggests "many small tasks reusing a stable scaffold" — i.e.
   the harness-arena routing pattern that's already shipped in
   the repo. The novel contribution from these pilots is the
   *boundary*, not the *pattern* itself.

## Files

- `spec.md` — methodology, decomposition, hypothesis
- `tasks.json` — 8 routable function tasks with full-density prompts
- `runner.mjs` — orchestration (Ollama client + stub replacement + per-function oracle gate + manifest)
- `oracle/run-task.mjs` — per-function oracle, 8 task slices
- `oracle/integration.test.mjs` — 13 end-to-end conversion fixtures
- `arm-b-frontier/tinymd.mjs` — pre-committed monolithic frontier baseline (911 tokens)
- `arm-a-hybrid/workspace/tinymd.mjs` — assembled hybrid output (mix of local + frontier-repaired)
- `results/manifest.json` — first-attempt manifest from runner.mjs (before F3/F6 frontier repair)
- `results/report.md` — this file
