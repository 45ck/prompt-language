/flow:run

Manually advance one flow step for debugging only.

1. Read `.prompt-language/session-state.json`.
2. Identify the current node at `currentNodePath`.
3. Execute the next deterministic action for that node type:
   - `prompt`: provide the pending prompt text.
   - `run`: execute the command and capture exit/stdout/stderr.
   - loop/branch nodes: evaluate condition and choose next path.
4. Persist updated runtime state.
5. Report the new node path and next required action.

Use this only when automatic hook advancement is not firing or when explicitly diagnosing a stuck flow.
