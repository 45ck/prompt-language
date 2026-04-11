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

| Doc                                                           | Focus                                                                  |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [What Works Now](what-works-now.md)                           | Short public summary of the strongest proven surfaces and caveats      |
| [Eval Test Matrix](eval-test-matrix.md)                       | Automated coverage expectations for parser, runtime, datasets, and CLI |
| [Eval Analysis](eval-analysis.md)                             | Comparative A/B results, latency analysis, and differentiator taxonomy |
| [Codex Parity Matrix](eval-parity-matrix.md)                  | Current parity bar for tests, CI, smoke, and supported-host limits     |
| [Codex Parity Delta Analysis](codex-parity-delta-analysis.md) | Current delta classification versus the Claude-oriented baseline       |
| [Live Validation Evidence](eval-live-validation-evidence.md)  | Required smoke evidence format and blocked-host classification         |
| [Smoke Coverage Status](test-design-smoke-gaps.md)            | Current smoke coverage, quick-suite evidence, and remaining gaps       |

## Research continuation

| Doc                                                                                 | Focus                                                               |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [Dataset Bank](dataset-bank.md)                                                     | Seeded JSONL suites, baseline workflow, and thesis dataset path map |
| [OpenCode Gemma 4 Plan](opencode-gemma-plan.md)                                     | Hosted OpenCode baseline plus bounded Gemma comparison plan         |
| [OpenCode Minimal Gate Subset](opencode-minimal-gate-subset.md)                     | Smallest rerun plan before cheaper starter-workflow experiments     |
| [Fresh vs Threaded Eval Suite](fresh-vs-threaded-eval-suite.md)                     | Planned eval slice for session-boundary comparisons                 |
| [Eval/Judge vNext Alignment](eval-judge-vnext-alignment.md)                         | Maps imported vNext eval framing onto the current `5vsm` backlog    |
| [Hypotheses v4](hypotheses-v4.md)                                                   | Research hypothesis set for later evaluation work                   |
| [Context-Adaptive Results Template](context-adaptive-rendering-results-template.md) | Draft results template for render-mode experiments                  |
