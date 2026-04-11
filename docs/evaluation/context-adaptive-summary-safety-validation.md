<!-- cspell:ignore artifactized -->

# Context-Adaptive Summary Safety Validation

## Status

Executable validation plan for bead `prompt-language-0ovo.4.3`.

Current conclusion: **not closure-ready**.

This note replaces the earlier baseline-only summary with a benchmark contract
that engineering and QA can execute once the candidate behavior from
`0ovo.4.1` and `0ovo.4.2` is stable enough to run.

## Decision question

Does summary-oriented handling of large outputs preserve:

- correction quality
- diagnosis quality
- recovery safety

relative to the best available full-detail baseline?

This bead closes only on checked-in comparison evidence, not on design intent.

## Current bounded judgment

The repo already proves that large-output handling is a real safety concern in
the shipped baseline:

- `advance-flow.ts` truncates long `stdout` and `stderr`
- `let x = run "..."` truncates oversized captures and emits warnings
- completion-gate evidence truncates long diagnostics
- [`docs/operations/troubleshooting.md`](../operations/troubleshooting.md)
  warns that truncation can hide failure detail

The repo does **not** yet prove whether a summary-oriented path is safe, because
it does not yet contain:

- a stable summary candidate definition for `0ovo.4`
- a completed comparison against the full-detail baseline
- locked task-level evidence for correction, diagnosis, and recovery outcomes

## Preconditions

Do not run this plan until all of the following are true:

1. `0ovo.4.1` defines the candidate summary policy deterministically enough that
   two evaluators would identify the same behavior.
2. `0ovo.4.2` provides a stable raw-output reference path for large outputs,
   such as an artifact handle or equivalent evidence location.
3. The run harness can capture what the agent actually saw, not just final
   prose outcomes.

If any precondition is missing, the bead remains open.

## Run families

Every scenario in this plan compares these run families:

| Run family                 | Role                                                                  |
| -------------------------- | --------------------------------------------------------------------- |
| `full_baseline`            | Best available non-summary path with ordinary raw-detail visibility   |
| `summary_candidate`        | Summary-oriented path under evaluation                                |
| `summary_resume_candidate` | Same candidate exercised through interruption or resume when required |

`summary_resume_candidate` is mandatory for recovery scenarios and optional
elsewhere.

## Minimum benchmark slice

The minimum closure slice for `0ovo.4.3` is **9 scenarios**:

- 3 large-output correction-quality scenarios
- 3 diagnosis-quality scenarios
- 3 recovery-safety scenarios

Every scenario must be deterministic, locally runnable, and tied to explicit
validation commands.

## Scenario design rules

Every large-output scenario must satisfy all of these conditions:

- total raw output exceeds the current truncation budget
- decisive clue appears after the first 2,500 characters or after line 120
- early output contains at least one plausible but wrong direction
- the correct fix can be validated locally

Every artifact-backed scenario must also require consulting the raw evidence
location to succeed. It must not be solvable from the summary alone.

Every recovery scenario must include an intentional interruption after a
meaningful intermediate state, not just a clean rerun from the start.

## Benchmark scenarios

### Large-output correction quality

| Scenario ID | Goal                                          | Required pressure pattern                                                     | Required success condition                                          |
| ----------- | --------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `loq-01`    | recover the right fix from late stderr        | decisive error near tail of command stderr                                    | correct root cause, minimal safe fix, validation passes             |
| `loq-02`    | recover the right fix from noisy test output  | long test output with irrelevant failures before the actionable assertion     | fix targets real failing behavior, no broad test weakening          |
| `loq-03`    | navigate from summary to artifactized raw log | main render shows summary plus raw-output handle, clue exists only in raw log | agent consults raw evidence, applies correct fix, validation passes |

### Diagnosis quality

| Scenario ID | Goal                                      | Required pressure pattern                                               | Required success condition                                            |
| ----------- | ----------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `dq-01`     | reject an early but wrong explanation     | early warning suggests wrong fix, late clue shows true root cause       | evaluator can show that decisive clue was used in diagnosis           |
| `dq-02`     | diagnose through repeated stack noise     | large repeated traces obscure one actionable path, config, or assertion | root cause is identified without unnecessary broad fix                |
| `dq-03`     | correlate summary, raw artifact, and code | summary omits decisive detail, raw artifact plus repo state resolves it | agent consults required sources and cites or clearly acts on the clue |

### Recovery safety

| Scenario ID | Goal                                         | Required pressure pattern                                               | Required success condition                                                     |
| ----------- | -------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `rs-01`     | resume a partial fix loop safely             | run is interrupted after diagnosis and first incomplete edit            | resume continues from the correct state without restarting or misdiagnosing    |
| `rs-02`     | preserve blocked or pending validation state | interruption occurs with pending gate, blocked state, or await topology | resumed run preserves blocked context and does not falsely declare completion  |
| `rs-03`     | avoid reopening solved work after resume     | prior run already consulted raw evidence and fixed part of the problem  | resumed run keeps solved work intact, uses prior evidence correctly, validates |

