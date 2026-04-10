# Evals and Judges (WIP)

> **WIP: extension on top of a shipped v1 surface.** Named `rubric` and `judge` declarations, judge-backed `review strict`, typed judge results, the checked-in dataset bank, and the CLI `prompt-language eval` runner are already real. This page is about the broader future-facing eval layer beyond that v1 slice.
>
> For the shipped contract, see [Evals and Judges V1](../../reference/evals-and-judges-v1.md). For the accepted first implementation boundary, see [docs/design/evaluation-stack-v1.md](../../design/evaluation-stack-v1.md). For the shipped runner and current evidence, see [docs/evaluation/dataset-bank.md](../../evaluation/dataset-bank.md), [docs/evaluation/eval-test-matrix.md](../../evaluation/eval-test-matrix.md), and [docs/evaluation/what-works-now.md](../../evaluation/what-works-now.md).

## Shipped v1 today

These pieces are already part of the current runtime or CLI surface:

- top-level `rubric` declarations
- top-level `judge` declarations
- `review strict using judge "name"`
- typed `_review_result.*` capture
- the CLI `prompt-language eval` runner over checked-in JSONL datasets

## Still proposed here

This page remains WIP because it goes beyond the shipped v1 slice:

- a standalone `eval { ... }` DSL block
- broader judge kinds and runtime support beyond the current v1 path
- replay, annotation, and calibration surfaces as first-class product features
- richer comparison and artifact tooling promoted into the language surface

## Goal

Add a first-class evaluation layer for prompt-language so the project can:

- measure workflow quality on curated datasets
- compare alternative flows or project layouts
- reuse structured judges and rubrics instead of embedding ad hoc evaluator prompts everywhere
- support thesis work around repeated failures, wisdom accumulation, multi-file projects, and self-hosting

## Problem

The runtime already has the right primitives for hard execution control:

- `done when:` for deterministic completion gates
- composite and custom predicates
- `review` for generator-evaluator repair loops
- `import`, prompt libraries, `remember`, approvals, and parallel workers for larger projects

What it still does not have is a coherent first-class eval DSL above those primitives.

Today, the remaining evaluation logic is split across:

- local scripts in `scripts/eval/`
- one-off benchmark fixtures
- evaluator behavior embedded inside `review`
- thesis plans in `docs/strategy/thesis-roadmap.md`

That is enough to run real experiments, but not enough yet to make evaluation a first-class language surface.

## Design principles

1. `done when:` stays deterministic. Hard completion should continue to rely on built-in gates, custom commands, and reproducible predicates.
2. `eval` is the top-level feature. The primary missing capability is suite execution over datasets, metrics, baselines, and comparisons.
3. `judge` is reusable but not magical. It should be a named evaluator definition used by `eval` and `review`, not an implicit replacement for mechanical gates.
4. `review` remains the repair loop. It should consume judges and critiques, but it should not be the only place evaluator logic lives.
5. Outcome beats trajectory by default. Final-state evaluation is the default; transcript or step judging is added only when process matters for policy, cost, or safety.
6. Small judges beat one giant judge. Prefer composable code, model, and human evaluators over a single opaque score.
7. Self-hosting is staged. The language should evaluate and maintain its own prompt-language artifacts before attempting runtime self-hosting.

## Proposed surface

| Construct              | Role                                  | Notes                                                                         |
| ---------------------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| `rubric`               | Reusable scoring schema               | Shipped in v1 as declaration syntax; richer semantics may grow later          |
| `judge`                | Reusable evaluator definition         | Shipped in v1 for review reuse; broader runtime support remains future-facing |
| `eval`                 | Dataset and experiment runner         | CLI runner ships today; this table covers proposed DSL promotion              |
| `review strict`        | Repair loop with fail-closed behavior | Shipped in v1; broader evaluator layering remains WIP                         |
| trace / replay tooling | Audit and reproducibility support     | Better as tooling and reports than ordinary flow control                      |

## Non-goals

- Do not replace `done when:` with model grading.
- Do not make normal flow execution depend on inline LLM judges by default.
- Do not require exact trajectory matching as the main success metric.
- Do not turn prompt-language into a general-purpose statistics platform.
- Do not attempt full runtime self-rewrite as the first self-hosting milestone.

