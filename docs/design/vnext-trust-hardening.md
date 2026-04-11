# Design: vNext Trust Hardening

## Status

Accepted design target for the vNext trust-hardening milestone.

Relevant bead:

- `prompt-language-zhog.1` - P0 trust hardening: strict mode, approval timeouts, budgets, and checkpoints

Primary anchors:

- [Spec 001 — Trust model and strict mode](../wip/vnext/specs/001-trust-model-and-strict-mode.md)
- [Spec 006 — Policy, risk, and budgeting](../wip/vnext/specs/006-policy-risk-and-budgeting.md)
- [Spec 007 — Checkpoints, event log, and replay](../wip/vnext/specs/007-checkpoints-event-log-and-replay.md)

Related current design constraints:

- [Diagnostics Contract V1](diagnostics-contract-v1.md)
- [Run-State V2 and Recovery Artifacts](run-state-v2-recovery-artifacts.md)
- [Evaluation Stack V1 Boundary](evaluation-stack-v1.md)

This note defines the bounded contract for fail-closed trusted execution in vNext. It is a design target for backlog execution, not a claim that the full surface is already shipped.

## Decision

prompt-language vNext may support permissive and balanced execution for exploration, but **trusted execution** is defined by one stronger rule:

- when the runtime no longer knows enough to continue safely, it must stop, persist structured failure state, and require an explicit recovery decision

For `prompt-language-zhog.1`, that rule becomes concrete in three linked surfaces:

1. strict-mode behavior for ambiguity and recovery-sensitive failures
2. hard budgets that bound autonomous execution before it drifts
3. checkpoint and restore semantics strong enough to stop, explain, and resume safely

This bead does not deliver the full replay/event-log substrate or the full contracts/effects/capabilities system. It fixes the trust boundary that later work must obey.

## Why this needs a first-class boundary

The repo already has partial movement in the right direction:

- approval and review semantics exist, but timeout and exhaustion behavior is still split across backlog slices
- runtime diagnostics now distinguish several blocked/runtime/outcome classes, but not all trust failures share one contract yet
- mutable session state exists, but the minimum checkpoint and restore guarantees are not written down in one place

Without a bounded trust contract, later work on effects, replay, safe parallelism, and evaluation can easily reintroduce fail-open behavior under a different name.

## Trust modes

vNext may expose three operator-facing trust presets:

- `permissive` - experimentation-friendly, may allow selected fallbacks
- `balanced` - fail closed on high-risk and recovery-sensitive failures, allow limited low-risk fallbacks
- `strict` - fail closed on all ambiguity covered by this note

This design note defines the **strict** contract. Other modes may relax behavior only where this note explicitly allows it.

## Strict-mode failure contract

Strict mode applies to five failure classes that matter because they can silently change what the runtime believes happened.

### Unknown variables

Strict-mode rule:

- unknown variable references are never rendered as an empty string, raw token, or best-effort interpolation

Required behavior:

- statically resolvable unknown references should fail at compile or lint time
- dynamically discovered unknown references must fail before the consuming node executes
- the failure must identify the variable name, consuming node, and whether the miss was compile-time or runtime

Consequence:

- strict execution cannot proceed on a guessed or silently degraded value

### Capture failures

Strict-mode rule:

- capture failure is a blocking runtime failure, not a fallback to raw or empty output

Capture failure includes:

- parse failure
- schema validation failure
- missing capture file
- empty capture where a non-empty capture is required
- retry exhaustion for structured capture

Required behavior:

- the runtime must stop at the capture site
- the failure record must preserve the capture target, expected shape, retry count, and last observed raw payload when safe to retain
- no strict-mode path may silently continue with `""`, partial JSON, or a best-effort coercion

Relationship to current diagnostics:

- this aligns with the repo's existing runtime-diagnostic direction rather than introducing a parallel "soft warning" channel for trusted execution

### Approval timeouts

Strict-mode rule:

- approval timeout resolves as **not approved**

Required behavior:

- timeout must not auto-approve
- timeout must not silently continue the guarded branch
- timeout must be distinguishable from "approval unsupported in this profile"

Operational meaning:

- unsupported approval remains a preflight/profile diagnostic
- a timed-out approval request is a runtime non-approval result with explicit cause `timeout`

This keeps approval timeout behavior aligned with the repo's outcome/diagnostic split instead of collapsing unsupported and denied cases together.

### Review exhaustion

Strict-mode rule:

- exhausted review loops are a fail-closed terminal condition for that path

Required behavior:

- when a strict review block reaches `max` rounds without a passing result, the flow must not continue as if review succeeded
- the failure record must preserve round count, last verdict, and the recovery action now required

Allowed relaxation outside strict mode:

