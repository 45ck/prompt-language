# Design: Memory Checkpoint, Handoff, and Compaction Boundary

## Status

Accepted design target for `prompt-language-b8kq.3`.

Relevant bead:

- `prompt-language-b8kq.3` - checkpoint, handoff, and compaction boundary for memory

Primary anchors:

- [Memory, Knowledge, Markdown, and Evaluation Positioning](../wip/memory/memory-knowledge-positioning.md)
- [Scrutiny and Risks: Revisions to the Memory + Markdown Direction](../wip/memory/memory-scrutiny-and-risks.md)
- [Recommended Implementation Roadmap](../wip/memory/memory-roadmap.md)
- [Memory Governance Alignment](memory-governance-alignment.md)
- [Replayability Event Log](replayability-event-log.md)

Related accepted and adjacent work:

- [vNext Trust Hardening](vnext-trust-hardening.md)
- [Run-State V2 and Recovery Artifacts](run-state-v2-recovery-artifacts.md)
- [Context-Adaptive Recovery Fallback](context-adaptive-recovery-fallback.md)
- older resume-state fragments tracked under `prompt-language-5syc` and `prompt-language-ea5a`

This note settles the boundary between execution/session state and durable memory so the repo does not grow a memory-owned checkpoint model beside the existing runtime, restore, and replay tracks.

## Decision

prompt-language should treat **checkpointing, resumability, handoff summaries, and runtime compaction as execution/session-state responsibilities**.

Durable memory remains a separate concern:

- runtime/session state owns exact execution position, blocked status, child topology, and safe restart behavior
- replay and event-log work own append-only history, restore visibility, and reconstruction
- durable memory owns curated reusable facts, procedures, rules, and lessons with provenance and invalidation
- Markdown knowledge remains a readable guidance layer, not an implicit resume substrate

Checkpoint and handoff features may read from durable memory and may trigger explicit promotion into durable memory, but they are not aliases for memory reads or writes.

## Why the boundary needs to be explicit

The repo now has multiple adjacent planning strands:

- the memory roadmap says checkpoints and compaction are runtime responsibilities
- trust hardening defines the checkpoint and restore contract
- run-state v2 adds additive recovery artifacts around `session-state.json`
- replayability adds append-only execution history, replay, and derived snapshots
- compact-mode recovery work adds safety rules around resume and host compaction

Without one accepted note here, the same concepts can drift into overlapping implementations:

- "checkpoint" inside memory semantics
- "resume state" inside run-state artifacts
- "replay history" inside operator recovery files
- "handoff summary" treated as trusted durable memory

This bead exists to stop that drift.

## Core model

The repo should use four distinct layers.

### 1. Execution/session state

This is the authoritative mutable state for an active or resumable run.

It includes:

- current node and safe resume boundary
- loop and retry counters
- pending approvals and blocked reasons
- child run topology, inbox or await state, and merge status
- current budgets, policy state, and gate-local progress
- latest compaction summary needed to continue the same run

This state must stay exact enough to resume deterministically. It is not durable memory.

### 2. Replay and recovery history

This is the durable runtime-owned history of what happened during a run.

It includes:

- append-only execution events
- checkpoint creation records
- restore attempt and outcome records
- derived snapshots and reports
- pointers to checkpoint payloads and run artifacts

This layer supports audit, replay, and reconstruction. It is not a general memory store.

### 3. Durable memory

This is curated cross-run reusable knowledge.

It includes:

- stable project rules
- reusable procedures
- validated lessons
- facts with provenance, TTL, and invalidation

Durable memory may be promoted from a run, but only through explicit write or promotion policy. It does not automatically inherit all checkpoint or handoff material.

### 4. Human-readable knowledge and artifacts

This includes:

- `AGENTS.md`, `CLAUDE.md`, and other Markdown guidance
- review or handoff artifacts
- approved plans and operator-facing summaries

These surfaces may inform runtime behavior or later promotion decisions, but they do not replace exact session state.

## Responsibility split

