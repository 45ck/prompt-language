# Design: Run-State V2 and Recovery Artifacts

## Status

Accepted design target for the current operator-shell recovery and observability work.

Relevant bead:

- `prompt-language-f7jp.4` - Run-state v2 and recovery artifacts layered over current session-state

Primary upstream references:

- [`docs/wip/reviews/2026-04-11-omx-adaptation-pack/specs/003-run-state-and-recovery.md`](../wip/reviews/2026-04-11-omx-adaptation-pack/specs/003-run-state-and-recovery.md)
- [`docs/wip/reviews/2026-04-11-omx-adaptation-pack/04-open-questions-and-risks.md`](../wip/reviews/2026-04-11-omx-adaptation-pack/04-open-questions-and-risks.md)
- [`docs/wip/reviews/2026-04-11-omx-adaptation-pack/adrs/ADR-003-adopt-managed-hooks-and-richer-run-state.md`](../wip/reviews/2026-04-11-omx-adaptation-pack/adrs/ADR-003-adopt-managed-hooks-and-richer-run-state.md)

This note should be read alongside the accepted [Operator Shell Boundary](operator-shell-boundary.md). Run-state v2 is an operator-shell visibility and recovery layer. It is not a replacement runtime.

## Decision

prompt-language may add a **run-state v2 directory layout** under `.prompt-language/` that records per-run manifests, recovery pointers, and debug artifacts, while keeping `.prompt-language/session-state.json` as the **canonical compatibility surface** for the current runtime and hooks.

The design is intentionally additive:

- current readers of `session-state.json` keep working
- richer operator surfaces may read `runs/<run-id>/...` artifacts when present
- missing v2 artifacts must degrade to current `session-state.json` behavior rather than breaking execution

Run-state v2 improves inspectability, interruption recovery, and operator diagnostics. It does not yet claim full replayability, append-only event sourcing, or deterministic crash restoration.

## Why this needs a first-class design

The current single-file model is operationally simple, but it is weak in exactly the places the operator-shell program is trying to strengthen:

- interrupted runs are hard to inspect after the fact
- child topology, recent failures, and operator guidance are not first-class artifacts
- future `doctor`, `watch`, and recovery commands need stable file locations rather than ad hoc derived guesses

At the same time, the repo already depends on `session-state.json` as a live runtime contract. Replacing that file outright would create migration and compatibility risk across hooks, guidance, docs, and test fixtures.

The design therefore needs an explicit answer to two questions:

1. What new artifacts are allowed now for recovery and debugging?
2. What remains out of scope until replay / event-log work lands separately?

## Directory layout contract

The v2 layout extends `.prompt-language/` with a per-run area:

```text
.prompt-language/
  session-state.json
  active-run.json
  runs/
    <run-id>/
      manifest.json
      plan/
        approved-plan.md
      gates/
        latest.json
        history.jsonl
      logs/
        runtime.log
      approvals/
        history.jsonl
      children/
        index.json
      artifacts/
        index.json
      recovery/
        checkpoints.jsonl
        latest.json
        debug-context.md
      rendered/
        workflow.flow
        latest-status.md
      diagnostics/
        doctor.json
```

Required meaning:

- `session-state.json` remains the mutable runtime snapshot used by current execution and hook flows
- `active-run.json` points to the currently active run ID when v2 is in use
- `runs/<run-id>/manifest.json` is the entry point for operator-facing inspection of a specific run
- subdirectories group artifacts by purpose so `doctor`, `watch`, and recovery commands can point to exact files instead of describing state abstractly

The presence of `runs/<run-id>/...` must never be required for basic runtime advancement. It is a richer state envelope, not a new prerequisite for execution.

## Manifest contract

`runs/<run-id>/manifest.json` is the primary v2 index for one run.

Minimum required fields:

- `runId`
- `layoutVersion`
- `createdAt`
- `updatedAt`
- `status`
- `stateFile`
- `activePath`
- `flowPath`
- `runner`
- `parentRunId` when the run is a child
- `childrenFile`
- `latestGateFile`
- `latestRecoveryFile`
- `latestDiagnosticsFile`
- `artifactsFile`

Required behavior:

- manifest fields may point at files that do not yet exist, but those paths must be stable and deterministic
- manifest state must be derivable from the current runtime state rather than becoming a competing source of truth
- manifest updates should be monotonic in usefulness: newer manifests may add pointers and metadata, but must not reinterpret current `session-state.json` semantics

The manifest is a routing document for operators and tools. It is not the authority for variable values, node completion, or gate outcomes; those remain owned by the runtime snapshot and other runtime artifacts.

## Compatibility path

