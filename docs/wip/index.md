# WIP Features

These pages describe **proposed** prompt-language features that are **not implemented yet**.

Use this section to showcase where the language is heading without confusing it with the shipped runtime.

- If a feature is in the [Language Reference](../reference/index.md), it is shipped
- If a feature is only in this section, it is **WIP** and **not available today**
- For backlog status and prioritization, see the [Roadmap](../roadmap.md)

## Proposed language features

| Page                                        | Focus                                   |
| ------------------------------------------- | --------------------------------------- |
| [approve](approve.md)                       | Hard human approval checkpoints         |
| [Structured Capture](structured-capture.md) | `let x = prompt ... as json { schema }` |
| [import](import.md)                         | Reusable sub-flow composition           |
| [Prompt Libraries](prompt-libraries.md)     | Exported reusable flows, gates, prompts |
| [Conditional Spawn](conditional-spawn.md)   | `spawn "name" if condition`             |
| [Spawn Model Selection](spawn-model.md)     | `spawn "name" model "haiku"`            |
| [Deterministic ask](deterministic-ask.md)   | `grounded-by` decides `ask` directly    |
| [review](review.md)                         | Generator-evaluator critique loops      |
| [race](race.md)                             | Speculative parallel execution          |

## Proposed runtime and integration features

| Page                                    | Focus                                        |
| --------------------------------------- | -------------------------------------------- |
| [Node.js SDK](sdk.md)                   | Public programmatic API                      |
| [Flow Registry](flow-registry.md)       | `.flow` files plus run and validate commands |
| [MCP Server](mcp.md)                    | Expose flow state to MCP clients             |
| [Workspace Orchestration](workspace.md) | Monorepo-aware flow execution                |
| [GitHub Action](github-action.md)       | CI wrapper for prompt-language               |

## Proposed tooling features

| Page                                     | Focus                                               |
| ---------------------------------------- | --------------------------------------------------- |
| [VS Code Extension](vscode-extension.md) | Syntax highlighting and inline lint                 |
| [Language Server](lsp.md)                | Editor-agnostic autocomplete and diagnostics        |
| [Web Playground](playground.md)          | Browser-based flow authoring and dry-run simulation |
