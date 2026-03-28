# `race` (WIP)

> **WIP: not implemented yet.** This page describes intended behavior, not current syntax.

## Goal

Support speculative execution where multiple approaches run in parallel and the first successful one wins.

## Proposed syntax

```text
race
  spawn "approach-a"
    prompt: Fix by refactoring the auth module.
    run: npm test
  end

  spawn "approach-b"
    prompt: Fix by adding input validation.
    run: npm test
  end
end
```

## Intended behavior

- children launch in parallel
- the first successful child wins
- losing children are cancelled or ignored
- winning variables are imported into the parent context
- the runtime exposes which child won

## Current workaround

Manually spawn children, await them, compare results, and decide which path to keep.
