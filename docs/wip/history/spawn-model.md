# Spawn Model Selection (WIP)

> **Status: shipped.** See [spawn](../../reference/spawn.md) in the Language Reference.

## Goal

Let different child flows run on different Claude models to balance cost, speed, and capability.

## Proposed syntax

```text
spawn "list-files" model "haiku"
  let files = prompt "List the test files."
end

spawn "fix-auth" model "sonnet"
  prompt: Fix the authentication bug.
end
```

## Intended behavior

- `model` is optional on `spawn`
- the child process receives the chosen model explicitly
- invalid model names fail clearly at spawn time
- spawns without a model inherit the current default configuration

## Current workaround

All children inherit the same model configuration as the parent run.
