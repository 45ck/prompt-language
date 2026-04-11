# Design: Replayability Event Log

## Status

Accepted design target for the replayability milestone.

Relevant bead:

- `prompt-language-zhog.3` - replayability

Primary anchors:

- [Spec 007 — Checkpoints, event log, and replay](../wip/vnext/specs/007-checkpoints-event-log-and-replay.md)
- [Spec 008 — Safe parallelism: worktrees, locks, and ownership](../wip/vnext/specs/008-safe-parallelism-worktrees-locks-ownership.md)

Related accepted boundaries:

- [vNext Trust Hardening](vnext-trust-hardening.md)
- [Run-State V2 and Recovery Artifacts](run-state-v2-recovery-artifacts.md)
- [Operator Cockpit, Watch, and Status Snapshots](operator-cockpit-watch-status-snapshots.md)
- [Artifact Package Contract](artifact-package-contract.md)
- [Artifact Runtime Lifecycle](artifact-runtime-lifecycle.md)
- [Artifact Extension Boundary](artifact-extension-boundary.md)

This note defines the repo-aligned target for append-only runtime history, replay, and auditability. It is a design target for backlog execution, not a claim that the full event-sourced runtime is already shipped.

## Decision

prompt-language may add a **run-scoped append-only execution event log** as the durable history layer for replay, audit, and post-hoc analysis, while keeping the current mutable runtime snapshot and run-state v2 artifacts as compatibility and operator surfaces during migration.

The model is:

- execution emits append-only events into a run-owned ledger
- the current runtime snapshot is still allowed to exist for active execution and compatibility
- richer derived snapshots, reports, and replay tools are produced from the event log plus checkpoint payloads
- checkpoint restore semantics stay bounded by the trust-hardened restore contract rather than becoming an informal "time travel" feature

This note deliberately strengthens history and replay without collapsing artifacts, operator snapshots, and runtime state into one undifferentiated log blob.

## Why this needs a first-class boundary

The repo already has three adjacent pieces of state:

- `session-state.json` as the current mutable runtime compatibility surface
- run-state v2 recovery files and manifests as additive operator evidence
- checkpoint semantics strong enough to stop and restore safely

Those surfaces improve recovery, but they do not yet provide one durable answer to the harder replay questions:

- what exactly happened across a long run?
- what was known at each boundary?
- which child run or gate changed the outcome?
- which checkpoint can be restored, and what did it actually capture?
- how can a report or audit trail be reconstructed later without trusting ad hoc debug text?

Without one accepted replayability note, later work can drift into two failure modes:

- treating recovery artifacts as if they were already an audit-grade ledger
- stuffing provenance, review history, or operator summaries into event logs that should remain runtime history only

## Relationship to existing state and recovery work

This bead builds on existing accepted boundaries instead of replacing them implicitly.

### Relationship to `session-state.json`

Until a later runtime migration deliberately changes the execution model:

- `session-state.json` remains the live compatibility surface for current execution and hooks
- active execution may still read and write mutable state directly
- the event log is the durable history of what happened, not the only state structure the runtime is allowed to hold during migration

The replayability milestone therefore does **not** require an immediate removal of mutable runtime state.

### Relationship to run-state v2

[Run-State V2 and Recovery Artifacts](run-state-v2-recovery-artifacts.md) remains narrower than this note.

Its artifacts:

- improve recovery and operator inspection now
- may be derived from current runtime state during migration
- may later be re-derived from the event log

They do **not** become a competing history model. In particular:

- `recovery/checkpoints.jsonl` remains a recovery aid unless and until it is explicitly reimplemented as a projection of the event log
- `manifest.json` remains an operator index, not a ledger root
- operator snapshots remain derived projections rather than hidden orchestration state

### Relationship to trust hardening

[vNext Trust Hardening](vnext-trust-hardening.md) already defines:

- when checkpoints are required
- what minimum checkpoint contents must exist
- what `restore <id> state|files|both` means
- when restore must fail conservatively

This note extends that boundary with:

- append-only execution events
- derived snapshots from that history
- replay, trace, and report tooling
- retention and auditability policy

It must not weaken the earlier restore contract.

## Event-log contract

Each run should own one append-only event ledger rooted under the run directory.

Recommended initial shape:

```text
.prompt-language/
  runs/
    <run-id>/
      events/
        execution.jsonl
        checkpoints/
          <checkpoint-id>.json
        snapshots/
          latest.json
          by-seq/
            00001000.json
        reports/
          latest-summary.json
          latest-trace.md
```

The exact filenames may evolve, but these invariants should hold:

- the event stream is append-only
- each event belongs to exactly one run
- parent and child runs keep distinct event namespaces
- cross-run relationships are expressed by identifiers, not by merging multiple runs into one unordered log
- derived snapshots and reports are replaceable projections, not primary evidence

### Event envelope

Each event should carry enough structure to support replay, diagnostics, and audit joins without depending on free-form text.

