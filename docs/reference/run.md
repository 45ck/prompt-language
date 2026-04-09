# run

`run:` executes a shell command and captures its result.

## Syntax

```yaml
run: npm test
run: npm run build [timeout 120]
run: npm run build timeout 120
```

## Semantics

- The command runs in the current workspace.
- A non-zero exit code marks the command as failed.
- Optional `timeout N` is in seconds. The bracket form `[timeout N]` is also accepted.
- Timeout kills the full command tree. On Windows, the runtime falls back to `taskkill /F /T`.
- Timed-out commands set `last_stderr` to `timed out after Ns` and are recorded in `audit.jsonl`.
- After each `run:`, runtime variables are updated.

## Runtime variables set by `run:`

- `last_exit_code`
- `command_failed`
- `command_succeeded`
- `last_stdout`
- `last_stderr`

## Example

```yaml
run: npm test
if command_failed
  prompt: Fix the failing tests shown above.
end
```

## Related

- [Runtime Variables](runtime-variables.md)
- [if](if.md)
- [retry](retry.md)
