# Design: Host Lifecycle Boundary

## Status

Accepted boundary note for `prompt-language-pbv5.2`.

Primary repo anchor:

- [Report 08: Feature Completeness Assessment](../research/08-feature-completeness.md)

Related design anchors:

- [Host Extension Boundary](host-extension-boundary.md)
- [Hook Manager Ownership and Lifecycle](hook-manager-ownership.md)
- [Operator Shell Boundary](operator-shell-boundary.md)
- [Provider Adapters Over Shared Flow IR](provider-adapters-shared-flow-ir.md)
- [Decision: skill vs profile vs agent vs flow file](terminology-skill-profile-agent-flow.md)

## Summary

The repo already contains the right comparison in [Report 08](../research/08-feature-completeness.md): host lifecycle work is least confusing when it stays **outside the core language**, with actual host wiring handled by **host-specific installers and adapters**, and with any shared config limited to **prompt-language-owned abstractions** rather than raw host internals.

This note refines that position into one product boundary:

- the **core language** owns flow semantics, gates, variables, spawn/await orchestration, and other prompt-language runtime concepts
- a **prompt-language-owned config/platform layer** may exist only for prompt-language concepts such as profiles, agents, harness defaults, and other flow-facing abstractions
- **host lifecycle automation and hook management remain outside the core language** and are implemented by host-specific installers, adapters, and operator-shell commands

## Repo evidence

The recommendation is not new. It is the convergence of several repo facts.

### 1. Report 08 already compares the three shapes directly

[Report 08](../research/08-feature-completeness.md) explicitly compares:

- inline DSL syntax for hooks and plugin lifecycle
- prompt-language-owned config / adapter layer
- host-specific installers / local scaffolds

Its current conclusion is already the right baseline:

- reject DSL syntax for host lifecycle work
- allow config only for prompt-language-owned abstractions
- keep host-specific wiring in installers and adapters

This note keeps that conclusion and sharpens the boundary language around it.

### 2. The repo already documents real lifecycle divergence across hosts

[Report 08](../research/08-feature-completeness.md) also documents that the currently wired Claude and Codex surfaces are not lifecycle-equivalent in this repo:

- Claude has a dedicated `TaskCompleted` hook and `PreCompact`
- the native Codex scaffold does not expose those same lifecycle surfaces
- Codex `PostToolUse` visibility is narrower
- the supervised/headless runner owns more lifecycle itself than native host hooks do

That matters because a shared inline DSL for hook lifecycle would imply a stable common surface that the repo's own evidence says does not exist.

### 3. Existing design notes already keep host mechanics below the language

Current design docs already separate prompt-language concepts from host integration work:

- [Host Extension Boundary](host-extension-boundary.md) says prompt-language is not a host-extension management plane
- [Hook Manager Ownership and Lifecycle](hook-manager-ownership.md) puts hook ownership metadata and merge-safe cleanup in adapters and operator-shell logic, not in DSL syntax
- [Operator Shell Boundary](operator-shell-boundary.md) says install, inspect, recover, and supervise may grow above the runtime without redefining the runtime
- [Provider Adapters Over Shared Flow IR](provider-adapters-shared-flow-ir.md) says host-specific execution mechanics such as hook wiring belong to adapters
- [Decision: skill vs profile vs agent vs flow file](terminology-skill-profile-agent-flow.md) keeps host skills and extension assets outside the prompt-language language core

### 4. The current shipped surface is already installer- and adapter-shaped

The repo's operational docs and code paths are consistent with this boundary:

- [CLAUDE.md](../CLAUDE.md) describes installation through `bin/cli.mjs install`
- installer tests in `src/infrastructure/adapters/installer.test.ts` verify copied plugin assets and host registration
- [Hooks Architecture](hooks-architecture.md) documents concrete Claude hook files and commands rather than a generic DSL lifecycle layer
- [Roadmap](../roadmap.md) explicitly narrows current Codex support and warns against overstating host lifecycle parity

The implementation direction is therefore already: host lifecycle is operational plumbing, not language semantics.

## Option comparison

This refines the three-way comparison already present in [Report 08](../research/08-feature-completeness.md).

