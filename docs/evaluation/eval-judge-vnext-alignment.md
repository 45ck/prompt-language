# Eval/Judge vNext Alignment

## Purpose

This note maps the imported vNext eval/judge framing onto the existing
`prompt-language-5vsm` backlog so the repo does not create a second parallel
evaluation track.

Anchors:

- [Spec 009: Evals, judges, and regression promotion](../wip/vnext/specs/009-evals-judges-and-regression-promotion.md)
- [WIP Evals and Judges](../wip/tooling/evals-and-judges.md)
- current `docs/evaluation/*`

## Bottom line

The imported vNext pack mostly **confirms and tightens** the existing `5vsm`
epic rather than replacing it.

What `5vsm` already covers well:

- deterministic completion stays separate from quality grading
- named `rubric` and `judge` declarations
- `review strict` fail-closed behavior
- runner-first eval execution over checked-in datasets
- repeat runs, reports, and baseline comparison
- live-validation evidence and blocked-host handling
- a staged self-hosting path that starts at the meta-layer

What remains genuinely open inside the current epic:

- richer eval artifacts, replay, and calibration support under `5vsm.6`
- the self-hosted meta-layer pilot under `5vsm.9`

What the imported framing adds as one real missing obligation:

- an explicit **failure-to-regression promotion workflow** from failed or
  interesting run to minimized candidate fixture and locked regression entry

## Mapping vNext expectations onto `prompt-language-5vsm`

| Imported expectation                                                             | Current `5vsm` coverage                                                                                                                   | Status                         | Alignment              | Notes                                                                                                                 |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Keep deterministic `done when:` separate from judge scoring                      | `5vsm.1`, [evaluation-stack-v1](../design/evaluation-stack-v1.md), [eval-analysis](eval-analysis.md), [what-works-now](what-works-now.md) | closed/shipped                 | aligned                | This boundary is already explicit in both design and evaluation notes.                                                |
| Named `rubric` and `judge` declarations                                          | `5vsm.1`, `5vsm.2`                                                                                                                        | closed/shipped                 | aligned                | The imported pack does not require a second syntax track here.                                                        |
| `review strict` fails closed                                                     | `5vsm.1`, `5vsm.3`, [evals-and-judges-v1](../reference/evals-and-judges-v1.md)                                                            | closed/shipped                 | aligned                | vNext matches the shipped runtime direction.                                                                          |
| Typed judge-result envelope with abstention                                      | `5vsm.1`, `5vsm.3`, [eval-test-matrix](eval-test-matrix.md)                                                                               | closed/shipped                 | aligned                | `abstain` already exists in the runtime envelope; this is not new scope.                                              |
| Evals as first-class runner capability over datasets                             | `5vsm.4`, `5vsm.5`, [dataset-bank](dataset-bank.md), [what-works-now](what-works-now.md)                                                  | closed/shipped                 | aligned                | The repo intentionally delivered this as CLI/runner work before broader DSL work.                                     |
| Repeats, metrics, reports, and baseline comparison                               | `5vsm.4`, `5vsm.5`, [dataset-bank](dataset-bank.md)                                                                                       | closed/shipped                 | aligned                | This is already the v1 runner contract.                                                                               |
| Pairwise or candidate comparison                                                 | `5vsm.4`, [fresh-vs-threaded-eval-suite](fresh-vs-threaded-eval-suite.md)                                                                 | partly shipped / partly future | aligned by intent      | Comparison belongs in runner/report tooling, not a new top-level syntax push.                                         |
| Artifact bundles, replay, annotation, and baseline lock                          | `5vsm.6`                                                                                                                                  | open                           | aligned but unfinished | The epic already owns this, and vNext mainly increases pressure to finish it.                                         |
| Human scorecards, model-vs-human comparisons, calibration, judge drift detection | `5vsm.6`                                                                                                                                  | open                           | aligned but unfinished | Current wording says "human annotation hooks"; that is broad enough to absorb calibration work without a second epic. |
| Live smoke, supported-host expectations, blocked-host classification             | `5vsm.8`, [eval-live-validation-evidence](eval-live-validation-evidence.md), [eval-parity-matrix](eval-parity-matrix.md)                  | closed                         | aligned                | The imported framing should reuse this evidence contract rather than restating it elsewhere.                          |
| Staged self-improvement rather than magical self-rewrite                         | `5vsm.9`, [what-works-now](what-works-now.md)                                                                                             | open                           | aligned                | The repo already chose the meta-layer-first path.                                                                     |
| Promote interesting failures into reusable regressions                           | split across `5vsm.5` and `5vsm.6`                                                                                                        | partial                        | genuine gap            | The bank exists, and artifacts are partially owned, but no child explicitly owns the promotion workflow end to end.   |