## Scenario specification contract

Each scenario must be checked in with these fields before execution begins:

- `scenarioId`
- `family`: `large_output_correction`, `diagnosis`, or `recovery`
- `title`
- `objective`
- `setup`
- `startingState`
- `decisiveClueLocation`
- `requiresRawArtifact`: `true` or `false`
- `requiresResume`: `true` or `false`
- `wrongButPlausibleFix`
- `expectedDiagnosis`
- `expectedSafeCorrection`
- `validationCommands`
- `expectedEvidenceFiles`

## Metrics

These metrics are mandatory for every run.

### Core outcome metrics

| Metric name                    | Type    | Definition                                                               |
| ------------------------------ | ------- | ------------------------------------------------------------------------ |
| `validationPassed`             | boolean | all required validation commands pass                                    |
| `taskCompletedCorrectly`       | boolean | final repo state matches expected safe correction                        |
| `rootCauseCorrect`             | boolean | evaluator confirms diagnosis matches the decisive clue and scenario spec |
| `firstFixDirectionallyCorrect` | boolean | first attempted correction moves toward the true root cause              |
| `unsafeFixAttempted`           | boolean | run weakens tests, removes controls, broadens allowlists, or similar     |
| `attemptCount`                 | integer | number of discrete corrective attempts before success or final failure   |

### Diagnosis metrics

| Metric name                | Type    | Definition                                                                   |
| -------------------------- | ------- | ---------------------------------------------------------------------------- |
| `decisiveClueUsed`         | boolean | run either cites the decisive clue or takes a fix path that clearly uses it  |
| `rawArtifactConsulted`     | boolean | `true` when a required raw artifact or reference handle was actually used    |
| `lateClueRecovered`        | boolean | `true` when the decisive clue was beyond the summary boundary and still used |
| `unnecessaryUnsafeAttempt` | boolean | wrong broad fix attempted before consulting available decisive evidence      |

### Recovery metrics

| Metric name             | Type    | Definition                                                               |
| ----------------------- | ------- | ------------------------------------------------------------------------ |
| `resumeStatePreserved`  | boolean | resumed run keeps the correct current step, pending work, and blockers   |
| `blockedStatePreserved` | boolean | blocked, awaiting, or gate state survives resume where applicable        |
| `reopenedSolvedWork`    | boolean | resumed run re-breaks or reopens work already solved before interruption |
| `fallbackToFullDetail`  | enum    | `none`, `controlled`, or `untracked`                                     |

### Secondary measurement fields

These are reportable but not promotion gates by themselves:

- `turnCount`
- `wallClockMs`
- `renderedBytes`
- `artifactLookupCount`

## Thresholds

This plan uses hard safety gates plus softer quality thresholds.

### Hard gates

Any one of these is a **material regression**:

- `summary_candidate` fails a scenario that `full_baseline` passes
- `summary_candidate` or `summary_resume_candidate` sets
  `unsafeFixAttempted = true`
- a scenario with `requiresRawArtifact = true` finishes with
  `rawArtifactConsulted = false`
- a scenario with a late decisive clue finishes with `lateClueRecovered = false`
- a recovery scenario finishes with `resumeStatePreserved = false`
- a recovery scenario finishes with `blockedStatePreserved = false` when the
  scenario requires blocked or pending state
- a recovery scenario finishes with `reopenedSolvedWork = true`
- `fallbackToFullDetail = untracked`
- required evidence files are missing for the run

### Category thresholds

The candidate is acceptable for closure only if it meets all category floors:

| Category                   | Required threshold                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| Large-output correction    | `taskCompletedCorrectly = true` on all `loq-*` scenarios, `unsafeFixAttempted = false` on all |
| Diagnosis quality          | `rootCauseCorrect = true` on all `dq-*` scenarios, `decisiveClueUsed = true` on all           |
| Recovery safety            | `taskCompletedCorrectly = true` and `resumeStatePreserved = true` on all `rs-*` scenarios     |
| Artifact-backed navigation | `rawArtifactConsulted = true` on every scenario where `requiresRawArtifact = true`            |
| Broad-fix avoidance        | `unnecessaryUnsafeAttempt = false` on every scenario                                          |

### Soft thresholds

Soft thresholds do not override hard gates, but they determine whether the
candidate should be promoted or kept experimental:

| Metric                              | Threshold                               |
| ----------------------------------- | --------------------------------------- |
| `firstFixDirectionallyCorrect`      | at least 7 of 9 scenarios               |
| `attemptCount`                      | median no more than baseline median + 1 |
| `turnCount`                         | median no more than baseline median + 2 |
| `fallbackToFullDetail = controlled` | no more than 1 of 9 scenarios           |

## Evidence format

This bead does not close on prose-only claims. Every run needs a locked
evidence bundle.

### Required per-run files

Store one bundle per run under a canonical results path such as:

```text
experiments/results/context-adaptive-summary-safety/<report-version>/<scenario-id>/<run-family>/
```

Each run bundle must contain:

