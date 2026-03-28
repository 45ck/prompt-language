# retry

`retry` reruns a block when the last command in that block failed.

## Syntax

```yaml
retry max 3
  run: npm run build
  if command_failed
    prompt: Fix the build errors.
  end
end
```

## Semantics

- `retry max 3` means 3 total attempts.
- The block always runs once.
- Re-entry is driven by `command_failed`.
- If attempts are exhausted, execution continues past the block.

## Related

- [run](run.md)
- [while](while.md)
- [until](until.md)
