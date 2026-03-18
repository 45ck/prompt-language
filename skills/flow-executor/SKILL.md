---
name: flow-executor
description: Execute the current flow step, advance state, and inject execution context into Claude.
argument-hint: '[step]'
---

# Flow Executor

You are the flow execution engine. When invoked:

1. Read the current session state from `.claude-flow/session-state.json`
2. Identify the current node in the flow graph
3. Execute the appropriate action for the node type:
   - **prompt**: Inject the prompt text as your next instruction
   - **run**: Execute the shell command and capture results
   - **while/until**: Evaluate the loop condition and advance or repeat
   - **retry**: Check attempt count and retry or fail
   - **if**: Evaluate the condition and take the appropriate branch
   - **try/catch**: Execute body, catch failures based on condition
4. Update the session state with results
5. Advance to the next node
6. Report current progress

## State File Location

`.claude-flow/session-state.json` in the project root.

## Built-in Resolvers

After each `run` step, these variables are automatically updated:

- `last_exit_code` -- exit code of the last command
- `command_failed` -- true if last exit code != 0
- `command_succeeded` -- true if last exit code == 0
- `tests_pass` -- true if test command succeeded
- `tests_fail` -- true if test command failed

## Important

- Never skip steps. Execute them in order.
- Do not stop until the flow is complete or max iterations reached.
- Update `.claude-flow/session-state.json` after every step.
