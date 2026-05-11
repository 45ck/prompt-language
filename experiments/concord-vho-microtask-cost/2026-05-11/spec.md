---
title: Concord/VHO pilot v2 — micro-task token-cost comparison
status: ad-hoc evidence — non-claim-eligible per program-status §3a
operator: 45ck
host: i7-14700K / RX 7600 XT 16GB / 64GB RAM / Ollama AMD-Vulkan
date: 2026-05-11
---

# Pilot v2: micro-task token-cost comparison

Direct response to the dual-reviewer audit of the 2026-05-11 TODO CLI
pilot, which found the hybrid pattern was 2-3× *more* expensive than
frontier-only at app-build scale due to scaffolding-cost dominance.
This pilot tests the same hypothesis at **micro-task scope**:
isolated single-function asks where there is no scaffolding cost to
amortise.

## Hypothesis under test

Routing a clearly-specified single-function implementation request to
`qwen3-coder:30b` via Ollama saves frontier API output tokens
without degrading correctness, when the spec is short (~30-100
tokens) and a deterministic oracle exists.

## Design changes from prior pilot

Three mandatory changes from a pre-flight critic agent before
running:

1. **Replaced ≥4 lodash-style tasks with novel-spec tasks** — the
   prior pilot's tasks were over-represented in qwen's training
   data, so headline pass rate didn't generalise. v2 includes 4
   novel-spec tasks (applyDiscountTier, validateConfig,
   formatLogEntry, mergeAcl) where the algorithm has no canonical
   form on the open web.
2. **Seeded random inputs in every oracle** — defeats the
   hardcoded-shape attack pattern that strict-format-fit smoke
   Finding 2 caught (qwen returning a hardcoded prime list).
   Mulberry32 PRNG seeded with `0xC0FFEE` for reproducibility.
3. **k=3 per task per arm** — the prior strict-format-fit smoke
   proved temperature=0 on this Ollama/Vulkan stack is
   non-deterministic (qwen3-coder:30b produced 3 different isPrime
   outputs across 3 identical runs).

## Other methodology fixes

- **Pre-committed Arm B (frontier) implementations BEFORE running
  Arm A** — prevents unconscious tightening of frontier code after
  seeing local output.
- **Single shared minimal-prompt template** for both arms, applied
  per-task. Prompts describe the algorithm but do not include the
  function body or any test fixtures.
- **tiktoken cl100k_base** for token counting — proxy for
  Anthropic's BPE (within ~10-15% per pre-flight critic, since
  Anthropic's tokenizer is not public).
- **Warm-up call discarded** — first qwen call pays cold-load cost.
- **No wall-time as primary metric** — Vulkan/AMD throttles under
  sustained load; tokens-spent is the comparison axis.

## Tasks

10 tasks — 4 novel-spec, 6 utility — all single-function, all with
deterministic oracles including seeded random inputs:

| ID                  | Category    | Signature                              | Why included                                     |
| ------------------- | ----------- | -------------------------------------- | ------------------------------------------------ |
| applyDiscountTier   | novel-spec  | `(cartTotal, tiers)`                   | Tiered business rule, not a canonical algorithm  |
| validateConfig      | novel-spec  | `(config, schema)`                     | Schema-driven validation with required + types   |
| formatLogEntry      | novel-spec  | `(event, ctx)`                         | Custom log line format with conditional fields   |
| mergeAcl            | novel-spec  | `(rules)`                              | Returns a Map<role, Set<perm>> — uncommon shape  |
| chunk               | utility     | `(arr, size)`                          | Lodash-canonical, oracle has random-array tests  |
| slugify             | utility     | `(title)`                              | Common, oracle includes non-ASCII inputs         |
| groupBy             | utility     | `(items, keyFn)`                       | Lodash-canonical                                 |
| parseQuery          | utility     | `(qs)`                                 | URL parsing with edge cases                      |
| partition           | utility     | `(arr, pred)`                          | Lodash-canonical                                 |
| flatten             | utility     | `(arr)`                                | Includes mutation check                          |

## Arms

- **Arm A (hybrid):** qwen3-coder:30b via Ollama
  (`POST /api/generate`, `temperature: 0`, `seed: 1234`,
  `num_predict: 512`). Per task: k=3 attempts, oracle gate. First
  attempt pass = local-only success.
- **Arm B (frontier, pre-committed):** Claude Opus 4.7 (this
  session) — implementations written into `arm-b-frontier/<task>.mjs`
  before any Arm A call.

## Promotion / escalation policy

- Arm A first attempt passes oracle → task counted as
  `local-first-attempt-pass`. **Frontier saving** = Arm B's
  tiktoken count for the same task (we would have spent that as API
  output tokens).
- Arm A first attempt fails but k=2 or k=3 passes → counted as
  `local-eventual-pass`. Frontier saving = same, but with
  reliability caveat (need a second-call routing rule).
- All k attempts fail → `frontier-required`. **Frontier loss** = Arm
  B's tiktoken count (still had to spend it) plus local GPU time
  consumed in the failed attempts.

## Token-economy formula

Per task:
```
tokensSavedByHybrid = (Arm A first-attempt pass)
                       ? armB.tokens
                       : 0
tokensWastedByHybrid = (Arm A first-attempt fail) ? armB.tokens : 0
```

Portfolio:
```
netFrontierTokenSavings = sum(tokensSavedByHybrid)
                         - sum(tokensWastedByHybrid)
                         - infrastructureCost (one-time, amortised over runs)
```

Infrastructure cost (router.mjs + oracle/run-tests.mjs +
tasks.json + arm-b pre-commits) is paid once and reused. With the
prior TODO CLI pilot's 8-12k frontier tokens of scaffolding written
fresh per pilot, hybrid was 2-3× more expensive at single-app scale.
Per-pilot amortisation analysis is in `results/report.md`.
