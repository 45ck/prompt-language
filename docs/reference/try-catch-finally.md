# try / catch / finally

Use `try` blocks to recover from failures and optionally run cleanup code.

## Syntax

```yaml
try
  run: npm run deploy
catch command_failed
  prompt: Deploy failed. Investigate the error.
finally
  run: cleanup.sh
end
```

## Semantics

- The `try` body always runs.
- `catch` runs if its condition is true after the body.
- `finally` always runs after the body and catch path.
- Default catch condition is `command_failed`.

## Related

- [run](run.md)
- [if](if.md)
- [retry](retry.md)
