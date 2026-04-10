# Write-Flow Advanced Guidance

This file is intentionally optional. Start with the minimal pattern in `SKILL.md`; only use these when the task needs them.

## Try/Catch

Use `try` only when you need explicit fallback behavior that differs from normal retry guidance.

## Branching (`if`/`else`)

Branching is appropriate when conditions genuinely change required actions, not when expressing preference.

## Variable Capture

Capture values when they:

- must survive multiple steps,
- are needed by several branches, or
- feed a `foreach` loop.

## While/Until

Use for true state-based repetition when a static retry budget is not enough. Add explicit loop limits to prevent runaway execution.

## Foreach

Use for repeatable batch edits where each iteration is logically identical and verifiable.

## Spawn/Await

Use only when work is independent and concurrency meaningfully reduces wall-clock time. Avoid for tightly coupled edits.
