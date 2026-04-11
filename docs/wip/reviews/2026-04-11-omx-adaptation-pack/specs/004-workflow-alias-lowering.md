# Spec 004 — Workflow Aliases That Lower to Flows

## Goal

Provide clearer default workflows without making prompt-language command-first.

## Proposed aliases

These are descriptive placeholders; naming can change.

- `workflow clarify`
- `workflow plan`
- `workflow execute`
- `workflow parallelize`

## Lowering rule

Every alias must lower to one of:

- a generated `.flow` file
- a generated planning file plus a `.flow` file
- a documented state transition with rendered preview

Users must be able to inspect the lowered artifact before or after execution.

## Recommended semantics

### clarify

Capture:

- scope
- non-goals
- acceptance criteria
- risks
- open questions

Artifacts:

- plan draft
- assumptions list
- generated flow stub if requested

### plan

Turn clarified scope into:

- implementation plan
- phases
- tradeoffs
- explicit gates
- rollout checklist

### execute

Run the approved plan with:

- gate-backed completion
- logged checkpoints
- recovery artifacts

### parallelize

Supervise a set of child flows that map onto explicit seams

## UX rule

Aliases are onboarding tools. The language remains the power-user surface.

## Acceptance criteria

- rendered alias output is inspectable
- generated flow files validate cleanly
- docs describe aliases as convenience layers, not separate semantics
- alias failures point back to visible flow or state artifacts
