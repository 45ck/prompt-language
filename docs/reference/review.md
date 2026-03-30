# review

`review` runs a generator-evaluator loop. The body runs once per round; if the evaluator judges it unsatisfactory, it re-runs with critique injected.

## Syntax

Basic:

```yaml
review max 3
  prompt: Write the implementation
  run: npm test
end
```

With criteria:

```yaml
review criteria: "Code must be clean and well-tested" max 5
  prompt: Implement the feature
end
```

Grounded by a command:

```yaml
review grounded-by "npm test" max 3
  prompt: Fix any test failures
end
```

Criteria and grounded together:

```yaml
review criteria: "All edge cases handled" grounded-by "npm test" max 3
  prompt: Implement and test the feature
end
```

## Semantics

- The body runs once per round.
- If `grounded-by` is specified and its command exits 0, the review passes and execution continues.
- If `grounded-by` exits non-zero, critique is generated and injected as `_review_critique`.
- `criteria` text is included in the evaluator prompt.
- If no `grounded-by` is specified, an AI evaluator judges the output.
- Default `max` is 3. When rounds are exhausted, execution continues past the block.

## Auto-set variables

- `_review_critique` — critique text from the last evaluator round

## Related

- [retry](retry.md)
- [while](while.md)
