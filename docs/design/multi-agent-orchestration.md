<!-- cspell:ignore fspx srex -->

# Design: Multi-Agent Orchestration Boundary

## Status

Accepted design direction for the current roadmap and Beads backlog.

## Decision

prompt-language stays **subagent-first**.

That means the product continues to model parallel or delegated work as a **parent-authored flow** that launches bounded child sessions via `spawn`, synchronizes them with `await`, and optionally uses explicit `send` / `receive` steps for narrow message passing.

prompt-language does **not** adopt full **agent-team semantics** in the current product direction. In particular, it does not grow into a system of semi-autonomous peers with shared task boards, implicit delegation, emergent routing, role negotiation, file claiming, or open-ended peer-to-peer coordination.

This follows the architecture position paper in [docs/research/00-architecture-position.md](../research/00-architecture-position.md): prompt-language is a **meta-orchestration layer for an existing autonomous agent**, not a multi-agent platform.

## Why this boundary exists

The current runtime already ships the right primitives for the product's orchestration layer:

- `spawn` / `await` for bounded child work
- `race` for competitive parallel execution
- `foreach-spawn` for explicit fan-out
- `send` / `receive` for explicit message passing
- gate enforcement for parent-level verification and stop conditions

These primitives fit the existing architecture because they preserve a single controlling process graph. The parent flow still owns:

- task decomposition
- synchronization points
- variable import and result shaping
- completion criteria
- failure handling

That is consistent with the repo's architectural claim that the DSL provides structure while the underlying agent provides reasoning.

## Current shipped model

Today, `spawn` launches a separate child `claude -p` process with its own state directory. `await` blocks until named children or `all` children complete. Child variables are imported back into the parent with a name prefix. `race` and `foreach-spawn` are extensions of the same parent-coordinated model, not a separate runtime architecture.

`send` / `receive` adds messaging, but it does not change the fundamental control model. The flow still defines who may send, who waits, and where execution resumes. Messaging is a tool inside orchestration, not a license for autonomous team behavior.

## Options considered

### 1. Stay subagent-first

Definition:

- parent flow remains the source of truth
- children are bounded workers
- coordination remains explicit in DSL nodes
- verification remains parent-owned

Pros:

- matches the current architecture exactly
- composes with gates, retries, and deterministic flow rendering
- keeps context isolation simple and auditable
- avoids inventing an agent-platform abstraction the repo does not yet need
- preserves portability across harnesses because the contract is still "launch child runtime, await result"

Cons:

- less expressive for emergent collaboration patterns
- complex peer workflows require more explicit parent wiring

### 2. Add agent-team semantics

Definition:

- agents become first-class collaborators rather than bounded children
- peers may claim work, negotiate, or route tasks among themselves
- coordination may become partially implicit or runtime-managed

Potential benefits:

- richer collaboration patterns
- more natural support for reviewer/writer or planner/executor teams

Costs:

- conflicts with the architecture position paper
- requires new concepts beyond the current AST and session model
- raises token cost materially through longer-lived peer coordination
- increases documentation burden because "agent", "profile", "skill", and "flow" boundaries get harder to explain
- pressures the runtime toward file locking, merge policy, task claiming, routing policy, and observability that are closer to a multi-agent platform than a DSL runtime

### 3. Defer all multi-agent work

Definition:

- avoid additional orchestration work entirely
- keep only the already shipped features and stop investing here

This was rejected because the repo already has real shipped value in `spawn`, `await`, `race`, `foreach-spawn`, and `send` / `receive`, and several open backlog items improve that existing model rather than changing product category.

## Rationale

### Architecture fit

The strongest reason is architectural coherence. Report 00 explicitly says prompt-language is not a multi-agent platform. A move to agent-team semantics would contradict the repo's current framing and blur the separation between:

- agent reasoning
- runtime orchestration
- external verification

Subagent-first keeps the boundary clean: prompt-language coordinates autonomous sessions, but does not become a society-of-agents runtime.

### Context model

The current model isolates context well. Each spawned child gets a separate session and state directory, and the parent imports only the outputs it chooses to keep. That matches the context-isolation argument in [docs/research/02-context-engineering.md](../research/02-context-engineering.md): isolation is valuable because uncontrolled multi-agent context sharing is expensive and error-prone.

Agent-team semantics would push the runtime toward shared mutable coordination state, implicit routing, and more conversational traffic between peers. That is exactly where context drift, ambiguity, and token waste start compounding.

### Runtime complexity

Subagent-first can still improve significantly without changing category:

- better harness abstraction
- named agents as spawn-time defaults
- profiles for context injection
- stronger child lifecycle management
- better smoke coverage for spawn-based flows

