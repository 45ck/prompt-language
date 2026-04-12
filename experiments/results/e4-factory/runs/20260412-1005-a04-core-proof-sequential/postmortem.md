# Postmortem

Run: `20260412-1005-a04-core-proof-sequential`
Date: `2026-04-12`
Verdict: `partial`

## What Happened

The sequential prompt-language lane produced most of the bounded CRM core but failed before clean
completion. The parent run reported failure while the workspace had already advanced beyond the last
persisted state, and orphaned prompt-runner child processes remained alive afterward.

## Root Causes

1. The Windows/headless prompt-runner path could fail mid-run without cleaning up the full Codex
   process tree.
2. The runtime and workspace could diverge, leaving the persisted session state behind the actual
   workspace output.
3. The earlier path/timeout issues from A03 were still part of the operational backdrop for this
   run.

## Evidence

- `outcome.md` records the partial failure and missing `handover` / `test-strategy` docs at the
  snapshot time
- `interventions.md` records the invalid first launch, successful rerun, and leftover processes
- `pl-sequential/ci-report.json` reports a prompt-runner failure
- `pl-state/session-state.json` remained `status: active` at `currentNodePath: [4]`

## Fixes Applied

This run directly motivated the later runtime patch set:

- absolute state-root handling was fixed
- headless run-node default timeouts were increased
- the Codex prompt runner was changed to explicit spawning with process-tree cleanup semantics

## Preventive Guardrails

- sequential reruns must be closed with explicit postmortems, not just raw logs
- comparison docs must call out runner/runtime failures separately from factory-surface failures

## Remaining Risks

- A04 itself remains a partial-failure artifact and should not be reclassified retroactively
- reporting artifacts at the top level are still weaker than the persisted state/audit evidence

## Follow-ups

- use A05, not A04, as the current sequential benchmark
- keep A04 as the pre-fix failure reference that justified the runtime changes
