# Example: Fix Failing Tests

A common workflow: run tests, fix failures, repeat until green.

## Natural language

```
Run the tests. If they fail, fix the failures and run them again. Keep going until they pass. Try up to 5 times. Don't stop until the tests are green.
```

## DSL equivalent

```
until (tests_pass, max=5) {
  run("npm test")
  if (tests_fail) {
    prompt("Fix the failing tests based on the error output above.")
  }
}
gate(tests_pass)
```

## What happens

1. **UserPromptSubmit** detects the control-flow intent and compiles the FlowSpec.
2. The flow starts with `run("npm test")`.
3. Built-in resolvers set `tests_pass` or `tests_fail` based on the exit code.
4. If tests fail, the agent receives the prompt to fix them.
5. On the next iteration, tests run again.
6. This repeats until `tests_pass` is true or 5 iterations are reached.
7. The `gate(tests_pass)` ensures the agent cannot stop unless tests actually pass.
8. If the agent tries to stop early, the **Stop** hook blocks it and re-injects the next step.

## Session state progression

After iteration 1 (tests fail):

```json
{
  "status": "active",
  "variables": {
    "last_exit_code": 1,
    "command_failed": true,
    "tests_fail": true,
    "tests_pass": false
  },
  "nodeProgress": {
    "until-1": { "iteration": 1, "maxIterations": 5, "status": "running" }
  },
  "gateResults": {
    "tests_pass": false
  }
}
```

After iteration 3 (tests pass):

```json
{
  "status": "completed",
  "variables": {
    "last_exit_code": 0,
    "command_succeeded": true,
    "tests_pass": true,
    "tests_fail": false
  },
  "nodeProgress": {
    "until-1": { "iteration": 3, "maxIterations": 5, "status": "completed" }
  },
  "gateResults": {
    "tests_pass": true
  }
}
```
