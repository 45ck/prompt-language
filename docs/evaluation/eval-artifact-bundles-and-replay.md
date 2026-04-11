# Eval Artifact Bundles and Replay

## Status

Design note for bead `prompt-language-5vsm.6`.

This note defines the artifact bundle and replay contract the evaluation stack
should grow into.

At `HEAD`, the runner now ships a narrow implementation slice of `5vsm.6`:

- per-case `runId` values in saved eval reports
- manifest-backed per-run bundles persisted beside saved reports
- runner-level replay metadata and baseline lineage on saved case results
- captured candidate-input snapshots inside saved run bundles
- a persisted-report `runId` replay helper for rerunning one saved case
- stored annotation hooks that append provenance records under one run bundle

It does **not** yet ship replay-by-run-id CLI support or deterministic
checkpoint replay of live host sessions.

## Purpose

The current evaluation stack can already do three useful things:

- execute checked-in JSONL datasets
- write locked machine-readable reports under `experiments/results/`
- compare a candidate report against a locked baseline report

That is enough for the seeded E1 runner slice, but it is not yet enough for the
later workflow already assumed by the surrounding notes:

- [Regression Promotion Workflow](./regression-promotion-workflow.md)
- [Eval/Judge vNext Alignment](./eval-judge-vnext-alignment.md)
- [Self-Hosted Meta-Layer Pilot](./self-hosted-meta-layer-pilot.md)

Those notes all assume a stronger evidence layer with:

- richer per-run artifacts
- stable run lookup
- replay or rerun handles
- baseline lineage
- future human annotation attachment

This note defines that missing contract without creating a second dataset bank
or a second results authority.

## What exists now

The shipped floor is narrower than the full `5vsm.6` target.

### Already present

- checked-in datasets under `experiments/eval/datasets/`
- suite notes under `experiments/eval/`
- locked report JSON files under `experiments/results/`
- report-level fields such as `datasetPath`, `harness`, `candidate`, `summary`,
  per-case pass/fail, duration, verify output, and optional baseline comparison
- live-validation evidence conventions for smoke and blocked-host classification
- per-case `runId` values on newly written runner reports
- per-run bundle manifests and captured verify or harness text under
  `experiments/results/<suite>/<version>/runs/<run-id>/` when the runner saves a
  report
- report-case lineage fields such as `baselineRunId`, `replay`, and artifact
  paths on newly written runner reports
- bundle-level task-input snapshots, locked-baseline references, and annotation
  file hooks on newly written runner reports

The seeded E1 report shape proves that the repo already stores durable suite
reports such as:

- `schemaVersion`
- `kind`
- `generatedAt`
- `datasetPath`
- `datasetName`
- `harness`
- `candidate`
- `repeat`
- `summary`
- `cases`
- `comparison`

### Not present yet

- replay or rerun CLI commands that resolve from a stored run handle
- deterministic checkpoint replay of live host sessions
- backfilled `runId` and bundle lineage on older locked reports that predate the
  runner slice

That distinction matters. The repo should not pretend it already has full
artifact-backed replay just because the suite report JSON exists.

## Boundary

`5vsm.6` owns richer artifacts, replay handles, annotation hooks, and
baseline-lock support.

It does **not** replace these existing boundaries:

- datasets still live under `experiments/eval/datasets/`
- locked suite outputs still live under `experiments/results/`
- deterministic pass/fail still comes from dataset `verify` and normal runner
  results, not from human annotation
- regression-promotion workflow still belongs to `5vsm.10`

This means the artifact bundle is an evidence layer under the current eval
stack, not a parallel bank and not a new top-level syntax track.

## Artifact model

The evaluation stack should distinguish three layers:

| Layer               | Role                                                                | Current status |
| ------------------- | ------------------------------------------------------------------- | -------------- |
| Dataset row         | Checked-in task contract and deterministic verification authority   | shipped        |
| Locked suite report | Durable aggregate output for one dataset/candidate run              | shipped        |
| Artifact bundle     | Per-case evidence package keyed by run ID and referenced by reports | planned        |

The locked suite report remains the human-readable and machine-readable summary.
The artifact bundle is the deeper evidence package that lets later workflows
inspect, replay, annotate, and promote individual cases without relying on
operator memory.

## Eval artifact bundle

One artifact bundle should represent **one case execution**:

- one dataset row
- one candidate
- one harness
- one repeat number
- one concrete workspace execution

