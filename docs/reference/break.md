# break

`break` exits the nearest enclosing loop.

## Syntax

```yaml
break
```

Labeled form:

```yaml
break outer
```

## Works inside

- `while`
- `until`
- `retry`
- `foreach`

## Semantics

- Execution resumes after the loop's `end`.
- Outside a loop, `break` is a lint warning and has no effect.

## Related

- [continue](continue.md)
- [while](while.md)
- [foreach](foreach.md)
