# Bounded Feature Implementation Benchmark

<!-- cspell:ignore 6e8t -->

## Status

Experiment-spec note for bead `prompt-language-6e8t`.

This note defines the second executable benchmark in the April 2026
experiment-spec backlog. It is intentionally narrower than the older thesis
labels in [Prompt Language Thesis](../../strategy/thesis.md): this backlog
"Experiment 2" is the bounded medium-feature benchmark, not the older thesis
labels in the dataset bank roadmap.

## Purpose

Measure whether prompt-language can add one medium feature to the fixed starter
application more reliably than a plain prompt over the same locked fixture
snapshots.

The point is not to reward the fanciest patch. The point is to answer one
concrete question:

> When the task is a bounded multi-file feature rather than a bug fix, does a
> prompt-language flow with deterministic gates produce more shippable outcomes
> than a plain prompt over the same app and the same time budget?

## Anchors

- [Benchmark Suite and Canonical Stack](../benchmark-suite-and-canonical-stack.md)
- [Evaluation Dataset Bank](../dataset-bank.md)
- [Eval Artifact Bundles and Replay](../eval-artifact-bundles-and-replay.md)
- [Evaluation Stack Test Matrix](../eval-test-matrix.md)
- [Regression Promotion Workflow](../regression-promotion-workflow.md)
- [Prompt Language Thesis](../../strategy/thesis.md)

## Hypothesis

Across the same fixed feature bank, the `gated` prompt-language candidate
should:

- produce a higher strong-pass rate than `vanilla`
- produce fewer auth and migration mistakes than `vanilla`
- produce fewer partial implementations that "mostly work" but are not
  actually shippable
- take slightly longer and cost slightly more than `vanilla`

The expected mechanism is:

- `vanilla` can stop after the happy path appears to work
- `gated` must continue until the feature-level validation commands and the
  stricter completion checks are green

## Candidate arms

The benchmark uses the existing runner semantics rather than inventing a custom
experiment harness.

| Arm | Runner candidate | Definition                                                                                                                                                                 |
| --- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | `vanilla`        | Run the dataset task prompt exactly as written, with no prompt-language control structure.                                                                                 |
| B   | `gated`          | Use the runner's generated one-step flow wrapper plus dataset-defined `gates`, so completion is enforced through prompt-language `done when` checks and repeatable repair. |

Shared controls for both arms:

- same harness, initially `codex`
- same model family and model version for both arms in one benchmark wave
- same fixture snapshot and seeded database state
- same validation commands and time budget
- same operator instructions and intervention policy
- same evidence capture rules

## Benchmark corpus

The benchmark should use a dedicated checked-in dataset rather than overloading
the older thesis labels in `dataset-bank.md`.

- dataset path:
  `experiments/eval/datasets/bounded-feature-implementation.v1.jsonl`
- suite note:
  `experiments/eval/bounded-feature-implementation/README.md`
- locked results directory:
  `experiments/results/bounded-feature-implementation/v1/`

The first version should contain **4 feature classes**. Each class should be a
bounded medium feature derived from the canonical Express + SQLite work-tracker
app in `zaq6`.

### Feature class selection rules

Every feature class must:

- require edits across at least four files
- touch at least three layers out of route/controller, domain/service,
  persistence or migration, and tests
- have a deterministic verification path that does not rely on human taste
  alone
- fit within a 45-minute wall-clock budget
- stay inside the fixed stack and avoid new external infrastructure
- preserve the app's existing auth/session model rather than replacing it
- be realistic enough that a partial implementation is plausible

### v1 feature bank

These are the concrete first four feature classes.

| ID  | Feature class        | Why it is included                                                                   | Required edit surfaces                                                        | Core validation commands                             |
| --- | -------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| BF1 | Audit log            | Measures append-only writes, viewer UX, and auth-sensitive access to historical data | schema or persistence, write path, read path, admin-only view, tests          | `npm run build`, `npm run test`, task-specific smoke |
| BF2 | Saved filters        | Measures user-scoped persistence plus query correctness and a visible UX surface     | schema, filter serialization, list/query path, authenticated UI route, tests  | `npm run build`, `npm run test`, task-specific smoke |
| BF3 | CSV export           | Measures feature completeness across data selection, auth, and response correctness  | route, export formatter, auth checks, fixture data coverage, tests            | `npm run build`, `npm run test`, task-specific smoke |
| BF4 | In-app notifications | Measures medium feature coordination across creation, unread state, and presentation | schema, event/write path, notification list route, read-state handling, tests | `npm run build`, `npm run test`, task-specific smoke |

