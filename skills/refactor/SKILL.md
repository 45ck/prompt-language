---
name: refactor
description: Safe refactoring with test verification after each change. Tests must stay green throughout.
argument-hint: '<file or module to refactor>'
---

# Safe Refactor

Refactor the target code incrementally, verifying tests pass after each change.

## What to do

1. Read the target file or module specified by the user.
2. Run the test suite to establish a green baseline. If tests are failing, fix them first.
3. Apply one refactoring at a time. After each change, run the tests.
4. If tests fail after a change, fix the issue before moving to the next refactoring.
5. Repeat until the code is clean or you've made 5 refactoring passes.

## Flow

```
flow:
  retry max 5
    prompt: Apply the next refactoring to the target code. Make one focused change. Keep tests green.
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
