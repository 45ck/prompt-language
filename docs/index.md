# Documentation

## Start here

| Guide                                 | What you'll learn                                                 |
| ------------------------------------- | ----------------------------------------------------------------- |
| [Getting Started](getting-started.md) | Install, run your first gate, see it work in 2 minutes            |
| [Language Guide](language-guide.md)   | All 12 primitives, patterns, when to use (and not use) the plugin |

## Reference

| Doc                                         | Contents                                                   |
| ------------------------------------------- | ---------------------------------------------------------- |
| [DSL Reference](dsl-reference.md)           | Full syntax, defaults, built-in variables, gate predicates |
| [CLI Reference](cli-reference.md)           | All CLI commands: install, status, init, demo, watch       |
| [Hooks Architecture](hooks-architecture.md) | Three-hook enforcement loop, state file schema             |

## Guides

| Doc                                       | Contents                                                        |
| ----------------------------------------- | --------------------------------------------------------------- |
| [How It Works](guide.md)                  | Internals: hook lifecycle, variable lifecycle, gate trust model |
| [Use Cases](use-cases.md)                 | When the plugin wins, when it doesn't, quick recipes            |
| [Non-Node Projects](non-node-projects.md) | Python, Go, Rust, and custom test runners                       |
| [Troubleshooting](troubleshooting.md)     | Stuck flows, failed gates, state file inspection                |

## Examples

| Example                                  | Pattern                                    |
| ---------------------------------------- | ------------------------------------------ |
| [Fix Tests](examples/fix-tests.md)       | Retry loop with test gate                  |
| [Lint and Fix](examples/lint-and-fix.md) | Compound gates (tests + lint)              |
| [Showcase](showcase.md)                  | 140+ worked examples across all primitives |

## Evaluation

| Doc                               | Contents                                           |
| --------------------------------- | -------------------------------------------------- |
| [Eval Analysis](eval-analysis.md) | 45-hypothesis A/B comparison, methodology, results |

## Research

| Doc                                                                   | Contents                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------ |
| [Research Index](research/README.md)                                  | Index of all research reports with abstracts and source list |
| [Architecture Position](research/00-architecture-position.md)         | How prompt-language differs from LangChain, DSPy, CrewAI     |
| [Enhancement Opportunities](research/07-enhancement-opportunities.md) | Wishlist with evidence tiers, proposed syntax, priorities    |
