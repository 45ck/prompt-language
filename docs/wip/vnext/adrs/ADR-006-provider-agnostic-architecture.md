# ADR-006 — Separate Flow IR from provider adapters

## Status

Proposed

## Context

The runtime currently relies heavily on provider-specific hooks. Long term this creates portability and architecture risks.

## Decision

Define a stable Flow IR and isolate provider-specific behavior in adapters (Claude Code, Codex CLI, etc.).

## Consequences

### Positive

- clearer portability story
- easier testing/simulation
- runtime architecture outlives specific providers

### Negative

- requires non-trivial refactor and boundary design
