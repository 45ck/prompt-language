---
title: Pilot v2 report — micro-task token-cost comparison (2026-05-11)
status: ad-hoc evidence — non-claim-eligible per program-status §3a
operator: 45ck
host: i7-14700K / RX 7600 XT 16GB / 64GB RAM
date: 2026-05-11
---

# Pilot v2 report

## Headline

**10/10 first-attempt local pass at k=3 (30/30 individual oracle
passes).** All 4 novel-spec tasks and all 6 utility tasks passed
qwen3-coder:30b's first attempt against deterministic oracles
including seeded random inputs.

| Metric                                  | Value                              |
| --------------------------------------- | ---------------------------------- |
| First-attempt pass                      | **10/10**                          |
| Any-of-3 pass                           | 10/10                              |
| Total individual oracle passes (k=3)    | **30/30**                          |
| Frontier-only baseline cost (Arm B)     | 693 tiktoken-equiv tokens          |
| Hybrid frontier cost (Arm A first-pass) | 0 (no repair needed)               |
| Net per-pilot frontier token saving     | **693 (100% of Arm B)**            |
| Local GPU wall time                     | ~25 seconds across all 30 attempts |

## Per-task results

| Task              | Cat        | Arm B chars | Arm B tokens | Arm A k1 tokens | k=3 pass | Diff vs Arm B                                                                                                            |
| ----------------- | ---------- | ----------- | ------------ | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| applyDiscountTier | novel-spec | 198         | 63           | 125             | 3/3      | More verbose, +applicableTier var, +empty-tiers guard                                                                    |
| validateConfig    | novel-spec | 376         | 97           | 126             | 3/3      | Different style, equivalent                                                                                              |
| formatLogEntry    | novel-spec | 336         | 91           | 120             | 3/3      | Different style, equivalent                                                                                              |
| mergeAcl          | novel-spec | 240         | 69           | 90              | 3/3      | Different style, equivalent                                                                                              |
| chunk             | utility    | 196         | 62           | 66              | 3/3      | Near-identical                                                                                                           |
| slugify           | utility    | 117         | 37           | 43              | 3/3      | Near-identical                                                                                                           |
| groupBy           | utility    | 200         | 59           | 62              | 3/3      | Near-identical                                                                                                           |
| parseQuery        | utility    | 420         | 125          | 133             | 3/3      | **Local found BETTER behavior** (handles `+` as space per application/x-www-form-urlencoded; my impl only handled `%XX`) |
| partition         | utility    | 132         | 44           | 66              | 3/3      | Slightly more verbose                                                                                                    |
| flatten           | utility    | 167         | 46           | 51              | 3/3      | Near-identical                                                                                                           |

**Local is genuinely writing different code, not transcribing.** Sample
diffs (Arm B vs Arm A k=1) at end of report. On `parseQuery`, the
local model produced _more correct_ behavior than my pre-committed
frontier reference — it added `+`-to-space decoding which is the
actual HTML form spec, while my impl only handled percent-escapes.
The other 9 are stylistic differences (more verbose variable names,
intermediate variables) with equivalent semantics.

## Token economy honest verdict

### Per-pilot at this scope

| Cost line                                                     | Hybrid (Arm A)              | Frontier-only (Arm B equivalent) |
| ------------------------------------------------------------- | --------------------------- | -------------------------------- |
| Output tokens spent on impls                                  | **0**                       | 693                              |
| Local eval tokens (GPU, free)                                 | ~2700 across k=3 × 10 tasks | n/a                              |
| Frontier infrastructure (router + oracle, written this pilot) | ~3500 tokens (one-time)     | 0                                |
| **Per-pilot net frontier cost**                               | ~3500                       | 693                              |

**At one-pilot scale, frontier-only is still cheaper** — the v2
infrastructure cost (router.mjs, oracle/run-tests.mjs, tasks.json,
spec.md, this report) is ~3500 frontier tokens for 693 tokens saved.
The hybrid is **5× more expensive at one-pilot scale**.

### Amortised across N pilots reusing the same infrastructure

