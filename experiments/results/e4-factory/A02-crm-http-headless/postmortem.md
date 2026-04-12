# Postmortem

Run: `A02-crm-http-headless`
Date: `2026-04-12`
Verdict: `failure`

## What Happened

The early headless CRM HTTP run failed before it could produce a comparable bounded product slice.
The stderr log shows repeated `SessionState invariant violation` errors around `command_failed` and
`command_succeeded`, followed by a failure opening the audit log under the lane state directory.
The intended scope was a headless CRM HTTP service with JSON persistence, not the later package
oriented CRM core proof.

## Root Causes

1. Runtime exit-state variables leaked into child flow state and violated the `SessionState`
   invariant for `command_failed` / `command_succeeded`.
2. Early headless state/audit path handling was brittle enough that the run ended with a missing
   audit path under `.factory-state` after the first failure aborted initialization.
3. Because the failure happened in runtime plumbing, the lane never reached meaningful product or
   verification work.

## Evidence

- `exit-code.txt` records `3`
- `ci-stderr.log` records repeated invariant violations and the final `ENOENT` for
  `.factory-state/audit.jsonl`
- the workspace only contains `docs/prd.md` and `docs/acceptance-criteria.md`

## Fixes Applied

Later runtime fixes addressed the main failure class:

- runtime exit variables are filtered before being passed into spawned children
- state-root handling was normalized so absolute state directories are resolved safely
- later prompt-language lanes were rerun against the patched runtime instead of this legacy lane

The spawn-variable fix is the clearest direct remediation for the A02 invariant failure.

## Preventive Guardrails

- every attempt now requires a written postmortem, even when the failure is mostly setup/runtime
- comparison docs must distinguish setup failures from product-capability failures
- repeatable runs under `runs/<run-id>/` are now the canonical evidence path

## Remaining Risks

- this specific HTTP slice was not rerun on the patched runtime, so its product-level viability is
  still unproven
- the historical evidence is limited to logs plus two partial docs

## Follow-ups

- rerun the HTTP slice on the patched runtime if the HTTP lane still matters
- otherwise treat `A02` as legacy setup evidence, not as a decisive product result
