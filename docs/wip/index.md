# WIP Features

> **Most features listed here have shipped.** The [Language Reference](../reference/index.md) is the authoritative source for what is available today. Pages below are kept for design context and history.

- If a feature is in the [Language Reference](../reference/index.md), it is shipped
- If a feature is only in this section, it is **WIP** and **not available today**
- For backlog status and prioritization, see the [Roadmap](../roadmap.md)

## Language features (shipped — see Language Reference)

The following features are implemented and documented in the reference:

- [approve](approve.md) — hard human approval checkpoints
- [Structured Capture](structured-capture.md) — `let x = prompt ... as json { schema }`
- [import](import.md) — reusable sub-flow composition
- [Prompt Libraries](prompt-libraries.md) — exported reusable flows, gates, prompts
- [Conditional Spawn](conditional-spawn.md) — `spawn "name" if condition`
- [Spawn Model Selection](spawn-model.md) — `spawn "name" model "haiku"`
- [Deterministic ask](deterministic-ask.md) — `grounded-by` decides condition directly
- [review](review.md) — generator-evaluator critique loops
- [race](race.md) — speculative parallel execution
- [remember](../reference/remember.md) — persistent memory store and `memory:` prefetch
- [foreach-spawn](../reference/foreach-spawn.md) — parallel fan-out per list item
- [send / receive](../reference/send-receive.md) — inter-agent messaging between children and parent

## Proposed runtime and integration features

| Page                                    | Focus                                        |
| --------------------------------------- | -------------------------------------------- |
| [Node.js SDK](sdk.md)                   | Public programmatic API                      |
| [Flow Registry](flow-registry.md)       | `.flow` files plus run and validate commands |
| [MCP Server](mcp.md)                    | Expose flow state to MCP clients             |
| [Workspace Orchestration](workspace.md) | Monorepo-aware flow execution                |

## Proposed tooling features

| Page                                     | Focus                                               | Status                                      |
| ---------------------------------------- | --------------------------------------------------- | ------------------------------------------- |
| [VS Code Extension](vscode-extension.md) | Syntax highlighting and inline lint                 | Basic package shipped (`vscode-extension/`) |
| [Language Server](lsp.md)                | Editor-agnostic autocomplete and diagnostics        | Planned                                     |
| [Web Playground](playground.md)          | Browser-based flow authoring and dry-run simulation | Planned                                     |
