# prompt

`prompt:` injects the next task for Claude.

## Syntax

```yaml
prompt: Fix the type errors in src/auth.ts
```

Select a context profile for one prompt turn:

```yaml
prompt using profile "reviewer": Inspect the diff for correctness issues.
```

## Semantics

- The text after `prompt:` becomes Claude's next instruction.
- `using profile "name"` merges the named profile on top of the flow default profile for this turn only.
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
