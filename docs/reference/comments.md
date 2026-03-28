# Comments

prompt-language supports inline comments with `#`.

## Syntax

```yaml
flow:
  run: npm test # run the suite first
```

## Semantics

- Everything after `#` on a line is stripped before parsing.
- Comments are ignored by the runtime.

## Related

- [Program Structure](program-structure.md)
