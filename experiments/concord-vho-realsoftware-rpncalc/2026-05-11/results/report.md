---
title: rpncalc — cross-app reuse pilot, report (2026-05-11)
status: ad-hoc evidence — non-claim-eligible per program-status §3a
operator: 45ck
host: i7-14700K / RX 7600 XT 16GB / 64GB RAM
date: 2026-05-11
scope-tag: real-software-multistage
purpose: empirically test the N≈12 break-even claim from the tinymd pilot by building a second real software pilot using the same routing pattern
---

# rpncalc — cross-app reuse pilot

## Why this exists

The tinymd pilot earlier today claimed a theoretical break-even at
N≈10-12 reused real-software builds with the same scaffolding. That
estimate was a calculation, not a measurement. This pilot tests
whether a second real-software build of a different shape can
actually reuse the tinymd scaffolding, and what fraction of the
frontier tokens are genuinely amortisable.

**App built:** Reverse Polish Notation (RPN) calculator.
- Input: `"3 4 + 2 *"` → Output: `"14"`
- Supports +, -, *, /, integers, decimals, negative numbers.
- Errors: stack underflow, division by zero, malformed expression,
  unknown tokens.

Genuinely different domain from tinymd (parsing markdown vs.
parsing arithmetic). Same multi-stage decomposition shape (lex →
classify → evaluate). 7 routable functions plus a frontier-owned
orchestrator.

## Cross-app result

| Metric                              | tinymd | rpncalc | Δ       |
| ----------------------------------- | ------ | ------- | ------- |
| Routable functions                  | 8      | 7       | -1      |
| First-attempt local pass            | 6/8    | 6/7     | similar |
| Cascade failures (dep was stub)     | 1 (F6) | 1 (evaluate) | identical pattern |
| Genuine local failures              | 1 (F3) | 1 (isNumber) | identical pattern |
| Frontier repairs needed             | 2      | 1 (only isNumber; evaluate routed cleanly on second attempt) | -1 |
| Final oracle pass                   | 24/24  | 23/23   | both 100% |
| Real CLI works end-to-end           | yes    | yes     | both    |

The pattern transferred cleanly across domains. Same shapes of
local failure recurred:

- **Subtle code error in generated regex.** rpncalc's isNumber:
  `/^-?(?:\d+|\d+\.\d+|\.\d+)$/` — the `|\.\d+` branch accepted
  `.5` despite the spec example explicitly forbidding it. Same
  family as tinymd's parseListItem missing-backslash bug.
- **Cross-function-contract guess.** rpncalc's evaluate cascade-
  failed because isNumber was a stub at first-pass time. After
  isNumber repair, evaluate routed cleanly on second attempt
  (9/9 oracle). Same recovery mode as tinymd's tokenize.

## Token economy — actual amortisation measurement

| Cost line                           | tinymd  | rpncalc | Reused? | Notes                              |
| ----------------------------------- | ------- | ------- | ------- | ---------------------------------- |
| `runner.mjs`                        | ~3,000  | **~500 (genericised refactor only)** | **mostly** | Made path-discovery generic; same logic |
| `oracle/run-task.mjs` test slices   | ~3,000  | ~2,000  | structure | Test framework reused; case data new for each domain |
| `oracle/integration.test.mjs`       | ~1,500  | ~700    | structure | Same shape; cases all new          |
| `tasks.json`                        | ~1,700  | ~600    | format  | Same JSON shape; content domain-specific |
| `arm-b-frontier/<NAME>.mjs`         | (counts as baseline) | (counts as baseline) | n/a | Frontier-only reference            |
| `arm-a-hybrid/workspace/<NAME>.mjs` skeleton | ~400 | ~150 | format | Same stub pattern                  |
| `spec.md`                           | ~2,000  | ~0 (skipped this pilot) | optional | Prior spec format reused implicitly |
| Repair tokens                       | ~80     | ~30     | n/a     | Per-bug                            |
| Report                              | ~1,500  | ~1,500  | format  | Same template                      |
| **Total new frontier tokens**       | **~13,200** | **~5,500** | | **~58% reduction on second pilot** |

So the real reuse fraction is **~42%**. Significantly less than
"reuse everything" but still meaningful. The cost-per-pilot drops
from ~13.2k (first build, no reuse) to ~5.5k (second build with
genuine reuse).

### Revised break-even calculation

With N pilots:

```
hybrid_total = 13.2k (first pilot setup) + (N-1) × 5.5k (subsequent)
frontier_only_total = N × ~700 (avg per-pilot baseline)
```

