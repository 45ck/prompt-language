# Runtime Semantics

<!-- cspell:ignore lrna -->

This document no longer tries to settle the full lifecycle design. That is the job of `prompt-language-50m6.4`.

Its narrower purpose for `prompt-language-50m6.1` is to state the runtime constraints that any later artifact implementation must preserve.

## Boundary goal

Artifacts should be runtime-recognized outputs for review, proof, and handoff.

They should not collapse existing runtime concepts into one bucket.

## Constraints later runtime work must honor

### 1. Artifact creation is explicit

The runtime must not silently upgrade every generated file, trace, or large-output blob into a first-class artifact.

Acceptable creation models for later design:

- an explicit emit step
- an explicit subsystem-owned emission contract
- a deliberate host integration that names the artifact type and payload

Not acceptable:

- "anything written to disk is now an artifact"
- "anything large enough to summarize is now an artifact"
- "every approval or review event auto-creates a canonical artifact whether the flow asked for one or not"

### 2. Artifacts are outputs, not execution state

Artifacts may be referenced by later steps, but they do not replace:

- variable/state persistence
- snapshot/restore state
- retry bookkeeping
- loop or branch control

If a run needs to resume, replay, or restore state, that remains a state-management concern even when artifacts are present alongside it.

### 3. Artifacts are review objects, not logs

An artifact may include summaries or attachments derived from logs, transcripts, or traces.

The underlying observability streams stay distinct:

- audit logs remain append-only operational evidence
- execution traces remain debugging history
- raw tool/model transcripts remain low-level capture unless intentionally packaged into an artifact

### 4. Artifacts do not replace gates

Later runtime work may allow gate predicates such as "artifact exists" or "artifact approved".

Even if that happens, the artifact is still the subject being inspected, not the gate primitive itself.

This means:

- gate evaluation rules remain part of control flow semantics
- approval state machines remain distinct from artifact payload structure
- artifact review records must not be treated as a hidden substitute for `if`, `done when:`, or approval nodes

### 5. Artifacts stay human-legible

A runtime-recognized artifact must remain inspectable without exposing hidden reasoning.

That excludes:

- chain-of-thought dumps
- internal planner scratch state
- opaque binary-only payloads with no reviewable surface

Attachments may be binary. The artifact itself still needs a reviewable manifest or canonical human-facing view.

### 6. Artifacts are a protocol, not yet a product surface

This slice does not commit prompt-language to:

- DSL syntax such as `artifact` declarations
- CLI commands
- IDE/TUI/browser review surfaces
- cross-run registries
- core PDF or DOCX export

Those are implementation and rollout questions for later beads.

## Relationship to current prompt-language

The current shipped DSL already has:

- `prompt`
- `run`
- `let` / `var`
- `if`
- `while`
- `until`
- `retry`
- `foreach`
- `try` / `catch` / `finally`
- `spawn`
- `await`
- `approve`
- `ask`
- `done when:`

Artifacts are therefore an additive protocol direction, not a justification to reinterpret the existing runtime model.

## Adjacency rules for nearby backlog

- `prompt-language-67qn` remains state snapshot and replay, not artifact lifecycle.
- `prompt-language-42wb` and `prompt-language-lrna` remain audit/trace observability, not reviewable artifact semantics.
- `prompt-language-5vsm.6` may consume artifact concepts for eval bundles, but eval replay requirements do not define the general artifact runtime.
- `prompt-language-0ovo.4` may persist large outputs and reference them compactly, but that rendering policy is not the artifact lifecycle.

## Deferred lifecycle questions

The following are real runtime questions, but they stay deferred to later design work:

- exact emit, validate, reference, review, and supersede semantics
- per-run only versus cross-run lookup
- how artifact versioning interacts with approvals and revisions
- whether failed artifact validation halts execution or only fails a later gate
