# Trace Summary

Run: `20260412-1005-a04-core-proof-sequential`

## Lane Traces

### `pl-sequential`

Primary traces:

- `pl-sequential/ci-report.json`
- `pl-sequential/ci-stderr.log`
- `pl-state/session-state.json`
- `pl-state/audit.jsonl`

What they show:

- the lane produced much of the bounded CRM core workspace but failed before clean completion
- the persisted state stalled at `currentNodePath: [4]` while the workspace had advanced further
- the top-level runner reported failure and the run left orphaned child-process issues

## Comparative Read

- these traces support treating A04 as a runtime-failure reference, not as a decisive capability
  loss for prompt-language

## Confounds

- the run is weakened by workspace/state divergence
- the trace set is good enough for diagnosis but not good enough for a strong product comparison
