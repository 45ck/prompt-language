# await

`await` blocks until one or more spawned children complete.

## Syntax

```yaml
await all
await "frontend"
```

## Semantics

- `await all` waits for every known child.
- `await "name"` waits for one child only.
- After `await`, child variables are imported with a `{child-name}.` prefix.

## Example

```yaml
await "frontend"
prompt: Frontend exit code was ${frontend.last_exit_code}.
```

## Notes

- Failed children do not throw automatically in the parent.
- Check imported child variables such as `${frontend.command_failed}` explicitly.

## Related

- [spawn](spawn.md)
- [Runtime Variables](runtime-variables.md)
