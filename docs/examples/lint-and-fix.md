# Example: Lint and Fix Cycle

Run the linter, fix any issues, and repeat until clean.

## Natural language

```
Lint the codebase. If there are errors, fix them and lint again. Repeat until lint passes. Maximum 3 attempts.
```

## DSL equivalent

```
retry(3) {
  run("npm run lint")
  if (lint_fail) {
    prompt("Fix the lint errors shown in the output above.")
  }
}
gate(lint_pass, "npm run lint")
```

## What happens

1. **UserPromptSubmit** detects the retry/lint pattern and compiles the FlowSpec.
2. The flow runs `npm run lint`.
3. Built-in resolvers set `lint_pass` or `lint_fail` based on the exit code.
4. If lint fails, the agent receives the prompt to fix the errors.
5. The retry block re-executes (up to 3 attempts total).
6. The `gate(lint_pass, "npm run lint")` runs lint one final time to verify the result.
7. If the gate passes, the flow completes.

## Variation: lint + tests together

```
retry(3) {
  run("npm run lint")
  if (lint_fail) {
    prompt("Fix the lint errors.")
  }
}
until (tests_pass, max=5) {
  run("npm test")
  if (tests_fail) {
    prompt("Fix the test failures.")
  }
}
gate(lint_pass, "npm run lint")
gate(tests_pass, "npm test")
```

This composes two independent fix cycles. The agent must pass both gates before it can stop.

## Variation: try/catch for lint with fallback

```
try {
  run("npm run lint")
} catch (command_failed) {
  run("npm run lint:fix")
  run("npm run lint")
}
gate(lint_pass)
```

This tries linting once. If it fails, the catch block runs the auto-fixer and re-lints. The gate still ensures the final result is clean.
