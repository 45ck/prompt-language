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

So swarms do **not** require prompt-language to become something completely different. They mainly require:

1. a first-class way to declare roles
2. a first-class way to collect typed outputs from roles
3. a first-class way to describe the coordination order between those roles

## Design thesis

`swarm` should be a **language-level orchestration macro** that compiles to the current runtime’s existing primitives.

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

## Strategic boundary

The language should support **structured swarms**, not free-form agent chatter.

The moment the feature becomes:

- hard to predict
- hard to inspect
- hard to gate
- hard to replay
- hard to prove correct

it stops fitting the current product identity.
