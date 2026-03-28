# Gates

Gates are completion predicates in `done when:`. They are the runtime's external verification layer.

## Syntax

```yaml
done when:
  tests_pass
  lint_pass
  gate typecheck: npx tsc --noEmit
```

## Built-in gates

- `tests_pass`, `tests_fail`
- `lint_pass`, `lint_fail`
- `pytest_pass`, `pytest_fail`
- `go_test_pass`, `go_test_fail`
- `cargo_test_pass`, `cargo_test_fail`
- `diff_nonempty`
- `file_exists path`

## Composite gates

```yaml
done when: any(tests_pass, pytest_pass)
  all(lint_pass, diff_nonempty)
  2_of(tests_pass, lint_pass, diff_nonempty)
```

## Other supported forms

- `gate name: command`
- `tests_pass == true`
- `not tests_pass`

## Semantics

- Gates run real commands when Claude tries to finish.
- Variables do not satisfy gates by themselves.
- If any gate fails, completion is blocked.

## Related

- [Program Structure](program-structure.md)
- [Runtime Variables](runtime-variables.md)