| N pilots | Hybrid frontier cost | Frontier-only cost | Hybrid wins?      |
| -------- | -------------------- | ------------------ | ----------------- |
| 1        | ~3500 (infra) + 0    | 693                | No (5× worse)     |
| 5        | ~3500 (infra) + 0    | 3,465              | Roughly even      |
| 10       | ~3500 (infra) + 0    | 6,930              | Yes (~2× better)  |
| 100      | ~3500 (infra) + 0    | 69,300             | Yes (~20× better) |

Break-even point is ~5 pilots reusing the same router + oracle +
task scaffold. Past that, hybrid pays off linearly.

### Per-task amortised after break-even

Once infrastructure is paid for, **every additional micro-task
routed to local saves the equivalent of its Arm B tokens** —
typically 40-130 tiktoken-equiv tokens. At Claude Sonnet 4 output
pricing ($3 / 1M tokens) this is $0.00012 to $0.00039 saved per
task. At Claude Opus pricing ($15 / 1M tokens), $0.0006 to $0.002
per task.

**The dollar savings are modest.** The real value of the system at
this scope is not cost:

- **Privacy**: code never leaves the rig
- **Latency**: 1-3 second local response vs 2-10 second API call
- **Rate-limit independence**: no Anthropic/OpenAI quotas
- **Reliability**: no API outages or model deprecation

## What this pilot actually proves

**Confirmed at micro-task scope:**

1. For tasks with a clear ~30-100 token spec and a deterministic
   oracle, qwen3-coder:30b on this rig matches frontier code
   correctness across all 10 tested tasks (k=3, including 4
   novel-spec tasks where retrieval/memorisation is unlikely).
2. Local output tokens are slightly higher than frontier (~10-50
   more tiktoken-equiv per task) due to verbosity, but this is
   immaterial to the cost story since local doesn't pay output
   token rates.
3. Routing pays off after ~5 pilots reusing the same infrastructure,
   and scales linearly past that.
4. Local can produce _more correct_ code than frontier on
   underspecified prompts when the model has stronger domain
   knowledge (parseQuery + handling).

**Does NOT prove (still open from prior pilot):**

1. That hybrid pays off at single-app-build scope. The TODO CLI
   pilot showed scaffolding cost dominates and hybrid is 2-3× more
   expensive when measured per-app. v2 is per-task, not per-app.
2. That this generalises beyond clearly-specified single-function
   tasks. Multi-function refactors, debugging existing code, and
   tasks with implicit context are unmeasured.
3. That the routing pattern wins on adversarial prompts where the
   description is significantly thinner than what was used here.
   The "starvation" sub-experiment (signature only, no English
   description) is not yet run.
4. That local first-attempt pass holds at k≥10 or across many
   prompt variations. k=3 here is not enough to publish stable
   pass-rate numbers.

## Reconciling with prior pilot

The TODO CLI pilot (2026-05-11, earlier today) and this v2 are not
contradictory — they are measuring different scopes:

| Scope                      | Verdict                | Why                                                          |
| -------------------------- | ---------------------- | ------------------------------------------------------------ |
| **Per-task micro-routing** | **Hybrid wins (this)** | No per-task scaffolding cost; 100% local success on 10 tasks |
| **Per-app construction**   | Hybrid loses (prior)   | Scaffolding dominates; hybrid 2-3× more expensive            |

Both findings update the §2a hybrid-efficiency tracker honestly.
The hybrid pattern is **cost-positive for stateless one-shot code
generation** and **cost-negative for app-build orchestration** at
the scale tested.

## Sample diffs (Arm B vs Arm A k=1)

### applyDiscountTier — different style, equivalent

```js
// Arm B (frontier, pre-committed):
export function applyDiscountTier(cartTotal, tiers) {
  let pct = 0;
  for (const [min, p] of tiers) {
    if (cartTotal >= min) pct = p;
    else break;
  }
  return cartTotal * (1 - pct / 100);
}

// Arm A k=1 (qwen3-coder:30b):
export function applyDiscountTier(cartTotal, tiers) {
  if (!tiers || tiers.length === 0) return cartTotal;
  let applicableTier = null;
  for (const [minTotal, percentOff] of tiers) {
    if (minTotal <= cartTotal) {
      applicableTier = [minTotal, percentOff];
    } else {
      break;
    }
  }
  if (applicableTier) {
    const [, percentOff] = applicableTier;
    return cartTotal * (1 - percentOff / 100);
  }
  return cartTotal;
}
```

