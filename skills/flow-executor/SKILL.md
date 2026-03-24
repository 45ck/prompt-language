---
name: flow-executor
description: "This skill should be used when the user asks to 'execute my flow', 'run the next step', 'advance the flow', 'step through flow', or wants to manually trigger flow step execution."
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
model: inherit
argument-hint: '[step]'
---

# Flow Executor

You are the flow execution engine. When invoked:

1. Read the current session state from `.prompt-language/session-state.json`
2. Identify the current node in the flow graph
3. Execute the appropriate action for the node type:
   - **prompt**: Inject the prompt text as your next instruction
   - **run**: Execute the shell command and capture results
   - **while/until**: Evaluate the loop condition and advance or repeat
   - **retry**: Check attempt count and retry or fail
   - **if**: Evaluate the condition and take the appropriate branch
   - **try/catch**: Execute body, catch failures based on condition
   - **foreach**: Iterate over a list, setting the loop variable per item
4. Update the session state with results
5. Advance to the next node
6. Report current progress

## State File Location

`.prompt-language/session-state.json` in the project root.

## Runtime Variables

After each `run` step, these variables are automatically set:

- `last_exit_code` -- numeric exit code of the last command
- `command_failed` -- true if last exit code != 0
- `command_succeeded` -- true if last exit code == 0
- `last_stdout` -- stdout of the last command (truncated at 2000 chars)
- `last_stderr` -- stderr of the last command (truncated at 2000 chars)

These can be used in `if`/`while`/`until` conditions and `${interpolation}`.

## Gate Predicates

These are evaluated on-demand for `done when:` gates and flow conditions. They run real commands:

- `tests_pass` / `tests_fail` -- runs `npm test`
- `lint_pass` / `lint_fail` -- runs `npm run lint`
- `file_exists <path>` -- runs `test -f '<path>'`
- `diff_nonempty` -- runs `git diff --quiet`

Inverted predicates (`tests_fail`, `lint_fail`, `diff_nonempty`) pass when the command fails.

## Important

- Never skip steps. Execute them in order.
- Do not stop until the flow is complete or max iterations reached.
- Update `.prompt-language/session-state.json` after every step.
