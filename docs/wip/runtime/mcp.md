# MCP Server (WIP)

> **WIP: not implemented yet.** This page describes intended behavior, not a released package.

## Goal

Expose prompt-language flow state to any MCP-capable AI client.

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