Each class should map to one fixture family under:

`experiments/eval/fixtures/bounded-feature-implementation/<feature-id>/`

Each fixture family should provide:

- one locked starting snapshot
- one feature brief
- one deterministic verify script or fixed validation command list
- one short note describing the main failure modes expected from partial work

## Repetition count and run matrix

The bead requires at least three repetitions per condition. The first
publishable wave should therefore be:

- 4 feature classes
- 2 arms (`vanilla`, `gated`)
- 3 independent repetitions per arm

That yields **24 total runs** before reruns for blocked environments.

### Repetition rules

Every repetition must use:

- a fresh worktree or fresh fixture copy
- the same locked fixture commit for both arms
- the same harness and model inside one benchmark wave
- the same seeded database reset procedure
- a new session id and fresh runner output paths

To reduce order effects:

- alternate arm order by repetition (`AB`, `BA`, `AB`)
- randomize feature order inside each repetition
- do not run all `vanilla` rows first and all `gated` rows second

If a run is blocked by external host or environment issues:

1. rerun it once from a fresh worktree
2. if it blocks again for the same external reason, classify it as `blocked`
3. keep it in the evidence pack but exclude it from the headline denominators

## Task contract

Each dataset row in `bounded-feature-implementation.v1.jsonl` should include at
least:

- `id`
- `feature_class`
- `fixture`
- `objective`
- `task`
- `validation_commands`
- `gates`
- `time_budget_minutes`
- `starting_state`
- `expected_artifacts`
- `rubric`

The dataset row should be rich enough that `bin/cli.mjs eval` can run both arms
without hand-written per-feature orchestration.

`gates` should mirror the deterministic validation commands plus any feature-
specific proof steps. For example, if the feature requires `npm run build`,
`npm run test`, and an authenticated smoke route, the gated arm should not be
allowed to stop after only the happy-path smoke passes.

## Rubric

This benchmark uses a fixed seven-axis rubric with **0 to 2 points per axis**.
Maximum score per run is **14**.

| Axis           | `0`                                                                                                                                | `1`                                                                                                | `2`                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Feature works  | Core feature flow is missing, broken, or only a stub.                                                                              | Happy path works, but one required scenario or persistence path is incomplete.                     | Required scenarios work end to end on the seeded fixture.                                             |
| Compiles       | Standard build or typecheck path fails.                                                                                            | App can run partially, but the standard build path is unreliable or requires manual caveat.        | Standard build path passes cleanly with no manual caveat.                                             |
| Tests pass     | Required test suite stays red, or new failures were introduced.                                                                    | Only a narrowed or partial test subset passes, or flake remains unresolved.                        | Required full test suite passes cleanly.                                                              |
| Auth correct   | Privilege leak, missing guard, or wrong actor can access the feature.                                                              | Main auth path works, but one negative path, role edge case, or ownership check is wrong.          | Positive and negative auth paths behave correctly.                                                    |
| Migration safe | Migration is destructive, non-repeatable, or breaks seeded data.                                                                   | Migration works on the main path but is not clearly restart-safe or seeded-data-safe.              | Migration is restart-safe, preserves seeded data, and matches the fixture contract.                   |
| UX acceptable  | User path is confusing, broken, or obviously inconsistent with the starter app.                                                    | Feature is usable but rough: unclear labels, missing affordance, or inconsistent route/view shape. | User path is coherent with existing app conventions and is usable without extra operator explanation. |
| No regressions | Unrelated behavior broke, tests or safeguards were weakened, or the patch introduced a material side effect outside feature scope. | Minor unrelated regression risk or an avoidable rough edge remains.                                | No observed regression and no weakened quality or safety controls.                                    |

