# Compact-Context Program

- Status: program-positioning note for `prompt-language-0ovo`
- Audience: maintainers and reviewers
- Scope: intent, constraints, rollout posture, and current status for the context-adaptive rendering track

## Purpose

This note is the short maintainer-facing narrative for the compact-context program.

It exists to answer four recurring questions in one place:

- what problem the program is trying to solve
- what constraints it must not violate
- how rollout is intentionally staged
- what the repo can honestly claim today

Use this page as the orientation layer over the deeper ADR, fallback, and evaluation notes.

## Program intent

Prompt-language already proves value through deterministic supervision: explicit gates, exact current-step visibility, and resumable state. That same design also tends to re-inject a large amount of state on ordinary turns.

The compact-context program exists to test one narrow hypothesis:

> Can prompt-language reduce prompt churn on ordinary turns without weakening deterministic recovery, gate trust, or operator visibility?

This is a runtime-behavior program, not a new language-surface program.

The intended upside is smaller and steadier prompt payloads where that is safe. The intended discipline is to treat compactness as an optimization candidate, never as a new source of truth.

## Hard constraints

The program is fail-closed. It is constrained by the current product's strongest trust properties:

- full-state rendering remains the correctness baseline
- gate and approval state must stay inspectable
- resume, compaction, and recovery paths must prefer more visibility, not less
- ambiguous state must escalate to full mode or fail explicitly
- docs must not describe compact mode as shipped before implementation and evidence exist

Compact context is therefore bounded by recovery and observability, not by token savings alone.

## Non-goals

This program does not currently aim to:

- add DSL syntax for selecting compact mode
- replace the full renderer as the canonical runtime surface
- let product docs advertise a new shipped user feature
- collapse recovery state into summary-only output
- use prompt-length pressure alone as justification for rollout

Those are either explicitly deferred or gated on later evidence.

## Rollout posture

The rollout is deliberately staged.

1. Instrument the current baseline so render cost and behavior can be measured honestly.
2. Canonicalize rendering and trigger vocabulary so tests, docs, and runtime use the same terms.
3. Keep any compact-mode path experimental and fail-closed.
4. Prove recovery fallback, summary safety, and representative benchmark behavior.
5. Only then decide whether compact context stays experimental, is rejected, or becomes eligible for wider exposure.

This is why the current docs split matters:

- [ADR-00XX: Context-Adaptive Rendering](../adr/ADR-00XX-context-adaptive-rendering.md) defines the architectural bet
- [Context-Adaptive Recovery Fallback](context-adaptive-recovery-fallback.md) defines the fail-closed policy
- [Compact-Mode Fallback Matrix](compact-mode-fallback-matrix.md) defines trigger vocabulary and current implementation subset
- evaluation notes define what still has to be measured before any broader claim is justified

## Current repo status

What is true today:

- the roadmap tracks context-adaptive rendering as WIP, not shipped
- the repo has planning/design notes for fallback, trigger classification, and evaluation structure
- the shipped runtime still uses full rendering as the baseline active-turn surface
- the `pre-compact` hook has a narrow compaction-preservation path and matrix-aligned trigger reporting
- evaluation prep exists, including a benchmark-pack seed and a results template

What is not yet true:

- there is no general shipped compact-mode selector for ordinary active turns
- there is no completed evidence report proving compact mode preserves quality and recovery
- there is no user-facing product claim that compact context is available today
- there is no rollout decision promoting the program beyond experimental planning and bounded hook-level work

## Documentation discipline

Because the feature is not shipped, the docs must keep three layers separate:

- design docs may explain the target behavior and rollout contract
- evaluation docs may explain the evidence bar and current gaps
- reference docs must state only the current user-facing truth: compact context is not an available runtime feature today

That separation is the point of `prompt-language-0ovo.7`. The repo should stay easy to read even while the program is still being tested and argued.

## Maintainer recommendation

Use this program note as the default link when reviewers ask for the short version.

Use the deeper notes only when the question is specifically about:

- architectural rationale
- fallback triggers
- benchmark design
- current evidence gaps

Best next specialist if this package needs follow-on closure work: `evaluation-report-writer`.
