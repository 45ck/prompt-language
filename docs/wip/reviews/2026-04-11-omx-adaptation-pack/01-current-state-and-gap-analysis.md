# Current State and Gap Analysis

## What prompt-language already has

The current public prompt-language surface already includes a substantial runtime:

- install / status / uninstall / init / validate / run / ci / demo
- Codex scaffold install / status / uninstall
- statusline and `watch`
- packaged workflows, explicitly documented as examples rather than the core feature
- `done when:` as the trust anchor
- persistent state in `.prompt-language/session-state.json`
- `spawn` / `await`, memory, approvals, imports / `use`, structured capture, review loops, and a stable SDK

The roadmap also already tracks registry, MCP, broader harness abstraction, LSP, playground, and workspace orchestration work.

## What OMX shows is still weak

OMX is stronger in operator ergonomics and durability around the runtime:

- setup / doctor / refresh / uninstall are explicit
- native hook ownership is treated as a first-class lifecycle problem
- `.omx/` stores plans, logs, memory, and runtime state as an inspectable project artifact
- a HUD / watch surface is treated as a supported operator path
- there are clear team lifecycle commands
- there are read-only inspect surfaces (`explore`, `sparkshell`)

## Gap summary

The gap is not “prompt-language lacks runtime semantics.” It is:

1. **host integration polish**
2. **state inspectability and recovery ergonomics**
3. **operator-shell clarity**
4. **team/runtime supervision UX**
5. **scaffolding for project guidance and canonical workflows**

## Important asymmetry

OMX is optimized around Codex as the execution engine. prompt-language is positioned more broadly as a supervised runtime and explicitly treats broader claims as research rather than shipped fact. That means copying OMX naively would pull prompt-language away from its strongest differentiator.

## Strategic implication

prompt-language should not react by becoming “OMX but with a DSL.” It should instead become:

- a stronger runtime core than OMX
- plus an OMX-quality operator shell
- while keeping all shortcuts inspectable and lowerable into explicit state, flow structure, and gates

## Working conclusion

This plan treats OMX as a **product-quality reference for operator experience**, not as the conceptual template for prompt-language itself.
