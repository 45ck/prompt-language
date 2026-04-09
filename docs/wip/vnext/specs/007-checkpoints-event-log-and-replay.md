# Spec 007 — Checkpoints, event log, and replay

## Problem

A mutable session-state JSON file is simple but weak for:

- replay
- crash recovery
- audit history
- conflict diagnosis
- long-run evaluation
- checkpoint branching

## Goals

- Add append-only execution events
- Derive current state from event log + snapshots
- Support checkpoints and restoration
- Support replay/debug tooling

## Non-goals

- This spec does not require a remote tracing backend
- This spec does not replace derived session snapshots where they remain useful

## Proposed syntax

### Checkpoints

```yaml
checkpoint "pre_auth_refactor"
```

```yaml
restore "pre_auth_refactor"
restore "pre_auth_refactor" files
restore "pre_auth_refactor" state
restore "pre_auth_refactor" both
```

### Replay CLI

```bash
prompt-language replay run_2026_04_09_001
prompt-language replay run_2026_04_09_001 --from checkpoint pre_auth_refactor
prompt-language trace show run_2026_04_09_001
prompt-language report run_2026_04_09_001
```

## Event model

Each run should record events like:

- flow_started
- node_entered
- node_completed
- command_started
- command_finished
- variable_set
- artifact_emitted
- gate_evaluated
- contract_evaluated
- judge_evaluated
- effect_executed
- approval_requested
- approval_resolved
- child_spawned
- child_completed
- checkpoint_created
- restore_applied
- budget_exceeded
- flow_failed
- flow_completed

## Storage design

### Recommended starting point

- append-only JSONL event log
- periodic derived snapshot for fast resume
- optional artifact directory per run

### Later evolution

- SQLite or embedded store if querying/compaction becomes painful

## Checkpoint semantics

A checkpoint may capture:

- runtime state
- workspace files
- both
- child-flow states where relevant

Different projects may choose different checkpoint costs and policies.

## Static analysis

The linter should flag:

- irreversible/high-risk effects without prior checkpoint where policy requires one
- replay-disabled features in strict production templates
- restore statements referring to unknown checkpoints

## Acceptance criteria

- Runs produce append-only execution events
- Derived state can be reconstructed from events
- Checkpoints can restore state/files/both
- Replay CLI can inspect past runs
- Structured reports can show why a run failed or paused

## Open questions

- Should checkpoints default to state-only for cheapness?
- How should artifact retention and cleanup be managed over time?
