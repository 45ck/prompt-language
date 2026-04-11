# Design: Safe Parallelism via Worktrees, Locks, Ownership, and Merge Policy

## Status

Accepted design target for `prompt-language-zhog.7`.

Relevant beads:

- `prompt-language-zhog.7` - safe parallelism: worktrees, locks, ownership, and merge policy
- `prompt-language-ik3n` - multi-project orchestration: workspace-aware flow execution across monorepo packages

Primary anchors:

- [Spec 008 — Safe parallelism: worktrees, locks, and ownership](../wip/vnext/specs/008-safe-parallelism-worktrees-locks-ownership.md)
- [Design: Flow IR and Static Analysis](flow-ir-and-static-analysis.md)
- [Design: Provider Adapters Over Shared Flow IR](provider-adapters-shared-flow-ir.md)

Related accepted boundaries:

- [vNext Trust Hardening](vnext-trust-hardening.md)
- [Multi-Agent Orchestration Boundary](multi-agent-orchestration.md)
- [Replayability Event Log](replayability-event-log.md)
- [Hook Manager Ownership and Lifecycle](hook-manager-ownership.md)

This note defines the repo-aligned safety boundary for parallel child execution. It is a design target for backlog execution, not a claim that prompt-language already ships worktree-backed spawn, lock enforcement, or automated merge/backout handling.

## Decision

prompt-language should treat safe parallelism as a runtime safety substrate, not merely as `spawn` ergonomics.

For `prompt-language-zhog.7`, that means parallel child execution may graduate from simple coordination into safe concurrency only when five concerns are made explicit:

1. child runs can execute in isolated worktrees rather than implicitly sharing one checkout
2. shared resources can be protected by explicit locks
3. child runs can declare ownership over paths or other mutable resources
4. merge behavior is explicit rather than implied by child completion
5. backout remains available when child output cannot be merged safely

The intended model is:

- authored flow and compile surfaces describe parallel intent, ownership, locks, and merge policy
- runtime uses that information to prepare isolated execution and reject unsafe combinations
- provider adapters carry out checkout, branch, filesystem, and session mechanics on the selected host
- replay and diagnostics record the resulting child topology, lock events, merge decisions, and backout outcomes

This milestone deliberately distinguishes safe parallel execution from general orchestration convenience. `spawn` and `await` are still the coordination primitives. `prompt-language-zhog.7` adds the isolation and conflict-control contract that makes some concurrent uses trustworthy.

## Why this needs a first-class design boundary

The repo already has a valid subagent-first orchestration direction:

- parent-authored `spawn`
- explicit `await`
- bounded child sessions
- parent-owned completion logic

That is enough for coordination, but not enough for conflict safety.

Without a stronger boundary, parallel children can still interfere through:

- one shared working tree
- shared package manifests or lock files
- overlapping file edits
- races on generated artifacts or reports
- ambiguous assumptions about who is allowed to merge or discard child output

That gap matters even when the product stays subagent-first. A parent may still be the sole orchestrator while children work in parallel on disjoint slices. Safe parallelism is therefore about preserving the current architecture under concurrent execution, not about changing prompt-language into a peer-mesh or autonomous team runtime.

## Coordination is not isolation

The milestone should preserve a crisp distinction:

- coordination decides when children start, what they are asked to do, and when the parent waits
- isolation decides whether those children can mutate shared state safely

`prompt-language-ik3n` is the clearest example of why this distinction matters. Workspace orchestration is primarily a convenience and coverage feature:

- discover workspace packages
- fan out per-package flows
- aggregate results and gates
- optionally filter target packages

That work does not, by itself, define a safe concurrency model for shared manifests, generated artifacts, or cross-package refactors. `ik3n` is about monorepo-aware orchestration. `zhog.7` is about the concurrency substrate that makes some of that orchestration safe to trust at scale.

## Worktree-backed spawn contract

Safe parallelism should add an explicit isolated-execution mode for child runs.

### Child isolation model

When a child is launched with worktree-backed isolation, the runtime should provision, at minimum:

- a dedicated checkout or equivalent isolated filesystem view
- a child-owned branch or branch-like writable ref
- a child-owned run directory and state namespace
- child-scoped artifact and event-log locations

