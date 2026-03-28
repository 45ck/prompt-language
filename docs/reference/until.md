# until

`until` repeats a block until a condition becomes true.

## Syntax

```yaml
until tests_pass max 5
  prompt: Fix the failing tests.
  run: npm test
end
```

## Semantics

- The condition is checked before entering the body and after each iteration.
- If the condition is already true, the body is skipped.
- `max N` limits the number of iterations.

## Related

- [while](while.md)
- [retry](retry.md)
- [ask](ask.md)