- permissive or balanced flows may still surface review exhaustion as an explicit negative outcome instead of a blocking failure where the author opts into that behavior

### State corruption

Strict-mode rule:

- unreadable, incompatible, or contradictory runtime state blocks execution and resume

State corruption includes:

- unreadable or partially written session state
- incompatible checkpoint metadata
- missing required checkpoint payload for a requested restore mode
- contradictions between canonical runtime state and required recovery metadata that the runtime cannot reconcile deterministically

Required behavior:

- the runtime must not guess, auto-repair, or continue from a reconstructed best effort
- resume must stop in an explicit failed state with recovery guidance
- repair requires a human decision such as restore, reset, or manual state fix

This aligns with the repo's fail-closed direction for session-load corruption and extends it to checkpoint and restore paths.

## Budget contract

Trust hardening also requires bounded execution. Budgets are not reporting hints. They are enforcement points.

### Budget types

The trust-hardening milestone covers these hard ceilings:

- `max_turns`
- `max_runtime`
- `max_cost_usd`
- `max_commands`
- `max_files_changed`
- `max_child_flows`

### Budget meanings

`max_turns`

- counts prompt-language-initiated model turns such as prompt, ask, review/judge attempts, and structured capture retries
- human approval responses do not count as turns

`max_runtime`

- measures wall-clock elapsed time from run start until completion, pause, or terminal failure

`max_cost_usd`

- measures adapter-reported execution cost for model/evaluator usage that prompt-language can attribute to the run

`max_commands`

- counts external command executions launched by runtime nodes, gate evaluation, or runner-managed helpers

`max_files_changed`

- counts distinct workspace paths changed by the run
- in v1 trust hardening this is defined over the workspace snapshot delta visible to prompt-language, not over arbitrary untracked host mutations it cannot observe

`max_child_flows`

- counts child runs started through `spawn`, `foreach-spawn`, or equivalent child-launching constructs

### Enforcement rules

Budgets must be enforced:

- before starting an action that would obviously exceed a ceiling
- after each node completion for ceilings that can only be measured post-action
- on parent and child boundaries, not just at terminal completion

When a budget is exceeded, the runtime must:

1. stop further autonomous advancement
2. persist a checkpoint or failure snapshot suitable for inspection and resume
3. record a structured non-success result with the exceeded budget type and measured value
4. require explicit human continuation if policy allows continuation at all

Budget exhaustion is never treated as silent success.

### Measurement support is mandatory under strict mode

If a flow declares a strict budget that the selected runner or adapter cannot measure reliably enough, execution must block before run start.

Examples:

- `max_cost_usd` without a usable cost adapter
- `max_files_changed` on a runner path that cannot provide a trustworthy workspace delta

The runtime may support best-effort reporting in non-strict modes, but strict mode cannot pretend a budget is enforceable when it is not.

### Parent and child budget inheritance

Child runs inherit trust mode and remaining parent budget unless the parent flow explicitly narrows them further.

Required constraints:

- a child may be stricter than its parent, but not looser by default
- a child budget cannot exceed the remaining parent budget for the same resource
- child exhaustion must be visible to the parent as a structured child result, not hidden inside generic child failure text

This makes `prompt-language-zhog.7` safe parallelism and later supervisor work build on bounded children rather than unconstrained delegated sessions.

## Checkpoint and restore contract

This bead needs checkpoint semantics strong enough for explicit failure and recovery, but it does not take ownership of full replay infrastructure.

### Scope of this milestone

`prompt-language-zhog.1` defines:

- when checkpoints are required
- what minimum data a checkpoint must capture
- what restore modes mean
- when restore must refuse to apply

`prompt-language-zhog.3` remains responsible for:

- append-only execution events
- derived snapshots from an event log
- replay/trace/report tooling
- retention and auditability policy beyond the minimal recovery contract

### Required checkpoint moments

The runtime must be able to create checkpoints:

- at run start
- before an irreversible or high-risk effect when policy requires one
- before pausing for approval on a high-risk path
- when a run is about to enter a blocked trust failure or exhausted-budget state, as long as state is still readable enough to capture
- at explicit authored `checkpoint` statements

Checkpoint creation may be skipped only when the runtime is already in a corruption state that prevents a trustworthy capture. In that case the corruption failure itself must say that no valid checkpoint could be created.

### Minimum checkpoint contents

Each checkpoint must capture enough information to make restore and resume deterministic at the current milestone boundary.

Minimum required fields:

- checkpoint id
- run id
- created time
- source node path
- trust mode
- captured scope: `state`, `files`, or `both`
- parent checkpoint id when derived from an earlier checkpoint
- resumable cursor or last completed node pointer
- budget counters at capture time
- child-run summary when children exist
- integrity metadata sufficient to reject mismatched restore payloads

