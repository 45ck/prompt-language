# Design: Artifact Runtime Lifecycle

## Status

Accepted design direction for `prompt-language-50m6.4`.

Anchors:

- `docs/wip/artifacts/runtime-semantics.md`
- `docs/wip/artifacts/open-questions.md`
- `docs/wip/artifacts/manifest-and-renderers.md`
- `docs/wip/artifacts/current-dsl-workarounds.md`

## Decision

prompt-language artifacts follow a lifecycle of **emit -> validate -> reference -> review -> supersede**.

Each lifecycle transition must have an observable runtime effect on a concrete artifact package and manifest. The runtime should treat an artifact version as a **durable, reviewable output snapshot**, not as hidden execution state and not as a mutable shared object.

The accepted storage and lookup model is:

- every emitted artifact version is owned by the run that created it
- artifacts are durably persisted as run-owned packages
- later runs may reference earlier artifact versions, but only through an explicit cross-run reference to an immutable emitted version
- cross-run lookup does not grant write-through mutation of the earlier artifact

This design clarifies runtime behavior without claiming shipped DSL syntax, CLI commands, or review UI.

## Why this direction

`docs/wip/artifacts/runtime-semantics.md` already settles that artifacts are explicit outputs, not logs, state, or hidden reasoning. The remaining lifecycle decision therefore needs to preserve three boundaries:

- the runtime must not silently upgrade arbitrary files into artifacts
- approvals and gates must remain control-flow primitives rather than being replaced by artifact metadata
- later runs need a durable handoff model, but not a global mutable artifact store that becomes more authoritative than the emitting run

Purely per-run-only artifacts would make review and handoff weaker than the program intends. A fully mutable cross-run registry would blur provenance, approval scope, and supersession. Run-owned immutable versions with explicit cross-run references keeps the model legible.

## Lifecycle model

### 1. Emit

Emit creates a new artifact version as a concrete package plus manifest.

Observable runtime effects:

- a new artifact package is materialized in runtime-owned storage
- the manifest records identity, producer, run ownership, and initial lifecycle status
- the artifact becomes addressable inside the emitting run

Rules:

- emit must be explicit in the flow or in a subsystem-owned contract
- generic file creation does not count as emit
- emit creates a new version; it does not rewrite a previously reviewed artifact in place

Initial state after emit:

- artifact version exists
- provenance is bound to one run
- validation and review are both pending unless explicitly completed immediately afterward

### 2. Validate

Validate checks whether an emitted artifact version satisfies its package and schema contract.

Observable runtime effects:

- validation outcome is recorded against the specific artifact version
- the recorded state becomes inspectable by later runtime predicates or operator surfaces
- validation evidence may point to machine-readable diagnostics, but those diagnostics are not themselves the artifact

Rules:

- validation is version-scoped
- validation may succeed or fail without deleting the artifact
- failed validation does not automatically halt the run unless a control-flow construct or host policy says it must

Consequences:

- later gates may fail because the artifact is invalid
- review may still inspect an invalid artifact when the purpose is diagnosis, but invalid and approved are distinct states

### 3. Reference

Reference resolves an artifact version for downstream use.

Observable runtime effects:

- the runtime resolves a handle to one concrete artifact version
- the consuming step can inspect the artifact manifest, views, or attachments through that resolved handle
- provenance of the reference target remains visible

Accepted reference semantics:

- inside one run, steps may reference artifact versions emitted earlier in that same run
- across runs, a run may reference a previously emitted artifact version only through an explicit durable identifier or path
- a cross-run reference points to a specific immutable version, not to a floating concept like "latest approved plan"

This means cross-run references are allowed, but only as **read-only snapshot references** unless a later step emits a new artifact version of its own.

Rejected semantics:

- implicit lookup of arbitrary files as artifacts
- mutable shared handles where one run silently edits another run's artifact version
- floating references whose target can change without an explicit supersession choice

## Review and approval semantics

### 4. Review

Review records human or automated judgment about a specific artifact version.

Observable runtime effects:

- review status is attached to one artifact version or to adjacent review records that point to that version
- comments, decisions, and review timestamps remain attributable to that exact version
- downstream steps can tell whether a version is not yet reviewed, reviewed with changes requested, rejected, or accepted

Rules:

