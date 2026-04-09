# ADR-004 — Prioritize contracts over additional control-flow syntax

## Status

Proposed

## Context

The strongest current value comes from boundedness and verification, not from generic loops/branches.

## Decision

Spend design/implementation effort on:

- contracts
- effects
- policy
- replay
  before adding significant new control-flow sugar.

## Consequences

### Positive

- aligns with real supervision needs
- reduces scope babysitting more directly

### Negative

- less flashy than adding more DSL features