Minimum fields:

- `schemaVersion`
- `runId`
- `seq`
- `eventId`
- `timestamp`
- `type`
- `phase`
- `nodePath` when the event is tied to a node
- `parentRunId` when the run is a child
- `causedBy` or prior event linkage when relevant
- `payload`

Required invariants:

- `seq` is strictly monotonic within one run
- `eventId` is immutable once written
- payloads may add fields over time but must not reinterpret older event meanings
- events record observed runtime facts, not speculative reconstruction

## Event taxonomy

The initial taxonomy should cover the execution boundaries already named in Spec 007.

Expected families:

- lifecycle: `flow_started`, `flow_failed`, `flow_completed`
- execution: `node_entered`, `node_completed`
- commands and effects: `command_started`, `command_finished`, `effect_executed`
- state changes: `variable_set`
- artifacts and contracts: `artifact_emitted`, `contract_evaluated`, `gate_evaluated`, `judge_evaluated`
- approvals and review: `approval_requested`, `approval_resolved`
- child topology: `child_spawned`, `child_completed`
- recovery: `checkpoint_created`, `restore_applied`
- policy and budget: `budget_exceeded`

The taxonomy should stay narrow enough that later tooling can reason over stable families instead of parsing arbitrary prose.

### Child-run and parallelism semantics

Replayability must compose with the safe-parallelism direction from Spec 008.

Required rules:

- each child run gets its own run id and event namespace
- parent events record child creation, await boundaries, merge decisions, and child result summaries
- child events do not silently mutate parent history; parent/child joins are explicit
- replay tooling can traverse parent-child relationships without flattening them into one fake single-threaded stream

This keeps parallel child conflicts observable and replayable without claiming a distributed transaction log.

## Derived snapshot model

The event log is the durable history. Snapshots are cached projections for speed and operator convenience.

Derived snapshots may be produced:

- periodically every N events
- at checkpoint creation
- at terminal run states such as `failed`, `blocked`, or `completed`
- on-demand by replay and report tooling

### Snapshot purpose

Derived snapshots should answer:

- current or last-known run status
- latest completed node boundary
- budget counters and active diagnostics
- child topology summary
- last checkpoint and last restore action
- pointers to relevant artifacts, logs, and reports

They exist to avoid replaying the entire log for every operator query.

### Snapshot constraints

Derived snapshots are not primary authority over history.

Required constraints:

- a snapshot must be reproducible from append-only events plus checkpoint payloads
- snapshots may be discarded and regenerated
- snapshot corruption must not destroy the canonical history
- tooling should be able to explain which event sequence a snapshot reflects

This mirrors the operator-cockpit rule that snapshots are derived projections over runtime-owned evidence.

## Checkpoint capture and restore semantics

Checkpointing in this note stays aligned with the trust-hardening restore contract, then adds stronger capture evidence and replay joins.

### Checkpoint creation

When a checkpoint is created, the runtime should emit:

- a `checkpoint_created` event with immutable checkpoint metadata
- a checkpoint payload file when the captured scope requires it
- optionally a derived snapshot anchored to the checkpoint sequence boundary

Checkpoint metadata should include at least:

- checkpoint id
- run id
- created time
- capture scope: `state`, `files`, or `both`
- source node path
- parent checkpoint id when derived from an earlier checkpoint
- resumable cursor or last completed safe boundary
- budget counters at capture time
- child summary when children exist
- integrity metadata

### Checkpoint payload model

The payload is the restorable material. The event is the durable record that the checkpoint exists.

Required separation:

- event log records checkpoint identity, scope, provenance, and integrity references
- checkpoint payload stores the actual captured state and or file material needed for restore
- derived snapshots may summarize the checkpoint, but they do not replace the payload

### Restore semantics

Restore remains conservative:

- `restore <id> state` restores runtime state only
- `restore <id> files` restores captured files only
- `restore <id> both` restores state and files atomically

Additional replayability rules:

- every attempted restore emits a visible restore event outcome, including failure
- restore history remains part of the same run history unless a later workflow explicitly forks into a new run
- replay tooling must show both the checkpoint being restored and the post-restore boundary that execution resumed from

This preserves auditability of recovery decisions instead of treating restore as an invisible rewrite of history.

### Branching and fork semantics

Restoring a checkpoint does not erase subsequent history.

The first accepted model should be:

- a run history can show that a restore was applied
- subsequent events continue from that restore boundary in the same run unless the runtime explicitly creates a new run id for a forked replay
- if a future implementation adds checkpoint branching into a new run, the child or derived run must preserve its ancestry pointer to the source checkpoint and source run

The important invariant is that replay and audit tools can see the branch, not that branching must take one exact storage shape immediately.

## Replay, trace, and report tooling

Spec 007 already points toward `replay`, `trace show`, and `report` commands. This note defines their contract boundaries.

### `replay`

