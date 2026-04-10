---
name: refactor
description: "This skill should be used when the user asks to 'refactor this', 'clean up this code', 'make this cleaner', 'safe refactor', 'restructure this', or wants to refactor code with continuous test verification."
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
model: inherit
argument-hint: '<file or module to refactor>'
---

# Safe Refactor

Refactor the target code incrementally, verifying tests pass after each change.

Use this when the intended behavior should stay the same and the goal is maintainability.
Do not use this for feature work that requires new failing tests (use `tdd`) or for already-broken suites where the primary goal is recovery (use `fix-and-test`).

## What to do

1. Read the target file/module and identify concrete smells.
2. Establish a green baseline with tests before changing structure.
3. Apply one behavior-preserving refactor at a time.
4. Run tests after each step; if they fail, stop and fix before proceeding.
5. Repeat up to 5 focused refactor passes.

## Flow

```
flow:
  retry max 5
    prompt: Apply one behavior-preserving refactor to the target code. Make one focused structural change only.
    run: npm test
  end

done when:
  tests_pass
  lint_pass
```

## Rules

- Never refactor and change behavior at the same time.
- Run tests after every change, no matter how small.
- If a refactoring breaks tests, revert it or fix the breakage before continuing.
- Prefer small, incremental changes over large rewrites.

## Examples

For refactor loops across JavaScript, Python, Go, and Rust projects, see `examples/multi-ecosystem.md`.
