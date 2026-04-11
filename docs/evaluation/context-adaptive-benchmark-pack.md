# Context-Adaptive Benchmark Pack

## Status

Bounded evaluation note for bead `prompt-language-0ovo.1.4`.

Current conclusion: **preparatory, not closure-ready**.

This note defines the minimum benchmark-pack shape needed before the
context-adaptive program can make honest claims about quality, safety, and
tradeoffs. It does not claim that the benchmark pack already exists as a
completed checked-in artifact set.

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

## Recommended pack size

The first benchmark pack should stay intentionally small:

- 2 fixtures for large-output diagnosis
- 2 fixtures for multi-turn continuation
- 2 fixtures for resume and recovery
- 2 fixtures for artifact-reference navigation
- 2 fixtures for safety-sensitive correction

That yields **10 total fixtures**. This is enough to surface pattern-level wins
or losses without pretending the pack is comprehensive.

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

This bead should not close on planning alone. The repo still needs evidence the
note does not provide by itself.

Missing today for closure:

- checked-in benchmark fixture set for this pack
- completed baseline versus candidate run results
- locked artifacts showing what the agent saw in each render mode
- explicit write-up of failures, regressions, and suspicious ties
- a credible judgment on whether context adaptation helps without hiding
  important detail

## Closure standard suggested by this note

This bead becomes closure-ready only when the repo has:

1. a checked-in benchmark pack matching the fixture categories above or a
   justified equivalent
2. completed comparison runs against at least one baseline and one
   context-adaptive candidate
3. report artifacts sufficient to inspect correctness, diagnosis quality, and
   safety outcomes
4. an evaluation summary that names wins, losses, ties, and unresolved evidence
   gaps explicitly

Until then, this note should be treated as benchmark-pack planning rather than
benchmark completion.

## Recommendation

Use this note as the bounded contract for the first context-adaptive benchmark
pack.

Keep the first pack small, comparison-oriented, and evidence-heavy. If the
adaptive path cannot beat or safely tie the baseline on these representative
fixtures, the repo should not generalize claims from narrower or cleaner cases.
