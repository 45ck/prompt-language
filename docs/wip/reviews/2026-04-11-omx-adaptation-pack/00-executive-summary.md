# Executive Summary

## Decision

prompt-language should **take and modify** OMX ideas, not adopt them verbatim.

The rule is simple:

- if an OMX idea improves **operation** of the runtime, adopt the discipline
- if an OMX idea changes **what the runtime is**, translate it into flow / gate / state semantics first

## Why now

prompt-language already ships the hard part of the product story:

- explicit `flow:`
- `done when:` verification gates
- persistent state
- reusable imports / exported libraries
- memory, approvals, structured capture
- `spawn` / `await` parallelism
- statusline and `watch`
- a public SDK

OMX highlights a narrower but real gap: the operator shell around the runtime is not yet as polished as the runtime itself.

## What to take from OMX

### Adopt mostly as-is

- install / refresh / doctor / uninstall discipline
- hook ownership + safe merge semantics
- richer run-state layout and recovery artifacts
- more opinionated operational monitoring
- explicit team lifecycle surfaces
- bounded inspect surfaces for repo lookup and shell-native verification

### Modify into prompt-language-native forms

- canonical workflows -> lowered flow templates, not magic commands
- AGENTS / skills -> scaffolding + reusable libraries, not hidden authority layers
- HUD -> richer `watch` / statusline, not a separate mental model
- team runtime -> supervisor over `spawn` / `await`, with worktree adapters as optional implementation details

### Reject

- Codex-first worldview
- tmux/worktree as conceptual center
- command-first identity that competes with the language
- role / skill magic that can bypass gates or hide runtime state

## Product thesis after this pack

prompt-language remains:

> the supervised runtime and control plane

The OMX-inspired layer becomes:

> the operator shell that installs, renders, inspects, recovers, and supervises that runtime

## First implementation order

1. hook manager + doctor + refresh / uninstall semantics
2. run-state directory v2 and recovery artifacts
3. watch / statusline upgrade into a fuller operator cockpit
4. flow-native canonical workflow aliases
5. AGENTS / scaffolding / reusable library bootstrap
6. team supervisor and bounded inspect surfaces

## Success criteria

This work is successful only if all of the following are true:

- gates remain the trust anchor
- every convenience surface can be lowered to explicit runtime state or flow templates
- uninstall leaves user-owned hooks intact
- operator state is inspectable and recoverable
- team features do not require tmux to understand the product
- docs remain honest about shipped vs tracked vs exploratory work
