# Design: Flow IR and Static Analysis

## Status

Accepted design target for the vNext compile-time-rigor milestone.

Relevant bead:

- `prompt-language-zhog.4` - P2 compile-time rigor: Flow IR, linting, simulation, and flow tests

Primary anchors:

- [Spec 010 — Provider adapters and Flow IR](../wip/vnext/specs/010-provider-adapters-and-flow-ir.md)
- [Spec 011 — Static analysis, linting, simulation, and flow tests](../wip/vnext/specs/011-static-analysis-linting-and-flow-tests.md)

Related current design constraints:

- [vNext Trust Hardening](vnext-trust-hardening.md)
- [Diagnostics Contract V1](diagnostics-contract-v1.md)
- [Context-Adaptive Recovery Fallback](context-adaptive-recovery-fallback.md)

This note defines the compile-time-rigor milestone as a design target for backlog execution. It does not claim that Flow IR, simulation, or flow tests are already shipped.

## Decision

prompt-language should add a compile boundary that turns authored flows into a reviewable intermediate form and then subjects that form to stronger pre-runtime analysis.

For `prompt-language-zhog.4`, that boundary consists of five linked surfaces:

1. a stable Flow IR emitted from parsed source
2. an `explain` path for human-readable structure and compatibility reporting
3. a `compile` path for machine-readable IR and diagnostics
4. stronger static analysis over trust, contracts, effects, budgets, and coordination
5. simulation and unit-style flow tests that exercise compile-time and runtime expectations without live agent execution

This milestone is intentionally sequenced after:

- `prompt-language-zhog.2` bounded execution contracts, effects, policy, and capabilities
- `prompt-language-zhog.3` replayability, event journals, derived snapshots, and replay/report tooling

Compile-time rigor depends on those earlier milestones because linting, simulation, and flow tests need stable semantics for trust failures, effect declarations, capability requirements, checkpoints, and replayable state boundaries. It should not invent a competing model ahead of them.

## Why this boundary matters

The repo already has parser, diagnostics, and runtime enforcement work, but it still leans heavily on runtime interpretation. That leaves three weaknesses:

- reviewability depends too much on reading source plus host-specific execution behavior
- many trust or scope mistakes can only be discovered while advancing a run
- provider portability remains architectural intent rather than a compile-checked contract

The compile-time-rigor milestone addresses those weaknesses by making the authored flow graph explicit, analyzable, explainable, and testable before live execution.

## Sequencing and dependency order

This note is deliberately not an "IR first" rewrite.

### What must exist before this milestone is credible

`prompt-language-zhog.2` must establish:

- stable contract vocabulary for gates, limits, invariants, required artifacts, and effect metadata
- capability and policy declarations that static analysis can reason about
- the distinction between statically knowable violations and runtime-measured deterministic failures

`prompt-language-zhog.3` must establish:

- a stable event and snapshot model that simulation can imitate rather than guess
- replay/report terminology for checkpoints, restore points, and child-run outcomes
- recovery boundaries that explain and test tooling can reference consistently

### Why compile-time rigor follows them

Without bounded execution, the compiler would only be able to lint syntax and shape, not meaningfully analyze effect safety, policy coverage, or capability fit.

Without replayability, simulation would collapse into mocked convenience rather than a disciplined approximation of real runtime transitions, checkpoints, and derived run state.

This is why `prompt-language-zhog.4` follows bounded execution and replayability rather than preceding them. It consumes their contracts. It does not substitute for them.

## Source-to-runtime model

The compile-time boundary should preserve the repo's inward architecture:

```text
flow source -> parse/resolve -> Flow IR -> lint/analyze -> explain/compile outputs -> runtime adapter
```

Authored source may continue to reference the same conceptual layers described in the vNext pack:

- specs
- contracts
- schemas
- policies
- flows

The compiler's job is to resolve those references into one stable intermediate representation that runtime and tooling can share.

## Flow IR

Flow IR is the canonical machine-readable representation of a compiled flow.

### Design goals

