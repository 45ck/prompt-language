# Design: Bounded Execution Contracts

## Status

Accepted design target for the vNext bounded-execution milestone.

Relevant bead:

- `prompt-language-zhog.2` - P1 bounded execution: contracts, effects, policy, and capabilities

Primary anchors:

- [Spec 002 — Contract system](../wip/vnext/specs/002-contract-system.md)
- [Spec 005 — Effect system and capabilities](../wip/vnext/specs/005-effect-system-and-capabilities.md)
- [Spec 006 — Policy, risk, and budgeting](../wip/vnext/specs/006-policy-risk-and-budgeting.md)
- [Spec 007 — Checkpoints, event log, and replay](../wip/vnext/specs/007-checkpoints-event-log-and-replay.md)

Related current design constraints:

- [vNext Trust Hardening](vnext-trust-hardening.md)
- [Run-State V2 and Recovery Artifacts](run-state-v2-recovery-artifacts.md)
- [Evaluation Stack V1 Boundary](evaluation-stack-v1.md)

This note defines the repo-aligned design boundary for bounded execution in vNext. It is intentionally future-facing and additive. The WIP specs may explore candidate syntax, but this note does not claim that contracts, effect nodes, or capability declarations are already shipped user-facing language features.

## Decision

The bounded-execution milestone packages four linked surfaces into one supervision model:

1. contracts that describe allowed scope, required checks, artifacts, and invariants
2. effect metadata that separates side effects from ordinary verification
3. policy that decides whether a requested action may run, requires review, or requires approval
4. capabilities that declare the tool and permission surface a node depends on

These surfaces are defined together because the repo's trust-hardening boundary already requires fail-closed behavior for ambiguity, checkpoints, and budgets. Contracts without effects would hide retry risk. Effects without policy would hide approval and budget implications. Capabilities without contracts would document permission needs but not whether the change stayed within scope.

Bounded execution therefore means:

- the runtime knows what scope a run is allowed to touch
- the runtime knows which steps are deterministic checks versus side effects
- the runtime knows what permissions a step claims and what policy tier governs it
- retry and resume behavior are derived from explicit metadata, not guessed from raw shell text

## Design goals

- make supervision artifacts reviewable instead of leaving them implicit in prompts and conventions
- distinguish compile-time scope safety from runtime execution safety
- preserve the fail-closed guarantees defined in [vNext Trust Hardening](vnext-trust-hardening.md)
- keep policy, approval, and capability enforcement observable and replayable
- remain compatible with the current architecture boundary where domain owns execution semantics and infrastructure provides adapters

## Non-goals

- This note does not finalize surface syntax.
- This note does not require every command to move to typed adapters immediately.
- This note does not replace budgets, checkpoints, or strict-mode rules from `prompt-language-zhog.1`; it consumes them.
- This note does not collapse semantic review into hidden model intuition. If a check needs semantic judgment, it must remain a named analyzer, judge, or review surface.

## Why these surfaces must stay coupled

The strongest shift after trust hardening is away from open-ended shell orchestration. In the current repo direction, a trustworthy run cannot be defined only by "did the command pass." It also needs to answer:

- what files or artifacts was the run allowed to touch
- what deterministic checks must pass before work can be considered acceptable
- what side effects are allowed, reversible, or one-time only
- what permissions and capabilities each action requires
- whether policy allows the action to run automatically, only after review, or only after approval
- whether a retry or resume would repeat a safe check or accidentally replay a side effect

That is why `prompt-language-zhog.2` is one bounded-execution milestone, not four unrelated features.

## Bounded-execution model

### Contracts

Contracts are the reusable boundedness layer. They package:

- scope rules such as allowed paths, forbidden paths, diff size ceilings, and artifact boundaries
- deterministic checks such as tests, lint, typecheck, build, or other named analyzers
- required emitted artifacts or preserved invariants
- structural expectations that can be linted before a run starts

Contracts describe what must be true for a change or flow to be considered within bounds. They do not themselves decide whether a risky action is permitted. That is policy's role.

### Effects

Effects classify actions by side-effect semantics rather than command shape. An effect record must make explicit:

- whether the step is a pure observation, a deterministic check, a local mutation, a reversible effect, or a one-time irreversible effect
- what risk class the action carries
- whether idempotency metadata exists
- whether rollback or compensating action exists
- whether checkpointing is required before execution

This prevents raw shell from silently mixing "observe repo state" and "perform irreversible external mutation" under one untyped `run` surface.

### Policy

Policy is the decision layer that consumes contract and effect metadata. It answers:

- can this action run automatically
- does it require review
- does it require explicit approval
- does it require a prior checkpoint
- do budgets allow it to start or continue

