---
name: flow-status
description: Show current flow execution progress (read-only).
disable-model-invocation: true
argument-hint: ''
allowed-tools: Read, Glob, Grep
---

# Flow Status

Display the current flow execution status.

1. Read `.prompt-language/session-state.json`
2. Show:
   - Flow goal
   - Current status (active/completed/failed/cancelled)
   - Current node and position in the graph
   - Loop iteration counts (e.g., "retry 2/3", "while iteration 3/5")
   - Variable values
   - Completion gate results
   - Any warnings
3. Format as a clear progress summary