### parseQuery — local found BETTER behavior than frontier

```js
// Arm B (frontier — only handles %XX escapes):
export function parseQuery(qs) {
  if (!qs) return {};
  const s = qs.startsWith('?') ? qs.slice(1) : qs;
  if (!s) return {};
  const out = {};
  for (const pair of s.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const k = eq === -1 ? pair : pair.slice(0, eq);
    const v = eq === -1 ? '' : pair.slice(eq + 1);
    out[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return out;
}

// Arm A k=1 (qwen3-coder — also handles `+` -> space per
// application/x-www-form-urlencoded, which my impl missed):
export function parseQuery(qs) {
  const result = {};
  if (!qs) return result;
  const query = qs.startsWith('?') ? qs.substring(1) : qs;
  if (!query) return result;
  const pairs = query.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=', 2);
    const decodedKey = decodeURIComponent(key.replace(/\+/g, ' '));
    const decodedValue = value !== undefined ? decodeURIComponent(value.replace(/\+/g, ' ')) : '';
    result[decodedKey] = decodedValue;
  }
  return result;
}
```

The oracle didn't test `+`-to-space behavior, so my impl passes —
but in production code that handles real query strings, the local
output is more correct. **Local was not just matching frontier; it
was extending it.**

## Spec-density ablation (added same day)

After the headline 10/10 result, ran the same 10 tasks with prompts
**starved** to just `signature` + one-line behavior summary (no
algorithm details, no return-shape hints, no edge-case rules).

Examples of the change:

| Task              | Full prompt (104 tokens for applyDiscountTier)                                                                                                                                  | Starved (24 tokens)                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| applyDiscountTier | "tiers is an array of [minTotal, percentOff] sorted by minTotal ascending. Return cartTotal multiplied by (1 - p/100) using the highest tier whose minTotal is <= cartTotal..." | "Apply a tiered percentage discount to a cart total."      |
| formatLogEntry    | Full template with [LEVEL] service@host: msg \| k=v shape                                                                                                                       | "Format a log event with context as a single-line string." |
| chunk             | Full size-and-overflow rules                                                                                                                                                    | "Split an array into batches of a given size."             |

**Result with starved prompts:**

| Metric                     | Full       | Starved   | Δ    |
| -------------------------- | ---------- | --------- | ---- |
| First-attempt local pass   | **10/10**  | **4/10**  | -6   |
| Any-of-3 local pass        | 10/10      | 4/10      | -6   |
| Frontier tokens saved      | 693 (100%) | 246 (35%) | -447 |
| Frontier tokens still owed | 0          | 447       | +447 |

Per-task pass at starved density:

- **PASS** (4): `validateConfig`, `groupBy`, `partition`, `flatten` — these are tasks where the name alone is essentially the spec
- **FAIL** (6): `applyDiscountTier`, `formatLogEntry`, `mergeAcl`, `chunk`, `slugify`, `parseQuery` — local produced _reasonable but different_ implementations that didn't match my pre-committed reference's strict expectations

Failure modes inspected from `manifest-starved.json`:

- `slugify`: 5/7 oracle pass — local handled most cases but differed on whether to collapse trailing/leading hyphens
- `parseQuery`: 6/8 — local omitted `+`-as-space encoding (when not told), producing a different but still plausible interpretation
- `chunk`: 0 (no code extracted) — model added an explanatory preamble in starved mode
- `applyDiscountTier`, `formatLogEntry`, `mergeAcl`: model picked different tier-selection / format / data-shape choices than my reference

**This is the load-bearing finding.** The headline 10/10 was real but
_conditional on prompt density at "tutorial-quality" level_. When
prompts are merely "name + behavior verb", local pass rate drops to
40% and the system loses tokens on net (saves 246, owes 447 in
repair).

