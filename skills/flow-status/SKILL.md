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

## Output Contract

Always structure output in this order:

1. Goal and high-level status
2. Current node path and human-readable node summary
3. Loop progress (only active loops)
4. Gate status
5. Warnings and blockers
6. Immediate next action

## Minimal Status Block

- `Goal`: short text
- `Status`: active/completed/failed/cancelled
- `Current node`: node kind + short payload
- `Path`: e.g. `[0,2,1]`
- `Gate summary`: pass/fail/pending counts

## Triage Hints

- If `status=active` and node path does not change across repeated checks, flag as possibly stuck.
- If there are warnings about capture failures or retries near max, call that out first.
- If gates are all passing but flow is still active, highlight possible advancement mismatch.

## Failure Modes

- Missing state file: report no active flow.
- Corrupted state file: report corrupted-state condition and suggest reset/recovery path.
- Unknown node kind in path: report stale or mismatched flow state and recommend reset.