## Proposed syntax

### `rubric`

```text
rubric "bugfix_quality"
  criterion correctness type boolean weight 0.50
  criterion minimal_change type boolean weight 0.15
  criterion edge_cases type categorical["missed", "partial", "covered"] weight 0.20
  criterion maintainability type categorical["poor", "ok", "good"] weight 0.15

  pass when:
    correctness == true
    overall >= 0.85

  abstain when:
    evidence_missing
end
```

### `judge`

```text
judge "impl_quality"
  kind: model
  model: "best-available-judge"
  inputs: [diff, test_output, trace]
  rubric: "bugfix_quality"

  output:
    pass: boolean
    confidence: number
    reason: string
    evidence: string[]
    abstain: boolean
end
```

### `eval` (proposed future DSL)

```text
eval "auth-regression"
  dataset: "datasets/auth/*.jsonl"
  run: flow "flows/fix-auth.flow"

  checks:
    - tests_pass
    - lint_pass

  judges:
    - impl_quality
    - trajectory_minimality

  repeat: 3

  metrics:
    - pass_rate
    - mean_score
    - latency_ms
    - token_cost
    - tool_calls
    - human_interventions

  compare against "baselines/v0.3.0.json"

  fail when:
    pass_rate < 0.95
end
```

### `review strict`

```text
review strict using judge "impl_quality" max 3
  prompt: Improve the implementation.
  run: npm test
end
```

## Semantics

### `rubric`

- A rubric is a named, reusable scoring schema.
- Rubrics should bias toward pass/fail and low-precision categorical judgments rather than fake decimal precision.
- Criteria are independent dimensions so judges can explain partial failure without collapsing everything into one blob.
- `abstain` is explicit. Lack of evidence is different from failure.

### `judge`

- A judge is pure by default. It scores artifacts and emits structured output, but does not change files or control execution by itself.
- Supported kinds:
  - `code` for deterministic checks or script-backed scoring
  - `model` for structured model grading
  - `human` for manual annotation or approval-backed scoring
- Supported inputs should be explicit and selectable, for example:
  - `output`
  - `reference`
  - `diff`
  - `files`
  - `trace`
  - `tool_calls`
  - `state`
  - `test_output`
- Reference-free and reference-based judges should be distinguishable in configuration.
- A judge result is a typed object that can be saved and inspected by later steps.

### `eval`

- `eval` is the first-class experiment surface.
- It owns:
  - dataset selection
  - candidate flow or project execution
  - repeated runs
  - deterministic checks
  - judge execution
  - metric aggregation
  - baseline comparison
  - failure thresholds
- `eval` is meta-layer execution. It is not intended to run as ordinary inner-loop control flow inside every production task.
- `compare` should be part of `eval`, not necessarily a separate top-level primitive. Pairwise comparison is one experiment mode.

### `review strict`

- `review` keeps its current role as a repair loop.
- `review strict` changes the failure mode: if rounds are exhausted without a passing verdict, the flow fails closed instead of silently continuing.
- `review using judge "name"` extracts evaluator logic out of the block body and makes it reusable across suites.
- Existing `review` behavior can remain as the default for backward compatibility.

### Relationship to `done when:`

- `done when:` should continue to accept only deterministic gates and predicates.
- Model and human judges should not be part of ordinary completion gating by default.
- If a workflow wants to route on a judge result, that should happen explicitly through captured judge output, not hidden inside completion semantics.

## Suggested inputs and outputs

### Judge targets

- outcome
- transcript
- trace
- tool calls
- diff
- files

### Standard judge result

```json
{
  "pass": true,
  "confidence": 0.91,
  "reason": "Tests pass and the diff stays within the intended scope.",
  "evidence": ["All required checks passed", "Only auth-related files changed"],
  "abstain": false
}
```

## Example experiments

### Single candidate regression suite

```text
eval "wisdom-regression"
  dataset: "datasets/wisdom/*.jsonl"
  run: flow "flows/with-wisdom.flow"
  checks:
    - tests_pass
  judges:
    - impl_quality
  repeat: 3
  metrics:
    - pass_rate
    - repeated_failures
    - human_interventions
end
```

### Pairwise comparison

