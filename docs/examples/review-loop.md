# Example: Review Loop

Use a generator-evaluator loop when the first draft is likely to be incomplete, but you want critique to stay tied to concrete evidence instead of vague preferences.

## Natural language

```
Draft a release note for the latest change. Then review it against the style guide and the actual diff. If the critique finds missing facts, unclear claims, or wording that is not supported by the diff, revise it and review again. Stop after a few rounds or once the review passes.
```

## DSL equivalent

```yaml
Goal: write a release note with grounded review

flow:
  review criteria: "Accurate, concise, and supported by the code changes" grounded-by "git diff -- docs src" max 3
    prompt: Draft a short release note for the current change. Use only facts you can support from the repository state. If critique is present, revise the draft to address it: ${_review_critique}
  end

done when:
  file_exists docs/release-note.md
```

## What happens

1. `review ... max 3` starts a bounded generator-evaluator loop.
2. Inside the block, the agent writes an initial draft from the prompt.
3. The `grounded-by` command supplies concrete evidence for evaluation. The review is anchored to repository state rather than free-floating opinion.
4. If the evaluator finds problems, its critique is injected into `_review_critique`.
5. On the next round, the same prompt runs again, now with critique available for revision.
6. The loop stops when the grounded review passes or the round limit is reached.

## Why grounded critique helps

Grounded critique is useful because it narrows the feedback to things that can be checked. Instead of "this feels weak" or "make it better," the evaluator can point to specific gaps such as unsupported claims, omitted changes, or wording that does not match the diff. That makes each revision more targeted and reduces the chance of the loop drifting into stylistic churn.

The pattern is especially useful for artifacts like summaries, release notes, migration guidance, and explanations where quality depends on staying faithful to source material while still improving clarity.

## Variation: review a plan against test output

```yaml
flow:
  review criteria: "Plan addresses the real failing tests and proposes concrete fixes" grounded-by "npm test" max 2
    prompt: Write a repair plan for the failing tests. If critique exists, revise the plan to address it: ${_review_critique}
  end

done when:
  tests_pass
```

Here the critique is grounded by live test output rather than a diff. The loop still works the same way, but the evidence source changes.
