# ADR-001 — Keep Runtime Core Separate from Operator Shell

## Status

Proposed

## Decision

The prompt-language runtime remains the canonical execution model. The OMX-inspired work ships as an operator shell layered above the runtime.

## Rationale

The runtime's moat is explicit flow structure, state, and verification gates. Folding operator conveniences into the product identity would weaken that differentiation.

## Consequences

- shell features must lower to visible runtime artifacts
- docs must keep shipped runtime semantics separate from convenience workflows
- shell implementation can evolve without redefining the language
