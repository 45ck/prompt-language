---
name: tdd
description: "This skill should be used when the user asks to 'do TDD', 'test-driven development', 'red green refactor', 'write a failing test first', or wants to implement a feature using test-driven development."
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
model: inherit
argument-hint: '<feature or requirement>'
---

# Test-Driven Development

Implement the requested feature using strict TDD: red, green, refactor.

Use this when adding or changing behavior.
Do not use this to recover an already failing test suite (use `fix-and-test`) or to perform behavior-preserving cleanup only (use `refactor`).

## What to do

1. Read the feature requirement from the argument.
2. Add or update one test that expresses the next behavior slice.
3. Run the targeted test and confirm it fails first (red).
4. Implement the smallest change to pass that test (green).
5. Refactor with all tests still green before starting the next slice.

## Flow

```
flow:
  retry max 5
    run: npm test
    if command_failed
      prompt: Read the test failures. If no test exists yet for the feature, write one (red phase). Otherwise fix the implementation to make it pass (green phase). Only write minimum code needed.
    end
  end

done when:
  tests_pass
  lint_pass
```

## Rules

- Always create the failing test before implementation for new behavior.
- The test must fail before you write implementation code. If it passes immediately, the test is not testing the new behavior.
- Write the minimum code to pass. Do not over-engineer.
- Once green, refactor for clarity. Do not add new behavior during refactor.

## Examples

For language-specific TDD loop command examples, see `examples/multi-ecosystem.md`.
