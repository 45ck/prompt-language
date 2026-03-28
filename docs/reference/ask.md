# ask

`ask` lets Claude evaluate a true/false condition when the answer is subjective.

## Syntax

```yaml
if ask "is this a security vulnerability?"
  prompt: Fix the vulnerability.
end
```

```yaml
while ask "does the code still have performance issues?" max 5
  prompt: Optimize the hottest code path.
end
```

With grounding:

```yaml
while ask "are there still failing tests?" grounded-by "npm test" max 5
  prompt: Fix the failing tests.
end
```

## Where it works

- `if ask "..."`
- `while ask "..."`
- `until ask "..."`

## Semantics

- `ask` uses a two-turn capture mechanism similar to `let x = prompt`.
- Claude answers `true` or `false`.
- `grounded-by` includes command output as evidence for the judgment.
- `ask` is slower than deterministic conditions because it needs an extra turn.

## Use it when

- The exit condition is subjective.
- No shell command can prove the condition directly.

## Related

- [if](if.md)
- [while](while.md)
- [until](until.md)
- [let / var](let-var.md)
