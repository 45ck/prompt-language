# foreach-spawn

`foreach-spawn` fans out over a list by launching one spawn child per item, all running in parallel.

## Syntax

From a variable:

```yaml
foreach-spawn file in ${files} max 20
  prompt: Review ${file} for security issues
  run: echo "reviewed ${file}"
end
```

From a command:

```yaml
foreach-spawn item in run "git diff --name-only HEAD~1" max 10
  prompt: Fix issues in ${item}
  run: npm test -- ${item}
end
```

## Semantics

- The list is split using the same rules as `foreach`: JSON arrays, newline-delimited, or whitespace-delimited.
- One spawn child is launched per item; all children start immediately in parallel.
- Each child receives the loop variable (e.g., `file` or `item`) in its variable scope.
- `max N` caps how many items are processed. Default is 50.
- Use `await all` after `foreach-spawn` to block until all children finish.

## Example

```yaml
let files = run "find src -name '*.ts'"
foreach-spawn file in ${files} max 30
  prompt: Add JSDoc comments to ${file}
  run: npx tsc --noEmit
end
await all
```

## Related

- [foreach](foreach.md)
- [spawn](spawn.md)
- [await](await.md)