- stable enough for tooling, tests, and provider/runtime boundaries
- explicit enough to analyze trust, effects, and topology without re-parsing source text ad hoc
- narrow enough that provider adapters remain downstream consumers instead of reshaping language semantics

### Required contents

Flow IR should capture, at minimum:

- explicit nodes and edges
- node kinds and execution class
- resolved contracts and policy references
- effect metadata and capability requirements
- schema references and capture expectations
- budget declarations and strictness requirements
- artifact producers and consumers
- child-flow topology and coordination edges
- approval, review, and gate checkpoints relevant to runtime advancement
- source locations needed for diagnostics and explain output

### Boundary rules

Flow IR should not:

- erase trust or effect distinctions into generic shell steps
- bake in Claude-specific or Codex-specific prompting behavior as core language semantics
- replace event journals, snapshots, or replay reports owned by replayability work
- serve as a serialized run-state format

That keeps `prompt-language-zhog.4` separate from:

- `prompt-language-zhog.3` replay and event substrates
- `prompt-language-zhog.8` provider adapters over shared Flow IR

## Explain and Compile Paths

Compile-time rigor needs two outputs because human review and machine execution are different jobs.

### `explain`

`explain` is the human-facing path. Its purpose is to make a flow reviewable before execution.

At minimum it should surface:

- resolved topology and step ordering
- contract, policy, and schema references
- effect and capability requirements
- budget declarations and strictness assumptions
- provider or profile compatibility issues that are statically knowable
- warnings about unsafe ambiguity, dead paths, or unsupported constructs

`explain` should prefer readable summaries over raw internal detail. It is for operators and reviewers deciding whether a flow means what they think it means.

### `compile`

`compile` is the machine-facing path. Its purpose is to emit stable IR and diagnostics for downstream tooling.

At minimum it should support outputs equivalent to:

```bash
prompt-language compile flows/fix-auth.flow --emit ir.json
prompt-language explain flows/fix-auth.flow
```

The compile result should be able to drive:

- linter and compatibility analysis
- simulation
- flow tests
- later provider/runtime adapters

Explain and compile should share the same semantic resolver. They may differ in presentation, but not in what the program means.

## Stronger Static Analysis

The milestone is broader than parsing and basic linting. It should statically analyze whether the flow is coherent under the repo's trust and bounded-execution model.

### Minimum analysis scope

The analyzer should detect or report:

- unknown variables, schemas, contracts, judges, policies, and capability references
- unreachable nodes or dead branches
- loops or retries without valid budgets
- risky effects without approval, policy, or capability coverage
- contradictory contracts or impossible expectations
- incompatible strict-mode assumptions
- provider/profile incompatibilities that can be known without running
- child-flow coordination risks such as overlapping ownership assumptions or missing synchronization declarations
- missing artifact producers for required downstream consumers
- structural ambiguity around restore, resume, or checkpoint-sensitive transitions

### Trust-aligned analysis

Static analysis must use the vocabulary established by trust hardening and bounded execution. In practice that means:

- strict-mode contradictions should be linted against the same fail-closed rules the runtime will enforce
- budget declarations should be checked against measurable capabilities rather than accepted as wishful intent
- effect safety should be analyzed as first-class metadata, not inferred from command strings alone
- approval, review, and checkpoint-sensitive paths should be analyzed as control-flow semantics, not just annotations

### Diagnostics posture

This milestone should extend, not replace, the shared diagnostics direction.

- parse and shape failures remain diagnostics
- statically provable trust, scope, and compatibility failures should also surface as diagnostics
- ordinary negative flow outcomes remain runtime outcomes, not compile-time errors

That keeps compile-time rigor aligned with the repo's diagnostics contract instead of inventing a second error taxonomy.

## Simulation

Simulation is the dry-run surface for exercising runtime semantics against compiled flows without live model or tool execution.

Its purpose is not merely to "pretend the run succeeded." It should let authors and evaluators pressure the same control-flow semantics that real runs rely on.

### Simulation scope

