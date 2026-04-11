# Research: OpenClaw Integration Spike

## Status

Research note for `prompt-language-0yg6.3`.

This note uses only repo-local OpenClaw source material plus adjacent prompt-language host-boundary notes. It identifies the smallest credible OpenClaw integration path, compares its lifecycle and security shape against the repo's current Claude and Codex stories, and recommends whether to prototype now, track later, or defer.

## Sources used

- [`docs/research/sources/openclaw-extending.md`](sources/openclaw-extending.md)
- [`docs/research/sources/openclaw-hardening.md`](sources/openclaw-hardening.md)
- [`docs/research/sources/openclaw-docs-combined.md`](sources/openclaw-docs-combined.md)
- [`docs/design/host-extension-boundary.md`](../design/host-extension-boundary.md)
- [`docs/design/host-lifecycle-boundary.md`](../design/host-lifecycle-boundary.md)
- [`docs/design/mcp-flow-facing-scope.md`](../design/mcp-flow-facing-scope.md)
- [`docs/design/operator-shell-boundary.md`](../design/operator-shell-boundary.md)
- [`docs/design/provider-adapters-shared-flow-ir.md`](../design/provider-adapters-shared-flow-ir.md)
- [`docs/research/08-feature-completeness.md`](08-feature-completeness.md)
- [`docs/research/claude-vs-codex-lifecycle-capability-matrix.md`](claude-vs-codex-lifecycle-capability-matrix.md)

## Question

What is the smallest credible OpenClaw integration path for prompt-language, given the repo's current host boundaries and the OpenClaw surfaces documented under `docs/research/sources`?

## Short answer

The smallest credible path is **not** a native lifecycle-parity adapter and **not** prompt-language-owned management of OpenClaw plugins, hooks, or config.

The smallest credible path is a **host-specific operator-shell or adapter spike that treats OpenClaw as an external Gateway-backed runtime and targets only its authenticated webhook ingress**:

- `POST /hooks/wake` for "poke the main session"
- `POST /hooks/agent` for "start an isolated agent run"

That path is small enough to validate value, keeps OpenClaw host specifics outside the language core, and does not require prompt-language to pretend it owns OpenClaw's broader platform lifecycle.

## Why this is the smallest credible path

The OpenClaw sources in this repo describe a much broader platform than the Claude and Codex surfaces prompt-language currently targets:

- a long-lived Gateway control plane
- first-class sessions and agents
- plugins, skills, tools, and internal hooks
- external HTTP webhooks
- cron and heartbeat scheduling
- durable state under `~/.openclaw`

That matters because the prompt-language host-boundary notes already reject turning the language into a generic host-extension or platform-management plane.

Those notes consistently say:

- host lifecycle stays outside the DSL
- host-specific installers and adapters own lifecycle wiring
- MCP stays flow-facing rather than becoming extension administration
- provider adapters must not promise fake parity before the shared Flow IR and replay substrate are ready

Given those constraints, most OpenClaw surfaces are too large for a first integration:

- plugin install and config would pull prompt-language into OpenClaw extension lifecycle
- managed hooks would pull prompt-language into OpenClaw hook ownership and discovery semantics
- Gateway RPC and session control would push the design toward a broader platform bridge before the provider-adapter substrate is mature

By contrast, the webhook surface is already designed as a bounded external trigger API with explicit auth, explicit endpoints, and clear security guidance. That makes it the narrowest host-facing seam that can demonstrate real usefulness.

## Smallest prototype shape

Prototype only the following shape:

1. prompt-language keeps its own runtime, docs, and semantics unchanged
2. a host-specific OpenClaw adapter or operator-shell command sends authenticated HTTP requests to an OpenClaw Gateway
3. the spike supports only two intents:
   - wake an existing OpenClaw main session
   - launch an isolated OpenClaw agent run with a supplied message and optional bounded `agentId`
4. any resulting OpenClaw activity is treated as OpenClaw-owned execution, not prompt-language-native lifecycle

Concretely, that means:

- use a dedicated hook token
- target loopback, tailnet, or another trusted proxy boundary only
- restrict explicit agent routing with `hooks.allowedAgentIds`
- keep payloads small and non-secret
- rely on OpenClaw's default external-content safety wrapper rather than disabling it

This is a real integration, but still an adapter-level bridge instead of a language commitment.

## What not to prototype first

Do not start with:

- prompt-language DSL syntax for OpenClaw hooks, agents, or plugins
- prompt-language-managed OpenClaw plugin install, enable, update, or uninstall flows
- prompt-language-managed mutation of `~/.openclaw/openclaw.json`
- a generic MCP bridge for OpenClaw platform administration
- claims that OpenClaw is just another Claude/Codex-style lifecycle backend
- deep Gateway RPC or session-control parity work

