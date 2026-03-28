# prompt

`prompt:` injects the next task for Claude.

## Syntax

```yaml
prompt: Fix the type errors in src/auth.ts
```

## Semantics

- The text after `prompt:` becomes Claude's next instruction.
- Variables can be interpolated into the text with `${name}`.
- `prompt:` itself does not run shell commands.

## Example

```yaml
let module = "auth"
prompt: Refactor the ${module} module for clarity.
```

## Related

- [let / var](let-var.md)
- [if](if.md)
- [run](run.md)
