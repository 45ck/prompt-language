# Evaluation

Evidence, QA matrices, and evaluation artifacts for prompt-language.

Evaluation measures the current product and its caveats. It does not expand the shipped surface: for product usage, syntax, and guarantees, use the [Guides](../guides/index.md) and [Reference](../reference/index.md). For the longer-range thesis, use [Strategy](../strategy/index.md) and [Research](../research/README.md).

The docs in this section are paired with the checked-in dataset bank under [experiments/eval/README.md](../../experiments/eval/README.md) and the locked report bank under [experiments/results/README.md](../../experiments/results/README.md).

## How to use this section

| If you need...                | Go here                                      | Why                                                             |
| ----------------------------- | -------------------------------------------- | --------------------------------------------------------------- |
| The quickest evidence summary | [What Works Now](what-works-now.md)          | Short public read on the strongest proven mechanism and caveats |
| The shipped product contract  | [Reference](../reference/index.md)           | Evaluation does not define shipped syntax or guarantees         |
| Current runner/status caveats | [Codex Parity Matrix](eval-parity-matrix.md) | Current support limits, smoke status, and parity gaps           |
| Long-range hypotheses         | [Strategy](../strategy/index.md)             | Thesis framing and experiment program beyond current proof      |
| External research synthesis   | [Research](../research/README.md)            | Source-driven reports that informed the product direction       |

## Product evidence

| Doc                                                                                               | Focus                                                                                             |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [What Works Now](what-works-now.md)                                                               | Short public summary of the strongest proven surfaces and caveats                                 |
| [Eval Test Matrix](eval-test-matrix.md)                                                           | Automated coverage expectations for parser, runtime, datasets, and CLI                            |
| [Eval Analysis](eval-analysis.md)                                                                 | Comparative A/B results, latency analysis, and differentiator taxonomy                            |
| [Codex Parity Matrix](eval-parity-matrix.md)                                                      | Current parity bar plus checked-in execution status for tests, CI, smoke, and supported-host gaps |
| [Codex Parity Delta Analysis](codex-parity-delta-analysis.md)                                     | Current delta classification and exact remaining full-run evidence gap                            |
| [v0.4.0 Release Readiness Checklist](v0.4.0-release-readiness-checklist.md)                       | Pre-tag release gate for `v0.4.0`, mapping each required checklist item to current repo evidence  |
| [2026-04-11 Codex Parity Execution Evidence](2026-04-11-codex-parity-execution-evidence.md)       | Branch-local execution evidence note separating deterministic passes from environment blockers    |
| [Live Validation Evidence](eval-live-validation-evidence.md)                                      | Required smoke evidence format and blocked-host classification                                    |
| [Smoke Coverage Status](test-design-smoke-gaps.md)                                                | Current smoke coverage, quick-suite evidence, and remaining gaps                                  |
| [Operator Shell Rollout and Promotion Evidence](operator-shell-rollout-and-promotion-evidence.md) | Rollout gates, blocker classes, troubleshooting, and promotion evidence for operator-shell slices |

## Research continuation

| Doc                                                                                         | Focus                                                                                                                     |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [Dataset Bank](dataset-bank.md)                                                             | Seeded JSONL suites, baseline workflow, and thesis dataset path map                                                       |
| [OpenCode Gemma 4 Plan](opencode-gemma-plan.md)                                             | Hosted OpenCode baseline plus bounded Gemma comparison plan                                                               |
| [OpenCode Minimal Gate Subset](opencode-minimal-gate-subset.md)                             | Smallest rerun plan before cheaper starter-workflow experiments                                                           |
| [Render Telemetry Model](../design/render-telemetry-model.md)                               | Machine-readable per-turn render telemetry contract for bytes, timings, gates, fallbacks, recovery, and config gating     |
| [Benchmark Suite and Canonical Stack](benchmark-suite-and-canonical-stack.md)               | Fixed stack and 20-task benchmark contract for factory-style evals                                                        |
| [Premature-Stop Benchmark](experiments/premature-stop-benchmark.md)                         | Concrete A/B spec for `vanilla` versus `gated` completion reliability on small bounded tasks                              |
| [Context-Adaptive Benchmark Pack](context-adaptive-benchmark-pack.md)                       | Preparatory benchmark-pack contract for representative fixtures, baseline comparison, report artifacts, and evidence gaps |
| [Hook Runtime Overhead Measurement](hook-runtime-overhead-measurement.md)                   | Reproducible startup, state-I/O, render, and gate-overhead capture path                                                   |
| [Context-Adaptive Program Status](context-adaptive-program-status.md)                       | Short evidence-positioning summary of what the context-adaptive program can and cannot honestly claim today               |
| [Fresh vs Threaded Eval Suite](fresh-vs-threaded-eval-suite.md)                             | Planned eval slice for session-boundary comparisons                                                                       |
| [Swarm Equivalence and Rollout](swarm-equivalence-rollout.md)                               | QA and promotion bar for swarm parity versus hand-written flows                                                           |
| [Eval/Judge vNext Alignment](eval-judge-vnext-alignment.md)                                 | Maps imported vNext eval framing onto the current `5vsm` backlog                                                          |
| [Context-Adaptive Summary Safety Validation](context-adaptive-summary-safety-validation.md) | Bounded evidence note for large-output summary safety and current gaps                                                    |
| [Eval Artifact Bundles and Replay](eval-artifact-bundles-and-replay.md)                     | Defines run bundles, replay handles, baseline lineage, and annotations                                                    |
| [Regression Promotion Workflow](regression-promotion-workflow.md)                           | Defines the path from captured run failure to approved bank entry                                                         |
| [Self-Hosted Meta-Layer Pilot](self-hosted-meta-layer-pilot.md)                             | Bounded repo-local pilot for self-maintaining eval assets first                                                           |
| [Hypotheses v4](hypotheses-v4.md)                                                           | Research hypothesis set for later evaluation work                                                                         |
| [Context-Adaptive Results Template](context-adaptive-rendering-results-template.md)         | Draft results template for render-mode experiments                                                                        |
