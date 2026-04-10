# E1 Repeated Failure

This suite is the first checked-in dataset bank for `E1` in the thesis roadmap: repeated failure elimination.

## Goal

Measure whether the gated candidate beats the vanilla candidate on failure patterns where the repo already has evidence that structure helps:

- gaslighting about code state
- narrow prompt framing against a broader verification target
- review-style prompts that invite commentary instead of repair

## Runnable bank

- Dataset: [`experiments/eval/datasets/e1-repeated-failures.jsonl`](../datasets/e1-repeated-failures.jsonl)

## Canonical workflow

Vanilla baseline:

```bash
npx @45ck/prompt-language eval \
  --dataset experiments/eval/datasets/e1-repeated-failures.jsonl \
  --candidate vanilla \
  --harness codex \
  --output experiments/results/e1-repeated-failure/v1/codex-vanilla.json
```

Gated comparison:

```bash
npx @45ck/prompt-language eval \
  --dataset experiments/eval/datasets/e1-repeated-failures.jsonl \
  --candidate gated \
  --harness codex \
  --baseline experiments/results/e1-repeated-failure/v1/codex-vanilla.json \
  --output experiments/results/e1-repeated-failure/v1/codex-gated.json
```

Hosted harnesses are the preferred baseline on this workstation. Do not install local models here just to run this suite.

The seeded E1 cases use `gate fixture_tests: node test.js` instead of builtin `tests_pass`, because these fixtures intentionally stay as plain JS directories without `package.json`.

## Current locked result

As of April 10, 2026, the locked Codex pair shows a narrow but real lift for the gated candidate on this suite:

- vanilla: `0/3`
- gated: `1/3`
- winning case: `e1.narrow-scope.v1`
- tied losses: `e1.gaslight-tests.v1`, `e1.review-only.v1`

Inspection path:

- [results summary](../../results/e1-repeated-failure/v1/README.md)
- [codex-vanilla.json](../../results/e1-repeated-failure/v1/codex-vanilla.json)
- [codex-gated.json](../../results/e1-repeated-failure/v1/codex-gated.json)

These artifacts were generated through the real headless Codex flow path with the workstation-safe default model `gpt-5.2`.

## Planned follow-on suites

- `E2`: `experiments/eval/datasets/e2-single-vs-multi-file.jsonl`
- `E3`: `experiments/eval/datasets/e3-wisdom-accumulation.jsonl`
- `E4`: `experiments/eval/datasets/e4-factory-starters.jsonl`
- `E5`: `experiments/eval/datasets/e5-parallel-specialists.jsonl`

Those paths are planned but not yet seeded with runnable cases.
