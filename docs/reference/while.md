# while

`while` repeats a block while a condition stays true.

## Syntax

```yaml
while tests_fail max 5
  prompt: Fix the failing tests.
  run: npm test
end
```

Negation:

```yaml
while not tests_pass max 5
  prompt: Keep fixing the tests.
end
```

## Semantics

- The condition is checked before each iteration.
- `max N` limits the number of iterations.
- If the condition is false at the start, the body is skipped.

## Related

- [until](until.md)
- [retry](retry.md)
- [ask](ask.md)
