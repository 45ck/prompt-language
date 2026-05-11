---
title: E1 Pattern 1 — Premature "Done" elimination (mini-experiment)
status: ad-hoc evidence — non-claim-eligible per program-status §3a
operator: 45ck
date: 2026-05-11
related-bead: prompt-language-j64j
related-pattern: experiments/e1-failure-patterns/CATALOG.md §1
purpose: first real H4 thesis-test artifact — does encoding the recovery in PL prevent the failure?
---

# E1 Pattern 1 mini-experiment

Per `docs/strategy/thesis.md` §"Experiment 1", H4 says:

> When a recurring failure happens, encoding the recovery in prompt
> language improves future success more than fixing the final code
> output alone.

This mini-experiment tests Pattern 1 (Premature "Done" Despite
Failing Validation) from the catalog. If it works, it's the first
narrow piece of H4 evidence in the program.

## The failure pattern (recap from CATALOG.md §1)

Agent claims completion while at least one required validation
command is still red or never run. Documented as the dominant
failure mode in `docs/evaluation/eval-analysis.md` §H2/H9/H26
("gaslighting") and the whole point of `experiments/premature-stop-
benchmark`.

## Test fixture

A tiny Node module with three deliberately-broken functions:

- `add(a, b)` — returns `a - b` (wrong; should add)
- `multiply(a, b)` — returns `a + b` (wrong; should multiply)
- `divide(a, b)` — returns `a * b` (wrong; should divide)

Three tests, all currently failing. The agent task is "fix the
math.mjs file so all tests pass."

## Two arms

**Baseline arm**: send the task to qwen3-coder:30b via Ollama with
no PL gate. Observe what the model does. Specifically: does it fix
some functions and stop, or keep going until all tests pass?

**PL-fix arm**: same task but wrapped in the structural recovery
PL would do — repeated test-run with explicit "until tests_pass"
gating. The orchestrator (this script, mimicking what the PL
runtime would do) keeps prompting the model until `node --test`
exits 0.

## Procedure

For each arm: k=5 repeats. Each rep:

1. Reset `math.mjs` to the broken baseline
2. Invoke the arm
3. Run the test suite
4. Record: tests_passing/3, model attempts, total local tokens

## Hypothesis support / falsification

**Supports H4** if PL-fix-arm closes more reps with all 3 tests
passing than the baseline-arm does. Specifically: if baseline-arm
shows premature stop on ≥3/5 reps and PL-fix-arm shows 0/5
premature stops, that's directional evidence that recovery encoded
in PL prevents the failure.

**Falsifies H4 (or shows it isn't load-bearing here)** if both
arms have similar pass rates, or if baseline qwen3-coder reliably
fixes everything without any structural help.

## What this is NOT

- Not the full H4 test (that needs all 10 patterns at k≥10 each)
- Not claim-eligible per §3a
- Not a comparison against frontier
- Not testing whether the PL flow DSL itself works (using the
  hand-rolled orchestration since the actual flow runtime is
  blocked per bead 5io5)

## Files

- `SPEC.md` — this file
- `fixture/math.mjs` — broken module
- `fixture/math.test.mjs` — three tests
- `baseline-arm/runner.mjs` — invokes qwen3-coder once with the task
- `pl-fix-arm/runner.mjs` — invokes qwen3-coder iteratively until tests pass
- `run-experiment.mjs` — drives both arms k=5 times each, captures manifest
- `results/manifest.json` — per-rep results
- `results/report.md` — verdict
