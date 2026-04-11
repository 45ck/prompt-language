<!-- cspell:ignore folr idbc -->

# Design: Provider Adapters Over Shared Flow IR

## Status

Accepted design target for `prompt-language-zhog.8`.

Primary anchors:

- [Spec 010 - Provider adapters and Flow IR](../wip/vnext/specs/010-provider-adapters-and-flow-ir.md)
- [ADR-006 - Separate Flow IR from provider adapters](../wip/vnext/adrs/ADR-006-provider-agnostic-architecture.md)

Related current boundaries:

- [vNext Trust Hardening](vnext-trust-hardening.md)
- [Host Extension Boundary](host-extension-boundary.md)
- [Multi-Agent Orchestration Boundary](multi-agent-orchestration.md)

This note defines the milestone boundary for provider adapters over a shared Flow IR. It is a design target for backlog sequencing, not a claim that prompt-language already ships a stable multi-provider runtime.

## Decision

prompt-language should treat provider adapters as a later execution layer over one shared Flow IR.

That means:

- the language core owns source parsing, compile output, static analysis, and runtime semantics over Flow IR
- provider adapters own host-specific execution mechanics such as session startup, continuation, hook wiring, tool invocation transport, and result capture
- host-specific features remain adapter capabilities, not language guarantees
- the project does not widen current shipped scope to market prompt-language as already provider-neutral end to end

The portability goal is architectural. The point is to stop core semantics from collapsing into one host's lifecycle quirks, not to rush a broad integration matrix before the substrate is ready.

## Why this needs a milestone boundary

Spec 010 and ADR-006 are directionally right: a stable IR and explicit adapters are the clean way to outlive any single host. But they are easy to misread as "add Claude, Codex, MCP, editor, and browser integrations in parallel."

That would be the wrong sequence.

Provider adapters only make sense after three earlier foundations are strong enough:

1. trust semantics define what counts as safe execution and safe failure
2. replay and checkpoint work define what runtime history and resume mean across hosts
3. Flow IR defines the provider-independent execution graph that adapters are allowed to interpret

Without those three foundations, "provider adapter" is just another name for a host-specific runner.

## Applied boundary

The provider-adapters milestone is the point where prompt-language may say:

- one authored flow compiles to one shared runtime representation
- multiple execution backends can interpret that representation
- differences between hosts are expressed as adapter capabilities, unsupported features, or diagnostics

It is not the point where prompt-language promises:

- feature parity across all hosts
- one universal host lifecycle abstraction in the DSL
- generic extension management for plugins, hooks, or MCP servers
- broad editor or browser surfaces as proof of runtime portability

That distinction matters because portability is about preserving one core contract under different runtimes, not about shipping every surrounding integration surface at once.

## What the shared Flow IR must own

The shared IR is the compatibility authority for provider work.

At minimum, the IR needs stable representation for the semantics already called out in Spec 010:

- explicit nodes and edges
- node classes
- variable reads and writes
- effect metadata
- capability requirements
- contracts and policy references
- schema references
- artifact producer and consumer edges
- budget and child-flow topology

The important boundary is not the exact serialization format yet. The important boundary is that provider adapters consume a provider-independent execution model rather than re-parsing source files or reverse-engineering host prompts.

If a host needs extra execution hints, those should be attached as adapter-facing metadata or capability mappings over the IR. They should not become new source-language semantics by accident.

## What provider adapters own

A provider adapter is responsible for lowering shared runtime intent into one host's actual execution surface.

Examples include:

- how a session is started, resumed, or continued
- how prompts are transported to the host
- how host tools or commands are invoked
- how approvals, reviews, and stop conditions are surfaced to the host
- how raw host outputs are captured and normalized into runtime results
- which declared capabilities are supported, unsupported, or only partially measurable

This keeps the split clean:

- core decides what a flow means
- adapters decide how that meaning is carried out on a given host

The adapter may reject a flow for missing capabilities. It may not silently redefine the flow's semantics to fit the host.

## Explicit blockers

`prompt-language-zhog.8` is intentionally blocked on earlier vNext work. It should not be treated as a parallel "integration epic."

### Blocker 1: trust hardening

Provider work depends on the fail-closed contract in `prompt-language-zhog.1`.

Reason:

- adapters need one shared meaning for approval timeout, review exhaustion, unknown variables, corruption, and budget exhaustion
- without that, each host will drift into its own interpretation of safety and recovery

The adapter boundary must inherit trust rules. It does not get to invent them.

### Blocker 2: replay and checkpoint substrate

Provider work depends on the replayability direction in `prompt-language-zhog.3`.

Reason:

- cross-provider execution becomes unverifiable if checkpoints, event history, and resume boundaries are not defined independently of the current host
- adapter output needs a stable place to land in the runtime record, or comparisons across providers become anecdotal

This is especially important if one host is step-oriented and another is thread-oriented. The replay model has to normalize that difference at the runtime boundary.

### Blocker 3: compile-time rigor and Flow IR

Provider work is directly blocked on `prompt-language-zhog.4`, which owns Flow IR, linting, simulation, and flow tests.

