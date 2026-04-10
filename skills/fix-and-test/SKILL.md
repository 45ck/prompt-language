---
name: fix-and-test
description: "This skill should be used when the user asks to 'fix the tests', 'make tests pass', 'tests are failing', 'fix and test', 'green the tests', or wants to iteratively fix failing tests until they pass."
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
model: inherit
argument-hint: '[test command or pattern]'
---

# Fix and Test

Run a fix-test loop: identify failing tests, fix them, re-run tests, repeat until green.

Use this when the codebase is already in a failing state and the goal is recovery.
Do not use this for greenfield feature delivery (use `tdd`) or structural cleanup of already-green code (use `refactor`).

## What to do

1. If the user provided an argument, use it as the test command (for example `npm test -- auth`). Otherwise use `npm test`.
2. Run the command and triage existing failures.
3. Fix production code first; only edit tests when they are demonstrably wrong.
4. Re-run the same command and iterate until green (max 5 passes).
5. Once scoped tests are green, run full `npm test` before declaring done.

## Flow

```
flow:
  retry max 5
    run: npm test
    if command_failed
      prompt: Analyze the test failures above and fix the underlying code. Do not modify tests unless they are genuinely wrong.
    end
  end

done when:
  tests_pass
```

## Rules

- Focus on fixing the source code, not the tests, unless the tests themselves are incorrect.
- During active triage you may run a scoped test command, but finish with the full suite.
- If you cannot fix a test after 5 attempts, explain what you tried and why it's failing.

## Examples

For ecosystem-specific command patterns, see `examples/multi-ecosystem.md`.