| Option                                              | What it means here                                                                                                                          | Benefit                                                               | Main confusion risk                                                                       | Fit with repo evidence                                                                                    | Decision                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Inline DSL syntax                                   | Add syntax for hooks, installation, host lifecycle, or hook-manager rules directly to the language                                          | Single authoring surface                                              | Pretends Claude/Codex lifecycle parity and makes host quirks look like language semantics | Poor. Report 08 and current design docs both argue against this                                           | Reject                                    |
| Separate config / platform layer                    | Add prompt-language-owned config for profiles, agents, harness defaults, or other prompt-language abstractions that adapters consume        | Shared surface for prompt-language concepts without polluting the DSL | Drifts into host-manifest mirroring if it starts encoding raw plugin or hook internals    | Good only when the config describes prompt-language concepts rather than host-native objects              | Allow, but keep it narrow                 |
| Host-specific installers with no shared abstraction | Put plugin install, hook wiring, refresh, uninstall, and host config mutation entirely in host-specific adapters and operator-shell tooling | Honest about lifecycle differences and easiest to keep safe           | UX can fragment across hosts if nothing common exists above adapters                      | Strong for actual lifecycle automation, matching current installer, operator-shell, and hook-manager work | Keep as the lifecycle implementation path |

## Recommendation

The least confusing product boundary is a **split boundary**, not a single universal lifecycle layer:

1. The **core language** stays flow-first and host-agnostic.
2. A **narrow prompt-language-owned config/platform layer** may define prompt-language concepts that need reusable non-inline configuration.
3. **Host lifecycle automation and hook management stay outside the core language** and are implemented by host-specific installers, adapters, and operator-shell lifecycle commands.

Stated more directly:

- choose the **separate config/platform layer** only for prompt-language-owned abstractions
- choose **host-specific installers/adapters** for actual lifecycle automation and hook management
- do **not** put lifecycle automation into inline DSL syntax

That is the least confusing boundary because it preserves one honest claim:

> prompt-language authors flows and runtime-facing abstractions; the host integration layer installs, wires, repairs, and removes host-specific machinery.

## What belongs in core vs outside core

### Core language and runtime

These remain prompt-language core concerns:

- flow structure and compile/runtime semantics
- gates and completion rules
- variables and state progression
- spawn/await orchestration
- flow-facing diagnostics and rendered progress
- prompt-language abstractions such as profiles, agents, or harness defaults if and only if they describe prompt-language behavior rather than raw host configuration

### Outside the core language

These should remain outside the core language, even if prompt-language tooling helps execute them:

- plugin installation and registration
- hook wiring, refresh, and uninstall behavior
- direct mutation of host hook manifests or plugin config files
- host-specific ownership metadata for managed hook entries
- host enable/disable workflows
- host extension marketplace management
- host skill or slash-command bundle management
- host MCP server lifecycle management
- any fake "generic host lifecycle" abstraction that hides real Claude/Codex differences

Those belong in adapters, installers, operator-shell lifecycle commands, and host-specific diagnostics.

## Why this boundary is clearer than the alternatives

### Why not inline DSL syntax

Inline lifecycle syntax would blur two different jobs:

- expressing what a flow should do
- administering the host environment that makes the flow runnable

The repo's own evidence shows those jobs do not share one stable cross-host lifecycle surface. Putting host lifecycle into the language would therefore turn contingent host behavior into misleading product semantics.

### Why not a full shared platform abstraction for everything

A separate config/platform layer is useful only up to the point where it still talks about prompt-language concepts. Once it starts mirroring raw host plugin schemas, hook slots, or installer details, it stops being a prompt-language abstraction and becomes a leaky duplicate of host config.

That would create two authorities:

- the real host config
- a prompt-language shadow config trying to describe it

This repo already argues against hidden second control planes. The same reasoning applies here.

### Why host-specific installers and adapters are the right place

Lifecycle automation is operational and host-shaped:

- install paths differ
- available hooks differ
- ownership and merge safety differ
- diagnostics and repair paths differ

The operator-shell and hook-manager docs already assume that reality. Keeping lifecycle automation in those layers is more honest and easier to make safe.

## Practical rule

When evaluating a proposal, ask:

- Is this describing how a prompt-language flow behaves?
- Or is it describing how prompt-language gets installed, wired into a host, repaired, or removed?

If it is the second case, it is outside the core language.

If a reusable definition is still needed, the first question is not "should this become DSL syntax?" but:

- is this a prompt-language abstraction that belongs in prompt-language-owned config?
- or is it host lifecycle plumbing that belongs in adapters and operator tooling?

## Consequences

What this supports:

- consistent docs language for `prompt-language-pbv5.2`
- future profiles/agents/harness-default work without turning host internals into language features
- safer installer, doctor, refresh, and uninstall work inside the operator shell
- clearer provider-adapter work because lifecycle differences stay explicit

What this blocks:

- adding hook lifecycle directives to the DSL
- describing plugin or hook management as prompt-language primitives
- building a generic host admin layer under the prompt-language brand
- claiming lifecycle parity where the repo only has partial overlap
