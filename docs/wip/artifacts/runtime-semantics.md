# Runtime Semantics

## Goal

Artifacts should not be passive blobs. The runtime should be able to reason over them.

## Lifecycle

1. define type
2. emit artifact
3. validate artifact
4. optionally render artifact views
5. optionally request human review or approval
6. optionally consume artifact later in the flow
7. optionally supersede earlier artifacts with revised versions

## Minimal useful semantics

### Create

A flow step emits an artifact into the artifact store.

### Validate

The runtime checks:

- manifest shape
- required fields for the type
- attachment existence
- renderer output status if requested

### Reference

Later steps should be able to reference an artifact by id or alias.

### Review

Humans can:

- comment
- request revision
- approve
- reject
- mark informational

### Gate against artifacts

The runtime should support artifact-aware gates such as:

- `artifact_exists release_packet`
- `artifact_valid release_packet`
- `artifact_status deploy_plan == approved`
- `artifact_review_state qa_packet == changes_requested`
- `artifact_type release_packet == "release_readiness"`

## Relation to current prompt-language

The current shipped DSL already includes:

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

Artifacts are a plausible extension because the runtime already has:

- structured execution
- verification gates
- human approval
- persistent state
- parallel subflows

## Recommended release order

### Phase 1

Artifact folder layout plus manifest convention plus sample renderers

### Phase 2

Artifact registry plus validation plus CLI inspection

### Phase 3

Artifact-aware gates and approvals

### Phase 4

Artifact DSL syntax

### Phase 5

IDE, TUI, or browser review UI