| Concern                                                         | Primary owner                                                          | Why                                                                               |
| --------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Current node, cursor, and safe resume boundary                  | execution/session state                                                | Resume must continue from the exact next valid point                              |
| Pending approval, blocked reason, and retry counters            | execution/session state                                                | These are in-flight control facts, not reusable knowledge                         |
| Child status, await targets, inbox state, and merge bookkeeping | execution/session state                                                | Multi-agent recovery depends on exact current topology                            |
| Checkpoint metadata and payload references                      | replay and recovery history                                            | They need durable run history and restore auditability                            |
| Checkpoint payload contents                                     | execution/session state captured into runtime-owned recovery artifacts | Payloads restore the run; they do not define durable memory semantics             |
| Restore outcomes and branch history                             | replay and recovery history                                            | Recovery must remain visible after it happens                                     |
| Handoff summary                                                 | execution/session state derived artifact                               | It helps restart or review, but is not automatically trusted memory               |
| Runtime compaction summary                                      | execution/session state                                                | It preserves enough active context to continue the same run                       |
| Durable lesson, fact, or rule                                   | durable memory                                                         | Reusable knowledge needs provenance, TTL, and reviewable writes                   |
| Markdown guidance and readable plans                            | human-readable knowledge and artifacts                                 | Readable context is valuable, but it is not authoritative runtime state by itself |

## Checkpoint responsibility

Checkpoint semantics belong with runtime state, restore policy, and replay history.

### A checkpoint is

- a runtime-owned capture boundary
- tied to one run
- able to restore `state`, `files`, or `both` according to the trust-hardening contract
- represented in durable runtime history with immutable checkpoint metadata

### A checkpoint is not

- a generic durable-memory snapshot
- a writable knowledge bundle that later runs may trust automatically
- permission to rewrite project memory or shared policy

### Required checkpoint behavior

This bead inherits the stronger checkpoint rules from the existing runtime track:

- trust hardening owns when checkpoints are required and when restore must fail closed
- run-state v2 may expose checkpoint summaries and recovery pointers as additive artifacts
- replayability owns append-only checkpoint and restore history plus derived replay tooling

This memory bead does not create a second checkpoint DSL or a second restore mechanism.

## Resumability responsibility

Resumability means the runtime can continue from a known safe boundary after interruption, restore, or host restart.

Resumability therefore belongs to execution/session state plus the recovery and replay surfaces that describe it.

Required rules:

- the resumable cursor is runtime state, not durable memory
- a resumable run must know whether it was blocked on approval, gate failure, child await, or explicit pause
- restore and resume must preserve or derive child topology from runtime-owned artifacts rather than from free-form memory text
- resuming after compaction or interruption must prefer exact state plus recovery artifacts over summary-only reconstruction

This aligns directly with:

- `prompt-language-zhog.1` for restore safety
- `prompt-language-f7jp.4` for additive run-state and recovery artifacts
- `prompt-language-0ovo.5` and children for compact-mode recovery behavior
- `prompt-language-5syc` and `prompt-language-ea5a` as older session-state implementation fragments that should be absorbed into the same model rather than preserved as a parallel design

## Handoff-summary responsibility

A handoff summary is a **restart and review artifact**, not durable memory by default.

### Handoff summaries should

- summarize the current run boundary for a later human or agent
- point back to authoritative runtime evidence such as run id, checkpoint id, failing gate, child state, artifacts, or logs
- be derived from session state and recent execution history
- remain visible in status, watch, or recovery artifacts where useful

### Handoff summaries should not

- become the sole source of resume truth
- silently replace precise child or approval state
- bypass replay and event-log history
- auto-promote themselves into durable memory

If part of a handoff summary becomes a stable reusable lesson, it must be promoted explicitly under the durable-memory rules described by the memory roadmap and governance notes.

## Compaction responsibility

The repo needs one explicit distinction:

- **runtime compaction** reduces active context pressure while preserving enough state to continue the current run
- **durable-memory curation** manages TTL, invalidation, expiry, and promotion quality over time

Those are different operations with different owners.

### Runtime compaction owns

- compact summaries used to rehydrate active run context
- host-compaction boundaries
- recovery-safe fallback behavior when summary-only continuation is too risky
- visibility of compaction markers and rehydrate source in operator tooling

### Durable memory curation owns

- expiry of stale facts and lessons
- invalidation on changed files or superseding evidence
- promotion or demotion of durable knowledge

Runtime compaction must not silently rewrite trusted durable memory. Durable-memory curation must not pretend to preserve exact active run state.

## Relationship to replay and event log