The checkpoint payload may live in the current state model or a richer run-state envelope, but the restore semantics must stay stable either way.

### Restore modes

Supported restore targets:

- `restore <id> state`
- `restore <id> files`
- `restore <id> both`

Required meanings:

- `state` restores runtime state and resumable cursor only
- `files` restores workspace files covered by the checkpoint without advancing runtime state
- `both` restores state and files as one recovery operation

### Restore safety rules

Restore must be conservative.

Required rules:

- restore must fail if the requested checkpoint does not exist
- restore must fail if the checkpoint was not captured with the requested scope
- restore must fail if integrity checks say the payload is unusable or mismatched
- `both` must apply atomically; partial success is not allowed
- restore must not auto-resume execution as a side effect

After restore, the run returns to a paused, inspectable state. A separate explicit resume decision is required.

### Resume semantics

Trust hardening depends on resume pointing to a known-good boundary.

Required rule:

- resume starts from the last completed safe execution boundary represented by the restored state, not from an ambiguous "current node" that may have been half-executed

This means the trust-hardening milestone depends on a real completed-node or equivalent resumable-cursor concept rather than a best-effort restart from mutable in-progress state.

That dependency is why the existing resume-granularity backlog remains directly relevant to this bead.

## Explicit invariants

Later work must preserve these invariants.

1. Strict mode never silently substitutes an unknown value for a required runtime fact.
2. Strict mode never auto-approves on timeout.
3. Strict mode never treats exhausted review as success.
4. Strict mode never resumes from corrupted or contradictory state.
5. Declared strict budgets are either enforceable or they block execution up front.
6. Budget exhaustion always produces a structured non-success result and a resumable inspection point.
7. Child runs inherit trust and boundedness from the parent unless explicitly narrowed further.
8. Restore never applies a partial `both` recovery.
9. Checkpoint identity and capture scope are immutable once written.
10. The current runtime snapshot remains the compatibility authority until broader replay/event-log work deliberately replaces that contract.

## Relationship to current architecture

This design preserves the repo's current architectural direction.

- Domain stays responsible for trust-state semantics, budget counters, checkpoint invariants, and restore rules.
- Application/runtime layers enforce those rules when advancing flows, evaluating completion, pausing for approval, or resuming runs.
- Infrastructure layers provide measurable adapters for cost, workspace-diff, file restore, and persistence, but they do not redefine the trust contract.

That keeps trust hardening as an inward architectural constraint rather than a shell-only or CLI-only feature.

## Out of scope

This bead does not include:

- the full append-only replay/event-log/report stack
- a complete effect/capability language or policy compiler
- safe-parallelism worktrees, file locks, or merge policy
- remote policy engines or organization-wide approval services
- model-judge expansion beyond what is needed to define strict review exhaustion semantics
- claiming every budget can already be measured on every current runner
- rewriting user-facing reference docs to present the full vNext contract as already shipped

## How this bead gates later work

### What it blocks

`prompt-language-zhog.2` is correctly blocked by this bead.

Reason:

- contracts, effects, policy tiers, and capability declarations need stable answers for fail-closed behavior, child inheritance, checkpoint requirements, and budget enforcement before they can be specified cleanly

Without this contract, bounded execution would just relocate ambiguity into policy syntax.

### What it enables

This bead enables:

- `prompt-language-zhog.2` bounded execution contracts to consume one stable trust vocabulary
- `prompt-language-zhog.3` replayability work to build richer event and restore tooling on top of a defined checkpoint boundary
- later compile-time rigor work to lint strict-budget and strict-failure contradictions consistently
- evaluation and review work to align `review strict`, approval denial, and fail-closed runtime reporting with one runtime trust model

### How it relates to older backlog items

This design does not replace older issues such as:

- `prompt-language-ln6k` approval checkpoints
- `prompt-language-5syc` resume granularity
- the evaluation-stack review/judge slices under `prompt-language-5vsm`

Instead, it classifies them:

- approval checkpoints are one implementation feeder into the timeout and recovery rules defined here
- resume granularity is part of making restore and resume trustworthy
- evaluation-stack work must respect the strict review-exhaustion and diagnostics/outcomes split defined here

## Consequences

What becomes easier after this note:

- implementing strict mode without inventing separate semantics per subsystem
- deciding whether a runtime condition is a blocker, an explicit negative outcome, or unsupported measurement
- reviewing new runner or adapter work against one trust baseline

What becomes harder:

- adding convenience fallbacks without naming them as non-strict behavior
- shipping budgets that cannot actually be measured
- treating checkpoints as vague "save points" without restore guarantees

That trade is intentional. vNext trust hardening is valuable only if the runtime stops pretending that ambiguous execution is safe enough.
