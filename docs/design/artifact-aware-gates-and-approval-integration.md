# Design: Artifact-Aware Gates and Approval Integration

## Status

Accepted design target for `prompt-language-50m6.7`.

Primary anchors:

- [`artifact-package-contract.md`](artifact-package-contract.md)
- [`artifact-runtime-lifecycle.md`](artifact-runtime-lifecycle.md)
- [`artifact-extension-boundary.md`](artifact-extension-boundary.md)
- [`../wip/artifacts/proposed-artifact-syntax.md`](../wip/artifacts/proposed-artifact-syntax.md)
- [`../wip/artifacts/open-questions.md`](../wip/artifacts/open-questions.md)

This note defines the repo-owned runtime semantics for artifact-aware gate predicates and for approval steps that inspect artifact revisions. It does not claim that artifact DSL syntax, approval UX, or review UI is already shipped.

## Decision

prompt-language should treat artifact-aware gates as **read-only predicates over one resolved artifact revision**.

Approval integration should be **explicit, version-scoped, and non-conflating**:

- an approval step may target an artifact revision for inspection
- an approval outcome remains a flow-control result owned by the approval step
- artifact review state remains artifact metadata owned by the reviewed revision
- the runtime may record both in one interaction, but it must not collapse them into one hidden state machine

The accepted semantic model is:

1. artifact resolution happens before gate evaluation
2. gates observe validation, review, approval linkage, and supersession facts for that resolved revision
3. approval steps bind to one concrete revision at approval start
4. superseding revisions never inherit approval or review outcomes automatically

## Why this slice is necessary

The earlier artifact notes already separate package identity, lifecycle, and extension ownership. What remains open is how flows should make deterministic decisions once artifacts exist.

Without this slice, later implementation would drift toward one of three bad outcomes:

- gate predicates would quietly inspect generic files instead of typed artifact revisions
- `approve` would become an implicit artifact review API with unclear version scope
- superseded or re-emitted artifacts would accidentally satisfy earlier approval or gate checks

This note fixes those runtime semantics while leaving syntax shape and review UI rollout to later work.

## Boundary

This note is about:

- which artifact facts gates may inspect
- how artifact references are resolved for gate evaluation
- how an approval step may target a reviewed artifact revision
- how rejected, changes-requested, invalid, and superseded states behave in flow evaluation

This note is not about:

- manifest shape or package layout
- custom type declaration syntax
- renderer plugins or review UI
- retention policy, quotas, or storage backends
- broad user-facing DSL rollout

## Core model

### Artifact handle model

Artifact-aware gates must not inspect arbitrary file paths. They inspect a resolved artifact handle.

A resolved handle must identify:

- artifact lineage or artifact id
- concrete revision id
- owning run id
- current revision status at the time of evaluation

The important rule is that gate evaluation happens against a concrete revision snapshot, not an ambient concept like "whatever file is in that directory now."

### Resolution rule

Before a gate predicate runs, the runtime resolves the requested artifact reference into one of two outcomes:

- `resolved` to one concrete artifact revision
- `missing` because no matching artifact revision is available

Resolution must be deterministic and visible in traces or diagnostics. The runtime must not silently switch from one revision to a newer superseding revision unless the flow explicitly asked for the current preferred revision of that lineage.

### State families

Artifact-aware gates may inspect four distinct state families:

| State family      | Question answered                                    | Example values                                            |
| ----------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| existence         | does a revision resolve at all                       | `missing`, `present`                                      |
| validation        | did this revision satisfy package and schema checks  | `pending`, `valid`, `invalid`                             |
| review            | what judgment was recorded against this revision     | `unreviewed`, `changes_requested`, `accepted`, `rejected` |
| revision standing | is this still the preferred revision for its lineage | `active`, `superseded`                                    |

Approval is not a fifth artifact state family. Approval belongs to flow execution. A gate may inspect approval outcomes that were explicitly linked to an artifact revision, but approval is not stored as a substitute for review state.

## Runtime flow

The accepted runtime sequence is:

