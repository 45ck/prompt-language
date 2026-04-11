# Premature-Stop Benchmark

<!-- cspell:ignore orfw -->

## Status

Experiment-spec note for bead `prompt-language-orfw`.

This note defines the first executable benchmark for the six-experiment backlog
created on 2026-04-07. It is intentionally narrower than the older thesis
labels in [Prompt Language Thesis](../../strategy/thesis.md): this backlog
"Experiment 1" is the premature-stop A/B benchmark, not the older
"repeated failure elimination" experiment.

## Purpose

Measure whether prompt-language's bounded completion loop plus deterministic
gates reduces premature stopping on small repo-local engineering tasks when
compared with a plain Claude Code prompt over the same fixture snapshots.

The point is not to prove every thesis claim at once. The point is to answer
one concrete question:

> When the task is small enough to be bounded and verified, does
> `prompt-language` stop less often before the work is actually green?

## Anchors

- [Benchmark Suite and Canonical Stack](../benchmark-suite-and-canonical-stack.md)
- [Evaluation Dataset Bank](../dataset-bank.md)
- [Eval Artifact Bundles and Replay](../eval-artifact-bundles-and-replay.md)
- [Evaluation Stack Test Matrix](../eval-test-matrix.md)
- [Prompt Language Thesis](../../strategy/thesis.md)

## Hypothesis

Across the same fixed task bank, the `gated` prompt-language candidate should:

- produce a higher task success rate than `vanilla`
- produce a lower premature-stop rate than `vanilla`
- require fewer human cleanup minutes after the candidate declares completion
- take slightly longer and cost slightly more than `vanilla`

The expected mechanism is simple:

- `vanilla` can stop after one plausible-looking patch or one misleading self-
  report
- `gated` must keep going until the dataset-defined validation commands are
  green or the run is explicitly classified as failed or blocked

## Candidate arms

The benchmark uses the existing runner semantics rather than inventing a second
harness.

| Arm | Runner candidate | Definition                                                                                                                                                      |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | `vanilla`        | Run the task prompt exactly as written in the dataset row.                                                                                                      |
| B   | `gated`          | Use the existing runner's generated one-step flow wrapper plus the dataset row's `gates`, so completion is enforced through prompt-language `done when` checks. |

Shared controls for both arms:

- same harness, initially `codex`
- same model family and model version for both arms in one benchmark wave
- same starting fixture snapshot
- same validation commands
- same time budget
- same operator instructions and intervention policy

## Benchmark corpus

The benchmark should use a single checked-in dataset:

- dataset path:
  `experiments/eval/datasets/premature-stop-benchmark.v1.jsonl`
- suite note:
  `experiments/eval/premature-stop-benchmark/README.md`
- locked results directory:
  `experiments/results/premature-stop-benchmark/v1/`

The first version should contain **12 tasks**. That keeps the benchmark wide
enough to avoid one-fixture anecdotes while still being cheap enough for a full
`3 x 2 x 12` sweep.

### Task selection rules

Every task must:

- start from a repo-local fixture snapshot
- fit within a 20-minute wall-clock budget
- have deterministic validation commands
- be small enough that a premature stop is plausible
- require at least one meaningful code edit
- avoid tasks whose only possible "fix" is weakening tests or config

### v1 task bank

These tasks are the concrete first corpus. They are derived from the canonical
20-task benchmark in `zaq6`, but narrowed to the small-task subset most likely
to expose early stopping.

