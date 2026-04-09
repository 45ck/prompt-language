# `review` (WIP)

> **Status: shipped.** See [review](../../reference/review.md) in the Language Reference.

## Goal

Add a first-class generator-evaluator loop for critique-driven refinement.

## Proposed syntax

```text
flow:
  retry max 5
    prompt: Implement feature X.
    review
      criteria: "Has tests? Handles errors? Clean code?"
      grounded-by: npm test
    end
  end
```

## Intended behavior

- the runtime launches a skeptical evaluator step or child
- the evaluator checks output against explicit criteria
- critique is fed back into the next generator iteration
- approval can break the surrounding retry or review loop
- objective evidence from `grounded-by` becomes part of the review

## Current workaround

Write the debate loop explicitly with `retry`, `spawn`, `await`, `let`, and follow-up prompts.