1. A flow emits an artifact revision.
2. Validation records `pending`, then `valid` or `invalid`.
3. An optional approval step binds to that exact revision.
4. The approver may inspect the revision and optionally record a review outcome for the same revision.
5. Gates and `done when:` predicates observe the recorded validation, review, approval linkage, and supersession facts.
6. If a new revision is emitted, the earlier revision may become `superseded`, but its review and approval history remains attached to that older revision.

Important consequence:

- a flow that wants a newly emitted revision approved must obtain approval for that exact new revision
- a previously approved revision does not make the successor approved

## Gate predicate model

The runtime should support both boolean predicates and explicit state selectors.

### Boolean predicates

Boolean predicates are for the common yes or no checks in `done when:` or guard conditions.

Accepted predicate set:

- `artifact_exists(ref)`
- `artifact_valid(ref)`
- `artifact_invalid(ref)`
- `artifact_reviewed(ref)`
- `artifact_accepted(ref)`
- `artifact_rejected(ref)`
- `artifact_changes_requested(ref)`
- `artifact_active(ref)`
- `artifact_superseded(ref)`

Boolean predicates must be side-effect free.

Deterministic rule for missing references:

- `artifact_exists(ref)` returns `false`
- all other boolean predicates also return `false`

This avoids throwing control-flow errors just because a not-yet-emitted artifact was checked in a guard.

### State selectors

State selectors are for flows that need explicit comparisons instead of derived booleans.

Accepted selector families:

- `artifact_validation_state(ref)` -> `missing | pending | valid | invalid`
- `artifact_review_state(ref)` -> `missing | unreviewed | changes_requested | accepted | rejected`
- `artifact_revision_state(ref)` -> `missing | active | superseded`

These selectors keep the model explicit and avoid overloading one generic `artifact_status` field with incompatible meanings.

### Why generic `artifact_status` is rejected

One flat selector like `artifact_status(plan) == approved` looks concise, but it collapses too many meanings:

- validation success versus human acceptance
- approval-step result versus artifact review state
- active revision versus superseded revision

The repo should prefer explicit selectors even if later syntax sugar is added on top.

## Deterministic semantics

### Validation predicates

Validation semantics:

- `artifact_valid(ref)` is `true` only when the resolved revision has validation state `valid`
- `artifact_invalid(ref)` is `true` only when the resolved revision has validation state `invalid`
- `pending` validation satisfies neither predicate
- `missing` satisfies neither predicate

This means "artifact exists" and "artifact is valid" are intentionally different checks.

### Review predicates

Review semantics:

- `artifact_reviewed(ref)` is `true` for `accepted`, `rejected`, or `changes_requested`
- `artifact_accepted(ref)` is `true` only for `accepted`
- `artifact_rejected(ref)` is `true` only for `rejected`
- `artifact_changes_requested(ref)` is `true` only for `changes_requested`
- `unreviewed` and `missing` satisfy none of those outcome predicates

This preserves the difference between "someone looked at it" and "it passed review."

### Revision predicates

Revision-standing semantics:

- `artifact_active(ref)` is `true` only for the currently preferred revision in that lineage
- `artifact_superseded(ref)` is `true` only when a newer revision explicitly supersedes it
- a superseded but accepted revision stays accepted in review history, but it is no longer the active revision

This lets flows require both acceptance and currency when needed.

Example:

```text
done when:
  artifact_valid release_packet
  artifact_accepted release_packet
  artifact_active release_packet
```

That is materially different from checking acceptance alone.

## Approval integration

### Approval target binding

If an approval step targets an artifact, the runtime must bind the approval request to one concrete revision before the prompt is shown to the approver.

The bound approval record must include:

- approval step id
- artifact id
- revision id
- run id
- approval timestamp

The approver must be reviewing that bound revision, not a floating alias that can change while the approval is in progress.

### Approval outcome versus review outcome

Approval outcome and artifact review outcome are related but not identical.

Approval outcome belongs to the flow step:

- `approved`
- `rejected`
- `changes_requested`

Artifact review outcome belongs to the artifact revision:

