---
name: refactor
description: Safe refactoring with test verification after each change. Tests must stay green throughout.
argument-hint: '<file or module to refactor>'
---

# Safe Refactor

Refactor the target code incrementally, verifying tests pass after each change.

## What to do

1. Run the test suite first to establish a green baseline. If tests are already failing, fix them before refactoring.
2. Read the target file or module specified by the user.
3. Identify refactoring opportunities (duplication, unclear naming, structural issues).
4. Apply one refactoring at a time. After each change, run the tests.
5. If tests fail after a change, fix the issue before moving to the next refactoring.
6. Repeat until the code is clean or you've made 3 refactoring passes.

## Flow

```
flow:
  run: npm test
  if command_failed
    prompt: Tests are failing before refactoring. Fix them first.
    run: npm test
  end
  prompt: Read the target code and identify refactoring opportunities. List them.
  retry max 3
    prompt: Apply the next refactoring. Make one focused change, then verify tests still pass.
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
