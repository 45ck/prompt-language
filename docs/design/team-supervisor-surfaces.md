# Design: Team Supervisor Surfaces

## Status

Accepted design target for bead `prompt-language-f7jp.8`.

Anchors:

- [Spec 007 - Team Supervisor](../wip/reviews/2026-04-11-omx-adaptation-pack/specs/007-team-supervisor.md)
- [Open Questions and Risks](../wip/reviews/2026-04-11-omx-adaptation-pack/04-open-questions-and-risks.md)
- [Multi-Agent Orchestration Boundary](multi-agent-orchestration.md)
- [Operator Shell Boundary](operator-shell-boundary.md)

## Decision

prompt-language may add **shell-level team supervisor surfaces** over existing child-flow orchestration, but those surfaces remain a thin operational layer over the current `spawn` / `await` model.

The supervisor is allowed to:

- discover related child runs
- persist team-topology metadata for recovery and visibility
- render aggregate status over a parent run and its children
- help an operator resume supervision after interruption
- help an operator stop active child runs in a bounded, inspectable way

The supervisor is not allowed to:

- introduce a new team-runtime semantics
- create autonomous peer coordination outside the parent flow graph
- become more authoritative than the underlying run and child-run state

This is a shell convenience and recovery surface, not a reopening of agent-team semantics.

## Why this needs a first-class design

The imported supervisor pack is directionally useful, but this repo already has explicit architecture constraints:

- multi-agent behavior stays subagent-first
- shell features must lower to visible runtime artifacts
- recovery and diagnostics must stay grounded in the current run-state model

Without a design note, "team supervision" could be misread as a new orchestration model rather than what this backlog item actually needs: a shell that helps operators inspect and recover groups of child runs already launched by explicit parent-authored flows.

## Core model

The unit of execution remains the **run**.

A **team** is an operator-shell view over one parent run and the child runs it launched through existing orchestration primitives such as:

- `spawn`
- `await`
- `foreach-spawn`
- `race`

The parent flow remains canonical for:

- decomposition
- launch points
- synchronization
- variable import
- gate ownership
- completion criteria

The supervisor adds no independent planning, delegation, or routing semantics. It only groups and presents already-existing runtime relationships.

## Topology metadata

The shell may persist **team-topology metadata** to make recovery and supervision practical, but this metadata is secondary to runtime state.

Required properties of topology metadata:

- it is derived from parent-run and child-run artifacts
- it is safe to rebuild when missing
- it never becomes the only source of truth for child status
- it records enough stable identity to reconnect supervision surfaces after interruption

The canonical topology record should capture:

- team identifier
- root parent run identifier
- supervisor creation timestamp
- child run identifiers
- child labels or aliases used by the parent flow
- launch provenance such as step name, node id, or rendered spawn site when available
- parent-to-child relationship type such as direct child or fan-out child
- runner or harness identifiers when relevant to recovery
- optional adapter attachments such as worktree path or terminal session id
- last observed aggregate state snapshot

Important constraint:

Topology metadata is an index for shell recovery. It is not permission to mutate child behavior without consulting the child-run state itself.

## `team-status`

`team-status` is the primary read surface.

Its job is to render the current known team topology and child-run state in one operator view.

Minimum responsibilities:

- show the root run and known child runs
- show each child's current lifecycle state such as running, completed, failed, stopped, or missing
- show whether the aggregate team is blocked on active children, fully settled, partially missing, or in conflict
- surface parent-child relationships clearly enough that operators can tell which child belongs to which launch point
- show whether optional adapters are attached
- point to the underlying run-state or diagnostics paths rather than hiding them

`team-status` should prefer derived and inspectable facts over optimistic summaries. When status cannot be resolved cleanly, it should surface ambiguity rather than pretend the team is healthy.

## `team-resume`

`team-resume` restores the supervision surface after operator interruption.

It does not re-plan the team and it does not reinterpret the flow. Its job is to:

1. locate the team-topology metadata or reconstruct it from runtime artifacts
2. reattach the shell to the root run and known child runs
3. refresh current child state from the underlying run-state
4. reopen optional adapters only when they are available and safe to reattach

`team-resume` must not:

- silently spawn replacement children for missing runs
- convert completed teams back into active orchestration
- invent missing topology when the runtime evidence is contradictory

If the topology cannot be reconstructed safely, the command should degrade into diagnostics rather than guessing.

## `team-stop`

`team-stop` is a bounded operator control surface for shutting down an active supervised team.

Its semantics are child-run-oriented:

- discover active children associated with the team
- request stop using the existing child-run stop mechanism
- report which children stopped, were already settled, or could not be reached
- leave a visible audit trail in the same run-state and diagnostics model used elsewhere

`team-stop` does not define a new cancellation model. It is a batch supervisor action over already-existing child stop behavior.

Required safety constraints:

- never stop runs that are not part of the resolved team topology
- never treat missing topology as license for broad process cleanup
- report partial failure explicitly
- preserve already-settled children as settled rather than rewriting history

## Relation to child runs

The team supervisor must preserve a strict child-run boundary.

Each child run keeps its own:

- runtime state
- logs and diagnostics
- gate outcomes
- completion or failure reason

The supervisor may aggregate these, but it must not flatten them into a single opaque team state that cannot be traced back to individual runs.

Practical rule:

When a supervisor surface needs to explain a team condition, it should be able to answer with a concrete child-run or parent-run reference. If it cannot, the shell is inventing state it should not own.

## Optional adapters

Optional host adapters such as worktrees, terminal sessions, or runner-specific attachments are valid only as secondary enrichments.

They may help:

- reopen a worktree for a child run
- reattach to a terminal or host session
- show runner-specific launch details

They may not:

- redefine what a team is
- become mandatory for supervision to work
- replace the runtime-owned notion of parent and child runs

This matters because the shell must stay portable across runner adapters. Worktrees or tmux-like attachments can improve operations, but they are not the semantic center of supervision.

## Explicit non-goals

The following are out of scope for this design:

- team memory or blackboard coordination
- autonomous task claiming or work stealing
- peer-to-peer routing or role negotiation
- nested team semantics beyond existing parent-child execution
- hidden long-lived supervisor daemons that keep coordinating outside visible runtime state
- tmux-first or worktree-first product framing
- any shell feature that bypasses the current `spawn` / `await` orchestration contract

## Consequences

What this unblocks:

- a concrete shell contract for `team-status`, `team-resume`, and `team-stop`
- recovery-oriented topology indexing without reopening orchestration architecture
- future runner-specific adapter work that still composes with one supervision model

What this constrains:

- user-facing docs must describe team supervision as an operator shell over child runs, not as a new team runtime
- future supervisor work must stay explainable in terms of parent-run and child-run artifacts
- additional surfaces such as `team-render` or `team-doctor` should be evaluated against this same boundary rather than treated as a license for broader team semantics

## Practical rule

When evaluating a team-supervisor feature, ask:

> Does this help an operator inspect, recover, or stop an explicit parent-authored set of child runs, or does it invent a new team control plane that can outgrow the visible flow graph?

If it does the first, it likely fits bead `prompt-language-f7jp.8`.

If it does the second, it is out of scope unless the project deliberately reopens the multi-agent architecture boundary.

## Bead closure

This bead appears closable at the design-doc level. The boundary, shell surfaces, child-run relationship, adapter role, and non-goals are now explicit without reopening agent-team semantics.

## Changed files

- `docs/design/team-supervisor-surfaces.md`