| ID   | Canonical source | Task                                                                         | Primary validation commands                             |
| ---- | ---------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------- |
| PS1  | `A1`             | Fix a broken `/health` route so smoke returns `200`.                         | `npm run test`, `npm run smoke:http`                    |
| PS2  | `A2`             | Add the missing project list route with seeded rendering.                    | `npm run test`, `npm run smoke:http`                    |
| PS3  | `A3`             | Repair a broken environment config read without weakening defaults.          | `npm run test`, `npm run build`                         |
| PS4  | `B2`             | Reject blank task titles cleanly at both route and test level.               | `npm run test`                                          |
| PS5  | `B3`             | Implement task-status filtering on list views and API output.                | `npm run test`, `npm run smoke:http`                    |
| PS6  | `C1`             | Repair login so valid credentials create a persistent session.               | `npm run test`, `npm run smoke:http`                    |
| PS7  | `C2`             | Fix logout so the session is invalidated server-side.                        | `npm run test`                                          |
| PS8  | `C4`             | Rotate session identifiers on login to close fixation.                       | `npm run test`                                          |
| PS9  | `D1`             | Repair a failing Vitest suite caused by stale mock expectations.             | `npm run test`                                          |
| PS10 | `D3`             | Add a failing-first regression test and fix archived-project task leakage.   | `npm run test`                                          |
| PS11 | `E1`             | Repair the Dockerfile so the container starts and passes health smoke.       | `npm run build`, `npm run smoke:http`, `docker build .` |
| PS12 | `E2`             | Fix Fly health-path and port wiring without changing the fixed deploy model. | `npm run test`, task-specific config check              |

Each task should map to one fixture directory under:

`experiments/eval/fixtures/premature-stop/<task-id>/`

Each fixture should contain:

- one locked starting snapshot
- one task prompt
- one `verify` script or fixed validation command list
- one short note describing the intended failure mode

## Dataset row contract

Each row in `premature-stop-benchmark.v1.jsonl` should include at least:

- `id`
- `category`
- `fixture`
- `objective`
- `task`
- `validation_commands`
- `gates`
- `time_budget_minutes`
- `expected_artifacts`
- `starting_state`

The row should be rich enough that `bin/cli.mjs eval` can execute both arms
without hand-written per-task orchestration.

`gates` should mirror the row's deterministic validation commands. For example,
if the task requires `npm run test` and `npm run smoke:http`, the gated arm
should not be allowed to stop after one of them passes.

## Run protocol

### Minimum wave

The minimum publishable wave is:

- 12 tasks
- 2 arms (`vanilla`, `gated`)
- 3 independent repetitions per arm

That yields **72 total runs** before reruns for blocked environments.

### Isolation rules

Every run should use:

- a fresh worktree or fresh fixture copy
- the same locked fixture commit for both arms
- the same harness and model within one wave
- the same workstation class when runs are compared directly

### Ordering rules

To reduce order effects:

- randomize task order within each repetition
- alternate arm order within each task (`AB` on one repetition, `BA` on the
  next)
- do not run all `vanilla` tasks first and all `gated` tasks second

### Rerun rules

If a run is blocked by host or environment issues:

1. rerun it once from a fresh worktree
2. if it blocks again for the same external reason, classify it as `blocked`
3. exclude it from success-rate denominators, but keep it in the evidence pack

### Time budget

Each task gets:

- 20 minutes wall-clock maximum
- one operator start action
- no mid-run steering unless the intervention policy says to annotate a
  premature stop

The benchmark is specifically meant to measure whether the system finishes the
bounded task on its own, not whether a human can keep rescuing it interactively.

## Outcome model

Every run should end in exactly one outcome bucket:

| Outcome            | Meaning                                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `success`          | All required validation commands are green within budget and no post-stop code edits were needed.                                                           |
| `assisted_success` | The task reaches green only after bounded human cleanup of 10 minutes or less.                                                                              |
| `premature_stop`   | The candidate stopped, claimed completion, or went idle while required validation was still red and the task remained solvable within the benchmark budget. |
| `failure`          | The run exhausted its budget or remained red for reasons not classified as blocked or premature stop.                                                       |
| `blocked`          | External host or environment limitations prevented a fair run.                                                                                              |

`success_rate` for the headline table should use:

`(success + assisted_success) / (success + assisted_success + premature_stop + failure)`

`premature_stop_rate` should use:

`premature_stop / (success + assisted_success + premature_stop + failure)`

Blocked runs stay visible but outside those denominators.

## Premature-stop definition

This benchmark needs a strict definition or the headline metric will drift.

A run counts as `premature_stop` when all of the following are true:

