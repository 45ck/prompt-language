# Design: Swarm Tooling Visibility

## Status

Accepted backlog-ready direction for `prompt-language-1wr7.5`.

## Problem

If `swarm` is introduced as a readability feature over `spawn` / `await` / `send` / `receive`, the tooling surface can easily drift into a misleading abstraction layer.

The main risk is that CLI output, status views, or debugging commands start describing a hidden "swarm runtime" instead of the actual lowered execution model. That would conflict with the subagent-first boundary in [multi-agent-orchestration.md](./multi-agent-orchestration.md) and make failures harder to diagnose when authored `swarm` syntax behaves differently from the lowered flow the runtime really executes.

## Decision

Swarm tooling must expose execution in a way that stays grounded in the lowered runtime.

That means:

- authors must be able to inspect the lowered flow before or during execution
- status output must identify the active swarm role in terms that map back to the child runtime actually running
- failure output must explain which role failed, what lowered child execution failed, and whether a role returned data before failing
- tooling must not invent a second hidden scheduler, hidden role state machine, or hidden success model that cannot be reconciled with ordinary child-session execution

`swarm` may improve readability, but it must not become a debugging blindfold.

## Boundary

This note follows the accepted v1 shape in [docs/wip/swarm/06-implementation-plan.md](../wip/swarm/06-implementation-plan.md) and the lowering contract in the swarm WIP notes:

- `swarm` is a macro over existing primitives
- the parent flow remains authoritative
- roles are bounded child templates, not autonomous peers
- visibility must describe parent-authored coordination of lowered child runs

The tooling surface should help users move cleanly between:

1. authored swarm syntax
2. lowered ordinary flow nodes
3. live child execution state

If any of those three views disagree, the lowered runtime remains the source of truth.

## Required visibility surfaces

### 1. Lowered-flow preview

Tooling must provide a supported way to inspect the lowered flow for a `swarm` definition.

Acceptable shapes:

- `validate --expand`
- `validate --lowered`
- a comparable inspect command that prints the exact lowered flow nodes

Minimum requirements:

- show the generated `spawn`, `await`, `send`, and `receive` structure in execution order
- preserve enough role naming to map lowered nodes back to authored `swarm.<role>` concepts
- show namespaced result import behavior such as `<swarm>.<role>.*`
- avoid paraphrased summaries when an exact lowered form is available

This preview is not optional "advanced mode". It is the primary escape hatch when authored swarm syntax is unclear or a lowering bug is suspected.

### 2. Active-role visibility

CLI and status surfaces must show which swarm roles are:

- declared but not started
- started and currently running
- completed successfully
- completed without a return payload
- failed

This visibility may appear in the main status view, watch mode, or a swarm-specific section, but it must map directly to ordinary child execution.

Minimum data per active or completed role:

- swarm id
- role id
- lowered child/session identity
- lifecycle state
- started-at timestamp
- completed-at timestamp when available
- return-present flag

The role label shown to the user should not hide the underlying child identity. A user debugging `role reviewer` must be able to see that it is the same child run later referenced by lowered `await` / `receive` behavior and logs.

### 3. Failure visibility

When a role fails, the CLI or status output must make the failure legible without forcing users to reverse-engineer the abstraction.

Minimum failure details:

- which `swarm` and `role` failed
- which lowered child execution failed
- child exit status or equivalent runtime failure reason
- whether the role produced a return payload before failure
- whether parent import for `<swarm>.<role>.*` occurred
- which parent `await` or join point observed the failure, if applicable

Failures should be reported in the authored vocabulary first and the lowered vocabulary second, for example:

`swarm checkout_fix role reviewer failed`

followed by the concrete lowered runtime reference that explains where to inspect further.

## Grounding rule

All swarm tooling must satisfy this rule:

> Any user-visible swarm state must be derivable from the lowered runtime, not from a separate hidden abstraction.

Applied consequences:

- no swarm-only "green" state if the lowered child run failed
- no role-complete state before the lowered `await` / join semantics make that completion visible to the parent
- no synthetic success state that ignores missing `return` transport
- no hidden retry or healing story unless it exists in ordinary runtime behavior
- no status wording that implies peer autonomy, task claiming, or team-level coordination outside the parent flow

The swarm abstraction may summarize, but it must not editorialize beyond what the lowered execution can justify.

## Recommended status model

To keep the tooling legible, role lifecycle should stay close to ordinary child execution:

- `declared`
- `running`
- `succeeded`
- `succeeded_no_return`
- `failed`

If the implementation needs finer internal detail, that detail should not replace these externally understandable states unless the extra states map clearly to observable lowered behavior.

## Authored vs lowered presentation

The preferred user experience is a paired view:

- authored view: `swarm repair role backend is running`
- lowered view: child run identity, corresponding `spawn`, and pending `await` / `receive`

This gives maintainers a readable top layer without sacrificing the concrete execution model needed for debugging, smoke tests, and support.

## Non-goals

This note does not authorize:

- a separate swarm scheduler
- hidden coordination state outside ordinary session/runtime data
- peer-to-peer role coordination views that imply agent-team semantics
- nested swarm observability requirements for v1
- speculative status such as "reviewing", "synthesizing", or "negotiating" unless those states correspond to explicit lowered flow nodes

## Backlog-ready acceptance criteria

`prompt-language-1wr7.5` is ready to close when tooling behavior satisfies all of the following:

- a maintainer can inspect an exact lowered-flow preview for a `swarm`
- the live CLI or status output identifies active and completed roles with a direct mapping to lowered child execution
- role failures are visible in both authored-role terms and lowered-runtime terms
- status wording stays consistent with the subagent-first boundary and does not imply a hidden swarm runtime
- debugging a swarm issue does not require guessing whether the authored syntax or lowered runtime is authoritative

## Why this matters

The strongest reason to ship `swarm` at all is readability. That benefit disappears if the abstraction hides the real execution model at the exact moment users need to trust or debug it.

Readable authoring and inspectable lowering are not competing goals here. For a subagent-first product, they are the same contract viewed from two different angles.
