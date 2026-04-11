# Design: MCP Flow-Facing Scope

## Status

Accepted decision note for bead `prompt-language-7kau`.

Primary anchors:

- [Host Extension Boundary](host-extension-boundary.md)
- [Operator Shell Boundary](operator-shell-boundary.md)

This note decides what MCP is allowed to do in prompt-language. It keeps MCP aligned to prompt-language flows and runtime state. It rejects turning prompt-language into a generic extension-management or platform-management layer.

## Scope

This note covers:

- whether MCP should stay flow-facing or become a broader management plane
- which MCP operations are allowed when they directly serve prompt-language flow execution
- which management features stay out of scope

This note does not:

- redefine profiles, agents, or host adapters
- approve host plugin or host MCP lifecycle management
- create a generic platform API for unrelated tools

## Decision

prompt-language keeps MCP **flow-facing**.

MCP may expose prompt-language runtime state, support bounded flow control, and help external tools inspect or influence the current prompt-language session when that interaction maps back to visible flow semantics.

prompt-language does **not** use MCP as a generic extension-management surface, host-administration plane, or platform runtime for arbitrary services.

The boundary is:

- MCP may control or inspect **prompt-language concepts**
- MCP may not manage the host client's extension ecosystem or become a generic platform-control layer

## Option Comparison

| Direction                                | What it would mean                                                                                                           | Benefits                                                                                                | Costs and risks                                                                                                                                                  | Decision |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Flow-facing MCP                          | MCP exposes flow progress, session state, gates, variables, and a narrow set of prompt-language control actions              | Matches the product boundary, stays inspectable, supports integrations without hiding runtime semantics | Requires discipline to keep operations narrow and runtime-backed                                                                                                 | Accept   |
| Generic extension or platform management | MCP manages plugins, skills, host hooks, external server registration, platform resources, or unrelated agent infrastructure | Looks flexible on paper and may centralize setup tasks                                                  | Blurs product identity, couples prompt-language to host-specific lifecycle differences, creates misleading portability claims, and expands scope away from flows | Reject   |

## Why Flow-Facing Wins

prompt-language is valuable because it gives a visible flow runtime with explicit control points, reviewable state, and gate-owned completion semantics.

A flow-facing MCP strengthens that model:

- external tools can inspect what the runtime is doing
- bounded control actions can map to visible runtime transitions
- integrations stay honest because the source of truth remains the prompt-language run

A generic management-plane MCP weakens that model:

- host-specific setup and lifecycle logic start to leak into the product surface
- the repo would need to pretend different clients expose equivalent extension semantics when they do not
- "MCP support" would drift from flow orchestration into platform administration

That is the wrong trade.

## Allowed MCP Operations

Allowed operations must satisfy both rules:

- they act on prompt-language runtime concepts
- their effects are visible in prompt-language state, diagnostics, or artifacts

The allowed flow-control and inspection surface is intentionally narrow:

- inspect the current flow graph or rendered flow progress
- inspect current session state, variables, and active step context
- inspect gate status, pending gates, and completion state
- inspect spawned-child status when it is already part of prompt-language orchestration
- set or update prompt-language session variables when an integration needs a controlled bridge into the current run
- reset prompt-language session state for the active run
- request bounded flow actions such as resume, retry, cancel, or advance when those actions already exist in the runtime model

These operations are allowed because they remain flow-facing. They do not invent a second control plane. They expose or trigger behavior the runtime already owns.

## Out-of-Scope Management Features

The following remain out of scope for MCP in prompt-language:

- installing, enabling, disabling, or upgrading host plugins
- managing host skills, slash-command packs, or extension bundles
- editing host hook manifests or host lifecycle configuration
- registering, starting, stopping, or supervising unrelated MCP servers for the host client
- acting as a generic marketplace or package-management interface
- provisioning platform infrastructure, runtimes, workers, queues, or external service fleets
- managing arbitrary agent teams, shared task boards, or non-prompt-language coordination systems
- exposing raw host-administration APIs as if they were prompt-language language features

If a proposed MCP feature primarily administers the host or broader platform rather than a prompt-language run, it is outside prompt-language core.

## Supporting Context

Other systems can justify the boundary without changing it.

Tools and runtimes such as Archon, GitHub Agentic Workflows, or AgentScope Runtime may include broader orchestration or platform-management concerns. That context is useful only as a contrast:

- those systems can afford broader platform surfaces because platform management is part of their product story
- prompt-language should not import that scope unless it deliberately changes product category

For this repo, the safer interpretation is narrower: use MCP to support prompt-language flow execution, not to recreate a generic agent platform or extension-control center.

## Consequences

What this enables:

- integrations can observe or steer runs without bypassing visible runtime semantics
- MCP tooling can be useful immediately for flow inspection and bounded control
- host-specific lifecycle work can stay in adapters, installers, and local setup where it belongs

What this prevents:

- accidental drift from flow runtime into host administration
- misleading docs that imply prompt-language owns plugin, hook, or server lifecycle
- a large platform surface that the runtime cannot implement consistently across hosts

## Practical Rule

When evaluating an MCP feature, ask:

> Does this help inspect or control a prompt-language run, or does it try to manage the host or broader platform?

If it is about the run, it may fit.

If it is about host or platform management, it is out of scope.

## Final Decision

MCP in prompt-language stays **flow-facing**: it may inspect runtime state and perform narrow, runtime-backed flow-control actions, but it must not turn prompt-language into a generic extension-management or platform-management layer.
