---
name: tdd
description: Test-driven development. Write a failing test first, then implement the minimum code to make it pass.
argument-hint: '<feature or requirement>'
---

# Test-Driven Development

Implement the requested feature using strict TDD: red, green, refactor.

## What to do

1. Read the user's feature description from the argument.
2. Write a failing test that captures the expected behavior. Run it to confirm it fails.
3. Write the minimum code to make the test pass. Run the tests to confirm.
4. If tests fail, fix the implementation and re-run. Retry up to 5 times.
5. Once green, refactor the implementation for clarity while keeping tests green.
6. Run the final test suite to confirm nothing is broken.

## Flow

```
flow:
  prompt: Write a failing test for the requested feature. Run it to confirm it fails (red phase).
  run: npm test
  retry max 5
    prompt: Write the minimum implementation to make the failing test pass (green phase).
    run: npm test
  end
  prompt: Refactor the implementation for clarity. Keep all tests passing (refactor phase).
  run: npm test

done when:
  tests_pass
  lint_pass
```

## Rules

- Always write the test BEFORE the implementation.
- The test must fail before you write implementation code. If it passes immediately, the test is not testing the new behavior.
- Write the minimum code to pass. Do not over-engineer.
- During refactor, do not add new behavior. Only improve structure.
