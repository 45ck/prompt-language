# `import` (WIP)

> **WIP: not implemented yet.** This page describes intended behavior, not current syntax.

## Goal

Allow teams to compose larger workflows from reusable sub-flow files instead of copy-pasting shared setup and verification steps.

## Proposed syntax

```text
flow:
  import "flows/setup.flow"
  prompt: Implement the feature.
  import "flows/verify.flow"
```

## Intended behavior

- `import` is resolved at parse time
- imported nodes are inlined into the parent flow
- relative paths only
- cycle detection prevents import loops
- missing files are lint errors, not runtime surprises
- imported nodes receive unique internal IDs

## Current workaround

Duplicate shared steps by copy-paste or wrap them in Claude Code skills.