1. the candidate terminated or claimed completion
2. at least one required validation command was still red or not yet run
3. the run was not blocked by an external environment issue
4. the task was still recoverable within the remaining benchmark budget with no
   major scope change

Common examples:

- "done" reported while tests still fail
- a patch landed but smoke was never run
- the first failing gate result caused the session to stop instead of repairing
- the candidate drifted into explanation mode and never returned to execution

This definition intentionally separates "hard task failure" from "stopped too
early." The benchmark is about that exact distinction.

## Metrics

### Primary metrics

- task success rate
- premature-stop rate
- median time to green
- median human cleanup minutes

### Secondary metrics

- total tokens or provider-reported cost
- recovery loop count
- number of validation cycles before green
- run-to-run variance by task
- blocked-run rate

### Normalized recovery-loop metric

The bead asks for "number of loops." The comparable field should be:

- `recovery_loops`

For `gated`, that is the number of prompt-language repair cycles visible in the
run bundle or transcript before the final outcome.

For `vanilla`, that is the number of additional explicit human re-prompts needed
after the first non-green validation result.

The point is not to claim the arms have identical mechanics. The point is to
measure how many recovery cycles each arm needed before it actually reached a
trustworthy stop.

## Evidence capture

This benchmark should use the existing `5vsm.6` artifact-bundle structure
rather than ad hoc notes.

For each run, the evidence pack should include:

- locked report row in
  `experiments/results/premature-stop-benchmark/v1/<candidate>.json`
- per-run bundle manifest under
  `experiments/results/premature-stop-benchmark/v1/runs/<run-id>/`
- validation stdout and stderr artifacts
- transcript or harness log when available
- changed-file summary or diff
- one human annotation record for cleanup and premature-stop classification

### Required human annotation fields

The annotation record should capture:

- `finalOutcome`
- `prematureStop`
- `prematureStopReason`
- `cleanupMinutes`
- `operatorInterventions`
- `recoveryLoops`
- `notes`

That keeps the subjective parts narrow and auditable instead of spreading them
through free-form prose.

## Publishable scorecard

The first result table should report one row per arm:

| Arm | Non-blocked runs | Success rate | Premature-stop rate | Median time to green | Median cleanup minutes | Median recovery loops | Median cost |
| --- | ---------------- | ------------ | ------------------- | -------------------- | ---------------------- | --------------------- | ----------- |

It should also report one row per task so the benchmark does not hide all
variance in one pooled number.

## Success threshold

`prompt-language` clears the benchmark directionally if the first full wave
shows all of the following:

- `gated` beats `vanilla` on task success rate by at least 10 percentage points
- `gated` beats `vanilla` on premature-stop rate by at least 15 percentage
  points
- `gated` does not increase median cleanup minutes
- the extra latency and cost remain bounded enough that the gain is operationally
  credible

The benchmark is still informative if the thresholds are not met. A null or
negative result should be kept, not rewritten.

## Threats to validity

### Model drift

Hosted models can change between runs. One wave should keep the same model
identifier and should record it in every run bundle.

### Operator learning and fatigue

If the same human is classifying every run, later runs may benefit from earlier
diagnosis. Alternating arm order and keeping the annotation schema narrow
reduces, but does not remove, that bias.

### Task imbalance

Some tasks may mostly measure auth correctness while others mostly measure
Docker familiarity. The per-task scorecard is required so one easy category does
not dominate the headline result.

### Harness limitations

If the harness cannot expose tokens, cost, or transcripts for some runs, those
fields should remain null. The benchmark should not invent synthetic values.

### Fixture leakage

If the same broken fixture snapshot is reused too often, the model may memorize
it. The suite therefore needs versioned fixture directories and periodic refresh
of task phrasings without changing validation targets.

## Remaining gap to full execution

This note defines the experiment contract only. Full acceptance for
`prompt-language-orfw` still requires:

- the checked-in JSONL dataset
- the fixture snapshots for `PS1` through `PS12`
- the locked `vanilla` and `gated` result reports
- the first published scorecard and interpretation note

Until those exist, `orfw` should remain open even though the benchmark design is
now concrete.
