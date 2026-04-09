# Spec 009 — Evals, judges, and regression promotion

## Problem

The repo already has a strong WIP direction for rubrics, judges, and evals, but evaluation is still partially split across scripts, docs, and local conventions. The system also needs a disciplined way to learn from failures.

## Goals

- Make evals and judges first-class
- Keep deterministic completion separate from quality grading
- Add baseline locking and structured artifacts
- Turn interesting failures into reusable regressions
- Support staged self-improvement without magical self-rewrite

## Non-goals

- Judges do not replace deterministic `done when:`
- Do not require model judges in ordinary production loops by default
- Do not make trajectory judging the default success metric

## Proposed syntax

### Rubric

```yaml
rubric "impl_quality"
  criterion correctness type boolean weight 0.50
  criterion scope type categorical["tight", "acceptable", "broad"] weight 0.20
  criterion maintainability type categorical["poor", "ok", "good"] weight 0.30

  pass when:
    correctness == true
    overall >= 0.85

  abstain when:
    evidence_missing
end
```

### Judge

```yaml
judge "impl_quality"
  kind: model
  inputs: [diff, test_output, changed_files]
  rubric: "impl_quality"

  output:
    pass: boolean
    confidence: number
    reason: string
    evidence: string[]
    abstain: boolean
end
```

### Eval

```yaml
eval "single-vs-multi-file"
  dataset: "datasets/factory/*.jsonl"

  candidates:
    - flow "flows/single-file.flow"
    - flow "flows/multi-file.flow"

  checks:
    - tests_pass
    - lint_pass

  judges:
    - impl_quality
    - scope_guard

  repeat: 3

  metrics:
    - pass_rate
    - win_rate
    - regressions
    - latency_ms
    - token_cost
    - human_interventions

  compare against "baselines/v0.5.0.json"

  fail when:
    pass_rate < 0.95
end
```

### Review strict

```yaml
review strict using judge "impl_quality" max 3
  prompt: Improve the implementation.
  run: npm test
end
```

## Regression promotion tooling

### CLI

```bash
prompt-language regressions promote run_2026_04_09_001
prompt-language regressions minimize run_2026_04_09_001
prompt-language regressions lock run_2026_04_09_001 --baseline v0.5.0
```

### Desired behavior

Given a failed or interesting run:

- capture trace + artifacts
- extract minimal reproducer
- create candidate fixture
- associate relevant contract/judge/wisdom proposal
- add to regression bank pending approval

## Calibration

The eval system should support:

- human scorecards
- model-vs-human comparisons
- judge drift detection
- baseline locking

## Acceptance criteria

- Named rubrics, judges, and evals exist
- `review strict` fails closed
- Judges support abstention
- Evals support repeat runs and baseline comparison
- Failure-to-regression promotion is possible

## Open questions

- Which judge inputs are safe/cost-effective to expose by default?
- How much of regression promotion belongs in CLI vs DSL?