Policy must remain observable. A blocked action is not "the shell failed." It is a structured policy outcome tied to risk, capability, budget, or approval state.

### Capabilities

Capabilities are declared requirements on tool and permission surfaces such as repository mutation, test execution, GitHub write access, or deployment rights. They are intentionally narrower than vague tool names.

Capabilities exist so that:

- static analysis can flag undeclared or unused permission claims
- policy can refuse actions that exceed the current trust mode or runtime profile
- retry and resume logic can reevaluate whether an action is still authorized to run
- audits can explain why a node needed a given permission

## Static scope checks vs dynamic deterministic checks

Bounded execution must distinguish what can be proven before the run from what must be measured during the run.

| Check category               | Purpose                                                                                          | Typical examples                                                                                                                                | Failure timing                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Static scope checks          | Prove the proposed work stays inside declared boundaries before or while constructing a run plan | allow/forbid paths, max files changed declaration, required contract existence, contradictory policy references, missing capability declaration | compile, lint, or preflight                                          |
| Dynamic deterministic checks | Execute a named check whose result is expected to be reproducible enough to gate advancement     | tests, lint, typecheck, build, static analyzer commands, schema validators                                                                      | runtime with structured pass or fail                                 |
| Dynamic side-effect checks   | Evaluate whether a side-effecting action may execute and what recovery metadata it needs         | approval-gated deploy, PR creation, message send, checkpointed migration                                                                        | runtime policy decision before action, then structured action result |
| Semantic analyzers           | Evaluate claims that are not reducible to file globs or simple command exit codes                | no permission widening, public API unchanged, artifact contract preserved                                                                       | runtime or review surface via explicit named analyzer                |

The important boundary is:

- static scope checks fail early because they do not need the action to run
- dynamic deterministic checks may execute automatically because they are checks, not effects
- side-effecting steps may never masquerade as deterministic checks
- semantic judgment must be named and inspectable, not inferred from generic shell success

## Contracts consume checks, not hidden effects

A contract may reference:

- static scope rules
- dynamic deterministic checks
- required artifacts
- semantic analyzers with named outputs

A contract must not hide untyped side effects inside what appears to be a harmless check. If a step mutates external state, communicates externally, or changes the workspace in a policy-relevant way, it needs effect metadata even if it is written as a command.

This preserves one clear distinction:

- checks answer "did the bounded condition hold"
- effects answer "what mutation or side effect would happen if this step runs"

## Retry semantics

Retry behavior must be explicit because retry safety is different for each execution class.

### Safe retry candidates

Automatic retry is acceptable only for:

- pure observation steps
- deterministic checks with known transient-failure handling
- structured capture or parse retries already allowed by trust-hardening rules

Even for these cases, retries must count against budgets and be visible in runtime records.

### Unsafe retry candidates

Automatic retry is not acceptable by default for:

- irreversible effects
- side-effecting actions without idempotency keys
- actions whose authorization window may have expired
- actions whose preconditions depended on a now-stale checkpoint or workspace state

### Required effect metadata for retry

If an effect may be retried across pause, crash, or resume, the runtime needs explicit metadata for:

- effect class
- idempotency key or equivalent duplicate-suppression identity
- rollback or compensating action when relevant
- whether policy requires re-approval before a retry
- whether a fresh checkpoint is required because the previous checkpoint no longer represents the current boundary safely

The runtime must not infer retry safety from the command string alone.

## Resume and replay boundary

Bounded execution inherits the restore and resume constraints from `prompt-language-zhog.1`.

### Resume rule

Resume starts from the last completed safe boundary represented by a valid checkpoint or equivalent resumable cursor. It does not restart from an ambiguous partially executed node.

### What must be persisted

For bounded execution to remain trustworthy across pause and restore, the runtime needs persisted records for:

- contract evaluation outcomes
- effect execution outcomes
- approval requests and their resolution status
- budget counters at the checkpoint boundary
- capability and policy decisions relevant to pending actions
- child-run summaries when child flows consume the same trust boundary

### What must be reevaluated on resume

Resume may reuse persisted completed results, but it must reevaluate conditions that can legitimately expire or change:

- unresolved approval requirements
- capability grants tied to the current runtime profile
- remaining budget availability
- checkpoint requirements for pending irreversible or high-risk effects
- any policy predicates that depend on current trust mode or operator choice

That means "resume" is not permission to replay every previously scheduled step. It is permission to continue from a known boundary while honoring current policy and authorization state.

## Permission model: capability, policy, approval, execution grant

The repo needs four distinct concepts. Collapsing them would make audits and recovery ambiguous.

