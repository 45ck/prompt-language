# Context and Thesis

## What “agentic swarm” should mean here

“Agentic swarm” is overloaded. In practice it usually refers to some form of multi-agent orchestration:

- manager-worker
- router-specialist
- peer handoff
- evaluator-optimizer
- map-reduce / fan-out
- observer / watchdog

For `prompt-language`, the important question is not whether swarms are fashionable. It is whether they can be represented in a way that preserves the product’s current strengths:

- deterministic control flow
- persistent state
- verifiable completion gates
- explicit supervision rather than hidden autonomy

## Existing fit with prompt-language

The current runtime already has the core substrate for structured multi-agent execution:

- `spawn` / `await`
- `foreach-spawn`
- `race`
- `send` / `receive`
- `review`
- `approve`
- `done when:`
- structured JSON capture

So swarms do **not** require prompt-language to become something completely different. In the accepted product boundary, they are only viable if they stay a parent-authored macro over the runtime that already exists. They mainly require:

1. a first-class way to declare roles
2. a first-class way to collect typed outputs from roles
3. a first-class way to describe the coordination order between those roles

## Design thesis

`swarm` should be a **language-level orchestration macro** that compiles to the current runtime’s existing primitives.

More explicitly: `swarm` v1 is syntax for structuring subagent-first orchestration, not a second execution engine and not a new agent-team runtime category.

This gives four benefits:

### 1. It keeps the runtime explainable

You can always expand a `swarm` into ordinary flow nodes and inspect what actually runs.

### 2. It avoids a second execution engine

The repo already has parse/session/advance/gate/render behavior. A macro approach reuses that instead of creating a parallel system.

### 3. It keeps the feature aligned with current product direction

The runtime is a supervised state machine for bounded engineering workflows, not an unconstrained social system for agents.

### 4. It keeps future complexity optional

Advanced features can be layered in later only when evals show they are worth the cost.

## Mental model

Use this mental model consistently:

- parent flow = manager / orchestrator
- role = named child execution template
- start = spawn role
- await = join and collect result
- return = explicit result from child to parent
- done when = final truth source
- approve = hard human checkpoint

## V1 boundary

The explicit boundary for `prompt-language-1wr7.1` is:

- the parent flow remains the only orchestrator
- roles are bounded child sessions, not autonomous peers
- all role coordination is authored in the parent-visible `flow:` block
- data moves into roles via declared inputs and back out via explicit `return`
- the runtime executes lowered `spawn` / `await` / `send` / `receive`, not hidden swarm-only machinery

Patterns that are in scope for v1:

- manager-worker
- fan-out then synthesize
- reviewer-after-workers
- multi-strategy workers followed by an explicit judge
- watchdog/observer roles that still report into the parent

Patterns that are out of scope for v1:

- nested swarms
- shared mutable swarm-local state across roles
- autonomous role creation or delegation
- peer negotiation or peer-to-peer routing outside the parent graph
- long-lived team memory or task-board semantics
- any framing where prompt-language becomes an agent-team platform rather than a control plane over child sessions

## Strategic boundary

The language should support **structured swarms**, not free-form agent chatter.

The moment the feature becomes:

- hard to predict
- hard to inspect
- hard to gate
- hard to replay
- hard to prove correct
- dependent on hidden schedulers or peer autonomy

it stops fitting the current product identity.
