# Regression Promotion Workflow

## Status

Design note for bead `prompt-language-5vsm.10`.

This note defines the workflow from a failed or interesting run to an approved,
reusable regression entry. It is a process and evidence contract, not shipped
product syntax.

Primary dependencies:

- [Eval/Judge vNext Alignment](eval-judge-vnext-alignment.md)
- [Dataset Bank](dataset-bank.md)
- [Live Validation Evidence](eval-live-validation-evidence.md)
- [Fresh vs Threaded Eval Suite](fresh-vs-threaded-eval-suite.md)
- [WIP Evals and Judges](../wip/tooling/evals-and-judges.md)

## Why this note exists

The evaluation stack already has two important pieces:

- `5vsm.5` gives the repo a checked-in dataset bank and locked result
  conventions.
- `5vsm.6` owns richer artifacts, replay, annotation, and baseline-lock support.

What is still missing is the operator workflow between them:

- which runs are worth promoting
- what must be captured before the signal is lost
- how a raw run becomes an isolated candidate reproducer
- who approves promotion into the reusable bank
- when the resulting entry is considered locked

Without that workflow, the repo has datasets and reports but no explicit path
for turning real failures into durable regression knowledge.

## Scope boundary

This note owns the promotion workflow only.

### `5vsm.5` remains responsible for

- checked-in JSONL dataset rows
- suite naming and path conventions under `experiments/eval/datasets/`
- locked result placement under `experiments/results/`
- baseline comparison as part of the runner surface

### `5vsm.6` remains responsible for

- richer run artifacts
- replay and run-ID lookup
- annotation and human-score attachment
- artifact persistence and baseline-lock mechanics

### `5vsm.10` owns

- the state machine from raw run to promoted regression
- required capture inputs
- minimization and isolation expectations
- approval rules
- the handoff from captured run evidence into the dataset bank and locked
  artifacts

This avoids creating a second dataset-bank track or a second artifact/replay
track.

## What counts as a promotion candidate

Not every failed run should enter the bank.

A run becomes a promotion candidate only when it is one of these:

- a deterministic product failure on a supported or otherwise interpretable run
- a repeated failure pattern seen across more than one similar run
- an "interesting pass" where the task passes but exposes a sharp edge, near
  miss, wrong-scope edit, or stale-context hazard worth locking as a future
  regression
- a judge or human-review disagreement that exposes a gap in current
  deterministic coverage and can be reduced to a stable fixture

A run is **not** promotable as a bank entry when it is primarily:

- an auth, host, or external-runtime blocker as defined in
  [Live Validation Evidence](eval-live-validation-evidence.md)
- a one-off operator mistake with no reusable reproducer
- a case that cannot be isolated from unrelated repo or environment noise
- a purely transient provider wobble with no stable product-level failure shape

Blocked external runs may still be retained as operational evidence, but they
do not become reusable regression rows.

## Promotion states

The workflow uses five explicit states.

| State       | Meaning                                                                                           | Owner                |
| ----------- | ------------------------------------------------------------------------------------------------- | -------------------- |
| `captured`  | The raw run is preserved with enough evidence to inspect later.                                   | operator             |
| `triaged`   | The run is classified as promotable, non-promotable, or blocked.                                  | operator or reviewer |
| `minimized` | A smallest credible reproducer exists with deterministic boundaries.                              | author               |
| `approved`  | A human reviewer accepts promotion into the checked-in bank.                                      | reviewer             |
| `locked`    | The new regression row and its baseline/report references are committed as durable repo evidence. | repo                 |

Do not skip directly from an interesting run to a checked-in dataset row.

## End-to-end workflow

### 1. Capture the originating run immediately

When a run fails or reveals an interesting edge case, capture the raw evidence
before retrying or cleaning up the workspace.

Required capture fields:

- run identifier or other stable handle
- date and commit/worktree description
- harness and candidate mode
- host classification: supported, blocked, or unsupported
- source task input: prompt, dataset row, or fixture reference
- deterministic verify command and exit status
- relevant gate summary
- changed-file summary or patch
- transcript or equivalent task log
- stdout and stderr from verification
- blocker classification, if any
- judge result or review verdict, if one exists
- short operator note explaining why the run is interesting

Minimum capture bar if `5vsm.6` is not finished yet:

- task input
- verify output
- diff or changed-file list
- transcript excerpt
- environment and blocker classification

Preferred capture bar once `5vsm.6` lands:

- stable run ID
- artifact bundle
- replay handle
- structured judge output
- annotation or approval metadata

### 2. Triage the run before any promotion work

Triage answers one question: should this become regression work at all?

The reviewer or operator must classify the run into exactly one bucket:

- `promote`: worth converting into a reusable regression candidate
- `observe_only`: useful evidence, but not suitable for bank insertion yet
- `blocked_external`: host or auth issue, not a product regression
- `reject`: not reusable or not important enough to justify maintenance

Required triage outputs:

- primary failure or interest class
- whether the signal is product-level or environment-level
- whether the case belongs in an existing suite or implies a new suite family
- whether the evidence is already sufficient for minimization

Recommended failure and interest classes:

- `verification_failure`
- `scope_drift`
- `stale_context_anchor`
- `recovery_failure`
- `judge_disagreement`
- `interesting_pass`
- `environment_blocker`

## 3. Minimize and isolate the candidate

Promotion only happens after the original run is reduced to the smallest
credible reproducer.

Minimization means:

