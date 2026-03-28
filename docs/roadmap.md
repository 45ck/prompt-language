# Roadmap

<!-- cspell:ignore jkfn lmep dekn folr idbc jstc -->

This page tracks notable features in `.beads` that are **not shipped yet**.

Use it to keep three things separate:

- **Shipped now**: documented in the [Language Reference](reference/index.md) and [README](../README.md)
- **Tracked next**: open backlog items with clear product value, but not implemented
- **Exploratory**: credible ideas that may change substantially or never ship

If a keyword or command is **not** documented in the [Language Reference](reference/index.md), treat it as **not available today**.

## Shipped vs tracked

The runtime already ships:

- persistent state and context re-injection
- `prompt`, `run`, `let` / `var`
- `if`, `while`, `until`, `retry`, `foreach`, `break`, `continue`
- `spawn` / `await`
- `done when:` gates and built-in predicates

Everything below is roadmap, not syntax you can use right now.

## Tracked next

These are open `.beads` items that fit the current product direction and are easy for users to understand.

| Feature                                                                     | Status               | Current workaround                                                    | Beads issue            |
| --------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------- | ---------------------- |
| Approval checkpoint node such as `approve "message"`                        | Tracked, not shipped | Use `let approval = prompt "..."` as a manual checkpoint              | `prompt-language-ln6k` |
| Structured output capture such as `let x = prompt "..." as json { schema }` | Tracked, not shipped | Capture plain text and parse it with shell tools or follow-up prompts | `prompt-language-rg6v` |
| Flow composition via `import`                                               | Tracked, not shipped | Reuse snippets by copy-paste or Claude Code skills                    | `prompt-language-jkfn` |
| Conditional spawn such as `spawn "name" if condition`                       | Tracked, not shipped | Wrap `spawn` in an outer `if` block                                   | `prompt-language-lmep` |
| Per-spawn model selection such as `spawn "name" model "haiku"`              | Tracked, not shipped | All spawns inherit the current Claude configuration                   | `prompt-language-2j9v` |
| Deterministic `ask` verdict from `grounded-by` exit code                    | Tracked, not shipped | `ask` still relies on Claude judgment today                           | `prompt-language-dekn` |
| Programmatic Node.js API / public SDK                                       | Tracked, not shipped | Use the CLI and hook runtime directly                                 | `prompt-language-syg2` |
| Flow registry and `.flow` run/validate conventions                          | Tracked, not shipped | Store flow files manually and invoke them with `claude -p`            | `prompt-language-yd9w` |
| Review / critique block such as `review max N`                              | Tracked, not shipped | Write the critique loop explicitly with `prompt` plus `if` or `retry` | `prompt-language-s6zz` |
| MCP server exposing flow state to other AI clients                          | Tracked, not shipped | Inspect `.prompt-language/session-state.json` directly                | `prompt-language-folr` |

## Platform and DX roadmap

These are substantial product improvements, but they are not part of the shipped runtime surface today.

| Feature                                                                | Status  | Notes                                         | Beads issue            |
| ---------------------------------------------------------------------- | ------- | --------------------------------------------- | ---------------------- |
| VS Code extension for syntax highlighting and inline lint              | Planned | Editor-specific first step                    | `prompt-language-8u0k` |
| Language server (LSP) for editor-agnostic autocomplete and diagnostics | Planned | Depends on extension groundwork               | `prompt-language-idbc` |
| Web playground for browser-based flow authoring and dry-run simulation | Planned | Good onboarding and docs surface              | `prompt-language-528q` |
| Workspace-aware monorepo orchestration                                 | Planned | Would build on `spawn` plus package discovery | `prompt-language-ik3n` |
| GitHub Action for running prompt-language in CI                        | Planned | Integration surface, not core language        | `prompt-language-jstc` |

## Exploratory orchestration ideas

These are interesting, but they are a step beyond the current core runtime and should not be described like committed syntax.

| Feature                                                     | Status      | Notes                                                              | Beads issue            |
| ----------------------------------------------------------- | ----------- | ------------------------------------------------------------------ | ---------------------- |
| `race` block for speculative execution                      | Exploratory | Parallel competitive strategies, first success wins                | `prompt-language-g6pl` |
| Persistent cross-flow memory such as `remember` / `memory:` | Exploratory | Bigger change to state model and product positioning               | `prompt-language-7g58` |
| Parent/child messaging between spawned flows                | Exploratory | More like a distributed workflow engine                            | `prompt-language-n6gr` |
| Fan-out / reduce constructs such as `foreach-spawn`         | Exploratory | Higher-level parallel orchestration over current `spawn` / `await` | `prompt-language-q72l` |

## Documentation rule

To keep the docs honest:

- The [Language Reference](reference/index.md) documents **only shipped features**
- This roadmap documents **tracked but unavailable features**
- Research docs may discuss ideas, but they are **not product guarantees**

That keeps “what exists” separate from “what might exist next.”