```text
eval "single-vs-multi-file"
  dataset: "datasets/factory/*.jsonl"
  candidates:
    - flow "flows/single-file.flow"
    - flow "flows/multi-file.flow"
  compare: pairwise
  judges:
    - outcome_quality
    - edit_scope
  metrics:
    - win_rate
    - pass_rate
    - regressions
    - lines_changed
end
```

## Trace, replay, and annotation tooling

These capabilities are necessary for evaluation, but they are better treated as tooling than as ordinary runtime keywords.

### Proposed tooling support

- trace capture for every eval run
- artifact capture for outputs, diffs, test logs, and tool transcripts
- replay by run ID
- baseline locking for comparison stability
- human annotation queues for judge calibration
- audit reports showing why a judge passed, failed, or abstained

### Possible CLI shape

```text
prompt-language eval run docs/evals/auth-regression.flow
prompt-language eval compare docs/evals/single-vs-multi-file.flow
prompt-language eval replay run_2026_04_09_001
prompt-language eval annotate run_2026_04_09_001 --rubric bugfix_quality
```

## Implementation direction

### Phase 1: landed v1 runtime slice

- define a stable internal judge-result shape
- extract reusable evaluator logic from `review`
- add `review strict`
- support named `rubric` and `judge` definitions in parsing and rendering

### Phase 2: landed v1 CLI runner

- add `prompt-language eval` execution over checked-in datasets
- support datasets, repeats, metrics, and baseline files
- wire in existing `scripts/eval/` harness concepts instead of replacing them wholesale
- keep checks deterministic and cheap by default

### Phase 3: still proposed

- pairwise candidate comparison
- trace and artifact persistence
- replay support
- report generation suitable for thesis experiments and regression tracking

### Phase 4: still proposed

- human annotation and approval-backed scoring
- judge audit trails
- calibration workflows that compare model judges against human scorecards

### Phase 5: still proposed

- policy compliance
- tool selection quality
- diff scope
- trajectory minimality

Only add these when process matters, not as the default success metric.

## Self-hosting path

The evaluation stack should enable staged self-hosting rather than immediate runtime self-rewrite.

### Stage 1: self-host the meta-layer

Prompt-language maintains its own:

- rubrics
- judges
- eval suites
- wisdom files
- project templates

### Stage 2: self-host prompt-language projects

Prompt-language edits and refactors:

- `.flow` files
- imports
- prompt libraries
- docs and examples

All under locked regression suites.

### Stage 3: self-host feature development

Prompt-language proposes new language features and evaluates them against:

- baseline suites
- A/B comparisons
- thesis metrics
- regression banks derived from prior failures

### Stage 4: explore runtime self-hosting

Only after the earlier stages are stable should the project explore parser, executor, or compiler-subset work in prompt-language.

## Relationship to current docs

This proposal extends existing project direction rather than replacing it:

- `docs/evaluation/eval-analysis.md` shows that deterministic gates are the current proven differentiator
- `docs/reference/review.md` already contains evaluator behavior that can be extracted into reusable judges
- `docs/strategy/thesis-roadmap.md` already defines experiment shapes that map naturally to first-class eval suites

## Current workaround

Today, the closest approximation is:

- use the shipped `prompt-language eval` CLI for checked-in JSONL datasets, repeats, reports, and baseline comparison
- use `done when:` for hard completion
- use `review` with `criteria:` or `grounded-by` for local repair loops
- write custom scripts in `scripts/eval/` for dataset execution and comparisons
- store baselines, traces, and notes manually in docs or fixture output

## Open questions

1. Should `judge` results be captured directly in normal flows, or only inside `eval` and `review`?
2. Should pairwise comparison be a first-class `compare` block or a mode on `eval`?
3. Where should traces live: session state, separate event logs, or eval-only artifacts?
4. How much of the eval stack belongs in the DSL versus the CLI and report tooling?
5. Which judge inputs are safe to expose by default without leaking unnecessary context or exploding cost?

## Acceptance criteria for the proposal

- The language keeps deterministic completion separate from evaluator-based quality scoring.
- The design supports the thesis experiments already defined in `docs/strategy/thesis-roadmap.md`.
- `review` can reuse evaluator definitions instead of embedding all judge behavior inline.
- The proposal includes a path for baselines, replay, and human calibration.
- The self-hosting path is staged and regression-driven rather than speculative.
