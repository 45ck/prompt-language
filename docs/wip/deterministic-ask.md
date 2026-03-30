# Deterministic `ask` (WIP)

> **Status: shipped.** See [if](../reference/if.md) in the Language Reference for `grounded-by` behavior.

## Goal

When `ask` has a `grounded-by` command, use that command's exit code directly instead of asking Claude for a yes or no judgment.

## Current syntax

```text
until ask "are all tests passing?" grounded-by "npm test" max 5
  prompt: Fix the failing tests.
end
```

## Intended behavior

- if `grounded-by` is present, exit code `0` means true
- non-zero exit codes mean false
- no separate judge prompt is emitted in that case
- pure `ask` without `grounded-by` still uses Claude judgment

## Current behavior

Today, even `grounded-by` still goes through an AI-mediated verdict.
