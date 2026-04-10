# Evals and Judges V1

This page documents the shipped v1 evaluation surface. It is narrower than the broader future-facing design work in [WIP Evals and Judges](../wip/tooling/evals-and-judges.md).

## What ships today

The shipped v1 surface includes:

- top-level `rubric "name"` declarations
- top-level `judge "name"` declarations
- `review strict using judge "name" max N`
- typed `_review_result.*` verdict capture
- the CLI `prompt-language eval` runner for checked-in JSONL datasets

## Declaration syntax

`rubric` and `judge` declarations live at the top level of a flow, before executable nodes:

```text
rubric "bugfix_quality"
  criterion correctness type boolean
end

judge "impl_quality"
  kind: model
  rubric: "bugfix_quality"
  inputs: [diff, test_output, output]
end

flow:
  review strict using judge "impl_quality" max 3
    prompt: Improve the implementation.
    run: npm test
  end
```

## Runtime semantics

- Named judges are currently a review-time runtime feature, not a general-purpose control-flow primitive.
- `review strict using judge "name"` runs the named judge through JSON capture and stores the verdict in `_review_result.*`.
- Named review judges currently support `kind: model` in runtime v1.
- Other judge kinds may parse, but they do not currently have equivalent runtime support in `review`.
- `review strict` fails closed when the maximum round count is exhausted without a passing verdict.

## CLI eval runner

The shipped `eval` surface is a CLI command, not a new DSL block:

```bash
npx @45ck/prompt-language eval --dataset experiments/eval/datasets/e1-repeated-failures.jsonl
```

Use it to:

- run checked-in JSONL datasets
- repeat cases and collect machine-readable reports
- compare candidate runs against locked baseline reports

For command details, see the [CLI Reference](cli-reference.md). For dataset layout and report evidence, see [Dataset Bank](../evaluation/dataset-bank.md).

## Not shipped in v1

These ideas remain future-facing and belong in WIP docs rather than the shipped contract:

- standalone `eval { ... }` DSL blocks
- judge references inside `done when:`
- `if judge ...` or `while judge ...` control-flow shortcuts
- replay, annotation, or calibration DSL keywords
- broad judge-kind runtime support beyond the current v1 review integration

## Related

- [review](review.md)
- [CLI Reference](cli-reference.md)
- [Dataset Bank](../evaluation/dataset-bank.md)
- [WIP Evals and Judges](../wip/tooling/evals-and-judges.md)
