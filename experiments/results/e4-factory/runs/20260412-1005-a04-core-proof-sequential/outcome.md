# Outcome

Run: `20260412-1005-a04-core-proof-sequential`

Goal: rerun the same bounded CRM core slice with `prompt-language`, but without `spawn` or `await`, to isolate whether multi-agent orchestration was responsible for the earlier runtime issues.

## Result

Result: partial failure.

The run did not complete cleanly.

- `pl-sequential/ci-report.json` reports `status: failed`
- `pl-state/session-state.json` remained `status: active`
- the last persisted node was the API implementation prompt (`currentNodePath: [4]`)

## What Was Produced

The sequential lane still generated substantial output before failure:

- `docs/prd.md`
- `docs/acceptance-criteria.md`
- `docs/architecture/domain-model.md`
- `docs/api-contracts.md`
- `specs/invariants.md`
- `packages/domain/src/index.ts`
- `packages/domain/test/domain.test.ts`
- `packages/api/src/index.ts`
- `packages/api/test/api.test.ts`
- `README.md`

Missing at the snapshot time:

- `docs/handover.md`
- `docs/test-strategy.md`

## Failure Shape

The failure was not a simple missing-file stop.

- `pl-sequential/ci-report.json` recorded a failed prompt-runner exit
- after the parent run had already failed, orphaned child processes were still present for the sequential lane Codex invocation
- the workspace had progressed beyond the persisted session state, which indicates runner/state divergence rather than a cleanly reported in-flow failure

At the time the result was recorded, the leftover sequential child processes were still present and were not terminated in order to respect the user's request not to kill active agents without need.

## Conclusion

This attempt does not disprove prompt-language as a factory surface, because the same bounded CRM core already completed successfully in `A03` with prompt-language.

What `A04` shows is narrower:

- sequential prompt-language can advance far into the bounded slice
- the current Windows/headless prompt-runner path can still fail mid-run and leave orphaned Codex children
- the remaining issue is operational reliability of the runner, not inability of prompt-language to express or drive the software slice