[Replayability Event Log](replayability-event-log.md) is the accepted history layer for:

- append-only execution history
- checkpoint and restore records
- derived snapshots
- replay, trace, and report tooling

This bead composes with that design by keeping the ownership split clean:

- memory does not own the event log
- checkpoints emit metadata into replay history instead of mutating durable memory
- handoff summaries may be artifacts derived from replay plus current session state
- compaction markers and restore outcomes remain visible runtime history, not memory entries

This keeps the repo from inventing two durable checkpoint narratives, one under memory and one under replay.

## Relationship to run-state v2 and resume-state work

[Run-State V2 and Recovery Artifacts](run-state-v2-recovery-artifacts.md) already establishes that:

- `session-state.json` remains the canonical compatibility surface for current runtime behavior
- `runs/<run-id>/...` artifacts are additive recovery and operator aids
- v2 does not yet claim full replayability

This bead keeps that migration legible:

- session-state and run-state artifacts may carry the current checkpoint, latest handoff summary, and compaction summary
- those artifacts remain runtime-owned recovery surfaces
- durable memory remains separate even when a run later promotes a lesson learned during recovery

Older resume-state work under `prompt-language-5syc` and `prompt-language-ea5a` should therefore be interpreted as implementation detail and migration baggage for this runtime-owned model, not as license to define a second memory-oriented checkpoint system.

## Promotion boundary into durable memory

Checkpoint, handoff, and compaction surfaces may produce candidate knowledge, but promotion must stay explicit.

Examples of valid promotion:

- a repeated recovery pattern becomes a durable troubleshooting rule after success and review
- a validated project procedure is written on `on="success"` or `on="approval"`
- a durable warning rule is derived from repeated replay evidence and stored with provenance

Examples of invalid implicit promotion:

- writing the latest handoff summary straight into shared memory as truth
- treating the current compaction summary as a durable project rule
- restoring from a checkpoint and assuming all captured transient analysis is now trusted memory

This keeps runtime recovery artifacts useful without poisoning durable memory.

## Backlog mapping

This boundary should reuse existing backlog rather than open a second checkpoint program.

| Concern                                                              | Existing backlog                               | Owner under this model                                             |
| -------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| durable memory semantics, scopes, reads, writes, promotion rules     | `prompt-language-b8kq`, `prompt-language-7g58` | durable memory track                                               |
| checkpoint safety, restore targets, fail-closed behavior             | `prompt-language-zhog.1`                       | trust and runtime track                                            |
| append-only event log, replay, restore history, derived snapshots    | `prompt-language-zhog.3`                       | replayability track                                                |
| additive run-state, manifests, recovery pointers, operator artifacts | `prompt-language-f7jp.4`                       | run-state and operator track                                       |
| compact-mode and host-compaction recovery safety                     | `prompt-language-0ovo.5` and children          | recovery-fallback track                                            |
| older session-state and resume-state fragments                       | `prompt-language-5syc`, `prompt-language-ea5a` | absorbed into the runtime-owned model, not a separate memory model |

No separate checkpoint implementation epic should be created under the memory program while these existing tracks remain active.

## Consequences

What this clarifies:

- exact resumability is a runtime concern, not a memory concern
- checkpoints are runtime captures with replay-visible history, not durable-memory snapshots
- handoff summaries are review and restart aids, not automatically trusted knowledge
- compaction pressure belongs to runtime context management, not durable-memory curation
- durable memory only receives curated promoted outputs

What this avoids:

- a second restore model inside memory semantics
- treating Markdown or handoff artifacts as if they were authoritative runtime state
- conflating operator recovery files with replay-grade history
- silently promoting transient summaries into shared memory

## Current repository status

This note records the accepted boundary for `prompt-language-b8kq.3`. It should not be read as a claim that the repo has already unified every checkpoint artifact, replay projection, compaction surface, or resume-state implementation under one shipped runtime.

As of April 11, 2026, the repo already has the right direction in separate notes:

- the memory roadmap and scrutiny docs place checkpoints and compaction under runtime ownership
- trust hardening defines restore and checkpoint safety
- run-state v2 defines additive recovery artifacts
- replayability defines append-only execution history

The design gap was the missing accepted note tying those strands together from the memory backlog side. This document closes that gap without creating a competing checkpoint model.
