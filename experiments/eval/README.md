# Shared Eval Bank

This directory is the checked-in home for reusable evaluation datasets and human-facing suite notes.

## Layout

```text
experiments/eval/
  README.md
  context-adaptive-benchmark-pack/
    README.md
    fixtures.json
    baseline-renderer-report.json
  datasets/
    README.md
    e1-repeated-failures.jsonl
  e1-repeated-failure/
    README.md
experiments/results/
  e1-repeated-failure/
    v1/
      README.md
      codex-vanilla.json
      codex-gated.json
```

## Candidate semantics

- `vanilla`: run the prompt or flow exactly as checked in.
- `gated`: for prompt datasets, wrap the prompt as a one-step prompt-language flow and append the dataset's `gates` as `done when:` checks before execution.

This lets one JSONL suite compare an ungated prompt baseline against a prompt-language candidate without inventing a second dataset format.

The seeded E1 suite uses a custom gate line (`gate fixture_tests: node test.js`) because its shared JS fixtures are plain files, not npm packages.

## Seeded suite

| Suite                                                                        | Status | Purpose                                                         | Locked evidence                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------- | ------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`datasets/e1-repeated-failures.jsonl`](datasets/e1-repeated-failures.jsonl) | Seeded | Repeated failure elimination starter for E1 and v1 runner smoke | [`../results/e1-repeated-failure/v1/codex-vanilla.json`](../results/e1-repeated-failure/v1/codex-vanilla.json), [`../results/e1-repeated-failure/v1/codex-gated.json`](../results/e1-repeated-failure/v1/codex-gated.json) |

## Seeded benchmark-pack references

| Pack                                                                            | Status | Purpose                                                                         | Seed artifact                                                                                                                    |
| ------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [`context-adaptive-benchmark-pack/`](context-adaptive-benchmark-pack/README.md) | Seeded | Minimal baseline pack for render-cost and recovery-sensitive context adaptation | [`context-adaptive-benchmark-pack/baseline-renderer-report.json`](context-adaptive-benchmark-pack/baseline-renderer-report.json) |

This benchmark-pack seed is intentionally smaller than the runner-backed datasets
above. It locks the fixture categories and current-renderer reference artifact
for later context-adaptive comparison beads without claiming that compact-mode
candidate reports already exist.

The seeded E1 suite reuses the durable JS bug fixtures already maintained under `scripts/eval/fixtures/`.

## Thesis dataset map

These are the concrete paths the thesis roadmap should grow into.

| Experiment                           | Dataset path                                              | Status  | Notes                                                                                               |
| ------------------------------------ | --------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| E1 repeated failure elimination      | `experiments/eval/datasets/e1-repeated-failures.jsonl`    | Seeded  | Uses existing prompt bug fixtures now.                                                              |
| E2 single-file vs multi-file         | `experiments/eval/datasets/e2-single-vs-multi-file.jsonl` | Planned | Will need paired flow fixtures rather than prompt-only bug prompts.                                 |
| E3 wisdom accumulation               | `experiments/eval/datasets/e3-wisdom-accumulation.jsonl`  | Planned | Should promote recurring scope and edge-case failures into with/without wisdom runs.                |
| E4 prompt-language-first factory     | `experiments/eval/datasets/e4-factory-starters.jsonl`     | Planned | Should point at the bounded CRM and helpdesk starter surfaces once their runner contract is stable. |
| E5 parallel specialist orchestration | `experiments/eval/datasets/e5-parallel-specialists.jsonl` | Planned | Should compare sequential vs coordinated specialist flows over the same bounded task set.           |

## Commands

Generate a locked baseline report with the current harness:

```bash
node bin/cli.mjs eval \
  --harness codex \
  --dataset experiments/eval/datasets/e1-repeated-failures.jsonl \
  --candidate vanilla \
  --output experiments/results/e1-repeated-failure/v1/codex-vanilla.json
```

Run the prompt-language candidate and compare it to that baseline:

```bash
node bin/cli.mjs eval \
  --harness codex \
  --dataset experiments/eval/datasets/e1-repeated-failures.jsonl \
  --candidate gated \
  --baseline experiments/results/e1-repeated-failure/v1/codex-vanilla.json \
  --output experiments/results/e1-repeated-failure/v1/codex-gated.json
```

On this workstation, prefer hosted harnesses such as Codex or the documented [OpenCode baseline](../../docs/evaluation/opencode-gemma-plan.md). Do not install local models here just to populate eval artifacts.

## Promotion rules

When a new failure class is worth keeping:

1. Add or harden the fixture under `scripts/eval/fixtures/` if that is still the shared source of truth.
2. Add a JSONL case under the appropriate suite in `experiments/eval/datasets/`.
3. Regenerate the locked baseline under `experiments/results/`.
4. Record the result comparison under `experiments/results/`.

This keeps datasets, suite notes, and locked run outputs separate instead of mixing them into one folder.