Agent-team semantics would require a different level of runtime machinery:

- peer identity and capability routing
- autonomous task claiming or queues
- conflict prevention and merge policy
- richer observability for inter-agent state
- new termination and recovery semantics when peers disagree or stall

That is a different product surface.

### Token and cost discipline

The repo's research already points toward restraint: use multiple agents only when seams are real and the improvement is measurable. Subagent-first supports that discipline because fan-out remains explicit. Agent-team semantics would make it easier to create chatty, always-on coordination patterns with weak visibility into value versus cost.

### Documentation burden

The project already has an active terminology backlog because "skill", "profile", "agent", and "flow file" are easy to conflate. Full agent-team semantics would make that worse before the terminology work is even settled. Subagent-first lets the repo define "agent" narrowly: a reusable spawned runtime definition, not an autonomous peer society.

## Consequences

### What continues

- `spawn`, `await`, `race`, `foreach-spawn`, and `send` / `receive` remain first-class shipped features
- experimentation with explicit fan-out patterns remains in scope
- named agents remain valid if they mean **spawn-time defaults**, not always-on peers
- harness abstraction remains valid if it preserves the same parent-child orchestration contract
- future swarm-style design work is still valid if it compiles down to the same parent-authored model; see [docs/wip/swarm/README.md](../wip/swarm/README.md)

### What does not happen now

- no shared task list primitive
- no peer self-assignment or work stealing
- no implicit agent routing or negotiation layer
- no team-level memory bus
- no autonomous peer mesh that can continue coordinating outside the parent flow graph
- no new product framing that presents prompt-language as CrewAI-, AutoGen-, or Agent-Teams-style orchestration

### Constraint on messaging

`send` / `receive` should be treated as a narrow coordination primitive inside explicit flows, not as the foundation for a free-form inter-agent society. If a future workflow requires complex long-lived message choreography, that is evidence for a different runtime layer, not necessarily for expanding the core DSL.

## Out of scope

The following ideas are explicitly out of scope for the current direction unless a later decision reopens them:

- peer agents with independent task discovery
- runtime-managed team hierarchies beyond explicit parent-child flow structure
- shared task boards or work queues as first-class DSL/runtime state
- automatic conflict prevention via task claiming or file locking for child agents
- autonomous merge-back semantics beyond explicit flow coordination
- role-debate or council-style agent patterns as a core language concept

These may still be discussed in research notes, but they should not be described as the current product path.

## Backlog impact

### Proceed

These fit the accepted subagent-first model:

- `prompt-language-1wr7` — swarm program, provided it stays a lowering-based macro over parent-authored `spawn` / `await` orchestration
- `prompt-language-9uqe.4` — harness abstraction: configurable runtime adapters instead of claude-only spawn
- `prompt-language-9uqe.3` — named agents for spawn as harness + default profile resolution
- `prompt-language-72a5.5` — Codex CLI: spawn/await harness via `codex exec`
- `prompt-language-72a5.6` — Codex smoke coverage for spawn/await once the harness exists
- `prompt-language-405` — explore Agent SDK for spawn/await instead of `claude -p`
- `prompt-language-360` — SubagentStop hook to improve child lifecycle handling
- `prompt-language-fspx` — foreach-spawn experiment
- `prompt-language-srex` — send/receive experiment
- `prompt-language-smk3`, `prompt-language-smk4`, `prompt-language-smk6` — smoke coverage for shipped orchestration primitives

### Proceed, but keep terminology tight

These are still valid, but only if they preserve the startup-config meaning of "agent":

- `prompt-language-9uqe.2` — context profiles
- `prompt-language-9uqe.3` — named agents for spawn
- `prompt-language-9uqe.7` — guided configuration UX

Their implementation should align with the separate terminology decision bead `prompt-language-9uqe.11`.

### Pause or reframe

No currently visible open Bead requires full agent-team semantics. If future backlog items propose any of the following, they should be paused or reframed first:

- shared peer task queues
- autonomous peer-to-peer delegation outside parent-authored flow control
- team memory or blackboard coordination as a core runtime primitive
- role-negotiation semantics as a first-class DSL feature

Those items would need a new architecture decision because they move prompt-language out of the meta-orchestration category defined in Report 00.

## Practical rule for future design work

When evaluating an orchestration feature, ask:

> Does this strengthen explicit parent-authored coordination of bounded child sessions, or does it introduce autonomous peer-team behavior as a new runtime category?

If it is the former, it likely fits the roadmap.

If it is the latter, it should be treated as out of scope until the project deliberately revisits the architecture position.
