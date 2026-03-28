# Conditional Spawn (WIP)

> **WIP: not implemented yet.** This page describes intended behavior, not current syntax.

## Goal

Make parallel flows less verbose when only some branches are needed.

## Proposed syntax

```text
spawn "fix-lint" if lint_fail
  prompt: Fix the lint errors.
end

spawn "fix-tests" if tests_fail
  prompt: Fix the failing tests.
end

await all
```

## Intended behavior

- the inline condition uses the same evaluation rules as `if`
- false conditions skip child launch entirely
- true conditions launch a normal child flow
- `await all` only waits on children that were actually started

## Current workaround

Wrap each spawn in its own `if` block.
