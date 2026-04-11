# Roadmap

<!-- cspell:ignore jkfn lmep dekn folr idbc jstc syg2 yd9w ik3n g6pl g58 n6gr q72l ln6k rg6v uqe s6zz u0k 8u0k 2j9v 0ovo -->

This page is the public status boundary for notable `.beads` work. It records what has shipped, what is active WIP, and what is still exploratory.

Use it to keep three things separate:

- **Shipped now**: documented in the [Language Reference](reference/index.md) and [README](../README.md)
- **Tracked next**: open backlog items with clear product value, but not implemented
- **Exploratory**: credible ideas that may change substantially or never ship

For feature-by-feature proposed syntax and behavior, see [WIP Features](wip/index.md). Future-facing detail belongs there, not in the shipped reference.

If a keyword or command is **not** documented in the [Language Reference](reference/index.md), treat it as **not available today**.

Codex note: in this repo, "Codex support" currently means the supervised headless runner used by `run`, `ci`, `eval`, and validation/preflight. The local Codex hook scaffold exists, but it remains experimental and is not public evidence of full Claude-parity lifecycle support.

## Shipped vs tracked

The runtime already ships:

- persistent state and context re-injection
- `prompt`, `run`, `let` / `var`
- `if`, `while`, `until`, `retry`, `foreach`, `break`, `continue`
- `spawn` / `await`
- `done when:` gates and built-in predicates
- `approve "message"` and `approve "message" timeout N` — hard human approval checkpoint
- `let x = prompt "..." as json { schema }` — structured JSON capture
- `import "file.flow"` and `import "file.flow" as ns` — flow composition
- export/use prompt library system — namespaced reusable flows, prompts, and gates
- `spawn "name" if condition` — conditional spawn
- `spawn "name" model "model-id"` — per-spawn model selection
- `grounded-by "cmd"` on `while`, `until`, `if` — deterministic exit-code condition
- `review max N` block with optional `criteria:` and `grounded-by` — critique loop
- `race` block — competitive parallel execution, first success wins
- `foreach-spawn item in list max N` — parallel fan-out
- `remember "text"` and `remember key="k" value="v"` — persistent memory
- `memory:` section — prefetch keys from memory store
- `send "target" "msg"` / `receive varName` — inter-agent messaging
- public SDK from the root package and `./sdk` subpath — stable programmatic API for integrations
- VS Code extension (basic syntax highlighting in `vscode-extension/`)
- GitHub Actions integration (`action/action.yml` — `45ck/prompt-language-action`)

## WIP: tracked next

These are open `.beads` items that fit the current product direction and are easy for users to understand.

| Feature                                            | Status            | Current workaround                                         | Beads issue            |
| -------------------------------------------------- | ----------------- | ---------------------------------------------------------- | ---------------------- |
| Flow registry and `.flow` run/validate conventions | WIP, tracked next | Store flow files manually and invoke them with `claude -p` | `prompt-language-yd9w` |
| MCP server exposing flow state to other AI clients | WIP, tracked next | Inspect `.prompt-language/session-state.json` directly     | `prompt-language-folr` |

Interpret the MCP row narrowly: the tracked surface is flow state inspection/control, not generic host-extension management.

## WIP: platform and DX roadmap

These are substantial product improvements that are not yet fully shipped.

| Feature                                                                | Status       | Notes                                                                                              | Beads issue               |
| ---------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------- | ------------------------- |
| Context-adaptive rendering program                                     | WIP, planned | Canonical renderer, compact mode, fallback, and eval evidence remain staged follow-up work         | `prompt-language-0ovo`    |
| Headless OpenCode flow runner                                          | WIP, partial | `run/ci --runner opencode` exists for headless prompt turns; default Claude hook loop stays intact | `prompt-language-9uqe.15` |
| Full harness abstraction for spawned sessions and runner resolution    | WIP, planned | Claude `spawn`/`await`, named-agent defaults, and broader runner config are still open             | `prompt-language-9uqe.4`  |
| Language server (LSP) for editor-agnostic autocomplete and diagnostics | WIP, planned | Depends on extension groundwork                                                                    | `prompt-language-idbc`    |
| Web playground for browser-based flow authoring and dry-run simulation | WIP, planned | Good onboarding and docs surface                                                                   | `prompt-language-528q`    |
| Workspace-aware monorepo orchestration                                 | WIP, planned | Would build on `spawn` plus package discovery                                                      | `prompt-language-ik3n`    |

## WIP: exploratory orchestration ideas

These are interesting, but they are a step beyond the current core runtime and should not be described like committed syntax.

- Deferred spawn/session-aware compact rendering heuristics — keep out of open priorities until the core context-adaptive program and recovery-safe fallback track are validated.

## Long-term research direction

For the broader thesis — prompt language as a primary engineering surface — and a concrete research plan with falsifiable experiments, see [Thesis](strategy/thesis.md) and [Thesis Roadmap](strategy/thesis-roadmap.md).

## Documentation rule

To keep the docs honest:

- The [README](../README.md) and [Language Reference](reference/index.md) document **only shipped features**
- This roadmap summarizes **tracked WIP, partial delivery, and exploratory items**
- Detailed future-facing behavior belongs in [WIP Features](wip/index.md), not the shipped reference
- Research docs may discuss ideas, but they are **not product guarantees**

That keeps "what exists" separate from "what might exist next."
