# Design: Host Extension Boundary

## Status

Accepted boundary for the current product direction.

Relevant open beads:

- `prompt-language-7kau` - Decision: MCP scope should be flow-facing, not generic extension management
- `prompt-language-9uqe.13` - Decision: profiles and agents vs direct management of skills, hooks, plugins, and MCP

## Decision

prompt-language does **not** become a host-extension management plane.

That means the product does not take ownership of the lifecycle for host-specific skills, hooks, plugins, or MCP servers. Those remain backend capabilities of the selected harness or host runtime.

prompt-language instead stays focused on its own first-class concepts:

- flow files
- profiles
- agents
- orchestration and verification around those concepts

## What stays in scope

The runtime may still depend on host capabilities, but only as implementation details behind adapters.

Allowed host-facing behavior:

- install or register prompt-language itself with the host
- invoke host commands through harness adapters
- expose prompt-language flow state to other tools
- use host-managed skills or extension packs as input to the runtime when the harness supports them

## What stays out of scope

The following do not become prompt-language core features:

- skill marketplace management
- hook lifecycle management
- plugin enable/disable workflows
- host MCP server lifecycle management
- direct editing of host extension manifests as a prompt-language language feature

The same boundary applies to multi-agent work: prompt-language may orchestrate spawned children, but it does not manage host-level agent teams, shared task boards, or skill marketplaces as core runtime concepts.

This is a deliberate boundary, not a missing feature.

## MCP scope

MCP remains flow-facing.

It can expose or control prompt-language session state, render flow progress, inspect variables, and support task-oriented integrations. It should not become a general-purpose extension administration plane for the host client.

That keeps MCP aligned with the rest of the design:

- prompt-language owns flow orchestration
- the host owns its extension ecosystem
- adapters bridge the two when needed

## Rationale

The main reason is architectural hygiene.

If prompt-language starts modeling host skills, hooks, plugins, and MCP server administration as language primitives, the DSL becomes coupled to whichever client is currently primary. That would weaken portability and blur the product's identity.

The repo's existing architecture position already says prompt-language is a meta-orchestration layer for an autonomous agent, not a platform for managing the agent host itself. This boundary keeps that claim honest.

## Consequences

### What this unblocks

- `prompt-language-9uqe.13` can treat profiles and agents as prompt-language-owned abstractions
- `prompt-language-7kau` can keep MCP focused on flow inspection and control
- future harness abstraction work can target backend adapters without exposing host-extension lifecycle in the DSL

### What this constrains

- docs should not describe skills, hooks, plugins, or MCP server lifecycle as prompt-language primitives
- backlog items that want host-extension management should be reframed as host integration work, not language work
- named agents and profiles should stay about runtime behavior and injected context, not host admin

## Practical rule

When evaluating a new feature, ask:

- Is this about orchestrating a flow, a profile, or a spawned child session?
- Or is it about administering the host's extension ecosystem?

If it is the second case, it does not belong in prompt-language core.

## Capability snapshot (Claude vs Codex)

This boundary is reinforced by current host-surface differences.

Legend:

- `[EVIDENCE]` directly backed by checked-in code/tests/docs
- `[INFERRED]` reasoned implication from implementation

| Concern                       | Claude surface in this repo                                                                                                                    | Codex surface in this repo                                                                                      | Confidence   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------ |
| Completion enforcement timing | Dedicated `TaskCompleted` hook (`hooks/hooks.json`, `task-completed.ts`)                                                                       | No `TaskCompleted`; gate enforcement is merged into `codex-stop.ts` and Codex contract excludes `TaskCompleted` | `[EVIDENCE]` |
| Compaction lifecycle          | `PreCompact` is wired (`hooks/hooks.json`)                                                                                                     | `PreCompact` is absent and explicitly excluded by Codex contract test                                           | `[EVIDENCE]` |
| Hook stability posture        | Claude hook loop is the documented runtime core (`docs/design/hooks-architecture.md`)                                                          | Codex hooks are explicitly opt-in/experimental (`.codex/config.toml`)                                           | `[EVIDENCE]` |
| Design implication            | Normalizing these differences into one "generic host lifecycle" would hide real behavior differences and create misleading language guarantees | Keep host-specific lifecycle semantics inside adapters and docs, not as unified DSL primitives                  | `[INFERRED]` |

For the full capability matrix (including prompt interception, tool-phase visibility, and session start), see [docs/research/08-feature-completeness.md](../research/08-feature-completeness.md).