This keeps one child's edits, temporary files, and derived runtime state from silently mutating another child's environment.

### Why worktrees are the right first isolation unit

Git worktrees are the simplest repo-aligned primitive that matches the repo's current execution style:

- they preserve the same repository history and object store
- they let children operate on real files instead of virtual patch buffers
- they align with later merge, diff, replay, and backout workflows
- they are understandable to operators using ordinary repository tooling

The note does not require Git worktrees to be the only future implementation strategy. It does require the isolation semantics to be equivalent: child runs must not appear to share one mutable checkout when safe parallelism is requested.

### Runtime expectations

The runtime should be able to report, at minimum:

- which children ran in shared checkout mode versus isolated worktree mode
- which worktree or equivalent isolated root belongs to each child
- which branch or writable ref each child produced
- whether a child completed cleanly, conflicted, or was backed out

That visibility is necessary for both operator trust and replayability.

## Ownership declarations

Safe parallelism requires explicit ownership, not informal "please stay in this folder" prompts.

### Ownership surface

A child run may declare ownership over:

- path globs or directory roots
- generated outputs
- named shared resources

The first implementation focus should be path ownership because it is the most reviewable and the easiest to connect to repository changes.

### Ownership rules

Ownership declarations should follow these rules:

1. Ownership is advisory only if the runtime cannot enforce or lint it. For this milestone, the target is explicit enforcement or compile-time rejection where possible.
2. Overlapping ownership is allowed only when an explicit shared-resource lock or merge strategy makes that overlap safe enough to reason about.
3. Ownership belongs to child execution planning and diagnostics, not to free-form prompt text.
4. Ownership is about mutation authority, not logical task assignment. A child may discuss broader context, but it should not claim write authority outside its declared scope by default.

### Relationship to compile-time rigor

[Design: Flow IR and Static Analysis](flow-ir-and-static-analysis.md) already calls out child-flow coordination risks such as overlapping ownership assumptions and missing synchronization declarations.

`prompt-language-zhog.7` depends on that compile boundary for three reasons:

- ownership declarations need a stable place in Flow IR
- the linter needs to detect overlap and unsafe combinations before live execution
- explain and compile outputs need to make child mutation scope reviewable without reading raw prompt text

Without Flow IR and static analysis, ownership falls back to conventions rather than enforceable runtime planning.

## Lock contract

Some resources remain shared even when filesystem edits are isolated.

Examples include:

- schema and migration lanes
- package manifests and workspace lock files
- release outputs
- deployment slots
- shared caches or generated indices

Safe parallelism therefore needs explicit lock semantics in addition to worktrees.

### What locks mean here

A lock is a serialized claim over a named shared resource for a bounded period of execution.

The design target is:

- lock acquisition is explicit in authored semantics
- lock ownership is visible in runtime state and event history
- lock conflicts fail or wait according to declared policy rather than producing implicit races
- lock release is deterministic on child completion, failure, or controlled backout

### Lock ordering and diagnostics

The runtime and linter should be able to detect or report:

- child mutations of known shared resources without required locks
- overlapping locks with incompatible acquisition order
- deadlock-prone lock sequences
- children waiting on locks long enough to threaten budget or progress guarantees

This keeps lock semantics aligned with the repo's fail-closed direction rather than treating contention as an informal best effort.

## Merge policy

Safe parallel children do not become trusted simply because they finished.

Completion and merge are separate decisions.

### Required merge postures

The initial design target from Spec 008 remains the right shape:

- `manual`
- `fail_on_overlap`
- `ours_if_nonoverlap`
- `squash_patch`

The important boundary is not the exact keyword list. The important boundary is that the runtime records a merge policy intentionally instead of assuming one.

### Merge rules

For this milestone, merge policy should satisfy these rules:

1. A child completion does not automatically imply parent workspace mutation.
2. Merge decisions are parent-owned, even when child execution was autonomous.
3. Overlap between ownership declarations, lock usage, and actual diffs must be visible before merge is finalized.
4. The runtime may auto-merge only when the declared strategy and observed overlap make that safe enough under the trust model.
5. Unsafe or ambiguous merges must stop as visible conflicts rather than silently picking a winner.

