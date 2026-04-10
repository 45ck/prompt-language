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

Strict fail-closed review:

```yaml
review strict max 3
  prompt: Improve the implementation
  run: npm test
end
```

Named judge reuse:

```yaml
review strict using judge "impl_quality" max 3
  prompt: Improve the implementation
  run: npm test
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
- If `using judge "name"` is specified, the named judge is executed through JSON capture and its verdict is stored in `_review_result.*`.
- Named review judges currently support `kind: model` in runtime v1. Other judge kinds abstain until runner-side support lands.
- If no `grounded-by` and no named judge are specified, review keeps the backward-compatible permissive evaluator behavior.
- Default `max` is 3. When rounds are exhausted, execution continues past the block.
- `review strict` changes the exhaustion behavior: if no passing verdict is reached by `max`, the flow fails closed.

## Auto-set variables

- `_review_critique` — critique text from the last evaluator round
- `_review_result` — JSON-serialized v1 judge-result envelope
- `_review_result.pass` / `.confidence` / `.reason` / `.evidence` / `.evidence_length` / `.abstain`
- `_review_result.judge` — named judge used for the current review round, when applicable

## Related

- [retry](retry.md)
- [while](while.md)
