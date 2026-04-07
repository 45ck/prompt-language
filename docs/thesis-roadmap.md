# Thesis Research Roadmap

<!-- cspell:ignore babysitting -->

This document maps the [thesis experiments](thesis.md#experiments-that-can-prove-or-disprove-the-thesis) to the project's existing eval infrastructure and outlines what new tooling is needed for each.

## Priority order

| Priority | Experiment                              | Why first                                               |
| -------- | --------------------------------------- | ------------------------------------------------------- |
| P0       | E1 — Repeated failure elimination       | Cheapest to run, directly extends existing eval scripts |
| P1       | E3 — Wisdom accumulation                | Builds on `remember` / `memory:` already shipped        |
| P2       | E2 — Single-file vs multi-file projects | Requires `import` maturity and fixture design           |
| P3       | E5 — Parallel specialist orchestration  | Builds on `spawn` / `await` / `send` / `receive`        |
| P4       | E4 — Prompt-language-first factory      | Largest scope, depends on learnings from E1-E3          |

## Existing infrastructure

| Asset                                  | What it provides                                            |
| -------------------------------------- | ----------------------------------------------------------- |
| `scripts/eval/smoke-test.mjs`          | 32 live `claude -p` tests, temp-dir isolation, pass/fail    |
| `scripts/eval/comparative-eval-v4.mjs` | A/B plugin-vs-vanilla harness with `--repeat N` reliability |
| `scripts/eval/ab-eval.mjs`             | Earlier A/B framework (v1/v2 patterns)                      |
| `scripts/eval/verification-eval.mjs`   | Gate-focused eval                                           |
| `docs/eval-analysis.md`                | 45+ hypothesis results, latency data, pattern taxonomy      |

All experiments below assume the project builds (`npm run ci`) and smoke tests pass (`npm run eval:smoke`) before any research eval begins.

---

## E1 — Repeated failure elimination

**Goal**: Show that encoding a fix in prompt language prevents the same failure class from recurring.

### What exists

- `comparative-eval-v4.mjs` already runs plugin-vs-vanilla with repeat sweeps
- `smoke-test.mjs` has fixture patterns for `run:`, `if`, `retry`, and gate evaluation

### What is needed

1. **Failure catalog** — curate 10 recurring failure patterns from real usage (e.g., missing error handling, forgotten edge cases, incomplete migrations)
2. **Baseline fixture set** — one `.flow` per failure pattern, no recovery logic, record baseline pass rate over 3 runs
3. **Recovery fixture set** — same patterns with prompt-language recovery (`retry`, `if command_failed`, wisdom in `memory:`, additional gates)
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

---

## E2 — Single-file vs multi-file projects

**Goal**: Show that structured multi-file prompt-language projects outperform monolithic flows.

### What exists

- `import` and `export/use` syntax already shipped
- Prompt library system supports namespaced reuse

### What is needed

1. **Bounded task spec** — a concrete feature (e.g., "build a REST API with auth, CRUD, and tests")
2. **Single-file fixture** — one large `.flow` encoding everything
3. **Multi-file fixture** — `architecture.flow`, `policies.flow`, `wisdom.flow`, `build.flow`, `gates.flow` with imports
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

---

## E3 — Wisdom accumulation

**Goal**: Show that a `wisdom.flow` or `memory:` section reduces babysitting over time.

### What exists

- `remember` keyword and `memory:` prefetch section already shipped
- Smoke tests AC (remember + memory) validates the mechanism works

### What is needed

1. **Wisdom file** — a curated `wisdom.flow` with 10+ concrete lessons (e.g., "always check empty states", "verify tenant isolation")
2. **Task set** — 10 bounded tasks where those lessons are relevant
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

---

## E4 — Prompt-language-first software factory

**Goal**: Show that prompt language can serve as the primary engineering surface for bounded software.

### What exists

- Full runtime: `spawn`/`await`, `import`, `memory:`, gates, `review`, `approve`
- `foreach-spawn` for parallel fan-out

### What is needed

1. **App spec** — a bounded CRUD app on a fixed stack (e.g., Express + SQLite + Vitest)
2. **Prompt-language project** — multi-file repository expressing all engineering intent
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

---

## E5 — Parallel specialist orchestration

**Goal**: Show that multi-agent prompt-language coordination improves outcomes over single-agent.

### What exists

- `spawn`/`await`, `send`/`receive`, `race`, `foreach-spawn` all shipped
- Smoke tests AE (foreach-spawn) and AF (send/receive) validate mechanisms

### What is needed

1. **Task spec** — a medium-complexity bounded feature requiring multiple concerns (architecture, backend, frontend, testing, review)
2. **Single-agent fixture** — one flow doing everything sequentially
3. **Multi-agent fixture** — separate flows for planner, architect, implementer, tester, reviewer coordinated via `spawn`/`await`/`send`/`receive`
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

The last metric is the leading indicator. If engineers consistently prefer editing flows over code for the tasks tested, the thesis is directionally confirmed.

## Relationship to existing evals

The thesis experiments extend — not replace — the existing evaluation infrastructure:

- **Smoke tests** (`npm run eval:smoke`) remain the quality gate for every code change
- **Comparative evals** (`comparative-eval-v4.mjs`) remain the evidence base for gate-win claims
- **Thesis evals** are a separate tier focused on the broader research questions above

Results from thesis experiments should be documented in `docs/` alongside the existing `eval-analysis.md`, with the same honesty standard: wins, ties, and losses all reported.
