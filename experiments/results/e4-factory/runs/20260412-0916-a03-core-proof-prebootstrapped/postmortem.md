# Postmortem

Run: `20260412-0916-a03-core-proof-prebootstrapped`
Date: `2026-04-12`
Verdict: `success`

## What Happened

The bounded CRM core completed successfully in both lanes:

- `prompt-language` multi-agent
- direct Codex baseline

The prompt-language lane still exposed runtime weaknesses on Windows during launch and reporting,
but those weaknesses did not prevent the bounded slice from completing.

## Root Causes

The main issues were operational rather than product-level:

1. Windows launcher quoting was fragile.
2. Absolute `--state-dir` handling was incorrect.
3. Headless `run` nodes inherited an overly short default timeout, causing false-negative timeouts
   for slower commands.
4. Top-level `ci-report.json` / `ci-stderr.log` capture was not reliable enough to be the sole
   source of truth.

## Evidence

- `outcome.md` records both lanes as successful
- `interventions.md` records the launch/path/time-out caveats
- `pl-state/session-state.json` records `status: completed` with passing gates
- `codex-alone` verification logs show the direct baseline also passed

## Fixes Applied

These A03 caveats directly informed later runtime work:

- state-root resolution was normalized
- the headless command default timeout was increased
- the Codex prompt runner was reworked to use explicit process spawning and cleanup

## Preventive Guardrails

- successful runs now require postmortem docs, not just outcome summaries
- closure policy now requires comparison updates and explicit follow-up tracking

## Remaining Risks

- the authoritative evidence for A03 still lives mostly in session state and audit logs, not in the
  empty redirected `ci-report.json`

## Follow-ups

- keep A03 as the first positive proof that prompt-language can drive the bounded CRM core
- use A05 as the stronger sequential proof after runtime fixes
