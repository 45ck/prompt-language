# ADR-00XX: Context-Adaptive Rendering for Prompt-Language

- **Status:** Proposed
- **Date:** 2026-04-09
- **Deciders:** prompt-language maintainers
- **Technical area:** runtime / rendering / hooks

## Context

Prompt-language currently uses full-state rendering as a deterministic safety mechanism. That design keeps runtime state outside the model's fragile conversation history, but likely re-injects more prompt state than necessary during ordinary turns.

Existing evidence indicates that prompt-language's strongest measured wins come from verification gates, not from larger control-flow or context-management surface area. Any rendering optimization must therefore preserve:

- gate trust semantics
- deterministic recovery
- resume/compaction safety
- exact current-step awareness

## Decision

We will pursue **context-adaptive rendering** as a runtime improvement program.

The program keeps **full-state rendering** as the correctness and recovery baseline, and introduces **compact rendering** only as an experimental optimization mode behind a flag.

We will not add new DSL syntax in the first phase.

## Consequences

### Positive

- creates a path to reduce prompt churn on ordinary turns
- preserves a full-state safety mode for recovery and debugging
- forces measurement before product claims

### Negative

- adds renderer complexity
- may yield small or negligible wall-clock gains if hook/gate overhead dominates
- requires additional recovery and parity testing

## Alternatives considered

### 1. Keep full rendering only

Rejected for now because the current design should at least be measured and canonicalized.

### 2. Replace full rendering with compact rendering everywhere

Rejected because this would weaken the current recovery model before evidence exists.

### 3. Add user-facing DSL syntax immediately

Rejected because rendering strategy is a runtime concern first and the product surface is already broad.

## Rollout

1. Instrumentation baseline
2. Canonical rendering foundation
3. Experimental compact mode
4. Evaluation
5. Decision on whether to stay experimental, be rejected, or move toward wider adoption

## Reversal criteria

This decision should be revisited if:

- compact mode harms recovery or gate reliability
- measured improvements are too small to justify added complexity
- instrumentation shows render cost is not a major contributor