It should be valid whether the case passed, failed, or was blocked by the
environment.

### Required bundle identity

Every bundle should carry:

- `runId`
- `datasetPath`
- `datasetName`
- `caseId`
- `candidate`
- `harness`
- `repeat`
- `generatedAt`
- `commit`
- `host`
- `model` when the harness exposes it
- `status`: `passed`, `failed`, or `blocked`
- `regressionClassification`: `product_regression`, `environment_blocker`, or
  `not_applicable`

### Required bundle evidence

Every bundle should include or reference:

- the dataset row identity
- the exact task input path or embedded prompt reference
- the deterministic `verify` command
- verify exit code
- verify stdout path or inline text
- verify stderr path or inline text
- execution summary
- changed-file summary or diff path
- transcript path or equivalent harness log path when available

### Optional bundle evidence

A bundle may additionally include:

- gate summary
- judge-result envelope
- approval or review capture
- workspace metadata
- blocked-host details
- runner warnings
- candidate-specific state artifacts

The bundle should tolerate missing optional files. For example, a blocked run
may have no diff, and some harnesses may not expose a transcript. The manifest
should say what is absent rather than forcing every run into the same file list.

## Bundle manifest shape

The runner now ships a manifest-backed bundle for saved reports, and the checked
in contract should stay close to the following shape:

```json
{
  "schemaVersion": 1,
  "kind": "prompt-language-eval-artifact-bundle",
  "runId": "eval.e1.narrow-scope.v1.codex.gated.r1.2026-04-10T08-36-09Z",
  "generatedAt": "2026-04-10T08:36:09.044Z",
  "dataset": {
    "path": "experiments/eval/datasets/e1-repeated-failures.jsonl",
    "name": "e1-repeated-failures.jsonl",
    "caseId": "e1.narrow-scope.v1",
    "inputFile": "task.txt",
    "verify": "node test.js"
  },
  "execution": {
    "candidate": "gated",
    "harness": "codex",
    "model": "gpt-5.2",
    "repeat": 1,
    "commit": "abc1234",
    "host": {
      "os": "windows",
      "shell": "powershell",
      "support": "blocked"
    },
    "status": "passed",
    "regressionClassification": "not_applicable",
    "durationMs": 87732
  },
  "artifacts": {
    "candidateInputPath": "runs/<run-id>/candidate-input.txt",
    "transcriptPath": "runs/<run-id>/transcript.md",
    "diffPath": "runs/<run-id>/diff.patch",
    "verifyStdoutPath": "runs/<run-id>/verify.stdout.txt",
    "verifyStderrPath": "runs/<run-id>/verify.stderr.txt",
    "judgeResultPath": null,
    "annotationPath": null
  },
  "summary": {
    "passed": true,
    "verifyExitCode": 0,
    "changedFiles": ["app.js"]
  },
  "baseline": {
    "reportPath": "experiments/results/e1/v1/codex-vanilla.json",
    "reportCandidate": "vanilla",
    "runId": "baseline.case-a.r1"
  },
  "replay": {
    "mode": "rerun_from_dataset",
    "runId": "eval.e1.narrow-scope.v1.codex.gated.r1.2026-04-10T08-36-09Z"
  }
}
```

The important point is not the exact file naming. The important point is that
the bundle manifest becomes the stable index for all deeper evidence related to
one case execution.

## Replay-by-run-id

`Replay` in this note means **a rerun reconstructed from captured evidence**,
not a claim of deterministic event-sourced execution replay across every
harness.

That narrower definition is the honest one for the repo's current state.

### Minimum replay contract

A `runId` should resolve enough information to:

1. find the originating dataset row
2. identify the candidate, harness, repeat, and relevant model
3. recover the original verify command and task input
4. inspect the original evidence files
5. re-run the same case in a fresh workspace with the same declared inputs

That gives the repo a credible "replay by run ID" story even before it has
full execution-state checkpoint replay.

### What run-ID replay should not claim yet

It should not claim:

- exact deterministic re-execution of model outputs
- byte-for-byte reproduction of every transcript
- restoration of hidden host session state
- exact recovery of unsupported-host or auth-blocked runs

For now, replay by run ID should mean "look up the captured case execution and
rerun it from the stored dataset and manifest context."

### Replay object shape

Every bundle should carry a replay block with these fields:

