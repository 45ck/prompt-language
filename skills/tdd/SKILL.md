---
name: tdd
description: Test-driven development. Write a failing test, implement until green, refactor. Single retry loop with test gate.
argument-hint: '<feature or requirement>'
---

# Test-Driven Development

Implement the requested feature using strict TDD: red, green, refactor.

## What to do

1. Read the user's feature description from the argument.
2. Write a failing test that captures the expected behavior. Run it to confirm it fails (red).
3. Write the minimum code to make the test pass. If tests fail, iterate (green).
4. Once green, refactor for clarity while keeping tests green.

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

- Always write the test BEFORE the implementation.
- The test must fail before you write implementation code. If it passes immediately, the test is not testing the new behavior.
- Write the minimum code to pass. Do not over-engineer.
- Once green, refactor for clarity. Do not add new behavior during refactor.
