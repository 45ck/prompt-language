---
title: Cross-family adversarial review findings (devstral grading qwen)
status: ad-hoc evidence — non-claim-eligible per program-status §3a
reviewer: devstral-small-2:24b (Mistral family)
implementer: qwen3-coder:30b (Alibaba/Qwen family)
operator: 45ck
date: 2026-05-11
---

# Cross-family adversarial review findings

Following adversarial review of the 2026-05-11 research synthesis,
ran a cross-family check on the v2 100/100 micro-task headline.
Process: devstral-small-2:24b (Mistral family, different from
qwen) generates 6 adversarial test cases per task; qwen's existing
k=1 solutions are run against those new cases.

## Headline

**The 100/100 v2 result does NOT fully survive cross-family
scrutiny.** Specifically:

- **1 real qwen bug found** that the original v2 oracle missed
  (parseQuery on `?a=b=c`).
- **2 of 4 gradable tasks held up cleanly** (chunk 6/6, slugify
  5/6 modulo a spec-interpretation difference).
- **1 task confounded by a methodology bug** (applyDiscountTier
  — devstral wrote test cases with reversed argument order).
- **6 of 10 tasks not gradable** because devstral wrote
  invalid-JSON cases (using `new Map()`, unquoted keys).

Combined with the published-baseline comparison
(`../results/published-baseline-comparison.md`), the v2 100/100
headline is **not a research finding** — it's a combination of
expected-baseline behaviour and oracle weakness.

## Per-task results

| Task                  | Adversarial cases | Qwen pass | Honest reading                                  |
| --------------------- | ----------------- | --------- | ----------------------------------------------- |
| applyDiscountTier     | 6                 | 0/6       | **Confounded** — devstral reversed `(cartTotal, tiers)` argument order despite explicit spec. Tells us nothing about qwen. |
| validateConfig        | (not graded)      | —         | Devstral wrote invalid JSON (e.g., bare schema objects with unquoted keys). |
| formatLogEntry        | (not graded)      | —         | Same — devstral wrote nested objects without quoted keys. |
| mergeAcl              | (not graded)      | —         | Devstral used JS `new Map()` and `new Set()` literals which aren't valid JSON. |
| chunk                 | 6                 | **6/6**   | qwen genuinely correct on adversarial cases.    |
| slugify               | 6                 | 5/6       | 1 failure on `"i'm"` — devstral expected `"im"` (drop apostrophe entirely); qwen produced `"i-m"` (apostrophe → hyphen, per spec). **Spec-interpretation difference, not a bug.** |
| groupBy               | (not graded)      | —         | Devstral wrote object literals with unquoted keys. |
| parseQuery            | 6                 | 5/6       | **REAL QWEN BUG**. Devstral case: `"?a=b=c"` → expected `{a:"b=c"}` (split on first `=`). Qwen returned `{a:"b"}` (drops everything after the second `=`). The v2 oracle did not test this case. |
| partition             | (not graded)      | —         | Devstral wrote arrow functions inline in JSON. |
| flatten               | (not graded)      | —         | Devstral wrote multiple nested arrays not in JSON shape. |

## The real qwen bug found

`parseQuery("?a=b=c")`:

- Spec implies (and arm-b-frontier's reference implements): split on
  the *first* `=`, so `{a: "b=c"}`.
- Qwen's k=1 implementation:
  ```js
  const [key, value] = pair.split('=', 2);
  ```
  This splits on `=` and takes only the first 2 elements, so
  `"a=b=c".split('=', 2)` returns `["a", "b"]` — discards the
  `=c` tail entirely. Result: `{a: "b"}`.
- This is a real bug. The v2 oracle's parseQuery cases never
  included a value containing `=`.

This is exactly the failure mode the oracle weakness critique
predicted: the same author wrote prompts and tests, and the
prompts didn't enumerate this edge case so the tests didn't either.
A different family writing tests immediately surfaced it.

## Methodology lesson — devstral as adversarial reviewer

Devstral failed to generate JSON-parseable cases for 6 of 10
tasks. The pattern was always the same: it wrote idiomatic JS
literals (`new Map()`, `{ id: 1 }` with unquoted keys, arrow
functions inside JSON arrays) instead of strict JSON.

Two ways forward for a future cross-family run:

1. **Stricter prompt with examples** showing the exact JSON shape
   required. Devstral may comply if shown.
2. **Use a JS-literal-aware parser** (e.g. eval() in a sandbox, or
   `json5`) instead of strict `JSON.parse`. Acceptable for
   research-grade evidence; would not be acceptable for production.

A third option is to use a different reviewer model (the gemma4:26b
attempt returned empty output — likely a thinking-token issue
specific to the gemma4 stack on this rig).

## What survives as defensible signal

Even with the partial coverage, the cross-family review made one
material finding the v2 oracle missed: **qwen's parseQuery has a
real bug on `?a=b=c`**. This proves the broader thesis: **single-
author oracle authoring (same model writes prompts and tests)
inflates pass rates by missing edge cases the prompt author didn't
think of**. Cross-family oracle authoring is the right pattern.

The 100/100 v2 headline should be revised to:
- 9/10 first-attempt at full prompt density when graded by the
  same-author oracle.
- ≤8/10 when graded by an adversarial cross-family reviewer
  (tentative; partial coverage).

The "deterministic substitution" narrative is significantly
weaker than the original synthesis claimed.

## Updated bead status

- prompt-language-mcog (P0, this experiment) — **completed**.
  Found 1 real qwen bug; methodology refined.
- prompt-language-h48s (P1, published-baseline comparison) —
  **completed**. Published-baseline document at
  `../results/published-baseline-comparison.md`.

## Cross-references

- Original v2 report: [`../results/report.md`](../results/report.md)
- Published-baseline comparison: [`../results/published-baseline-comparison.md`](../results/published-baseline-comparison.md)
- Synthesis challenge-and-defense: [`../../../docs/strategy/research-synthesis-challenge-and-defense-2026-05-11.md`](../../../../docs/strategy/research-synthesis-challenge-and-defense-2026-05-11.md)
- Cross-family runner: [`./cross-family-runner.mjs`](cross-family-runner.mjs)
- Raw results: [`./cross-family-results.json`](cross-family-results.json)
