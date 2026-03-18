---
name: flow-reset
description: Abandon or reset the current flow execution.
argument-hint: ''
---

# Flow Reset

Reset the current flow execution.

1. Check if `.claude-flow/session-state.json` exists
2. If it exists:
   - Read current state and show summary of what will be abandoned
   - Delete the session state file
   - Confirm the flow has been reset
3. If no active flow:
   - Report "No active flow to reset"
