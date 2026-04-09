# ADR-002 — Keep deterministic completion separate from judges

## Status

Proposed

## Context

The repo’s WIP eval/judge direction is strong because it keeps `done when:` deterministic. Allowing model judges to silently become completion criteria would weaken trust.

## Decision

- `done when:` remains deterministic by default
- judges/rubrics/evals exist as a separate layer
- workflows may route on judge output explicitly, but judge logic is not hidden inside ordinary completion semantics

## Consequences

### Positive

- clearer trust model
- better reproducibility
- smaller blast radius from judge mistakes

### Negative

- some users may want convenient all-in-one quality gating