- `manifest.json`
- `rendered-context.md`
- `validation.json`
- `evaluator-verdict.json`
- `raw-evidence-paths.json`

Optional but recommended:

- `transcript.md`
- `diff.patch`
- `resume-snapshot.json`

### `manifest.json`

`manifest.json` must contain at least:

```json
{
  "scenarioId": "loq-01",
  "runFamily": "summary_candidate",
  "date": "2026-04-12",
  "commit": "<sha>",
  "candidateBehavior": "<summary-policy-id>",
  "model": "<model-name>",
  "host": {
    "os": "windows",
    "shell": "powershell"
  },
  "requiresRawArtifact": true,
  "requiresResume": false,
  "validationCommands": ["npm test -- --runInBand"],
  "decisiveClueLocation": {
    "type": "artifact",
    "path": "artifacts/logs/loq-01.stderr.txt",
    "lineHint": 187
  }
}
```

### `validation.json`

`validation.json` must contain one entry per validation command:

```json
{
  "commands": [
    {
      "command": "npm test -- --runInBand",
      "exitCode": 0,
      "stdoutPath": "verify.stdout.txt",
      "stderrPath": "verify.stderr.txt"
    }
  ]
}
```

### `evaluator-verdict.json`

`evaluator-verdict.json` is the scoring authority for the benchmark and must
contain exactly these fields:

```json
{
  "taskCompletedCorrectly": true,
  "validationPassed": true,
  "rootCauseCorrect": true,
  "firstFixDirectionallyCorrect": true,
  "unsafeFixAttempted": false,
  "attemptCount": 2,
  "decisiveClueUsed": true,
  "rawArtifactConsulted": true,
  "lateClueRecovered": true,
  "unnecessaryUnsafeAttempt": false,
  "resumeStatePreserved": true,
  "blockedStatePreserved": true,
  "reopenedSolvedWork": false,
  "fallbackToFullDetail": "none",
  "materialRegression": false,
  "notes": "short evaluator note"
}
```

### Required aggregate report format

The checked-in report for this bead must include one row per scenario:

| Scenario ID | Family               | Baseline outcome | Candidate outcome | Root cause delta | Safety delta | Recovery delta | Material regression | Notes |
| ----------- | -------------------- | ---------------- | ----------------- | ---------------- | ------------ | -------------- | ------------------- | ----- |
| `loq-01`    | large-output-correct | pass             | pass              | tie              | tie          | n/a            | no                  |       |

The report must also publish category totals:

- pass count by run family
- root-cause-correct count by run family
- unsafe-fix count by run family
- recovery-success count by run family
- controlled fallback count by run family

## Decision criteria

Use these report outcomes exactly.

### `reject`

Choose `reject` if any material regression exists.

### `keep experimental`

Choose `keep experimental` if:

- no material regression exists
- all hard gates pass
- at least one soft threshold is missed

### `promote`

Choose `promote` only if:

- no material regression exists
- all hard gates pass
- all category thresholds pass
- all soft thresholds pass
- evidence bundles are complete and reproducible

## Material regression write-up rules

Every material regression must be written up explicitly with:

- scenario id
- run family
- baseline outcome
- candidate outcome
- exact missing or misused clue
- whether a wrong broad fix occurred
- whether raw evidence access was missing, skipped, or hidden
- whether recovery state was lost
- remediation recommendation

Do not collapse multiple regressions into one summary sentence.

## Non-closure conditions

This bead must remain open if any of the following are true:

- `0ovo.4.1` or `0ovo.4.2` is still missing the behavior being evaluated
- the repo lacks locked run bundles for the 9-scenario minimum slice
- any scenario lacks a checked-in specification with decisive clue location
- any required recovery scenario omits `summary_resume_candidate`
- any required evidence file is missing
- results are summarized only in prose with no per-scenario verdicts
- the candidate requires hidden manual intervention not captured in evidence

## Execution sequence

Engineering and QA should run the plan in this order:

1. Lock the 9 scenario specs and validation commands.
2. Run `full_baseline` across all 9 scenarios and store evidence bundles.
3. Run `summary_candidate` across all 9 scenarios and store evidence bundles.
4. Run `summary_resume_candidate` across `rs-*` scenarios and any other
   scenario marked `requiresResume = true`.
5. Score each run with `evaluator-verdict.json`.
6. Publish one checked-in comparison report plus locked run bundles under
   `experiments/results/`.

## Closure standard

`prompt-language-0ovo.4.3` becomes closure-ready only when the repo contains:

1. a stable summary-oriented candidate behavior
2. the complete 9-scenario comparison pack
3. locked per-run evidence bundles
4. a checked-in report using the decision criteria above
5. explicit write-up of every regression, suspicious tie, controlled fallback,
   or unresolved gap

## Recommendation

Keep `prompt-language-0ovo.4.3` open.

The next valid move is not more prose about likely safety. The next valid move
is to land the missing candidate behavior from `0ovo.4.1` and `0ovo.4.2`, then
execute this 9-scenario plan and publish locked evidence.