- `unreviewed`
- `accepted`
- `rejected`
- `changes_requested`

The runtime may offer a coupled path where one approval action also records the matching artifact review event for the bound revision. When it does, the linkage must be explicit in stored records.

The runtime must not assume:

- approval of a flow step automatically reviews every artifact mentioned in that step
- artifact acceptance automatically means the flow's approval step passed

### Coupled approval path

The accepted coupled path is:

1. an approval step targets artifact revision `rN`
2. the approver chooses `approve`, `reject`, or `request_changes`
3. the approval step records its own step outcome
4. if configured to do so, the runtime appends the corresponding review event to revision `rN`

This gives the repo one coherent interaction without erasing the boundary between control flow and artifact metadata.

### Supersession rule

If revision `rN+1` supersedes `rN`, then:

- approval and review records for `rN` stay attached to `rN`
- `rN+1` starts with its own validation and review state
- any flow that wants `rN+1` accepted must approve or review `rN+1` explicitly

This rule prevents accidental carry-forward of approval across revisions.

## Approval-aware gate usage

Two usage patterns are acceptable.

### Pattern A: gate on review facts

The flow gates on artifact review state directly:

```text
done when:
  artifact_valid deploy_plan
  artifact_accepted deploy_plan
  artifact_active deploy_plan
```

Use this when the artifact's own review state is the business condition.

### Pattern B: gate on flow approval plus artifact facts

The flow gates on approval success and on artifact identity separately:

```text
done when:
  artifact_valid deploy_plan
  approval_passed("review_deploy_plan")
  artifact_active deploy_plan
```

Use this when the approval step matters as a workflow checkpoint even if the artifact review ledger is stored separately.

The repo should support both patterns because one is artifact-centric and the other is flow-centric.

## Rejected behaviors

The runtime must reject these behaviors by design:

- treating arbitrary files as artifacts in gate evaluation
- auto-passing approval for a superseding revision because the earlier revision was accepted
- interpreting missing artifacts as valid or approved
- collapsing validation, review, and approval into one ambiguous `status`
- letting a long-running approval prompt float to whichever revision is newest when the approver submits

## Non-goals

This slice does not:

- define final DSL syntax for artifact-aware gates
- claim that `artifact_exists`, `artifact_valid`, or related selectors are already implemented
- define review UI components or CLI commands
- define storage layout for review comments beyond the earlier extension-boundary decision
- replace existing `approve` semantics with artifact review metadata
- allow artifacts to replace variables, logs, snapshots, or generic gate prerequisites

## Consequences for implementation

This decision constrains the later implementation slice for `prompt-language-50m6.7` as follows:

- gate evaluation must resolve artifact references explicitly and deterministically
- runtime records must keep validation, review, approval, and supersession facts distinct
- approval targeting must bind to one concrete revision before human action starts
- tests must cover `missing`, `valid`, `invalid`, `accepted`, `rejected`, `changes_requested`, and `superseded`
- later syntax sugar, if any, must lower to these explicit semantics instead of inventing a broader status model

## Current repository status

As of April 11, 2026, this repository has accepted design notes for artifact packaging, lifecycle, and extension boundaries, but not yet the implementation evidence for artifact-aware gate execution and approval coupling.

What is currently shipped:

- generic completion-gate evaluation for built-in predicates, custom commands, and boolean variables
- generic validate/preflight checks for runner compatibility and ordinary gate prerequisites
- approval flow handling through existing step state such as `approve_rejected`

What is still missing for `prompt-language-50m6.7`:

- artifact reference resolution from a gate predicate to one concrete artifact revision
- gate evaluation over artifact validation, review, revision-standing, and supersession facts
- explicit approval binding to `artifact id + revision id + run id`
- deterministic tests for `missing`, `valid`, `invalid`, `accepted`, `rejected`, `changes_requested`, and `superseded` artifact cases

This note closes the design gap for `prompt-language-50m6.7`, but it should not be read as a claim that the bead is fully implemented or ready to close without the runtime and test work described in the bead itself.
