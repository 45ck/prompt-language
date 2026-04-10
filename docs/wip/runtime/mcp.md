# MCP Server (WIP)

> **WIP: partial in-repo support exists, but the public MCP product surface described here is not a stable shipped contract yet.** The repo contains an MCP server module and entrypoint, but the external-client packaging and supported surface remain tracked work.

## Goal

Expose prompt-language flow state to any MCP-capable AI client.

## Current state

- the repo contains MCP server implementation work and a checked-in entrypoint
- the public docs do not yet treat this as a supported, finished cross-client integration surface
- the roadmap still tracks the broader MCP product surface as WIP rather than shipped

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
- rendering output is available through MCP tools

## Current workaround

Read the session-state JSON directly or use the CLI inside Claude Code.