`replay` is the deterministic history walker.

It should support:

- replaying an entire run from event zero
- replaying from a named checkpoint boundary
- reconstructing derived state at a chosen sequence boundary
- following parent-child relationships while preserving run ownership

`replay` should explain missing or corrupt history explicitly rather than guessing.

### `trace show`

`trace show` is the operator and maintainer inspection surface over the event stream.

It should localize:

- lifecycle transitions
- node boundaries
- checkpoint and restore events
- gate, contract, judge, and approval outcomes
- child spawn, await, and completion boundaries
- budget-exceeded or blocked transitions

This is a richer history surface than today’s recovery summaries, but it is still a projection over the ledger.

### `report`

`report` is the compact post-hoc explanation surface.

Expected outputs:

- why the run completed, failed, paused, or required approval
- which gates, judges, or policies shaped the outcome
- which checkpoints were created or restored
- which child runs or artifacts materially affected the result
- which files, artifacts, or diagnostics an operator should inspect next

Reports may be regenerated. They are not canonical history.

## Retention and compaction

Replayability is only useful if retained history remains trustworthy and bounded.

### Minimum retention rule

By default, prompt-language should retain:

- the full append-only event stream for a run
- checkpoint payloads required by surviving restore references
- enough derived snapshots to make operator queries practical
- enough generated reports to support common support and evaluation workflows

### Allowed compaction

Compaction may remove replaceable derived material, but must not silently destroy canonical replay evidence.

Safe compaction targets:

- regenerated snapshots
- regenerated reports
- transient debug renderings

Compaction must not remove:

- the only surviving execution events for a run
- the only checkpoint payload referenced by a restorable checkpoint that policy says must remain valid
- ancestry pointers needed to explain child or branch relationships

### Policy hooks

Retention policy may later vary by template, trust mode, or environment, but the runtime should make that policy explicit.

Useful future controls include:

- retention windows by run class
- stronger retention for strict or audit-sensitive runs
- snapshot frequency and report caching limits
- pruning behavior for completed child runs

Those policies are allowed to differ. They must not be hidden.

## Auditability and provenance

The event log should give the repo one durable execution history surface that can be audited without conflating it with artifact-local review history.

### What belongs in the event log

The event log should record:

- execution facts
- checkpoint and restore actions
- gate, contract, approval, and judge outcomes
- artifact emission events and pointers to artifact identities
- child-run creation and completion facts

### What does not belong only in the event log

The artifact notes already define a different boundary:

- artifact manifests own artifact-local provenance
- artifact packages and review records own reviewable content and decisions tied to that artifact
- global execution history may mirror those facts, but does not replace the artifact-local record

This matters because replayability should strengthen audit joins, not erase package-local review evidence by centralizing everything into one ledger.

### Audit invariants

The first replayable design should preserve these audit properties:

1. A run’s history can be reconstructed from append-only events and referenced checkpoint payloads.
2. Restore actions remain visible after they happen.
3. Parent and child relationships remain inspectable.
4. Derived snapshots and reports can be regenerated and compared to their source event ranges.
5. Artifact provenance remains joinable from event history without redefining artifacts as logs.

## Migration path

This note is intentionally additive.

### Migration shape

The expected sequence is:

1. keep current mutable runtime state for active execution compatibility
2. begin emitting append-only events for new runs
3. derive snapshots, operator projections, and reports from those events where practical
4. progressively reduce direct dependence on mutable state where the event log becomes trustworthy enough

### Explicit non-goals for the first replayability milestone

This bead does not require:

- immediate removal of `session-state.json`
- a remote trace backend
- replacing artifact manifests with event history
- pretending current recovery summaries are already deterministic replay
- solving every storage-engine or compaction concern before the first JSONL-based implementation lands

SQLite or another embedded store may become a later optimization, but JSONL plus derived snapshots is the starting point accepted here.

## Consequences

What this unblocks:

- a durable run history strong enough for replay, trace inspection, and structured reports
- a clean handoff from trust-hardened checkpoints to visible restore history
- parent-child replayability that fits the safe-parallelism direction
- clearer separation between runtime history, operator projections, and artifact-local review evidence

What this constrains:

- run-state v2 recovery files and cockpit snapshots must not claim to be the canonical ledger
- restore must remain visible and conservative rather than mutating history silently
- artifacts and review packages must stay first-class objects rather than being demoted to event-log attachments

## Current repository status

This note records the accepted design boundary for `prompt-language-zhog.3`. It should not be read as a claim that the repository already emits the full event taxonomy, replay CLI, checkpoint payload layout, or retention enforcement described above.

As of April 11, 2026:

- the repo has accepted trust-hardening checkpoint and restore semantics
- the repo has accepted additive run-state v2 recovery artifacts and operator projections
- the remaining design gap is one local accepted note explaining how append-only replay history should layer over those existing surfaces without redefining them implicitly

This document closes that design gap.
