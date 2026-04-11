# MCP Server (WIP)

> **WIP: partial in-repo support exists, but the public MCP product surface described here is not a stable shipped contract yet.** The repo contains an MCP server module and entrypoint, but the external-client packaging and supported surface remain tracked work.

## Goal

Expose prompt-language flow state to any MCP-capable AI client.

## Current state

- the repo contains MCP server implementation work and a checked-in entrypoint
- the server code already exposes `flow://state`, `flow://variables`, `flow://gates`, `flow://audit`, plus `flow_status`, `flow_reset`, and `flow_set_variable`
- the public docs do not yet treat this as a supported, finished cross-client integration surface
- the roadmap still tracks the broader MCP product surface as WIP rather than shipped
- the current design boundary is flow-facing only; MCP is not the place where prompt-language manages host plugins, skills, hooks, or third-party MCP lifecycle

## Intended surface

Resources:

- `flow://state`
- `flow://variables`
- `flow://gates`
- `flow://audit`

Tools:

- `flow_status`
- `flow_reset`
- `flow_set_variable`

## Intended behavior

- the MCP server reads `.prompt-language/session-state.json`
- clients can inspect flow state without being a Claude Code plugin
- narrow control remains limited to prompt-language session operations such as reset and variable updates
- rendering output is available through MCP tools

## Explicit non-goals

The MCP surface described here is **not** intended to:

- install or enable Claude/Codex/OpenCode plugins
- manage host skill bundles, slash commands, or agent registries
- edit host hook manifests
- register or proxy arbitrary unrelated MCP servers
- become a general extension-administration surface

That boundary is what keeps `prompt-language-7kau` honest: MCP is about prompt-language flow state, not host-platform administration.

## Current workaround

Read the session-state JSON directly or use the CLI inside Claude Code.
