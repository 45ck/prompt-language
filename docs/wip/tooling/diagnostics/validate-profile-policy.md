# `validate` Profile Policy

## Purpose

Keep compatibility checking inside `validate` so users can see problems before execution.

## CLI shape

```bash
pl validate my.flow
pl validate my.flow --runner claude --mode interactive
pl validate my.flow --runner opencode --mode headless --json
```

## Evaluation model

`validate` should answer two questions:

1. Is the flow structurally valid?
2. Can the selected execution profile preserve the semantics required by this flow?

## Compatibility policy

There are only three externally visible outcomes:

- `ok` — flow is valid and compatible
- `warn` — flow is valid and a UX-only feature is unavailable
- `blocked` — flow is valid but the selected profile would change semantics or cannot execute required features

## Hard blockers

Block when the selected profile would change or remove:

- `approve`
- gate enforcement
- required capture / `ask` semantics
- required parallel semantics

## Non-blocking warnings

Warn only for auxiliary surfaces such as:

- status line
- watch mode
- richer progress rendering

## Recommended JSON envelope

```json
{
  "status": "blocked",
  "diagnostics": [
    {
      "code": "PLC-004",
      "kind": "profile",
      "phase": "preflight",
      "severity": "error",
      "blocksExecution": true,
      "retryable": false,
      "summary": "approve is unsupported for runner=opencode mode=headless",
      "action": "Use an interactive profile, or replace approve with a policy/pre-approval step."
    }
  ],
  "outcomes": []
}
```
