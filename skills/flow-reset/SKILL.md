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
