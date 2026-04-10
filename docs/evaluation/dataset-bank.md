# Evaluation Dataset Bank

The v1 evaluation runner is now backed by a checked-in JSONL dataset bank under [experiments/eval](../../experiments/eval/README.md).

## What is seeded now

| Suite                                                                        | Purpose                                                                                       | Source fixtures                                 |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [E1 repeated failures](../../experiments/eval/e1-repeated-failure/README.md) | First reusable runner suite for repeated failure elimination and gated-vs-vanilla comparisons | `gaslight-tests`, `narrow-scope`, `review-only` |

The seeded suite is intentionally small. It proves the runner/report path against durable repo fixtures before the thesis bank expands into broader flow and product surfaces.

The current E1 cases use a fixture-local custom gate (`gate fixture_tests: node test.js`) rather than builtin `tests_pass`, because these legacy JS fixtures are plain `app.js` + `test.js` directories without `package.json`. The dataset-side contract is documented in [experiments/eval/datasets/README.md](../../experiments/eval/datasets/README.md).

## Seeded evidence

The first locked artifacts for the seeded suite are now checked in:

- [`codex-vanilla.json`](../../experiments/results/e1-repeated-failure/v1/codex-vanilla.json)
- [`codex-gated.json`](../../experiments/results/e1-repeated-failure/v1/codex-gated.json)

Both were regenerated on April 10, 2026 through the Codex harness path on this workstation against the same three-case E1 starter suite.

Current signal from the locked pair:

- vanilla: `0/3`
- gated: `1/3`
- winner: gated, by one case (`e1.narrow-scope.v1`)

## What the runner does

`prompt-language eval` currently owns the tooling layer promised by the v1 boundary:

- checked-in dataset execution
- repeated runs
- machine-readable reports
- baseline comparison against a locked report

This is runner/tooling functionality, not new ordinary flow control.

For prompt datasets, the `gated` candidate is executed as a generated one-step flow so the listed `gates` run as actual prompt-language completion checks rather than as plain prompt text.

## CLI shape

```bash
node bin/cli.mjs eval \
  --harness codex \
  --dataset experiments/eval/datasets/e1-repeated-failures.jsonl \
  --candidate gated \
  --baseline experiments/results/e1-repeated-failure/v1/codex-vanilla.json \
  --output experiments/results/e1-repeated-failure/v1/codex-gated.json
```

## Thesis dataset map

The bank now has one seeded suite and a concrete path plan for the remaining thesis tracks:

- `experiments/eval/datasets/e1-repeated-failures.jsonl` — seeded
- `experiments/eval/datasets/e2-single-vs-multi-file.jsonl` — planned
- `experiments/eval/datasets/e3-wisdom-accumulation.jsonl` — planned
- `experiments/eval/datasets/e4-factory-starters.jsonl` — planned
- `experiments/eval/datasets/e5-parallel-specialists.jsonl` — planned

Those planned paths are documented so the backlog can point at concrete future suite names instead of vague “add datasets later” language.

## Baseline rule

Locked baselines and notable comparison reports should be stored under `experiments/results/`, not under `scripts/eval/results/`.

Locked baselines should be generated with a supported hosted harness on this workstation. For Codex-backed runs here, prefer the checked-in `gpt-5.2` default unless a result explicitly records another model. Do not install local models here just to populate the dataset bank.
