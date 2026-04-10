---
name: flow-reset
description: "This skill should be used when the user asks to 'reset my flow', 'abandon the flow', 'start over', 'clear flow state', or wants to cancel/abort the current flow execution."
disable-model-invocation: true
allowed-tools: Bash, Read
model: haiku
argument-hint: ''
---

# Flow Reset

Reset the current flow execution.

1. Check if `.prompt-language/session-state.json` exists
2. If it exists:
   - Read current state and show summary of what will be abandoned
   - Delete the session state file
   - Confirm the flow has been reset
3. If no active flow:
   - Report "No active flow to reset"

## Safety and Scope

- Reset clears prompt-language runtime state, not your git working tree.
- Never delete unrelated files or directories.
- If the state file is malformed JSON, treat it as recoverable corruption and still allow reset.

## Operator Checklist

1. Confirm current flow status from `.prompt-language/session-state.json` when readable.
2. Report what will be lost:
   - current node path,
   - loop progress,
   - captured runtime variables,
   - gate results.
3. Delete only the state file and keep backups if present.
4. Re-check flow status and confirm reset outcome.

## Suggested Response Template

- `Previous status:` active/completed/failed/cancelled
- `Current step:` short node summary if available
- `Action taken:` deleted state file / no-op
- `Result:` flow reset complete / no active flow

## Failure Handling

- If delete fails due to permissions, report the exact path and error.
- If state file is locked, instruct retry after process exit.
- If state file does not exist, return success as a no-op.
