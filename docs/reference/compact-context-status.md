# Compact Context Status

This page is the user-facing answer to "does prompt-language support compact context or compact mode today?"

## Short answer

No.

Compact context is a tracked runtime program, not a shipped feature.

The current product contract remains:

- full-state rendering is the baseline runtime surface
- recovery and gate visibility take priority over prompt-size optimization
- no public DSL syntax or stable runtime flag is documented for enabling compact mode

If you do not see a compact-context control in the reference docs, treat it as unavailable.

## What exists today

The repo does contain design and evaluation work around context-adaptive rendering:

- planning notes for compact-versus-full rendering behavior
- a fail-closed fallback policy for recovery-sensitive turns
- evaluation scaffolding for benchmark packs and future reports

Those notes are for maintainers and reviewers. They are not the same thing as a shipped user feature.

## What is not available today

The current public contract does not include:

- a `compact` keyword
- a user-facing render-mode switch in the documented DSL
- a documented CLI flag that enables compact runtime rendering as supported behavior
- a claim that ordinary active turns run through compact mode

## Why the docs are strict here

Prompt-language's trust model depends on exact recovery and verification state. Any compact-context rollout has to prove that it does not hide:

- current-step identity
- blocked gate or approval state
- capture recovery details
- resume or compaction boundaries

Until that proof exists, the reference docs stay conservative on purpose.

## Where to look instead

- [Roadmap](../roadmap.md): tracked WIP status for the context-adaptive rendering program
- [Compact-Context Program](../design/compact-context-program.md): maintainer intent, constraints, and rollout posture
- [Context-Adaptive Program Status](../evaluation/context-adaptive-program-status.md): current evidence posture and remaining gaps

## Practical guidance

If you are using prompt-language today, assume the runtime behaves according to the documented full-state baseline and the existing shipped hooks.

If you are evaluating future compact-context work, use the design and evaluation docs as planning material, not as a product contract.