- `mode`
- `runId`
- `datasetPath`
- `caseId`
- `candidate`
- `harness`
- `repeat`
- `model` when known
- `commit` or worktree identity
- `limitations`

Recommended `mode` values:

- `rerun_from_dataset`
- `rerun_with_fixture_snapshot`
- `evidence_only`

`evidence_only` is important for blocked runs or older captures where the repo
has enough evidence to inspect the case later but not enough to promise a
meaningful rerun.

## Baseline-lock boundary

The artifact bundle must support baseline locking, but it must not become the
baseline authority itself.

### Source of truth

The baseline source of truth remains:

- checked-in dataset rows under `experiments/eval/datasets/`
- locked suite reports under `experiments/results/`

### Role of the bundle

The bundle adds lineage underneath those locked reports:

- a report case entry should be able to reference the originating `runId`
- a later baseline comparison should be able to say which concrete case runs
  produced the locked result
- a promoted regression row should be able to point back to the originating run
  bundle

### What baseline lock should mean

A locked baseline should answer:

- which dataset version was run
- which candidate and harness produced it
- which per-case runs fed the report
- which report is the durable baseline artifact

That means baseline lock is a **report-level** concept with per-case lineage,
not a pile of ungoverned local bundle files.

### What this note does not authorize

This note does not authorize:

- storing canonical baselines outside `experiments/results/`
- treating ad hoc local artifacts as locked truth
- bypassing checked-in dataset rows with free-form replay-only cases
- silently mutating a locked baseline because a rerun produced a different
  outcome

Any bundle-to-baseline linkage should strengthen the current bank, not weaken
it.

## Human annotation hooks

Human annotation is a future attachment point, not the current scoring
authority.

The repo already treats deterministic `verify` as the pass/fail authority.
Annotation should therefore begin as an additive review layer for:

- disagreement resolution
- calibration
- promotion review
- "interesting pass" explanation
- blocked-run triage

### Annotation attachment boundary

Annotations should attach to a `runId` or to a locked report case reference,
not float as free-form notes with no provenance.

Recommended attachment targets:

- one run bundle
- one case inside a locked report
- one compare result that references two or more runs

### Recommended annotation fields

- `annotationId`
- `runId`
- `author`
- `createdAt`
- `kind`
- `verdict`
- `score` when the annotation is numeric
- `notes`
- `rubricRef` when tied to a named rubric or evaluation rule

Recommended `kind` values:

- `triage`
- `promotion_review`
- `judge_calibration`
- `interesting_pass`
- `blocked_run_review`

### Important boundary

Human annotation hooks should not silently override deterministic case pass/fail
from `verify`.

They may explain, calibrate, or approve. They should not become an untracked
second completion system.

## Storage direction

This note intentionally leaves exact final file layout flexible, but the
storage direction should be:

- locked suite reports remain under `experiments/results/<suite>/<version>/`
- per-run bundle files live in a subordinate run-artifact area associated with
  that results tree
- reports reference `runId` values rather than embedding every transcript and
  diff inline

One acceptable future layout would be:

```text
experiments/results/
  e1-repeated-failure/
    v1/
      codex-vanilla.json
      codex-gated.json
      runs/
        <run-id>/
          manifest.json
          transcript.md
          diff.patch
          verify.stdout.txt
          verify.stderr.txt
          annotation.jsonl
```

That keeps the current report authority intact while making deeper evidence
discoverable and reviewable.

## Acceptance bar for `5vsm.6`

This note is satisfied in implementation terms only when the repo can do all of
the following:

- emit a stable `runId` per case execution
- persist a manifest-backed artifact bundle for that run
- resolve a run ID back to dataset row, candidate, harness, and evidence paths
- record whether replay is `rerun_from_dataset`, `rerun_with_fixture_snapshot`,
  or `evidence_only`
- preserve locked baseline authority under `experiments/results/`
- attach human annotations with provenance instead of loose notes

At `HEAD`, the runner/helper layer now covers this acceptance bar. Replay CLI
surfaces and deterministic checkpoint replay remain follow-on work beyond this
implementation slice.

## Out of scope

This note does not define:

- a final CLI syntax for replay lookup
- exact storage drivers or database choices
- deterministic checkpoint replay of live host sessions
- auto-promotion of failed runs into the dataset bank
- judge calibration policy details

Those remain with the surrounding runner, regression-promotion, and broader
eval work.
