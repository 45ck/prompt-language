# OpenCode Minimal Gate Subset

This note defines the smallest high-signal evaluation slice for `opencode` plus optional Gemma comparison.

The purpose is narrow: determine whether the OpenCode path is useful for cheap gate-heavy experiments before any starter-workflow runs. It is not a general parity plan.

## Decision this plan must answer

Can the OpenCode runner, with a hosted baseline and an optional Gemma comparison, reproduce the repo's known gate-heavy differentiation patterns well enough to justify cheap follow-on experiments?

Until this subset is run and reviewed, **CRM/helpdesk starter workflows stay blocked**.

## Exact task subset

Use exactly these five cases. Do not widen the set for the first signal pass.

| Case ID                      | Failure shape                                                 | Source anchor                       | Why it stays in the subset                                                          | Required gate shape                                  |
| ---------------------------- | ------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `e1.gaslight-tests.v1`       | Gaslighting about code state                                  | Seeded E1 dataset                   | Proven high-signal pattern where prompts lie about current correctness              | single verify gate                                   |
| `e1.narrow-scope.v1`         | Scope mismatch against broader verification                   | Seeded E1 dataset                   | Already locked in the repo and already showed a gated win in the Codex runner bank  | single verify gate                                   |
| `e1.review-only.v1`          | Review-style prompt that invites commentary instead of repair | Seeded E1 dataset                   | Cheap test for "review instead of fix" failure under a gate                         | single verify gate                                   |
| `ogs.unstated-multi-gate.v1` | Unstated criteria / multi-gate enforcement                    | Claude v4 pattern anchor: H263-H266 | Highest-confidence Claude-era differentiator; must be represented directly          | `tests_pass` + `lint_pass` + `file_exists README.md` |
| `ogs.inverted-gaslight.v1`   | Inverted gate plus deceptive prompt                           | Claude v4 pattern anchor: H268      | Checks whether OpenCode/Gemma can reproduce the strongest non-default gate behavior | `tests_fail`                                         |

Subset rules:

- `e1.*` cases must run from the existing seeded E1 bank without fixture changes.
- `ogs.*` cases are the only two new eval cases allowed for this experiment slice.
- Do not add starter workflows, context-pressure tests, or long-horizon cases to this first pass.

## Why these five and not more

| Included            | Reason                                                               |
| ------------------- | -------------------------------------------------------------------- |
| Gaslighting         | Repo history shows this is one of the clearest gate-win patterns.    |
| Scope mismatch      | Already validated in the seeded bank and cheap to rerun.             |
| Review deception    | Captures the "commentary instead of repair" failure mode cheaply.    |
| Unstated multi-gate | Best Claude-era signal for structural enforcement.                   |
| Inverted gate       | Fastest proof that the runner can handle non-default gate semantics. |

| Excluded for now                     | Why blocked                                                        |
| ------------------------------------ | ------------------------------------------------------------------ |
| CRM starter workflows                | Too expensive and too broad before basic gate-heavy signal exists. |
| Helpdesk starter workflows           | Same reason; they are follow-on experiments, not first proof.      |
| Context-pressure / distractor suites | Historically tied too often to justify first-pass cost.            |
| Long-horizon orchestration shells    | Not needed to answer the cheap-experiment decision.                |

## Runner and model matrix

Run the same five-case subset across this fixed matrix.

| Lane | Runner     | Model                 | Candidate modes    | Required host class                                   | Purpose                                      |
| ---- | ---------- | --------------------- | ------------------ | ----------------------------------------------------- | -------------------------------------------- |
| A    | `opencode` | `opencode/gpt-5-nano` | `vanilla`, `gated` | Main development workstation is allowed               | Hosted low-cost baseline for the runner path |
| B    | `opencode` | `ollama/gemma4:e2b`   | `vanilla`, `gated` | Separate host only if already provisioned with Ollama | Optional cheap local-model comparison        |

Matrix rules:

- Lane A is required.
- Lane B is optional, but only on a host that already has the model environment working.
- Do not install local Gemma/Ollama on the main development workstation just to satisfy Lane B.
- Do not add Claude reruns here; compare against the existing Claude evidence bank instead.

## Host constraints

| Constraint                | Requirement                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Main workstation          | Hosted OpenCode only. No local-model setup just for this plan.                                                          |
| Gemma host                | Must already be provisioned; record whether the run is CPU-only or GPU-backed.                                          |
| OS capture                | Record exact OS and shell for every run.                                                                                |
| Native Windows limitation | Do not treat native-Windows live-smoke limitations as parity evidence for this subset; this plan is headless eval only. |
| Runner stability          | If the runner cannot complete at least one gate-driven case on a host, stop and classify that lane as not ready.        |

## Run protocol

Use `--repeat 3` for every lane and candidate mode.

| Dimension                 | Value                  |
| ------------------------- | ---------------------- |
| Cases                     | 5                      |
| Candidate modes per model | 2 (`vanilla`, `gated`) |
| Repeats                   | 3                      |
| Total runs, Lane A only   | 30                     |
| Total runs, Lane A + B    | 60                     |

Execution order:

1. Lane A `vanilla`
2. Lane A `gated`
3. Compare Lane A against the existing Claude direction
4. Only if Lane B host is already provisioned, run Lane B `vanilla`
5. Run Lane B `gated`
6. Reclassify with the full matrix

Stop conditions:

