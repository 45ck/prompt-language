# Results

Store run outputs under:

```text
results/YYYYMMDD-HHMMSS/task-id/arm/
```

Each arm directory should contain the artifacts listed in `docs/runbook.md`.
Preserve `.prompt-language/session-state.json` for claim-bearing runs when it is
small enough to review; it is the audit trail for structured senior-behavior
artifacts. Raw generated workspaces may be ignored if they would break repo
formatting, contain nested Git repositories, or include large dependency trees;
preserve final diffs and logs as durable evidence either way.