- review is version-scoped, not artifact-family-scoped
- review does not mutate the artifact payload into a new version by itself
- a request for changes does not "edit" the artifact; it leaves the reviewed version in place until a successor is emitted

### Relationship to `approve`

`approve` remains a runtime control-flow primitive. It may target or mention an artifact version, but it is not replaced by artifact review metadata.

Practical consequences:

- an approval node may ask a human to inspect an artifact
- the approval outcome belongs to the approval step in the flow
- artifact review state may be updated as part of that process, but the two records are not interchangeable

The runtime must not assume:

- "artifact accepted in review" automatically means an approval node passed
- "approval granted" automatically means the artifact package became reviewed, valid, or superseded

That separation preserves current flow semantics and avoids hiding control-flow decisions inside artifact metadata.

## Supersession semantics

### 5. Supersede

Supersede marks that a newer artifact version replaces an older version for future reference.

Observable runtime effects:

- a successor artifact version is emitted
- the successor records which earlier version it supersedes
- the older version remains addressable for audit and replay, but no longer represents the preferred current version for that lineage

Rules:

- supersession never rewrites history
- approvals and reviews stay attached to the version they were made against
- a superseding version must be re-validated and, when required, re-reviewed

This prevents accidental carry-forward of approval from version N to version N+1.

## Per-run versus cross-run semantics

The explicit decision is:

- artifact creation and primary ownership are per-run
- artifact persistence is durable beyond the run
- cross-run reference is allowed, but only to immutable emitted versions

What this means in practice:

- the emitting run is the authority for artifact provenance
- later runs may consume an earlier artifact as input, evidence, or context
- later runs must emit their own successor artifact if they want to revise or extend the prior work in a reviewable way

What this avoids:

- a global mutable artifact object that outlives run boundaries and obscures provenance
- approval ambiguity caused by multiple runs editing "the same" artifact in place
- hidden host behavior where "latest artifact" changes underneath a flow without a visible event

## Relationship to `done when:` and gate evaluation

Artifacts may become subjects of gate predicates, but they do not replace gate semantics.

If artifact-aware gates are added later, they should evaluate observable facts about a resolved artifact version, such as:

- whether a version exists
- whether that version validated successfully
- whether that version has the required review or approval outcome
- whether that version has been superseded

Rules for later gate work:

- `done when:` must evaluate explicit predicates, not infer success from the mere presence of an artifact package
- review state, approval state, and validation state must remain distinguishable in gate evaluation
- a superseded version should not satisfy a gate that asks for the current accepted artifact unless the predicate explicitly allows it

This decision does **not** claim that artifact-aware gate syntax is already shipped. It only defines the semantics future gate work must preserve.

## Interaction with current runtime primitives

This decision is additive to the current runtime, not a reinterpretation of it.

Artifacts may be produced or consumed around existing primitives such as:

- `run` for file- and tool-producing work
- `approve` for explicit human checkpoints
- `spawn` and `await` for child-run handoff
- `done when:` for completion evaluation

But artifacts do not become:

- a replacement for variables or snapshots
- a hidden substitute for approval nodes
- a new control-flow language by implication

The current workaround examples in `docs/wip/artifacts/current-dsl-workarounds.md` remain workarounds until later implementation beads land real artifact support.

## Consequences

### What this unblocks

- `prompt-language-50m6.5` can define package conventions knowing artifact versions are durable run-owned snapshots
- `prompt-language-50m6.7` can add artifact-aware gates without collapsing approval and review into one state machine
- `prompt-language-50m6.8` can decide storage details for review logs and custom types without reopening lifecycle basics

### What this constrains

- future docs must not claim mutable cross-run artifact editing as the default model
- approval UX must remain explicit about whether it is recording flow approval, artifact review, or both
- any syntax proposal must lower to these lifecycle semantics instead of redefining them implicitly

## Explicit non-claims

This note does not settle:

- DSL syntax such as `emit artifact`, `artifact_valid`, or `artifact_status`
- CLI commands for lookup, inspect, or supersede
- renderer plugin APIs
- retention policy, quotas, or large-binary storage mechanics
- whether review comments live inside the package, beside it, or in event logs

Those remain for later beads, especially `prompt-language-50m6.7`, `prompt-language-50m6.8`, and `prompt-language-50m6.9`.
