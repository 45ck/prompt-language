# ADR-003 — Adopt Managed Hooks and Richer Run State

## Status

Proposed

## Decision

Adopt OMX-style operational discipline for:

- managed hook ownership
- refresh / uninstall preservation
- richer run-state and recovery artifacts

while keeping prompt-language's runtime semantics unchanged.

## Rationale

This is the highest-value, lowest-identity-risk borrowing from OMX.

## Consequences

- hook ownership metadata becomes first-class
- doctor and recovery become core operator surfaces
- migration compatibility work is required