### Relationship to provider adapters

[Design: Provider Adapters Over Shared Flow IR](provider-adapters-shared-flow-ir.md) already separates language semantics from host mechanics.

That split applies directly here:

- the language core owns what merge policy means
- the adapter owns how worktree creation, branch preparation, diff capture, and merge execution happen on a specific host
- adapter capability reporting must surface when a host cannot honor isolated worktrees, merge automation, or diff visibility

This prevents safe parallelism from collapsing into one host's ad hoc filesystem tricks.

## Backout policy

Merge safety is incomplete without an explicit backout posture.

Backout is the rule for what happens when a child run:

- fails terminally
- produces unsafe overlap
- violates ownership or lock expectations
- completes but cannot be merged under the declared strategy

### Required backout behavior

The safe-parallelism milestone should target the following behavior:

1. A child worktree or equivalent isolated execution root can be discarded without corrupting the parent checkout.
2. A merge attempt that fails cleanly can leave the parent in a visible unresolved state or can roll back to the pre-merge baseline according to declared policy.
3. The runtime preserves enough evidence to inspect what the child changed even when backout is chosen.
4. Parent flow advancement after backout is explicit and observable, not hidden behind "child failed" text.

That keeps backout aligned with replayability and operator trust. A discarded child is still part of runtime history.

## Replay and observability requirements

[Replayability Event Log](replayability-event-log.md) already establishes that parent and child runs keep distinct event namespaces with explicit joins.

Safe parallelism should extend that history model with events or equivalent records for:

- isolated child creation
- ownership declarations
- lock acquisition and release
- merge attempts and merge outcomes
- backout actions
- parent decisions at `await` or later synchronization boundaries

This is necessary for the acceptance criterion in Spec 008 that parallel child conflicts remain observable and replayable.

Without that evidence, "safe" parallelism would still be anecdotal.

## Relationship to `prompt-language-ik3n`

`prompt-language-ik3n` remains a valid and narrower backlog item.

### What `ik3n` owns

Workspace orchestration owns:

- workspace detection
- package selection and filtering
- per-package fan-out
- aggregation of child outcomes and gates

Those are orchestration and ergonomics concerns.

### What `zhog.7` owns

Safe parallelism owns:

- isolated execution substrate
- ownership declarations
- shared-resource locks
- merge and backout semantics
- conflict visibility and replayability

Those are concurrency-safety concerns.

### How they fit together

The intended relationship is additive rather than duplicated scope:

- `ik3n` can deliver useful workspace discovery and package fan-out even before the full safe-parallelism substrate exists
- `zhog.7` defines the stronger safety contract that later workspace orchestration should consume where parallel package work stops being naturally isolated
- when package work touches shared manifests, shared lock files, top-level configs, or generated artifacts, `ik3n` should rely on the `zhog.7` substrate rather than inventing its own file-claiming or merge heuristics

In short:

- `ik3n` is not the architecture answer for safe concurrency
- `zhog.7` is not the user-facing replacement for workspace orchestration

One is monorepo-aware orchestration. The other is the underlying safety model for concurrent child mutation.

## What this milestone should eventually deliver

Once the compile and runtime prerequisites are materially in place, `prompt-language-zhog.7` should define:

- a Flow IR representation for isolated child execution, ownership, locks, and merge policy
- static analysis for overlap, missing locks, and unsafe merge combinations
- a runtime contract for preparing isolated worktrees and child-owned refs
- adapter capability reporting for hosts that cannot honor the safety contract fully
- replay and diagnostics surfaces for child isolation, contention, merge, and backout decisions

That is the point where prompt-language can claim safer parallel child execution in a way that is reviewable and testable.

## What this milestone does not promise now

This note does not claim that prompt-language already ships:

- automatic file claiming or work stealing
- peer-mesh agent coordination
- always-on distributed locking across arbitrary external systems
- conflict-free auto-merge for all overlapping edits
- a new multi-agent product category beyond the accepted subagent-first runtime

It also does not reopen the [Multi-Agent Orchestration Boundary](multi-agent-orchestration.md). Safe parallelism strengthens the current parent-authored child-run model. It does not replace it with autonomous team semantics.
