# if

`if` branches execution based on a condition.

## Syntax

```yaml
if tests_fail
  prompt: Fix the tests.
else if lint_fail
  prompt: Fix the lint errors.
else
  prompt: Everything passed.
end
```

`elif` is an alias for `else if`.

## Conditions

`if` conditions can use:

- runtime variables such as `command_failed`
- built-in predicates such as `tests_fail`
- comparisons such as `${count} > 0`
- boolean operators `not`, `and`, `or`
- [ask](ask.md) conditions for subjective evaluation

## Semantics

- The first true branch is taken.
- `else` is optional.
- Flow conditions prefer runtime variables when available.

## Related

- [ask](ask.md)
- [while](while.md)
- [until](until.md)
