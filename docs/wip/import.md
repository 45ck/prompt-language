# `import` (WIP)

> **WIP: not implemented yet.** This page describes intended behavior, not current syntax.

## Goal

Allow teams to compose larger workflows from reusable local files and named libraries instead of copy-pasting shared setup and verification steps.

## Proposed syntax

```text
Goal: implement the feature safely

import "./flows/setup.flow"
import "./libraries/testing.flow" as testing

flow:
  prompt: Implement the feature.
  use testing.fix_and_test(test_cmd = "npm test -- auth")

done when:
  use testing.node_ci()
```

## Intended behavior

- `import` is resolved at parse time before execution begins
- relative file imports inline shared flow content into the parent program
- namespaced imports expose exported definitions for `use`
- local relative paths are supported first; package-style imports can build on the same model later
- cycle detection prevents import loops
- missing files and missing exported symbols are lint errors, not runtime surprises
- imported nodes receive unique internal IDs in the expanded program

## Design direction

- top-level `import` is preferred over a flow-local statement because imported definitions may be used from both `flow:` and `done when:`
- local anonymous imports cover simple composition
- namespaced imports cover reusable exported assets such as `flow`, `gates`, and `prompt` definitions
- `import` remains declarative expansion, not runtime code loading

For exported reusable assets, see [Prompt Libraries](prompt-libraries.md).

## Current workaround

Duplicate shared steps by copy-paste or wrap them in Claude Code skills.