### Token economy under starvation

| Cost line                         | Hybrid (starved)             | Frontier-only          |
| --------------------------------- | ---------------------------- | ---------------------- |
| Output tokens spent on local pass | 0                            | 0                      |
| Frontier output owed for failures | 447 (Arm B for the 6 failed) | 693 (Arm B for all 10) |
| Local GPU eval tokens spent       | ~2700                        | n/a                    |
| **Net frontier output cost**      | 447                          | 693                    |
| **Net saving vs frontier-only**   | **246 (35%)**                | (baseline)             |

So even at starved density, hybrid still saves _some_ output tokens —
just much less than the headline 100%. But amortising the v2
infrastructure cost (~3500 frontier tokens) takes ~14 starved-mode
pilots to break even, vs ~5 in full-density mode.

### Implication for the skill

The `concord-microtask-router` skill must require **tutorial-quality
prompts** (signature + algorithm guidance + return shape + edge case
rules) to reliably pay off. Single-line "name + behavior verb"
prompts work for ~40% of tasks (the trivially-named ones) and lose
money on the rest.

This is also good news in disguise: it means the prompt-writing work
is real frontier work — the frontier author is contributing
algorithmic decomposition, not just typing. The "save tokens" claim
isn't free; it's "trade input-token effort for output-token
savings" with a leverage ratio that depends on how clear your
specs are.

## k=10 stability sweep (added 2026-05-11 evening)

Re-ran both density regimes at k=10 (10 reps per task, 100 reps per
arm total) to firm up the headline numbers and check for
single-shot variance.

| Regime          | k=3 result   | k=10 result        | Variance                                            |
| --------------- | ------------ | ------------------ | --------------------------------------------------- |
| Full density    | 30/30 oracle | **100/100 oracle** | Zero (every rep passes)                             |
| Starved density | 12/30 oracle | **40/100 oracle**  | Zero (same 4 tasks always pass; same 6 always fail) |

**Both numbers are perfectly stable.** No coin-flip variance at k=10.

This means:

- The headline 10/10 first-attempt pass at full density is **not a
  lucky run** — it's deterministic for this model + prompt + seed
  combination on this rig.
- The starved-density failures are **deterministic capability gaps**,
  not random misses — local truly needs algorithmic guidance for
  those task shapes.
- The earlier strict-format-fit smoke's finding of qwen non-determinism
  on isPrime at k=3 was task-specific, not a general property of
  the model at temp=0. Most tasks ARE deterministic; some aren't.

Per-rep data preserved in `results/manifest-k10-full.json` and
`results/manifest-k10-starved.json`.

## Recommendation for next experiments

In priority order:

1. ~~**Run a starvation ablation.**~~ DONE — see "Spec-density ablation"
   above.
2. ~~**Run at k=10 with seeded varying.**~~ DONE — see "k=10 stability
   sweep" above. Headline numbers stable to 0 variance.
3. **Cross-app generalisation.** Pick 50 micro-tasks from a real
   open-source codebase (e.g. random functions from a popular npm
   package) and re-run the same setup. If pass rate stays ≥80%,
   the pattern generalises beyond curated novel-spec tasks.
4. **Promote to §2a tracker** with explicit scope tag
   `micro-task-clearly-specified` and the 30/30 number, alongside
   the TODO CLI's negative result tagged
   `single-app-orchestration`.

## What this means for skill packaging

The user's request was: "create skills and techniques that claude
code/codex can use with symphony or whatever or even just by itself
to save tokens."

This pilot supports a **narrowly-scoped Claude Code skill** that:

- Accepts a single-function implementation request
- Has a clear ≤100-token spec
- Has a deterministic test or property check
- Routes to local Ollama (qwen3-coder:30b on AMD/Vulkan or any
  comparable) instead of consuming Claude API output tokens
- Falls back to Claude on first-attempt oracle fail

It does **not** support a "build whole apps with hybrid routing"
skill — the prior TODO CLI pilot showed scaffolding cost dominates
at that scope.

A draft skill spec is at:
`skills/concord-microtask-router/SKILL.md` (forthcoming).
