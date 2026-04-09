# Experiments

This directory holds the research and evaluation scaffold for controlled prompt-language experiments.

## Structure

```text
experiments/
  premature-stop-benchmark/
  bounded-feature-benchmark/
  parallel-planning/
  parallel-isolated-modules/
  full-saas-factory/
  self-healing-ci/
  eval/
  results/
  templates/
```

## Purpose

- `premature-stop-benchmark/` for repeated-stop and premature-exit comparisons
- `bounded-feature-benchmark/` for bounded implementation benchmarks
- `parallel-planning/` for plan quality and coordination experiments
- `parallel-isolated-modules/` for isolated module/build concurrency experiments
- `full-saas-factory/` for end-to-end product factory experiments
- `self-healing-ci/` for CI repair and auto-fix experiments
- `eval/` for shared rubrics, scoring scripts, and evaluation helpers
- `results/` for run outputs, scores, and analysis artifacts
- `templates/` for reusable experiment design docs

The directories exist as organizational scaffolding first. Individual experiments can add their own notes, fixtures, or run logs underneath the relevant folder.