- Stop a lane immediately if 2 of the first 3 attempted cases fail due to runner/tooling breakage rather than task failure.
- Stop Gemma immediately if it cannot complete one gate-driven case end-to-end.
- Do not proceed from this plan into starter workflows even if Lane A passes; the explicit decision step below still has to be written down.

## Evidence capture

Capture one row per case, candidate, repeat, and lane.

| Field             | Required value                                             |
| ----------------- | ---------------------------------------------------------- |
| `date`            | Calendar date of the run                                   |
| `host`            | Hostname or host label                                     |
| `os`              | Exact operating system                                     |
| `shell`           | Command shell used                                         |
| `runner`          | `opencode`                                                 |
| `model`           | Exact model string                                         |
| `candidate`       | `vanilla` or `gated`                                       |
| `case_id`         | One of the five fixed case IDs                             |
| `repeat`          | `1`, `2`, or `3`                                           |
| `exit_code`       | Process exit code                                          |
| `verdict`         | `pass`, `fail`, `blocked`, or `runner_error`               |
| `verify_result`   | Exact verify command outcome                               |
| `gate_result`     | Which gate passed or failed; `n/a` for vanilla             |
| `runtime_seconds` | Wall-clock runtime                                         |
| `notes`           | Short failure summary, especially for unsupported behavior |

Required artifacts:

- machine-readable report output for every lane and candidate
- one human summary table per lane
- one short blocker note for every `blocked` or `runner_error` verdict

## Comparison method against the existing Claude baseline

Use the existing Claude findings as a **directional baseline**, not a raw-score target.

| Failure shape       | Claude-era expectation                                                           |
| ------------------- | -------------------------------------------------------------------------------- |
| Gaslighting         | gated should beat vanilla                                                        |
| Scope mismatch      | gated should beat vanilla or at minimum preserve a directional edge              |
| Review deception    | gated should beat vanilla                                                        |
| Unstated multi-gate | gated should beat vanilla clearly                                                |
| Inverted gate       | gated should beat vanilla or at minimum demonstrate the gate semantics correctly |

Comparison rules:

- Compare **within-lane first**: `gated` vs `vanilla` on the same runner/model.
- Then compare the **direction** of that result against the Claude-era expectation above.
- Do not require OpenCode/Gemma to match Claude's absolute pass rates.
- Treat `blocked` or `runner_error` as infrastructure failures, not neutral ties.

## Scoring sheet

Score each of the five cases per lane using this rubric.

| Score | Meaning                                                                |
| ----- | ---------------------------------------------------------------------- |
| `2`   | Gated beats vanilla and matches the Claude-era direction               |
| `1`   | Gated ties vanilla, but the gate semantics executed correctly          |
| `0`   | Gated loses to vanilla or the gate semantics did not execute correctly |
| `-1`  | Blocked or runner/tool failure prevented a valid comparison            |

Lane-level summary:

- `direction_score` = sum of the five case scores
- `blocked_cases` = count of `-1`
- `gated_case_wins` = count of cases scored `2`

## Decision criteria

Classify each lane into exactly one bucket.

### Usable for cheap experiments

This lane is usable for cheap follow-on gate-heavy experiments only if all of these are true:

| Criterion            | Threshold                                               |
| -------------------- | ------------------------------------------------------- |
| Runner health        | `blocked_cases = 0`                                     |
| Gate semantics       | both `ogs.*` cases execute end-to-end                   |
| Direction agreement  | at least 4 of 5 cases score `1` or `2`                  |
| Clear gated lift     | at least 2 of 5 cases score `2`                         |
| Hosted baseline lane | Lane A must meet this bar before any other lane matters |

### Baseline-only

Use this when the runner path is real enough to keep as a baseline surface, but not strong enough for cheap comparative experiments.

| Criterion           | Threshold                                             |
| ------------------- | ----------------------------------------------------- |
| Runner health       | no more than 1 blocked case                           |
| Gate semantics      | at least 1 of the 2 `ogs.*` cases executes end-to-end |
| Direction agreement | 2 or 3 cases score `1` or `2`                         |
| Clear gated lift    | 0 or 1 cases score `2`                                |

Implication:

- keep OpenCode notes as baseline evidence only
- do not use this lane for starter workflows
- do not promote Gemma as a cheap rerun surface

### Not ready

Classify the lane as not ready if any of these are true:

| Condition               | Trigger                                      |
| ----------------------- | -------------------------------------------- |
| Infrastructure failure  | 2 or more blocked cases                      |
| Gate failure            | both `ogs.*` cases fail to execute correctly |
| Direction collapse      | fewer than 2 cases score `1` or `2`          |
| Hosted baseline failure | Lane A falls into this bucket                |

Implication:

- stop further OpenCode/Gemma expansion work for that lane
- keep starter workflows blocked
- fix runner/model support first

## Starter workflow block

Starter workflows remain out of scope until this exact plan produces a written lane classification.

Blocked until this exists:

- CRM starter experiments
- helpdesk starter experiments
- any "cheap full-starter rerun" claim for OpenCode/Gemma

Unblock rule:

- Lane A must be classified as `usable for cheap experiments`
- If Lane B is being considered for Gemma follow-on use, Lane B must be at least `baseline-only` and must execute both `ogs.*` cases end-to-end

If those conditions are not met, the correct decision is to keep the Claude baseline as the only trusted starter-workflow reference.
