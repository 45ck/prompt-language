/flow:status

Show current prompt-language runtime state.

1. Read `.prompt-language/session-state.json`.
2. Report:
   - goal and overall status,
   - current node path and node summary,
   - active loop progress,
   - gate pass/fail/pending state,
   - warnings/blockers,
   - immediate next action.

If no state file exists, report no active flow.  
If state is corrupted, report corruption and suggest reset/recovery.
