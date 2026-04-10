/flow:reset

Reset the active flow state.

1. Check `.prompt-language/session-state.json`.
2. If present, summarize what will be abandoned (current node, loop progress, variables, gate state).
3. Delete only `.prompt-language/session-state.json`.
4. Confirm reset outcome.

If no state file exists, return a no-op success: "No active flow to reset."  
Do not delete unrelated files or modify git state.