Compatibility is the hard boundary for this design.

### `session-state.json` remains canonical for current runtime semantics

Until a later runtime decision says otherwise:

- hooks may continue reading and writing only `session-state.json`
- existing debugging guidance that tells users to inspect `session-state.json` remains true
- v2 artifacts may be derived from that state, but they do not supersede it

This preserves the [Hooks Architecture](hooks-architecture.md) contract that the current hook loop is state-file driven.

### v2 is optional and additive

A runtime or operator command may create:

- `active-run.json`
- `runs/<run-id>/manifest.json`
- recovery, diagnostics, rendered, and child index artifacts

without changing how older commands interpret `session-state.json`.

If the v2 layer is missing or partially written:

- execution still falls back to the v1-compatible state file
- `doctor` should report the partial migration
- recovery surfaces should degrade gracefully and identify which artifact is missing

### Compatibility write path

When v2 exists, the safe mental model is:

1. the runtime advances `session-state.json`
2. v2 artifacts are refreshed from that state and adjacent execution context
3. operator surfaces read whichever richer artifacts exist, then fall back to `session-state.json`

This keeps write ownership narrow and makes partial migration diagnosable.

## Recovery and debug artifact contract

Run-state v2 exists primarily to give interruption recovery a stable evidence set.

Required artifacts:

- `recovery/latest.json` - machine-readable pointer to the latest recovery snapshot and the immediate next operator hint
- `recovery/checkpoints.jsonl` - append-only checkpoint summaries for major run transitions such as start, gate failure, child await, interruption, and completion
- `recovery/debug-context.md` - human-readable recovery summary for fast inspection
- `children/index.json` - current child topology, statuses, and important paths
- `gates/latest.json` - last known gate evaluation surface
- `diagnostics/doctor.json` - latest machine-readable health summary when doctor or a similar check has run
- `artifacts/index.json` - named pointers to generated plans, rendered flows, logs, reports, and other operator-relevant outputs

Minimum recovery questions these artifacts should answer:

- which run is active or was last active?
- what was the current node or path when interruption happened?
- what was the last failing gate or command?
- which child runs were active, blocked, failed, or awaiting?
- which file should an operator open next?

The recovery layer should point to evidence. It should not replace evidence with summaries alone.

## Migration boundaries

This design deliberately stops short of a storage-engine rewrite.

### In scope now

- adding stable directories and manifests
- adding recovery and debug artifacts
- teaching operator surfaces such as `doctor` or `watch` where to look
- detecting partial migration or stale artifact layouts

### Out of scope for this bead

- replacing `session-state.json` as the live runtime snapshot
- requiring hooks to advance from per-run manifests
- introducing an append-only event ledger as the authoritative runtime model
- claiming deterministic replay from checkpoints alone
- introducing long-retention history policy as a hard runtime guarantee

This is the main migration safeguard: run-state v2 may increase evidence and convenience, but it may not silently redefine the runtime contract.

## Overlap with replay and event-log work

This note intentionally overlaps with later replayability work, but it does not subsume it.

The repo already has separate planning pressure toward append-only events and replayable runtime history. That work aims at stronger guarantees such as:

- audit-grade history
- derived snapshots from append-only events
- replay and post-hoc reconstruction
- more reliable crash recovery

Run-state v2 should prepare for that future without pretending to have already delivered it.

Practical boundary:

- `recovery/checkpoints.jsonl` may look append-only, but it is only a recovery aid in this design
- `manifest.json` may point to state and history files, but it is not an event-sourced ledger root
- v2 artifacts may later be re-derived from an event log, but current v2 adoption must not depend on that future architecture

This keeps `prompt-language-f7jp.4` narrower than the broader replay / event-log track. It improves operator recovery now, while leaving the deeper runtime-history decision open.

## Consequences

What this unblocks:

- a stable target layout for `doctor`, `watch`, and operator-facing recovery commands
- richer child, gate, and diagnostics visibility after interrupted runs
- a migration path that strengthens observability without breaking current hooks

What this constrains:

- docs and code must not describe run-state v2 as a replay system
- new operator surfaces must explain their fallback behavior when only `session-state.json` exists
- later event-log work must either adopt this directory layout or explicitly supersede it rather than quietly diverging

## Current repository status

This note records the accepted target boundary. It should not be read as a claim that the repository already emits every listed file or manifest.

As of April 11, 2026:

- the accepted operator-shell direction already calls for richer run-state and recovery artifacts
- the imported OMX review pack already defines the additive shape at WIP level
- the canonical design gap is the absence of a repo-level accepted note explaining how v2 coexists with `session-state.json` and how it differs from future replay work

This document closes that design gap.
