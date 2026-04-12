# Postmortem

Run: `20260412-1047-a05-core-proof-sequential-patched`
Date: `2026-04-12`
Verdict: `success`

## What Happened

The patched sequential prompt-language lane completed the bounded CRM core slice end to end. All
prompt steps completed, verification passed, file gates passed, and the final persisted state is
`completed`.

## Root Causes

The most important result is negative evidence against the earlier A04 interpretation:

1. The A04 failure was not caused by prompt-language being unable to express the factory slice.
2. The critical failure modes were runner/runtime issues around state-root handling, brittle
   run-node timeouts, and Codex process launch / cleanup.
3. Once those were fixed, the same sequential lane completed.

## Evidence

- `pl-state/session-state.json` ends with `status: completed`
- `n7`, `n8`, and `n9` record exit code `0` for `lint`, `typecheck`, and `test`
- all required file-existence gates are `true`
- no matching A05 prompt-runner processes remained alive after completion

## Fixes Applied

The runtime now includes:

- normalized state-root resolution for absolute state directories
- a longer default timeout for headless run nodes
- a spawn-based Codex runner path with explicit process-tree cleanup logic

## Preventive Guardrails

- every E4 attempt now requires `outcome.md`, `postmortem.md`, `interventions.md`, and a comparison
  update before closure
- success runs also require postmortems so near-failures are not lost

## Remaining Risks

- the top-level redirected `ci-report.json` / `ci-stderr.log` are still not the authoritative
  evidence path for this run because the supervisory shell command had been interrupted earlier
- the current closure policy is documented, but not yet mechanically enforced by a dedicated check

## Follow-ups

- add the final A05 closure docs to the repo and comparison summary
- if stronger enforcement is needed, add a small closure checker for E4 run folders
