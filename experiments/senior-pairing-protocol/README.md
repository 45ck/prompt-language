# Senior Pairing Protocol

Status: planned

This experiment tests whether prompt-language can encode senior-engineer
metacognition tightly enough to improve local-model coding work.

The model under test is treated as a junior developer sitting beside a senior
engineer. The prompt-language flow does not merely ask the model to "be senior";
it forces observable steps: clarify, assess risk, plan, implement narrowly,
verify, critique, repair, and escalate when confidence is low.

Runtime is recorded as telemetry, not as a primary score. Local inference can be
slow, and this experiment is about decision quality and work quality before
speed.

## Primary Question

Can a prompt-language supervision protocol improve local-model task quality by
making senior engineering judgment explicit and enforceable?

## Arms

| Arm                            | Description                                                                     | Purpose                                |
| ------------------------------ | ------------------------------------------------------------------------------- | -------------------------------------- |
| `solo-local`                   | Local model receives the task directly                                          | Baseline for ordinary prompting        |
| `persona-only-control`         | Local model receives a senior-engineer persona prompt without PL checkpoints    | Controls for prompt theater            |
| `pl-senior-pairing-local`      | Local model runs through the Senior Pairing Protocol flow                       | Tests PL as metacognitive scaffolding  |
| `pl-senior-pairing-full-local` | Local model runs through a heavier feature-probe flow with spawned reviewers    | Tests richer PL orchestration support  |
| `pl-hybrid-judge`              | Local model performs the work, external strong model judges high-risk decisions | Tests local/frontier division of labor |

The full-feature arm is exploratory. The primary causal comparison is
`solo-local` versus `persona-only-control` versus `pl-senior-pairing-local`.

## What Counts As Evidence

- Passing deterministic task oracle.
- Explicit ambiguity handling before implementation.
- Correct risk classification.
- Minimal, scoped diff.
- Tests that would fail on the original bug or missing feature.
- Repair behavior grounded in actual failing output.
- Escalation when the model cannot justify a safe decision.

## What Does Not Count

- A polished transcript without a better final artifact.
- A persona statement that says "I am a senior engineer."
- Faster runtime by itself.
- Judge approval without deterministic evidence.

## Directory Map

| Path                 | Purpose                                      |
| -------------------- | -------------------------------------------- |
| `docs/`              | Experiment method, runbook, and threat model |
| `protocol/`          | Reusable senior-pairing behavior contract    |
| `flows/`             | Prompt-language arms used by the benchmark   |
| `tasks/`             | Benchmark task briefs and fixture contracts  |
| `rubrics/`           | Human and model scoring rubrics              |
| `manifests/`         | Machine-readable experiment metadata         |
| `results/templates/` | Scorecard and run-report templates           |

## First Run Plan

1. Select one task from `tasks/`.
2. Copy the task to a fresh workspace for the selected arm.
3. Run arms in randomized order; use at least three repeats per task before
   comparing arms.
4. Reset to a fresh copy before every arm and repeat.
5. Run `pl-senior-pairing-local`.
6. Run `pl-senior-pairing-full-local` as a feature probe after the compact PL
   arm is valid.
7. Run `pl-hybrid-judge` from a fresh fixture, not as a rescue pass over a prior
   local-PL workspace.
8. Score deterministically first, then score senior-behavior criteria.
9. Record runtime as telemetry only.

## Related Evidence

- `experiments/aider-vs-pl/results/2026-04-28-local-model-experiments.md`
- `experiments/aider-vs-pl/LOCAL-MODEL-VIABILITY-FINDINGS.md`
- `docs/feature-coverage.md`
- `docs/reference/evals-and-judges-v1.md`
