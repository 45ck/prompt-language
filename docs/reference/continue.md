# continue

`continue` skips the rest of the current loop iteration.

## Syntax

```yaml
continue
```

Labeled form:

```yaml
continue outer
```

## Works inside

- `while`
- `until`
- `retry`
- `foreach`

## Semantics

- Remaining statements in the current iteration are skipped.
- Outside a loop, `continue` is a lint warning and has no effect.

## Related

- [break](break.md)
- [foreach](foreach.md)
- [while](while.md)
