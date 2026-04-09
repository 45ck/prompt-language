# ADR-005 — Move runtime state toward event log + derived snapshots

## Status

Proposed

## Context

A single mutable state file is simple but weak for replay, audit, and crash recovery.

## Decision

Adopt append-only event logs with derived snapshots, while keeping a practical migration path from current session-state handling.

## Consequences

### Positive

- replayability
- audit history
- easier regression creation
- better observability

### Negative

- more storage and implementation complexity
