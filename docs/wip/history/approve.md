# `approve` (WIP)

> **Status: shipped.** See [approve](../../reference/approve.md) in the Language Reference.

## Goal

Add a hard human approval checkpoint that pauses the flow until the user explicitly approves or rejects the next step.

## Proposed syntax

```text
flow:
  prompt: Generate the migration SQL
  approve "Ready to run this migration against prod?"
  run: psql -f migration.sql
```

Optional direction:

```text
approve "Deploy to production?" timeout 5m
```

## Intended behavior

- `approve` pauses flow advancement
- the approval message is rendered prominently in the flow view
- simple approvals such as `yes`, `y`, `approved`, or `ok` continue the flow
- rejections cancel the flow or route to a fallback path
- optional timeouts fail closed rather than silently continuing

## Current workaround

Use a capture prompt as a manual checkpoint:

```text
let approval = prompt "Review the plan above. Reply APPROVED to continue."
if ${approval} == "APPROVED"
  run: deploy.sh
end
```
