# ADR-002 — Lower Convenience Surfaces to Visible Artifacts

## Status

Proposed

## Decision

Every convenience surface introduced by this plan must lower to at least one of:

- a generated flow
- a generated guidance file
- a stable state transition
- a documented runtime artifact

## Rationale

This prevents hidden orchestration magic from competing with the language and preserves inspectability and debuggability.

## Consequences

- `workflow` aliases require render / preview support
- team supervision must be explainable via child-flow state
- scaffolding must generate normal repo files
