# Outcome

Run: `20260412-1047-a05-core-proof-sequential-patched`
Date: `2026-04-12`
Verdict: `success`

## Scope

Rerun the bounded CRM core slice through the sequential `prompt-language` lane after the runtime
patches that followed A04.

## Result Summary

The run completed successfully.

The authoritative persisted state ends with `status: completed`, all prompt nodes `n1` through `n9`
completed, and all verification plus file gates passed.

## Verification

Passed:

- `npm run lint`
- `npm run typecheck`
- `npm run test`

The recorded run-node exit codes for `lint`, `typecheck`, and `test` are all `0`, and the final
test run reports `4` passed files and `17` passed tests.

## Artifact Completeness

Required artifacts passed their file gates:

- `.factory/project.flow`
- `docs/prd.md`
- `docs/acceptance-criteria.md`
- `docs/architecture/domain-model.md`
- `docs/api-contracts.md`
- `specs/invariants.md`
- `packages/domain/src/index.ts`
- `packages/api/src/index.ts`
- `docs/handover.md`
- `docs/test-strategy.md`

## Comparison Delta

This run closes the gap left by A04.

- A04: partial sequential failure
- A05: sequential success on the patched runtime

That makes the current evidence stronger: `prompt-language` now has both a successful multi-agent
run and a successful sequential run for the same bounded CRM core slice.

## Closure

The top-level redirected `ci-report.json` and `ci-stderr.log` remained empty because the supervisory
shell command had been interrupted earlier. The authoritative completion evidence for this run is
the persisted `pl-state/` state and audit trail.
