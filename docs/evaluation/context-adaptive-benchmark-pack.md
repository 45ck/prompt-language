# Context-Adaptive Benchmark Pack

## Status

Bounded evaluation note for bead `prompt-language-0ovo.1.4`.

Current conclusion: **seeded baseline pack is now checked in**.

This note defines the minimum benchmark-pack shape needed before the
context-adaptive program can make honest claims about quality, safety, and
tradeoffs. The repo now contains the baseline-pack seed for this bead under
[`experiments/eval/context-adaptive-benchmark-pack/`](../../experiments/eval/context-adaptive-benchmark-pack/README.md).
That checked-in slice is intentionally smaller than the later comparison beads:
it seeds representative fixtures plus a current-renderer reference report, but
it does not claim that compact-mode comparisons or promotion evidence already
exist.

## Purpose

Define a narrow baseline benchmark pack for context-adaptive evaluation work so
future runs compare the right things:

- prompt pressure reduction
- task-completion quality
- diagnosis quality
- resume and recovery quality
- safety regressions under compacted or summarized context

The pack is meant to be small enough to run repeatedly and strict enough to
produce comparable evidence across baseline and candidate render modes.

## Anchors

- [Context-Adaptive Rendering Results Template](./context-adaptive-rendering-results-template.md)
- [Benchmark Suite and Canonical Stack](./benchmark-suite-and-canonical-stack.md)
- [Evaluation Dataset Bank](./dataset-bank.md)
- [Eval Artifact Bundles and Replay](./eval-artifact-bundles-and-replay.md)
- [What Works Now](./what-works-now.md)
- [Seeded Benchmark Pack README](../../experiments/eval/context-adaptive-benchmark-pack/README.md)
- [Seeded Fixture Inventory](../../experiments/eval/context-adaptive-benchmark-pack/fixtures.json)
- [Current-Renderer Baseline Report](../../experiments/eval/context-adaptive-benchmark-pack/baseline-renderer-report.json)

## Benchmark-pack boundary

This pack is not the full eval program.

It is a bounded representative slice intended to answer one question first:

Does context-adaptive rendering improve prompt-budget handling without silently
reducing task quality or making diagnosis and recovery less safe?

In scope:

- representative fixtures for prompt pressure and compacted context
- baseline versus candidate comparisons
- locked evidence expectations for each run
- enough coverage to expose obvious regressions

Out of scope:

- exhaustive benchmark-bank coverage
- final promotion thresholds for all future eval families
- productization of artifact storage or replay tooling
- claims about parity across every model or host

## Representative fixture categories

The pack should contain a small number of fixtures that force different failure
and recovery behaviors instead of repeating the same edit pattern.

### 1. Large-output diagnosis

Goal:
Determine whether compacted or summarized output hides the true failure cause.

Representative fixture shape:

- failing command with verbose stderr where the decisive clue appears late
- failing test suite with many irrelevant lines before the actionable assertion
- command output that exceeds ordinary in-thread readability

Primary question:
Can the agent still identify the real cause and choose the right fix path?

### 2. Multi-turn code-edit continuation

Goal:
Check whether context-adaptive rendering preserves enough thread state to keep a
multi-step implementation coherent.

Representative fixture shape:

- one task requiring diagnosis, edit, rerun, and follow-up correction
- intermediate outputs large enough to pressure prompt budget
- at least one branch where the first fix is incomplete

Primary question:
Does compaction preserve continuity well enough to finish the task cleanly?

### 3. Resume and recovery after interrupted progress

Goal:
Verify that a resumed run can recover the correct state after prior context has
been compressed or summarized.

Representative fixture shape:

- interrupted run after partial edits
- stored context containing prior actions, failures, and remaining objective
- one case where the next safe step depends on a detail from earlier output

Primary question:
Can the resumed agent continue safely without reintroducing solved failures?

### 4. Artifact-reference navigation

Goal:
Measure whether pushing detail into artifact references remains usable during
real diagnosis.

Representative fixture shape:

- raw output moved to artifact-like evidence location
- main render path contains a compact summary and reference handle
- successful completion requires consulting the referenced detail

Primary question:
Can the agent use externalized evidence without losing speed or correctness?

### 5. Safety-sensitive correction

Goal:
Ensure context adaptation does not make the agent overconfident in risky fixes.