Simulation should support mocked or scripted outcomes for common runtime primitives, including:

- gate results
- judge or review results
- command exit outcomes
- budget exhaustion
- approval results where relevant
- child-flow completion or failure
- checkpoint or restore-sensitive transitions once replayability semantics are available

This should support a CLI shape equivalent to:

```bash
prompt-language simulate flows/fix-auth.flow
```

### Simulation constraints

Simulation should be grounded in the same compiled semantics as live execution.

It should not:

- bypass the Flow IR and re-interpret raw source separately
- invent state transitions that violate replay or checkpoint boundaries
- treat provider-specific host quirks as the core behavior under test

The correct mental model is "deterministic runtime rehearsal over compiled semantics," not "lightweight demo mode."

## Flow Tests

Flow tests are unit-style tests for authored flow behavior.

They should let authors assert compile-time and runtime expectations over compiled flows without requiring a real live agent loop.

### Purpose

Flow tests should cover:

- compile failures for invalid references or impossible strict-mode programs
- runtime decision behavior under mocked gates, reviews, approvals, and command results
- budget exhaustion and recovery-sensitive branches
- child-flow and coordination semantics where the runtime contract is stable enough

This should support a CLI shape equivalent to:

```bash
prompt-language test flows/**/*.spec.flowtest
```

### Design rules

- flow tests should compile through the same resolver and IR path as real flows
- test fixtures should assert stable diagnostics, outcomes, or state transitions rather than incidental prompt text
- test assertions should prefer domain-level semantics such as flow status, budget-exhausted result, or compile diagnostic code
- simulation and flow tests should share scenario vocabulary so evals and regression suites do not fork the model of execution

### Relationship to evaluation

Flow tests do not replace live evaluation. They sit below it.

- flow tests cover authored-flow correctness and contract behavior
- simulation covers deterministic scenario rehearsal
- replay and reports provide inspectable evidence for real runs
- evaluation still owns live runner behavior and end-to-end regressions

## Relationship to Later Work

This milestone is a midpoint, not the final architecture.

### What it enables

`prompt-language-zhog.4` should enable:

- stronger compile-time review before running a flow
- testable flow semantics separate from host-specific execution quirks
- later provider adapters consuming one shared IR instead of raw source
- safer safe-parallelism work because coordination assumptions can be linted before runtime

### What it does not subsume

This note does not replace:

- bounded execution contracts, effect declarations, or capability policy work
- replay, event-log, checkpoint-report, or restore tooling
- provider adapter design and portability backlog
- full end-to-end evaluation or smoke validation against live hosts

## Out of scope

This bead does not include:

- claiming provider portability is complete before provider-adapter work lands
- replacing runtime enforcement with compile-time certainty
- turning Flow IR into a public stability guarantee for external consumers on day one
- introducing a second state model that conflicts with replayability or current recovery artifacts
- treating simulation as proof of real runner behavior
- rewriting shared index pages or broader roadmap docs as part of this slice

## Acceptance interpretation

This design note satisfies `prompt-language-zhog.4` only if later implementation can show all of the following:

- Flow IR, explain, compile, lint, simulation, and flow tests are treated as one coherent milestone
- the milestone explicitly builds on bounded execution and replayability instead of racing ahead of them
- static analysis covers trust, contract, effect, budget, and coordination concerns, not just syntax
- simulation and flow tests reuse compiled semantics rather than parallel ad hoc interpreters
- the design leaves provider adapters and replay/report tooling in their own later milestones

## Consequences

What becomes easier after this note:

- reviewing whether a flow is safe and coherent before running it
- testing flow semantics without a live host loop
- separating language meaning from provider-specific execution
- building later portability work on one explicit compile target

What becomes harder:

- hiding ambiguous runtime semantics behind "the host will figure it out"
- treating contracts, budgets, or effects as comments instead of analyzable program structure
- introducing provider-specific shortcuts into the language core

That trade is intentional. Compile-time rigor matters only if it strengthens the repo's enforcement-first runtime model instead of diluting it.