### Strong-pass rule

The headline "strong pass" threshold for this benchmark should be:

- total score of **12 or more**
- no `0` on `auth correct`, `migration safe`, or `no regressions`
- all deterministic validation commands green

A run with a lower score can still remain in the evidence pack, but it should
not count as a shippable success.

## Evidence capture

Each run should emit an artifact bundle consistent with the existing evaluation
framework rather than ad hoc screenshots or operator notes.

Minimum expected artifacts per run:

- run manifest with benchmark id, feature id, arm, repetition index, harness,
  model, fixture commit, and timestamp
- final report JSON produced by the runner
- command transcript or normalized result capture for every validation command
- patch or diff summary showing the changed files
- fixture-local smoke or endpoint evidence for the user-visible path
- concise rubric judgment with per-axis scores and one-sentence rationale
- blocked-environment note when a run cannot be judged fairly

Recommended artifact-bundle fields:

- `runId`
- `baselineRunId` when comparing against a locked baseline
- `featureClass`
- `arm`
- `repeat`
- `rubricScores`
- `validationResults`
- `artifactRefs`
- `finalOutcome`

Locked baselines and notable comparison reports should live under:

`experiments/results/bounded-feature-implementation/v1/`

## Scoring and comparison model

### Primary metrics

- strong-pass rate
- mean total rubric score
- per-axis mean score
- zero-rate on `auth correct`, `migration safe`, and `no regressions`
- median time to green

### Secondary metrics

- total tokens or provider-reported cost
- validation-loop count
- run-to-run variance by feature class
- blocked-run rate
- proportion of runs that needed human cleanup after a claimed stop

### Comparison rule

The benchmark should compare `vanilla` and `gated` at three levels:

1. overall across all 24 runs
2. by feature class
3. by rubric axis

This matters because prompt-language may win most clearly on auth, migration,
and regression containment even when happy-path feature completion looks close.

## Threats to validity

This benchmark is only useful if its weaknesses are written down up front.

### 1. Feature-class bias

Risk:
The chosen four features may accidentally favor query-heavy or route-heavy work.

Mitigation:
Keep the v1 bank mixed across audit/history, persistence/query, file export,
and notification/read-state behavior.

### 2. Prompt unfairness

Risk:
The `gated` arm could receive a more explicit task contract than `vanilla`.

Mitigation:
Keep the same task brief for both arms and let the only structural difference
be the prompt-language control/gate wrapper.

### 3. Judge subjectivity

Risk:
`UX acceptable` can drift into taste-based scoring.

Mitigation:
Tie the rubric to starter-app consistency, route clarity, and required user
path completion rather than visual polish or personal style.

### 4. Model and host drift

Risk:
Comparisons may be polluted by model-version changes or host instability.

Mitigation:
Pin the model family per wave, record exact runner/model metadata, and classify
repeatable environment failures as `blocked` rather than silent `failures`.

### 5. Learning and contamination effects

Risk:
Later runs may benefit from earlier operator familiarity or fixture residue.

Mitigation:
Use fresh worktrees, reset seeded data every run, alternate arm order, and keep
feature prompts locked once the wave begins.

### 6. Rubric gaming

Risk:
An agent may chase the happy path and miss migration or auth correctness unless
those are judged explicitly.

Mitigation:
Keep the seven-axis rubric fixed, require deterministic validation commands, and
use the no-zero strong-pass rule on the high-risk axes.

## Publishable minimum

The first publishable result set for `prompt-language-6e8t` requires:

1. the dedicated dataset and fixture family described above
2. one full `4 x 2 x 3` benchmark wave
3. locked result artifacts with per-axis rubric scores
4. a summary that reports both total-score outcomes and high-risk zero-rates
5. explicit classification of blocked runs and any judge-confidence caveats

## Recommended next step

Use this note as the contract for the checked-in `bounded-feature-
implementation.v1.jsonl` dataset and its paired fixture families, then capture
the first locked `vanilla` and `gated` result sets under
`experiments/results/bounded-feature-implementation/v1/`.
