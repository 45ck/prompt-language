# Thesis Research Roadmap

<!-- cspell:ignore babysitting -->

This document maps the [thesis experiments](thesis.md#experiments-that-can-prove-or-disprove-the-thesis) to the project's existing eval infrastructure and outlines what new tooling is needed for each.

It is not the same thing as the product roadmap.

- The [product roadmap](../roadmap.md) is about making prompt-language a trustworthy supervision runtime now.
- This page is about the larger bet: whether that runtime can become a real engineering medium.

That means the thesis work must build on the product core in stages rather than racing ahead of it.

## Staged proof model

The thesis should be tested in this order:

1. **Runtime truth**: prove the runtime is really in control, inspectable, and repeatable.
2. **Outcome lift**: prove it improves bounded engineering outcomes over plain prompting.
3. **Project lift**: prove multi-file structure, wisdom, and orchestration improve maintainability and supervision burden.
4. **Medium shift**: prove engineers increasingly edit prompt-language artifacts first and code second.

If stage 1 or 2 is weak, stage 4 is just storytelling.

## Priority order

| Priority | Experiment                              | Why first                                               |
| -------- | --------------------------------------- | ------------------------------------------------------- |
| P0       | E1 — Repeated failure elimination       | Cheapest to run, directly extends existing eval scripts |
| P1       | E3 — Wisdom accumulation                | Builds on `remember` / `memory:` already shipped        |
| P2       | E2 — Single-file vs multi-file projects | Requires `import` maturity and fixture design           |
| P3       | E5 — Parallel specialist orchestration  | Builds on `spawn` / `await` / `send` / `receive`        |
| P4       | E4 — Prompt-language-first factory      | Largest scope, depends on learnings from E1-E3          |

Read this as a dependency order, not a hype order. The later experiments are more ambitious, but they only mean anything if the earlier ones show real lift.

## Existing infrastructure

| Asset                                  | What it provides                                                          |
| -------------------------------------- | ------------------------------------------------------------------------- |
| `scripts/eval/smoke-test.mjs`          | Live smoke suite spanning `A` through `AO`, temp-dir isolation, pass/fail |
| `scripts/eval/comparative-eval-v4.mjs` | A/B plugin-vs-vanilla harness with `--repeat N` reliability               |
| `scripts/eval/ab-eval.mjs`             | Earlier A/B framework (v1/v2 patterns)                                    |
| `scripts/eval/verification-eval.mjs`   | Gate-focused eval                                                         |
| `experiments/eval/datasets/*.jsonl`    | Checked-in dataset bank for the v1 eval runner                            |
| `docs/evaluation/eval-analysis.md`     | 45+ hypothesis results, latency data, pattern taxonomy                    |

All experiments below assume the project builds (`npm run ci`) and smoke tests pass (`npm run eval:smoke`) before any research eval begins.

They also assume the evidence is honest about host support, blocked environments, and runtime caveats. A thesis experiment that quietly leans on an unsupported or unverified host path is not evidence.

---

## E1 — Repeated failure elimination

**Goal**: Show that encoding a fix in prompt-language supervision reduces repeated human intervention on the same failure class.

### What exists

- `comparative-eval-v4.mjs` already runs plugin-vs-vanilla with repeat sweeps
- `smoke-test.mjs` has fixture patterns for `run:`, `if`, `retry`, and gate evaluation
- the seeded E1 JSONL bank now exists at `experiments/eval/datasets/e1-repeated-failures.jsonl`
- the locked Codex pair currently shows directional lift on the seed: vanilla `0/3` vs gated `1/3`

### What is needed

1. **Failure catalog** — curate 10 recurring failure patterns from real usage (e.g., missing error handling, forgotten edge cases, incomplete migrations)
2. **Baseline fixture set** — start from `experiments/eval/datasets/e1-repeated-failures.jsonl`, then grow it to 10+ failure patterns
3. **Recovery fixture set** — compare `candidate=vanilla` against `candidate=gated` first, then add richer recovery flows (`retry`, `if command_failed`, wisdom in `memory:`)
4. **Eval script** — `scripts/eval/thesis-e1-eval.mjs` extending the v4 harness to compare baseline vs recovery pass rates

### Success criteria

| Metric                     | Baseline target | Recovery target |
| -------------------------- | --------------- | --------------- |
| Pass rate                  | < 60%           | > 85%           |
| Repeated human fixes       | > 2 per task    | < 1 per task    |
| Failure shifts to new type | —               | > 50% of fails  |

### Verdict

- **Confirmed** if recovery fixtures measurably reduce repeated interventions across 3+ runs
- **Rejected** if pass rates do not improve or failures remain in the same category

Why this comes first:

- it tests the clearest near-term promise of the runtime
- it does not require a full factory story
- it answers whether prompt-language helps structurally, not stylistically

---

## E2 — Single-file vs multi-file projects

**Goal**: Show that structured multi-file prompt-language projects are easier to maintain and supervise than one large monolithic flow.

### What exists

- `import` and `export/use` syntax already shipped
- Prompt library system supports namespaced reuse

### What is needed

1. **Bounded task spec** — a concrete feature (e.g., "build a REST API with auth, CRUD, and tests")
2. **Single-file fixture** — one large `.flow` encoding everything, planned under `experiments/eval/datasets/e2-single-vs-multi-file.jsonl`
3. **Multi-file fixture** — `architecture.flow`, `policies.flow`, `wisdom.flow`, `build.flow`, `gates.flow` with imports, paired in that same planned dataset
4. **Eval script** — `scripts/eval/thesis-e2-eval.mjs` running both variants on 5+ tasks, comparing:
   - task pass rate
   - lines changed per edit
   - number of regressions across runs

### Success criteria

| Metric                     | Single-file | Multi-file target |
| -------------------------- | ----------- | ----------------- |
| Pass rate over 5 tasks     | baseline    | > baseline + 15%  |
| Lines changed per fix      | baseline    | < baseline - 30%  |
| Regressions across re-runs | baseline    | < baseline        |

### Verdict

- **Confirmed** if multi-file projects are more reliable and easier to edit
- **Rejected** if the added structure increases complexity without reliability gains

This is the first real test of "prompt-language project" thinking rather than single-run scripting.

---

## E3 — Wisdom accumulation

**Goal**: Show that reusable recorded lessons reduce repeated mistakes and human babysitting over time.

### What exists

- `remember` keyword and `memory:` prefetch section already shipped
- Smoke tests AC (remember + memory) validates the mechanism works

### What is needed

1. **Wisdom file** — a curated `wisdom.flow` with 10+ concrete lessons (e.g., "always check empty states", "verify tenant isolation")
2. **Task set** — planned under `experiments/eval/datasets/e3-wisdom-accumulation.jsonl`
3. **Two-arm eval** — run with and without wisdom loaded, 3 iterations each
4. **Eval script** — `scripts/eval/thesis-e3-eval.mjs` tracking:
   - repeated-mistake count
   - human correction count
   - pass rate

### Success criteria

| Metric            | Without wisdom | With wisdom target |
| ----------------- | -------------- | ------------------ |
| Repeated mistakes | baseline       | < baseline - 40%   |
| Human corrections | baseline       | < baseline - 30%   |
| Pass rate         | baseline       | > baseline + 10%   |

### Verdict

- **Confirmed** if wisdom-loaded runs show fewer repeated mistakes
- **Rejected** if outcomes are indistinguishable

This is important because it tests whether prompt-language can improve from prior work without collapsing into vague memory claims.

---

## E4 — Prompt-language-first software factory

**Goal**: Show that prompt-language can become the primary engineering surface for a bounded class of software work.

### What exists

- Full runtime: `spawn`/`await`, `import`, `memory:`, gates, `review`, `approve`
- `foreach-spawn` for parallel fan-out

### What is needed

1. **App spec** — a bounded CRUD app on a fixed stack (e.g., Express + SQLite + Vitest)
2. **Prompt-language project** — planned under `experiments/eval/datasets/e4-factory-starters.jsonl`, anchored to the CRM and helpdesk starter surfaces
3. **Execution harness** — runs the project end-to-end, measures:
   - whether a working app is produced
   - core journey pass rate (manual or automated)
   - percentage of changes made in `.flow` files vs direct code edits
4. **Eval script** — `scripts/eval/thesis-e4-eval.mjs`

### Success criteria

| Metric                           | Target     |
| -------------------------------- | ---------- |
| Working app delivered            | yes        |
| Core journeys passing            | > 80%      |
| Changes in `.flow` vs code       | > 60% flow |
| Engineer preference (flow first) | > 50%      |

### Verdict

- **Confirmed** if the app works and most engineering happens at the flow layer
- **Rejected** if heavy manual code cleanup is required or engineers prefer direct code edits

This is the hardest and most thesis-heavy experiment. It should come after the repo has already shown believable outcome lift and maintainability lift in smaller experiments.

---

## E5 — Parallel specialist orchestration

**Goal**: Show that explicit specialist coordination improves outcomes when the seams are real, not just because more tokens were spent.

### What exists

- `spawn`/`await`, `send`/`receive`, `race`, `foreach-spawn` all shipped
- Smoke tests AE (foreach-spawn) and AF (send/receive) validate mechanisms

### What is needed

1. **Task spec** — a medium-complexity bounded feature requiring multiple concerns (architecture, backend, frontend, testing, review)
2. **Single-agent fixture** — one flow doing everything sequentially
3. **Multi-agent fixture** — planned under `experiments/eval/datasets/e5-parallel-specialists.jsonl`, comparing the same task set with explicit specialist coordination
4. **Eval script** — `scripts/eval/thesis-e5-eval.mjs` comparing:
   - plan quality (acceptance criteria coverage)
   - task pass rate
   - integration bugs
   - human supervision minutes

### Success criteria

| Metric                  | Single-agent | Multi-agent target  |
| ----------------------- | ------------ | ------------------- |
| Acceptance criteria met | baseline     | > baseline + 20%    |
| Integration bugs        | baseline     | comparable or fewer |
| Human supervision       | baseline     | < baseline - 25%    |

### Verdict

- **Confirmed** if multi-agent coordination improves coverage without excessive integration cost
- **Rejected** if coordination overhead or integration bugs negate the benefits

This is not just a test of "more agents". It is a test of whether prompt-language adds value by making delegation, review, and integration explicit and inspectable.

---

## Cross-cutting evaluation metrics

Every experiment should track these for comparability:

- task success rate
- premature-stop rate
- human babysitting minutes
- human cleanup minutes
- repeated-failure rate
- run-to-run variance
- total cost and latency
- **engineering surface preference** — for each change, was it easier to modify the flow or the code?

The last metric is the leading indicator for the long-range thesis. If engineers consistently prefer editing prompt-language artifacts over code for the tasks tested, the thesis is directionally strengthened. If they do not, the runtime may still be valuable, but the "primary engineering medium" claim weakens.

## Exit criteria for the thesis direction

The broader thesis becomes materially stronger only if all of the following begin to show up together:

- prompt-language supervision produces measurably better bounded outcomes
- multi-file prompt-language projects are easier to revise than flat flows
- reusable wisdom reduces repeated mistakes
- multi-agent coordination improves coverage without chaos
- engineers choose to edit prompt-language artifacts first for at least some bounded software tasks

If the repo only proves gates and bounded supervision, that is still a useful product outcome. It just means the product is a strong supervision runtime rather than a new primary engineering medium.

## Relationship to existing evals

The thesis experiments extend — not replace — the existing evaluation infrastructure:

- **Smoke tests** (`npm run eval:smoke`) remain the quality gate for every code change
- **Comparative evals** (`comparative-eval-v4.mjs`) remain the evidence base for gate-win claims
- **Thesis evals** are a separate tier focused on the broader research questions above

Results from thesis experiments should be documented in `docs/` alongside the existing `evaluation/eval-analysis.md`, with the same honesty standard: wins, ties, and losses all reported.