### Capability declaration

Capability answers:

- what permission surface does this node claim it needs

It is static metadata attached to a node, contract helper, or side-effecting adapter.

### Policy decision

Policy answers:

- does the selected trust mode and runtime profile permit this capability and risk class to execute automatically, under review, or only with approval

It is a runtime decision derived from declared metadata plus budgets and trust mode.

### Approval result

Approval answers:

- did a human authorize this specific guarded execution attempt

Approval is instance-specific. It is not a durable blanket permission for all future retries or resumes.

### Execution grant

Execution grant answers:

- does the runtime currently hold the concrete credential, adapter access, or environment permission needed to perform the action

This is where infrastructure reality matters. A node may be allowed by policy and approved by a human, but still blocked because the runner lacks the actual tool grant.

Keeping these four surfaces separate makes failure modes explainable:

- undeclared capability is a lint or contract authoring problem
- policy denial is a trust-mode or rules problem
- approval timeout or denial is an operator decision problem
- missing execution grant is an adapter or environment problem

## Budgets and scope limits

Contracts and budgets are related but not interchangeable.

- Contracts define boundedness expectations such as scope, invariants, and required checks.
- Budgets define hard ceilings on autonomy over time, cost, commands, files, and child flows.

Some concepts may appear in both layers for different reasons. For example:

- `max_files_changed` is a contract-level scope bound when it describes intended blast radius
- the same metric is a runtime budget when it stops further autonomous advancement after actual changes accumulate

The runtime should preserve that distinction rather than forcing one surface to absorb the other.

## Child flows and capability inheritance

Bounded execution must treat child flows as part of the same trust envelope unless the parent explicitly narrows them further.

Required rules:

- a child cannot silently widen capabilities beyond the parent's allowed surface
- a child inherits remaining budgets unless the parent narrows them
- child policy decisions and effect outcomes must be visible to the parent as structured results
- retry or resume of a child cannot bypass pending approval or checkpoint requirements that would apply if the same effect ran in the parent

This keeps later supervisor and safe-parallelism work aligned with the same bounded-execution contract rather than introducing a second permission model for delegated work.

## Compile-time and runtime enforcement split

The architecture should preserve one clean split.

### Compiler and linter responsibilities

- validate that referenced contracts, policies, analyzers, and capabilities exist
- detect contradictory or impossible scope rules
- flag side-effecting nodes that lack effect metadata
- flag undeclared capability use
- flag strict flows that rely on unenforceable budgets or missing checkpoint support

### Runtime responsibilities

- evaluate deterministic checks and emit structured results
- apply policy before effect execution
- record approval, checkpoint, budget, and effect outcomes
- stop or pause when trust-hardening rules require fail-closed behavior
- reuse persisted completed boundaries while reevaluating time-sensitive authorization on resume

### Infrastructure responsibilities

- provide trustworthy adapters for command execution, capability grants, artifact persistence, checkpoint creation, and restore
- surface measurement gaps instead of pretending unavailable enforcement exists

This keeps bounded execution consistent with the repo's inward dependency flow: domain owns semantics, application coordinates evaluation, and infrastructure provides execution facts.

## Future implementation order

The milestone can evolve in layers without changing the boundary defined here.

### Phase 1

- contract packaging of existing checks and scope rules
- effect classification with risk and idempotency metadata
- capability declaration and linting

### Phase 2

- policy resolution that consumes effect class, risk, capability, budget, and approval requirements
- checkpoint-aware execution for high-risk and irreversible effects
- replayable structured records for contract and effect outcomes

### Phase 3

- typed adapters above raw shell for high-value actions
- richer semantic analyzers and policy composition
- stronger child-flow enforcement and cross-run audit tooling

## Out of scope

This note does not include:

- final user-facing grammar for contracts, effects, or capabilities
- a claim that current runners already provide every required measurement or permission adapter
- a full enterprise policy catalog
- replacing the current run-state compatibility authority before replay work lands
- automatic semantic proof of invariants without explicit analyzers

## Consequences

What becomes clearer after this note:

- how contracts, effects, policy, and capabilities divide responsibility
- which failures should happen at lint time versus runtime
- which steps are safe to retry automatically and which must require explicit reauthorization
- how permission problems differ from policy denial or approval timeout

What becomes harder:

- hiding external mutation inside generic shell checks
- treating approval as a permanent permission grant
- resuming a run without reevaluating time-sensitive authorization and checkpoint requirements
- presenting untyped orchestration as trustworthy bounded execution

That trade is intentional. `prompt-language-zhog.2` should make supervision more explicit, not move the ambiguity into nicer syntax.
