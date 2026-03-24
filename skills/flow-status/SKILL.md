---
name: flow-status
description: "This skill should be used when the user asks to 'show flow status', 'where am I in the flow', 'flow progress', 'what step am I on', or wants to see current flow execution progress."
disable-model-invocation: true
allowed-tools: Read, Glob, Grep
model: haiku
argument-hint: ''
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