## Duplicates to avoid

The imported framing should **not** create any of these duplicate tracks:

- a second parser/runtime push for `rubric`, `judge`, or `review strict`
- a second "eval DSL" initiative that ignores the repo's runner-first v1 boundary
- a second live-validation plan outside `5vsm.8`
- a separate baseline-lock or annotation epic that duplicates `5vsm.6`
- a separate self-hosting epic that bypasses `5vsm.9`

The main duplication risk is treating the vNext `eval { ... }` examples as a
new backlog stream. In this repo, that would be mis-sequenced. The current
design already chose a narrower and more practical order:

1. ship declarations and strict review semantics
2. ship the dataset runner and baseline reports
3. finish artifacts, replay, and calibration support
4. expand toward self-hosted eval maintenance

## Sequencing implications

The imported framing sharpens the existing execution order rather than changing
it.

### 1. Treat the current shipped v1 slice as the floor, not as provisional draft

The existing closed `5vsm` children already establish the current product
contract:

- `5vsm.1` boundary and non-goals
- `5vsm.2` parser/lint/render support
- `5vsm.3` review-time runtime semantics
- `5vsm.4` runner execution, repeats, reports, and baseline comparison
- `5vsm.5` seeded dataset bank
- `5vsm.7` automated QA matrix
- `5vsm.8` live-validation evidence contract

The vNext pack should build on that surface, not reopen it.

### 2. Finish `5vsm.6` before chasing broader eval syntax

Spec 009 places real weight on:

- trace capture
- replay
- stable baseline locking
- human calibration
- artifact-backed inspection

Those are all closer to `5vsm.6` than to any new syntax bead. The next useful
work remains artifact and replay infrastructure, not another round of DSL
expansion.

### 3. Keep dataset-bank growth tied to evidence, not to speculative feature naming

[dataset-bank](dataset-bank.md) already maps E1-E5 and the newer notes such as
[fresh-vs-threaded-eval-suite](fresh-vs-threaded-eval-suite.md) define future
suite contracts. The vNext pack does not require a new dataset-planning epic.
It mostly raises the quality bar for how failures get promoted into that bank.

### 4. Use `5vsm.9` only after replay and regression protection are credible

The imported self-improvement framing is regression-driven. That means the
self-hosted meta-layer pilot should stay sequenced after the artifact/replay
work is solid enough to lock and inspect failures.

## Genuine gap

The current epic has one clear hole relative to Spec 009:

### Missing explicit regression-promotion workflow

Spec 009 is not satisfied by "we have datasets" plus "we have reports." It
also asks for an explicit path from a failed or interesting run to a reusable
regression entry:

- capture the trace and artifacts for the run
- minimize or isolate the reproducer
- attach the relevant contract or judge context
- add a candidate fixture to the bank
- lock it behind approval rather than silently promoting noise

Today, that ownership is only implicit:

- `5vsm.5` covers seeded datasets and naming/versioning
- `5vsm.6` covers richer artifacts, replay, and annotation hooks

Neither child clearly owns the full promotion pipeline.

## Follow-up guidance

Only one follow-up is justified by the imported framing if the current epic is
expanded:

- add a narrow child under `prompt-language-5vsm` for **regression promotion
  workflow**, covering failed-run capture, minimization, approval, and bank
  insertion

No other new follow-up is justified from the imported pack right now.

In particular, the following should stay inside existing scope:

- calibration and judge-drift work stays under `5vsm.6`
- self-hosted eval maintenance stays under `5vsm.9`
- live smoke and evidence policy stays under `5vsm.8`
- runner-side compare and future suite growth stay under the existing eval bank
  and runner work

## Verdict for `prompt-language-zhog.5`

`prompt-language-5vsm` is already the correct umbrella for the imported
eval/judge framing.

The imported pack does **not** justify a second eval/judge roadmap. It mainly
does three things:

- confirms that the repo's runner-first v1 boundary was the right call
- makes the remaining open `5vsm.6` and `5vsm.9` work more urgent
- exposes one real missing obligation: explicit regression-promotion workflow