Reason:

- adapters need a stable compile target
- simulation and compatibility analysis need the same IR the adapters consume
- provider support should be decided against declared capabilities and effects, not against ad hoc source inspection

Until `zhog.4` exists in substance, the provider-adapters milestone stays architectural rather than implementation-facing.

## Capability model, not fake parity

Provider-neutral architecture does not mean every host supports every behavior.

The correct model is:

- the IR declares required semantics and capabilities
- the adapter declares what it can honor
- compile, lint, or preflight can report incompatibilities before execution

Examples of likely adapter differences:

- hook-driven versus runner-driven enforcement
- atomic exec versus multi-turn threaded continuity
- approval surfacing
- tool transport shape
- measurable cost or workspace-diff support
- child-session orchestration support

Those differences should produce capability reports and diagnostics, not hidden semantic downgrades.

## Relationship to existing host boundaries

This milestone stays aligned with the repo's existing architecture decisions.

### Host extension boundary still applies

The [Host Extension Boundary](host-extension-boundary.md) already establishes that prompt-language does not become a host-extension management plane.

Provider adapters therefore may:

- use host hooks, plugin packaging, or host MCP registration as implementation details
- expose flow-facing control or inspection where the host supports it

Provider adapters do not:

- make host plugin lifecycle a language feature
- standardize raw host extension configuration in the DSL
- turn MCP into a generic extension-control plane

### Multi-agent boundary still applies

The [Multi-Agent Orchestration Boundary](multi-agent-orchestration.md) already keeps prompt-language subagent-first.

Provider adapters must preserve that control model. They may change how a child session is launched on a host, but they do not convert prompt-language into a peer-mesh or agent-team runtime.

## Relationship to MCP, LSP, and playground backlog

The existing backlog already includes MCP, LSP, and browser-playground work. Those items should relate to provider adapters as downstream consumers or adjacent surfaces, not as the driver of the provider architecture.

### MCP: flow-facing control surface, not the portability layer

`prompt-language-folr` is about exposing prompt-language flow state to external clients.

That work sits above the runtime substrate:

- it can read or control session state
- it can expose rendered flow progress, variables, or diagnostics
- it may eventually inspect adapter capability status

It does not define provider portability by itself.

MCP remains flow-facing. It is not the shared IR, not the provider-adapter contract, and not a reason to widen prompt-language into generic host administration.

### LSP: authoring assistance over language and compile surfaces

`prompt-language-idbc` is an editor/tooling surface.

Its natural dependency is the language and compile boundary:

- parser behavior
- diagnostics
- symbol and variable knowledge
- later IR-backed compatibility or effect warnings

The LSP can benefit from a shared IR once `zhog.4` exists, but it should not lead the provider-adapter sequence. Editor autocomplete is not evidence that runtime portability is solved.

### Playground: browser authoring and simulation, not runtime parity

`prompt-language-528q` is a browser-facing onboarding and dry-run surface.

Its correct relation to provider work is:

- it can use parser, renderer, lint, and simulation outputs
- it can explain capability mismatches or show IR-derived diagnostics later
- it should not be presented as a proof that real provider execution is already portable

The playground belongs to docs and authoring UX. It does not replace trust, replay, or adapter verification.

## What this milestone should deliver later

Once the blockers above are materially in place, the provider-adapters milestone should define:

- one shared Flow IR contract that adapters consume
- one adapter interface for execution, continuation, result normalization, and capability reporting
- one compatibility story for unsupported or partially supported runtime features
- one test strategy that compares provider behavior against the same IR-derived expectations

At that point, host-specific implementations such as Claude, Codex, or future adapters can be judged against one runtime contract instead of against hand-written host glue.

## What this milestone does not promise now

This note does not claim that prompt-language already ships:

- a stable shared Flow IR
- a provider-neutral runtime implementation
- broad multi-provider smoke coverage
- host-parity for approvals, hooks, or threaded execution
- editor, playground, and MCP surfaces all wired to one released adapter framework

Those remain sequenced backlog outcomes.

The current repo direction should therefore keep saying:

- portability is an explicit architecture target
- the runtime is still proving trust, replay, and IR substrate first
- adjacent tooling surfaces should consume that substrate when it exists rather than redefine it early

## Consequences

### What becomes clearer

- provider portability is a runtime-architecture concern, not a marketing label for any new integration
- host-specific lifecycle differences stay in adapters instead of leaking upward into the language
- MCP, LSP, and playground work can be prioritized honestly without pretending they establish execution portability

### What gets constrained

- no "just add another host" work that bypasses the shared IR boundary
- no presentation of provider support as stable before trust and replay semantics are portable
- no widening of prompt-language core into generic host-extension, editor-platform, or browser-platform management

## Practical rule

When evaluating new provider-related work, ask:

> Is this defining or consuming the shared runtime contract, or is it just adding another host-facing integration surface?

If it is only the second case, it should not lead `prompt-language-zhog.8`.

The provider-adapters milestone starts only when trust, replay, and Flow IR are strong enough that multiple hosts can be compared against the same runtime semantics.
