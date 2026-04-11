# Design: Operator Shell Boundary

## Status

Accepted design direction for the current OMX adaptation backlog.

Relevant open beads:

- `prompt-language-f7jp.1` - Decision: bound operator-shell imports as a shell over existing runtime semantics
- `prompt-language-f7jp.2` - Lifecycle hardening: doctor, refresh, uninstall safety, and diagnostics surface
- `prompt-language-f7jp.3` - Hook manager: ownership metadata, merge-safe install, and uninstall-safe cleanup
- `prompt-language-f7jp.4` - Run-state v2 and recovery artifacts layered over current session-state
- `prompt-language-f7jp.5` - Operator cockpit: richer `watch` surface and machine-readable status snapshots
- `prompt-language-f7jp.6` - Workflow aliases and `render-workflow` lowering to visible flows
- `prompt-language-f7jp.7` - Project scaffolding for AGENTS, starter flows, and reusable libraries
- `prompt-language-f7jp.8` - Team supervisor surfaces over existing `spawn` / `await` primitives
- `prompt-language-f7jp.9` - Rollout, troubleshooting, and promotion evidence for operator-shell work

## Decision

prompt-language may grow an **operator shell**, but that shell remains **layered above** the runtime rather than redefining the runtime itself.

The runtime remains the canonical source of truth for:

- flow structure
- session and variable state
- gate evaluation and completion
- spawned child orchestration
- deterministic rendered status and diagnostics

The operator shell is allowed to improve how users install, inspect, recover, supervise, and render that runtime. It is not allowed to replace explicit flow / gate / state semantics with hidden host behavior or a second control plane.

## What is in scope

The operator-shell program may add convenience and hardening around the shipped runtime, including:

- install, refresh, doctor, and uninstall safety
- managed hook ownership and merge-safe lifecycle behavior
- richer run-state layout and recovery artifacts
- stronger `watch` and status surfaces
- canonical workflows that lower to visible `.flow` artifacts
- project scaffolding that generates ordinary repo files
- supervision surfaces over existing `spawn` / `await` primitives

These features are valid only if they remain inspectable and grounded in the underlying runtime state.

## What is out of scope

The operator-shell program does not justify any of the following category shifts:

- an OMX-branded or Codex-first product identity
- a slash-command-first mental model that outranks flow files
- hidden role or skill magic that can override gates, state, or rendered flow structure
- tmux or worktrees as the conceptual center of the product
- a second runtime that can continue coordinating outside the explicit prompt-language execution model

If a proposed shell feature requires any of those shifts, it is proposing a product-category change rather than an incremental operator improvement.

## Why this boundary exists

prompt-language's current differentiation is not "a collection of useful commands." It is a verification-first supervision runtime with explicit control flow, visible state, and gate-owned completion semantics.

OMX-style operator discipline is useful because it sharpens the shell around that runtime:

- better lifecycle hygiene
- better observability
- better recovery
- better supervision ergonomics

OMX-style product identity is not the part to import. If the repo blurs shell conveniences into the runtime definition, it weakens the very boundary that makes the language legible and trustworthy.

## Applied rules

### 1. The runtime stays canonical

When a shell feature needs to explain what happened, the answer must be recoverable from runtime-owned artifacts such as:

- the flow graph
- state files
- child-session metadata
- gate outcomes
- rendered status or diagnostics

The shell may aggregate or present these artifacts, but it should not invent opaque state that becomes more authoritative than the runtime itself.

### 2. Conveniences must lower to visible artifacts

Canonical workflows, templates, and shortcuts are allowed only if they lower to visible prompt-language artifacts.

Examples:

- workflow aliases should render to ordinary `.flow` programs or visibly equivalent runtime structures
- shell-generated scaffolds should be ordinary repo files
- cockpit views should reflect runtime state rather than a hidden shell-only model

This keeps debugging and review anchored in the same artifacts the runtime actually executes.

### 3. Supervision remains subagent-first

Any team or supervisor surface in this program must stay inside the accepted multi-agent boundary in [Multi-Agent Orchestration Boundary](multi-agent-orchestration.md).

That means:

- supervision may sit over `spawn`, `await`, `send`, `receive`, and related child metadata
- supervision may not invent peer-team semantics, shared task boards, or autonomous agent negotiation

The operator shell may improve visibility and control over child runs. It does not create a new agent-team runtime.

### 4. Host lifecycle concerns stay host-facing

This decision also composes with [Host Extension Boundary](host-extension-boundary.md).

The operator shell may install or refresh prompt-language-owned assets, but it does not turn host-extension administration into a prompt-language language feature. Hook ownership, plugin registration, and host-specific adapters stay implementation concerns beneath this boundary rather than new DSL primitives.

## Consequences

### What this unblocks

- `doctor`, `refresh`, and recovery work can proceed without reopening product identity
- hook-manager work can be evaluated as lifecycle safety, not as a host-admin language feature
- watch/cockpit work can proceed as runtime visibility rather than a second orchestration engine
- workflow alias work can proceed if it lowers to visible artifacts
- team-supervisor work can proceed if it remains a shell over the current subagent-first model

### What this constrains

- docs must keep shipped runtime semantics separate from imported shell planning
- future operator-shell features must explain their runtime mapping, not just their UX
- no operator-shell proposal should be described as shipped behavior until the underlying runtime, docs, and validation evidence exist

## Practical rule

When evaluating a new operator feature, ask:

> Does this strengthen how users install, inspect, recover, or supervise the existing runtime, or does it try to replace the runtime's visible flow / gate / state model with a hidden shell abstraction?

If it does the first, it likely fits this roadmap.

If it does the second, it is out of scope until the project deliberately reopens the architecture boundary.