Break-even when hybrid_total ≤ frontier_only_total:

| N pilots | Hybrid total | Frontier-only total | Hybrid wins? |
| -------- | ------------ | ------------------- | ------------ |
| 1        | 13,200       | 700                 | No (~19×)    |
| 5        | 35,200       | 3,500               | No (~10×)    |
| 10       | 62,700       | 7,000               | No (~9×)     |
| 25       | 145,200      | 17,500              | No (~8×)     |
| 50       | 282,700      | 35,000              | No (~8×)     |
| 100      | 557,700      | 70,000              | No (~8×)     |

**Sobering result: hybrid never breaks even** under this model
because the 5.5k per-pilot cost remains larger than the per-pilot
local saving (~500-600 tokens of code that would otherwise be
frontier output). The earlier tinymd "break-even at N≈12"
calculation was wrong because it assumed all 13.2k of first-pilot
scaffolding amortised, when actually only ~7.7k of it does.

The honest model is that **per-pilot scaffolding cost dominates
per-pilot local savings by ~10×** at this real-software scope.
Hybrid does not pay back on dollar economics at this scope, period.

What survives:
- The local code IS genuine, useful, and correct (tinymd 24/24,
  rpncalc 23/23). The system works mechanically.
- The non-cost benefits (privacy, latency, quota independence)
  remain real.
- The micro-task scope (v2 pilot) where 100% of the saving is the
  local code with NO scaffolding cost still wins immediately.

## What this changes about the engineering-readiness verdict

The 2026-05-11 morning verdict that hybrid pays off at "real-
software multistage scope past N≈12" is **wrong** by today's
measurement. Honest revision:

| Engineering decision                                     | Verdict (revised)        |
| -------------------------------------------------------- | ------------------------- |
| Ship `concord-microtask-router` skill                    | **GO** (still — micro-task win is real) |
| Use hybrid for narrow personal/internal micro-tasks      | **CONDITIONAL GO** (still) |
| Use hybrid for **real-software multistage**              | **NO** (revised — never pays off on dollar economics; only justified by privacy/latency/quota) |
| Build Portarium ↔ PL integration                         | **NO** (still — premature) |
| Promote hybrid as primary engineering paradigm           | **NO** (still — n=2 doesn't change this) |

The skill's existing boundary "don't use for one-off real-software
builds" should be strengthened to "don't use for real-software
builds at all on dollar grounds — only if privacy/latency/quota
matter more than raw cost."

## What this pilot proves

**Confirmed:**
1. The routing pattern transfers cleanly across domains (markdown
   parsing → arithmetic evaluation). Same per-pilot shape: ~80-90%
   first-attempt local pass, ~1 real local bug per build, ~1
   cascade failure recoverable on retry, integration tests pass
   after at most one frontier repair.
2. The runner.mjs is genuinely reusable across pilots with minor
   genericisation (~500 tokens of refactor work).
3. The oracle/test pattern is reusable in *structure* but the
   domain-specific test cases must be newly written per pilot.
4. Local failure modes are stable across pilots: subtle regex
   errors and cross-function-contract guesses. Same fixes apply.

**Disproved:**
1. The tinymd "break-even at N≈12" claim is wrong. The honest
   amortisation model gives no break-even at any N.

**Still open:**
1. The micro-task scope still pays off (v2: 10/10 at k=10).
2. Cross-app generalisation beyond two pilots curated by the same
   author is unmeasured.

## CLI smoke

```
3 4 + = 7
10 2 / = 5
1 2 + 3 4 + * = 21
0.1 0.2 + = 0.3
5 0 / -> division by zero
```

Working calculator. 84-line module mostly written by qwen3-coder:30b.

## Files

- `spec.md` — *(skipped to test minimal-spec reuse; experiment design is documented in this report instead)*
- `tasks.json` — 7 routable function tasks, full-density prompts
- `runner.mjs` — generic real-software runner (refactored from
  tinymd's; auto-detects workspace name; works for any pilot of
  this shape)
- `oracle/run-task.mjs` — per-function oracle, 7 task slices
- `oracle/integration.test.mjs` — 16 end-to-end RPN cases
- `arm-b-frontier/rpncalc.mjs` — pre-committed monolithic baseline
- `arm-a-hybrid/workspace/rpncalc.mjs` — assembled hybrid output
- `results/manifest.json` — first-attempt manifest from runner
- `results/report.md` — this file
- `results/rpncalc.skeleton.mjs` — skeleton backup (auto-saved by
  runner so re-runs start from the same state)