Those are larger category shifts and would immediately run into the boundaries already accepted elsewhere in the repo.

## Lifecycle differences versus Claude and Codex

### Claude and Codex in this repo

The repo's current lifecycle notes show that Claude and Codex are being reasoned about as host-execution backends for prompt-language:

- prompt interception before model turns
- stop blocking
- completion enforcement timing
- session restore and compaction behavior
- child-session continuity

Even Claude and Codex do not fully share one lifecycle contract today. The repo already treats Claude as the stable hook-native path, native Codex hooks as partial, and the Codex headless runner as the honest cross-host baseline.

### OpenClaw

OpenClaw's documented shape is different.

It is not primarily a small hook surface inside another coding agent. It is a broader agent platform centered on a long-lived Gateway with its own:

- session and agent model
- hook system
- webhook ingress
- cron and heartbeats
- tool policies
- plugin system
- workspace and memory conventions
- persistent state under `~/.openclaw`

That means an OpenClaw integration is not a drop-in extension of the Claude/Codex matrix.

The lifecycle mismatch is structural:

- Claude and Codex integration points in this repo are about controlling prompt-language execution inside a host loop
- OpenClaw's easiest documented seam is asking an already-running OpenClaw Gateway to do work via webhook ingress
- OpenClaw therefore looks more like an adjacent runtime or platform than like another narrow hook contract

The correct first move is to respect that difference rather than normalize it away.

## Security differences versus Claude and Codex

The OpenClaw sources in this repo highlight stronger first-pass security constraints than the current Claude/Codex host notes:

- OpenClaw stores session transcripts on disk under `~/.openclaw/agents/<agentId>/sessions/*.jsonl`
- sandboxing is opt-in rather than assumed
- tools and exec posture can become effectively host-level if not constrained
- skills and plugins are an explicit supply-chain risk
- webhook ingress requires explicit token-based auth
- Gateway exposure and reverse-proxy handling need deliberate hardening

Those facts push the first integration toward a conservative shape:

- do not send secrets through webhook payloads
- do not let prompt-language take ownership of plugin or skill lifecycle
- do not widen the scope to remote config mutation
- do not assume OpenClaw host state is ephemeral or low-risk

Compared with Claude/Codex, the first OpenClaw prototype must behave more like a carefully bounded external-system integration than like another in-process hook surface.

## Fit with prompt-language architecture boundaries

This webhook-first spike fits the accepted prompt-language boundaries well:

- `host-extension-boundary.md`
  - supports host-specific adapters
  - rejects host-extension lifecycle as language syntax
- `host-lifecycle-boundary.md`
  - keeps actual host wiring outside the core language
- `mcp-flow-facing-scope.md`
  - avoids turning prompt-language into a generic OpenClaw management plane
- `operator-shell-boundary.md`
  - allows host-facing lifecycle conveniences above the runtime
- `provider-adapters-shared-flow-ir.md`
  - avoids claiming multi-provider runtime parity before the Flow IR and capability model are mature

By contrast, a deeper OpenClaw integration now would cut across all of those boundaries at once.

## Recommendation

Recommend **prototype now**, but only in the narrow webhook-first form.

That recommendation is intentionally limited:

- prototype now:
  - a host-specific OpenClaw adapter or operator-shell spike that can call `/hooks/wake` and `/hooks/agent`
  - explicit auth, bounded agent routing, and loopback or trusted-network deployment assumptions
  - documentation that this is an OpenClaw-specific integration path, not a new language primitive
- track later:
  - any deeper OpenClaw adapter based on Gateway RPC, session inspection, or more direct lifecycle coupling
  - any provider-neutral story that tries to place OpenClaw beside Claude and Codex under one shared runtime contract
  - any MCP exposure beyond flow-facing prompt-language concepts
- defer:
  - plugin lifecycle management
  - prompt-language-owned OpenClaw config management
  - DSL syntax for OpenClaw-specific lifecycle constructs

## Decision rule

If the proposed work asks prompt-language to **trigger** OpenClaw safely from the outside, it is a reasonable prototype candidate now.

If the proposed work asks prompt-language to **administer or normalize** OpenClaw's broader platform lifecycle, it should be tracked later or deferred until the provider-adapter substrate is much stronger.

## Final recommendation

**Prototype now**: a minimal, host-specific OpenClaw webhook bridge.

Do **not** treat that as evidence that prompt-language should already support OpenClaw as a full lifecycle-parity backend beside Claude and Codex.
