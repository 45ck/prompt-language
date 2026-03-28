# Program Structure

Every prompt-language program is made from a small set of top-level sections.

## Sections

| Section      | Purpose                                     | Required |
| ------------ | ------------------------------------------- | -------- |
| `Goal:`      | Human-readable task description             | No       |
| `env:`       | Environment variables for command execution | No       |
| `flow:`      | Ordered runtime steps                       | No       |
| `done when:` | Completion criteria                         | No       |

All sections are independent. A valid program can use only `done when:` or only `flow:` or both.

## Syntax

```yaml
Goal: fix the auth module safely

env:
  NODE_ENV=production
  API_BASE=https://api.example.com

flow:
  run: npm test
  if command_failed
    prompt: Fix the failing tests.
  end

done when:
  tests_pass
  lint_pass
```

## Semantics

- `Goal:` is descriptive only. It does not drive execution directly.
- `env:` injects key-value pairs into command and gate execution.
- `flow:` contains the executable steps.
- `done when:` contains predicates that must pass before the runtime allows completion.

## Notes

- `env:` values are strings.
- `done when:` works without `flow:`.
- `flow:` works without `done when:`, but then nothing externally enforces success.

## Related

- [Gates](gates.md)
- [run](run.md)
- [Defaults and Limits](defaults-and-limits.md)
