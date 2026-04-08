# Decision: skill vs profile vs agent vs flow file

## Status

Accepted as the canonical terminology note for the `profiles/agents` design track.

Relevant open beads:

- `prompt-language-9uqe.11` — Terminology decision: skill vs profile vs agent vs flow file
- `prompt-language-9uqe.13` — Decision: profiles and agents vs direct management of skills, hooks, plugins, and MCP
- `prompt-language-9uqe.14` — Decision: subagent-first orchestration vs agent-team semantics

## Why this note exists

Recent design discussion mixed together four different things:

- host-runtime instruction bundles
- reusable prompt-language context packs
- spawned child runtimes
- executable flow programs

If those stay blurred, the backlog will drift toward host-specific extension management and the docs will keep overstating what the product actually ships.

This note fixes the vocabulary boundary.

## Decision

prompt-language uses four distinct terms:

- **skill**: reusable know-how or host-runtime instruction bundle that belongs to the underlying agent platform, not to the prompt-language DSL
- **profile**: reusable context pack that shapes what a prompt/ask turn sees
- **agent**: a named spawned runtime definition that controls what a child session is
- **flow file**: an executable prompt-language program

### Governing rule

**Profiles control what a turn sees. Agents control what a spawned session is.**

That is the core separation.

If a feature mainly changes prompt context, defaults, or reusable turn scaffolding, it is profile-shaped.

If a feature mainly changes child-session identity, model, harness, cwd, variable passing, or execution policy, it is agent-shaped.

## Definitions

### Skill

A skill is a host-level instruction asset for the underlying agent runtime. In this repo, that means things such as slash-command bundles and `skills/` content that help Claude Code or another host agent do work.

A skill is not a prompt-language program, not a prompt-language node kind, and not a first-class prompt-language semantic object.

### Profile

A profile is a prompt-language abstraction for reusable turn context. It exists to package stable prompt-facing context such as constraints, coding standards, role framing, review criteria, or task-specific instructions that should be reused across `prompt:` or `ask` style turns.

A profile is narrower than an agent. It does not define a new runtime process. It defines reusable context for turns executed inside a runtime.

### Agent

An agent is a prompt-language abstraction for a spawned child runtime. It answers the question: when `spawn` creates a child session, what kind of session is that?

Agent concerns include things like:

- child-session identity
- model selection
- cwd / workspace targeting
- variable pass-through policy
- harness-specific runtime adapter choices

This matches the current runtime direction: `spawn` already creates child processes, and the system already has agent-shaped concerns such as `cwd`, `vars`, and `model`.

### Flow file

A flow file is an executable prompt-language program. It is the user-authored workflow artifact that contains `Goal:`, `flow:`, `done when:`, imports, and other DSL constructs.

A flow file is the top-level program unit. It may eventually reference profiles or named agents, but it is not itself one of those abstractions.

## Placement by layer

| Concept   | Primary job                        | Belongs in DSL?       | Belongs in config?     | Runtime role                           | Docs placement                             |
| --------- | ---------------------------------- | --------------------- | ---------------------- | -------------------------------------- | ------------------------------------------ |
| Skill     | Host-runtime reusable instructions | No                    | Host-specific only     | Host agent may load/invoke it          | Host integration / installer / skills docs |
| Profile   | Reusable turn context              | Yes, if shipped later | Yes                    | Shapes prompt/ask injection            | Language/design docs                       |
| Agent     | Reusable spawned child definition  | Yes, if shipped later | Yes                    | Defines spawned child runtime behavior | Language/design docs                       |
| Flow file | Executable workflow program        | Yes, already shipped  | Optional metadata only | Parsed and executed by runtime         | Core language docs                         |

## Current shipped state vs tracked terminology

This distinction must stay honest about current implementation status.

### Shipped now

- Flow files are shipped now.
- Skills exist in the repo and installer surface, but as host-runtime assets rather than DSL primitives.
- Agent behavior exists today only in ad hoc `spawn` blocks, not as a separate named definition system.

### Tracked / not yet shipped

- Profiles as a first-class reusable prompt-language construct are not shipped.
- Named agent definitions as a reusable prompt-language construct are not shipped.

That means the terminology is canonical now, but not every term already has first-class syntax.

## What goes where

### DSL surface

The DSL should expose prompt-language concepts, not raw host-extension management.

- Flow files are first-class.
- Profiles may become first-class because they are flow-facing and turn-facing.
- Agents may become first-class because they are `spawn`-facing and runtime-facing.
- Skills should not become a raw DSL primitive.

### Config surface

Config is where reusable non-inline definitions belong.

- Profiles belong in prompt-language-owned config or library surfaces if they ship.
- Agents belong in prompt-language-owned config or library surfaces if they ship.
- Host skills remain in host-managed packaging and installation surfaces.

### Runtime adapter surface

Runtime adapters translate prompt-language abstractions into host-specific behavior.

- A profile should compile to prompt/context injection behavior for the selected harness.
- An agent should compile to child-session spawn behavior for the selected harness.
- A skill should stay outside the prompt-language runtime core and remain the host's concern.

## Practical interpretation

When deciding where new work belongs, use this test:

- If the user wants reusable instructions for a turn, think `profile`.
- If the user wants reusable child-session behavior for `spawn`, think `agent`.
- If the user wants a complete executable workflow, think `flow file`.
- If the user wants to manage slash commands, host extensions, marketplace bundles, or host instruction packs, think `skill`, which is outside the prompt-language language core.

## Consequences

### What this unblocks

- `prompt-language-9uqe.11` can use this note as the canonical wording.
- `prompt-language-9uqe.13` can build on this abstraction boundary instead of collapsing into direct host-extension management.
- Future profiles/agents design work can target prompt-language-owned abstractions rather than mirroring Claude/Codex/OpenClaw feature names.

### What this constrains

- Docs must stop using `skill` and `profile` interchangeably.
- Backlog items should not propose direct management of hooks, plugins, MCP servers, or host skills as if those were prompt-language language constructs.
- `spawn` evolution should be discussed in agent terms, not in skill terms.

## Non-goals

This decision explicitly does not do the following:

- It does not make raw skills a first-class DSL primitive.
- It does not endorse an OO-style method syntax on flows, profiles, or agents.
- It does not commit prompt-language to managing host plugin lifecycle, host hook lifecycle, or MCP server lifecycle directly.
- It does not claim that named profiles or named agents are already shipped.

## Rationale

This boundary keeps prompt-language portable.

If the product directly models Claude-specific or Codex-specific skills, hooks, plugins, and marketplace objects as language concepts, the DSL will become a thin wrapper over whichever host is currently primary. That would make the language harder to explain, harder to port, and harder to keep architecture-stable.

By contrast:

- flow files stay the executable user artifact
- profiles stay turn-facing
- agents stay spawn-facing
- skills stay host-facing

That separation aligns with the repo's existing architecture position: prompt-language is a meta-orchestration layer for an autonomous agent, not a general extension manager for the host platform.
