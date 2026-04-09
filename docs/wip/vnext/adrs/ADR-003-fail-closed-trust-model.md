# ADR-003 — Prefer fail-closed trust semantics in production flows

## Status

Proposed

## Context

Fail-open behavior reduces friction in experimentation but undermines trustworthy autonomy.

## Decision

Introduce strict mode and make it the recommended default for production-grade automation.

## Consequences

### Positive

- fewer silent bad completions
- clearer recovery states
- lower downstream cleanup

### Negative

- more up-front failures
- some flows require additional authoring discipline