Representative fixture shape:

- task with one tempting but wrong broad fix
- decisive safety detail appears in long output, prior state, or artifact-backed
  evidence
- acceptance depends on not weakening tests or controls

Primary question:
Does the compacted path preserve the caution needed to avoid unsafe shortcuts?

## Seeded pack size

The repo now seeds the minimum closure slice for this bead:

- 1 gate-heavy fixture
- 1 long-flow fixture
- 1 large-output fixture
- 1 recovery fixture

That yields **4 total fixtures** in the checked-in pack. This is enough to make
the baseline categories concrete and to lock a current-renderer reference
artifact without pretending the wider comparison program is complete.

Later context-adaptive comparison beads can expand this seed into the broader
10-fixture or 20-fixture families once compact-mode execution and telemetry
collection are ready.

## Baseline comparison matrix

Each fixture should run against a minimal comparison set.

| Run family               | Purpose                                                                     |
| ------------------------ | --------------------------------------------------------------------------- |
| Full-context baseline    | Best available non-adaptive thread path for the same task                   |
| Compact-render candidate | Context-adaptive rendering path under evaluation                            |
| Resume-path candidate    | Same adaptive path exercised through interruption and resume where relevant |

Not every fixture needs all three families. Resume-path runs are mandatory only
for fixtures that genuinely test recovery.

## Baseline measurement plan

Each fixture should capture the same small set of measurements so results stay
comparable across runs.

### Outcome measures

- task completed correctly or not
- validation commands passed or not
- wrong-fix incidence
- recovery success after interruption where applicable

### Diagnosis measures

- root-cause identified correctly or not
- number of corrective attempts before success
- whether the agent consulted the decisive evidence source

### Efficiency measures

- turns to completion
- total rendered context volume for the run
- number of artifact-reference lookups when applicable

### Safety measures

- tests or safeguards weakened
- risky broad edits introduced
- recovery path re-broke previously fixed behavior

## Fixture expectations

Every fixture row in the pack should define:

- stable fixture identifier
- category
- objective
- starting state
- expected decisive evidence location
- required validation commands
- expected report artifacts
- whether interruption or resume is required

The pack should prefer deterministic local fixtures over evaluation cases that
depend on external timing or unstable hosted services.

## Report artifact expectations

Each benchmark run should produce a compact but inspectable evidence set.

Minimum expected artifacts per run:

- run manifest with fixture id, run family, model, and timestamp
- final task outcome summary
- validation command transcript or normalized result capture
- rendered-context sample or equivalent evidence of what the agent saw
- artifact references consulted during the run, if any
- concise evaluator judgment covering correctness, diagnosis quality, and safety

Recommended comparison artifacts per fixture:

- one side-by-side result row comparing baseline and candidate outcomes
- one short narrative note when the candidate loses, ties suspiciously, or wins
  only by reduced visibility standards

The reporting layer should favor inspectable evidence over score-only summaries.

## Evidence gaps this note makes explicit

This bead is about seeding the baseline pack, not proving the full context-
adaptive program. The remaining gaps belong to later comparison and promotion
work.

Still missing after this seed:

- completed compact-mode candidate runs against the seeded baseline
- locked telemetry-rich artifacts showing what the agent saw in each render mode
- explicit write-up of wins, losses, regressions, and suspicious ties
- a credible judgment on whether context adaptation helps without hiding
  important detail

## Closure standard for this bead

`prompt-language-0ovo.1.4` becomes closure-ready when the repo has:

1. a checked-in benchmark pack covering gate-heavy, long-flow, large-output,
   and recovery fixtures
2. a checked-in current-renderer baseline report artifact for that pack
3. docs that state clearly which later beads still own compact-mode comparisons,
   telemetry-backed measurements, and promotion judgments

That closure standard is now met by the seeded pack in
`experiments/eval/context-adaptive-benchmark-pack/`.

This does not close the wider context-adaptive evaluation program. It only
finishes the baseline-pack seeding slice so later beads have a stable pack to
run and compare.

## Recommendation

Use this note as the bounded contract for the first context-adaptive benchmark
pack.

Keep the first pack small, comparison-oriented, and evidence-heavy. If the
adaptive path cannot beat or safely tie the baseline on these representative
fixtures, the repo should not generalize claims from narrower or cleaner cases.