- remove unrelated files, steps, and history
- keep the fixture local and deterministic
- isolate one main behavior or failure class per row
- preserve the original bug shape without dragging along unrelated noise
- make the verify command cheap enough to run repeatedly in CI and eval loops

Isolation rules:

- prefer a fixture-local verify command over repo-global setup
- use the smallest file surface that still reproduces the behavior
- freeze any important setup in checked-in fixture inputs rather than in
  operator memory
- if the issue depends on thread carry-over or prior context, encode that in
  dataset metadata rather than prose alone
- if the issue cannot be replayed or approximated without live-host behavior,
  keep it as evidence only until `5vsm.6` provides a credible replay path

The candidate is not ready for approval if it still depends on:

- ad hoc shell history
- unstated operator choices
- unsupported-host behavior
- non-deterministic pass conditions with no durable judgment artifact

## 4. Prepare the reusable regression entry

Once minimized, the candidate must be converted into repo-native bank material.

Required outputs for the candidate package:

- target suite path under `experiments/eval/datasets/`
- stable row ID
- fixture directory or other checked-in input location
- deterministic `verify`
- candidate classification and short rationale
- reference to the originating run capture
- any required suite metadata such as scenario family, thread grouping, or risk
  tags

If the case extends a context-sensitive suite such as
[Fresh vs Threaded Eval Suite](fresh-vs-threaded-eval-suite.md), the row must
also include the suite-specific metadata needed to preserve the context shape,
for example:

- `thread_group`
- `thread_order`
- `scenario_family`
- `context_dependency`

The dataset row should describe the stable reproducer, not the entire story of
the original debugging session.

## 5. Human approval before bank insertion

Promotion must be explicit. No run should silently auto-promote itself into the
checked-in bank.

Approval checklist:

- the case represents a real product signal rather than an external blocker
- the reproducer is minimized and isolated
- the verify command is deterministic enough for repeated runner use
- suite placement is correct and does not duplicate an existing row
- the row ID, fixture path, and metadata are stable and understandable
- required trace and artifact references are attached
- any judge involvement is recorded as evidence, not hidden as the only pass
  condition

Reviewer outcomes:

- `approve`: candidate may be added to the dataset bank
- `revise`: minimization or metadata is incomplete
- `reject`: keep as historical evidence only

Rejected candidates should retain their origin capture reference so future work
can revisit them without recreating the entire investigation.

## 6. Lock the promoted regression

After approval, the case becomes durable repo evidence only when both of these
happen:

1. the checked-in dataset row and fixture land in the dataset bank
2. the resulting baseline or comparison artifacts are stored in the canonical
   results location when the suite is next regenerated

Locking rules:

- the dataset bank is the source of truth for the reusable regression entry
- locked reports belong under `experiments/results/`, not ad hoc temp folders
- transient local script output is evidence, not the canonical lock
- the origin run reference must remain traceable after locking
- later edits to the row should preserve the same stable row ID unless the case
  has materially changed

The locked state should answer two questions without extra archaeology:

- what behavior is this row protecting?
- which real run caused the repo to promote it?

## Required trace and artifact context

This workflow depends on trace and artifact capture, even before the full
`5vsm.6` surface exists.

Required trace context for every approved promotion:

- origin run handle
- commit or worktree identity
- task input reference
- transcript or equivalent execution log
- verify output
- diff or changed-file summary
- classification outcome

Preferred artifact context once `5vsm.6` matures:

- replayable run ID
- artifact manifest
- judge-result envelope
- human annotation or approval record
- baseline comparison reference

`5vsm.10` should not invent a separate artifact store. It should consume the
artifact and replay surfaces that `5vsm.6` provides.

## Composition with `5vsm.5` dataset-bank work

The dataset bank remains the durable home for reusable regressions.

This workflow composes with `5vsm.5` in a straight line:

1. capture and triage a real run
2. minimize it into a stable fixture
3. create or extend a checked-in JSONL suite row
4. regenerate the suite's locked outputs under `experiments/results/`

What `5vsm.10` must not do:

- define alternative dataset locations
- redefine the bank's naming and result-placement rules
- replace runner-side baseline comparison with bespoke note-taking

## Composition with `5vsm.6` artifact and replay work

`5vsm.6` is the infrastructure layer that makes promotion cheaper, safer, and
more reviewable.

This workflow composes with `5vsm.6` as follows:

- capture uses `5vsm.6` artifacts, traces, and replay handles when available
- approval consumes judge outputs and annotations produced by `5vsm.6`
- locking points from the checked-in dataset row back to the replayable origin
  evidence
- replay support should reduce the amount of manual re-creation needed during
  minimization and review

Until `5vsm.6` is fully landed, the workflow may use a reduced manual evidence
bundle. That is a temporary fallback, not the long-term contract.

## Promotion acceptance bar

`prompt-language-5vsm.10` is satisfied when this workflow is true in practice:

- failed or interesting runs have an explicit capture bar
- external blockers are separated from product regressions
- minimization and isolation happen before dataset-bank insertion
- human approval is required before promotion
- promoted rows point back to origin evidence
- locking composes with the existing dataset-bank and artifact/replay plans

## Out of scope

This note does not define:

- replay CLI syntax
- artifact schema details
- judge calibration methodology
- automatic promotion without review
- index updates or suite-priority decisions across the whole bank

Those stay with the relevant dataset-bank, artifact, replay, and broader eval
planning work.
