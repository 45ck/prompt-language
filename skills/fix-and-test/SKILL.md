---
name: fix-and-test
description: "This skill should be used when the user asks to 'fix the tests', 'make tests pass', 'tests are failing', 'fix and test', 'green the tests', or wants to iteratively fix failing tests until they pass."
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
model: inherit
argument-hint: '[test command or pattern]'
---

# Fix and Test

Run a fix-test loop: identify failing tests, fix them, re-run tests, repeat until green.

## What to do

1. If the user provided an argument, use it as the test command (e.g., `npm test -- auth`). Otherwise use `npm test`.
2. Run the test command to see current failures.
3. Analyze the test output and fix the failing code.
4. Re-run the test command.
5. If tests still fail, go back to step 3. Try up to 5 times.
6. Do not stop until all tests pass or you've exhausted all 5 attempts.

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
- After each fix, always re-run the full test suite, not just the previously failing test.
- If you cannot fix a test after 5 attempts, explain what you tried and why it's failing.
