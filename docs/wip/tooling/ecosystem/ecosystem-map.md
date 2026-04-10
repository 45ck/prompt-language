# Ecosystem Map

## Category map

### Same-layer or very-nearby references

These are the most relevant comparison points for prompt-language design work.

- **Archon**: workflow and orchestration shell for AI coding
- **Druids**: event-driven distributed coding-agent runtime
- **Hankweave Runtime**: long-horizon headless runtime for reliable agent execution
- **GitHub Agentic Workflows**: Markdown-authored agent workflows compiled into GitHub Actions
- **Streetrace**: structured runtime and DSL for multi-agent systems
- **Agent Loom**: durable packet and artifact protocol for AI work
- **Doctrine**: structured source language and compiler for agent doctrine
- **Context Cascade**: selective-load hierarchy for Claude Code context

### Adjacent but farther away

These are useful conceptual references, but they are not strong candidates for direct import.

- **IBM PDL**: declarative prompt programming language
- **AgentScope Runtime**: deployment and service runtime for production agent apps

## Layer model

### Layer A: authoring source and compiler

Projects here make agent instructions programmable above the runtime.

- Doctrine
- IBM PDL

### Layer B: supervision runtime around an existing agent

This is prompt-language's strongest current layer.

- prompt-language
- Hankweave Runtime

### Layer C: workflow shell and orchestration

These package multi-step flows, routing, execution surfaces, and sometimes UI.

- Archon
- GitHub Agentic Workflows
- Druids
- Streetrace

### Layer D: durable context protocol and repository operating system

These emphasize visible handoff artifacts and filesystem-oriented truth.

- Agent Loom
- Context Cascade

### Layer E: production deployment substrate

These solve serving, sandboxes, APIs, and deployment.

- AgentScope Runtime

## Main takeaway

prompt-language should import selectively from layers A, C, D, and E, but it should not blur itself into all of them at once.

The high-value path is:

- stay verification-first
- add better session boundaries
- make artifact handoff explicit
- improve runtime observability and recoverability
- document the ecosystem so future work does not accidentally duplicate a neighbor blindly
