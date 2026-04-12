# Outcome

Run: `A02-crm-http-headless`
Date: `2026-04-12`
Verdict: `failure`

## Scope

Run an early bounded CRM HTTP slice through the `codex+prompt-language` lane in headless mode.
This was a headless HTTP service target, not the later bounded CRM core package slice.

## Result Summary

The run failed early and never became a clean product-comparison attempt.

The recorded exit code was `3`, `ci-report.json` remained empty, and the primary failure signal was
written to `ci-stderr.log`. The lane still produced partial discovery artifacts:

- `docs/prd.md`
- `docs/acceptance-criteria.md`

No comparable implementation, verification, or release evidence was produced.

The failure happened before `.factory-state/audit.jsonl` was established, so the wrapper also
surfaced a secondary audit-path `ENOENT`. That secondary error should be read as crash fallout, not
as the original cause.

## Verification

- `lint`: not reached
- `typecheck`: not reached
- `test`: not reached

## Artifact Completeness

Present:

- partial evidence logs
- partial docs pack (`prd`, `acceptance-criteria`)

Missing:

- implementation artifacts
- verification logs
- completion report
- release / handover artifacts

## Comparison Delta

`A02` should not be used as evidence that prompt-language cannot build the software slice. It is an
early runtime/setup failure, not a completed capability comparison.

## Closure

This run is closed as a historical failed attempt with partial evidence only. Its findings were
rolled forward into later runtime fixes and later sequential reruns.
