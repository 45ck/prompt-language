# Self-Hosted Meta-Layer Pilot

## Status

Accepted bounded pilot for `prompt-language-5vsm.9`.

## Purpose

Define the first self-hosted evaluation milestone for
`prompt-language-5vsm.9` without expanding into parser, executor, or runtime
self-rewrite.

This pilot is intentionally narrow: prompt-language should maintain its own
meta-layer artifacts inside this repo before it attempts to modify the
underlying language engine.

## Anchors

- [Eval/Judge vNext Alignment](./eval-judge-vnext-alignment.md)
- [Design: Evaluation Stack V1 Boundary](../design/evaluation-stack-v1.md)
- [Evals and Judges (WIP)](../wip/tooling/evals-and-judges.md)
- [Evaluation Dataset Bank](./dataset-bank.md)

## Pilot decision

The first self-hosted slice is **repo-local meta-layer maintenance only**.

In scope:

- `.flow` files used for evals, examples, and meta-layer project workflows
- eval suite definitions and checked-in dataset docs
- rubric and judge definitions
- evaluation notes, runner-facing manifests, and adjacent maintenance docs
- repo-local prompt-language project templates or helper notes that shape eval
  execution

Out of scope in this phase:

- parser self-rewrite
- executor or runtime self-rewrite
- core state-transition changes justified only by self-hosting ambition
- autonomous promotion of language features into shipped runtime behavior
- broad self-modifying loops without human review and locked regressions

## Why this boundary exists

[evaluation-stack-v1](../design/evaluation-stack-v1.md) explicitly keeps the
first evaluation slice split between runtime declarations and runner/tooling.
[eval-judge-vnext-alignment](./eval-judge-vnext-alignment.md) also makes the
sequencing constraint explicit: artifact capture, replay, and regression
promotion must become credible before broader self-hosting work.

That means `5vsm.9` should not act like a shortcut around unfinished `5vsm.6`
work. The pilot starts where the risk is lower and the evidence is easier to
inspect:

- checked-in eval assets
- docs and manifests
- judge and rubric maintenance
- `.flow` maintenance for the evaluation stack itself

## Entry criteria

This pilot should begin only after artifact and replay work is usable enough to
support failure inspection and regression discipline.

Minimum expected preconditions:

1. Eval runs produce durable artifacts that can be inspected after failure.
2. Replay or equivalent rerun support is stable enough to reproduce notable
   failures without rebuilding the whole experiment manually.
3. The dataset bank has named suites and locked baselines for the pilot surface.
4. Regression promotion expectations are documented so interesting failures do
   not disappear into ad hoc notes.

If those conditions are missing, the correct next step is to finish the
artifact/replay path rather than broadening self-hosting scope.

## Pilot scope

The pilot should exercise prompt-language as the author and maintainer of its
own evaluation layer.

### Maintained assets

- eval `.flow` files under repo control
- rubric and judge declarations used by current eval suites
- dataset descriptions, fixture notes, and suite-level evaluation docs
- maintenance notes that explain thresholds, compare modes, or regression
  interpretation

### Allowed change types

- clarify or refactor eval-facing `.flow` files
- add or tighten rubric and judge wording
- improve dataset documentation and suite notes
- restructure repo-local eval docs so the maintenance path is clearer
- add small supporting prompt-language assets that help the repo run or review
  evals consistently

### Excluded change types

- modifying parser or executor code as part of the pilot goal
- changing completion semantics to make self-hosting easier
- adding hidden evaluator behavior into `done when:`
- rewriting general runtime internals through prompt-language
- promoting new meta-layer content automatically without review evidence

## Operating model

The pilot should run as a supervised maintenance loop, not as an autonomous
self-improvement claim.

Expected loop:

1. Start from a bounded repo-local maintenance task.
2. Edit only the meta-layer artifacts needed for that task.
3. Run the relevant eval suite or regression subset.
4. Inspect artifact output, judge results, and baseline comparison.
5. Accept, revise, or reject the candidate change under human review.

The default unit of work is a small, reviewable maintenance change to eval
assets, not a large cross-cutting rewrite.

## Regression protection expectations

This pilot is only valid if regression discipline is stronger than ordinary doc
editing.

Minimum expectations:

- every pilot change maps to a named suite, baseline, or documented evaluation
  reason
- failures produce inspectable artifacts rather than only pass/fail summaries
- notable failures can be replayed or rerun with stable enough inputs to debug
- candidate fixes do not enter the bank silently; promotion remains explicit
- human review decides whether a changed rubric, judge, or `.flow` definition is
  accepted

The pilot should prefer locked, boring protection over clever autonomy. If a
change cannot be tied back to a clear regression or maintenance objective, it
should not be part of this phase.

## Success metrics

The pilot is successful if it proves that prompt-language can maintain its own
evaluation layer with bounded risk and useful evidence.

Primary success metrics:

- a small set of real meta-layer maintenance tasks complete through
  prompt-language-authored changes
- accepted changes stay inside repo-local eval artifacts and docs
- reruns against the relevant suites remain stable enough to explain accept or
  reject decisions
- at least one failure or weak run is converted into a durable regression asset
  or documented bank addition
- human reviewers can inspect why a change passed, failed, or was rejected

Secondary success metrics:

- lower manual effort to update eval docs, rubrics, judges, and suite metadata
- improved consistency between dataset docs, suite notes, and runner behavior
- fewer orphaned eval notes or drifting judge definitions

## Stop conditions

The pilot should stop immediately if any of these happen:

- the work starts requiring parser, executor, or state-machine changes to keep
  going
- replay or artifact evidence is too weak to explain pass/fail outcomes
- eval changes begin causing unexplained baseline churn across unrelated suites
- the loop starts proposing broad self-rewrite instead of bounded meta-layer
  maintenance
- human reviewers cannot reliably tell whether the change improved or degraded
  the evaluation surface

Stopping is the intended control, not a sign that the pilot failed. A stop
condition means the repo has reached the current safety boundary.

## Sequencing after artifact and replay work

The intended order is:

1. finish artifact, replay, and regression-promotion support
2. run this repo-local meta-layer pilot on eval assets and docs
3. expand to broader prompt-language project maintenance only if the pilot is
   stable
4. consider runtime self-hosting questions much later, under separate design and
   evidence gates

This preserves the v1 boundary from
[evaluation-stack-v1](../design/evaluation-stack-v1.md) and the sequencing
warning from [eval-judge-vnext-alignment](./eval-judge-vnext-alignment.md):
meta-layer self-hosting comes after credible replay discipline, not before it.

## Explicit non-goal

This note does **not** authorize first-phase self-rewrite of the parser,
executor, or runtime. The purpose of `5vsm.9` is to prove that prompt-language
can safely maintain its own evaluation layer inside the repo, not to claim
general autonomous evolution of the language engine.
