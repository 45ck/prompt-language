# Documentation

prompt-language is a programmable runtime for Claude Code. It wraps Claude in a terminal-side state machine so you can define state, context, control flow, parallel work, and completion checks around the agent instead of supervising every step manually.

## Start here

| Guide                                 | What you'll learn                                                                   |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| [Getting Started](getting-started.md) | Install the runtime, run your first gate, see Claude stay blocked until checks pass |
| [Language Guide](language-guide.md)   | The runtime model, all 13 primitives, and when to use each capability               |

## Reference

| Doc                                         | Contents                                                            |
| ------------------------------------------- | ------------------------------------------------------------------- |
| [Language Reference](reference/index.md)    | Concept- and keyword-based reference pages for the full language    |
| [DSL Reference](dsl-reference.md)           | One-page full syntax, defaults, built-in variables, gate predicates |
| [CLI Reference](cli-reference.md)           | All CLI commands: install, status, init, demo, watch                |
| [Hooks Architecture](hooks-architecture.md) | Three-hook enforcement loop, state file schema                      |

## Guides

| Doc                                       | Contents                                                        |
| ----------------------------------------- | --------------------------------------------------------------- |
| [How It Works](guide.md)                  | Internals: hook lifecycle, variable lifecycle, gate trust model |
| [Use Cases](use-cases.md)                 | When the plugin wins, when it doesn't, quick recipes            |
| [Non-Node Projects](non-node-projects.md) | Python, Go, Rust, and custom test runners                       |
| [Roadmap](roadmap.md)                     | Tracked but not yet shipped features from `.beads`              |
| [WIP Features](wip/index.md)              | Proposed feature pages for the future language and tooling      |
| [Troubleshooting](troubleshooting.md)     | Stuck flows, failed gates, state file inspection                |

## Examples

| Example                                                | Pattern                                     |
| ------------------------------------------------------ | ------------------------------------------- |
| [Fix Tests](examples/fix-tests.md)                     | Retry loop with test gate                   |
| [Lint and Fix](examples/lint-and-fix.md)               | Compound gates (tests + lint)               |
| [Self-Reflection](examples/self-reflection.md)         | Analyze failure before retrying             |
| [Retry with Backoff](examples/retry-with-backoff.md)   | Exponential delay between retry attempts    |
| [Approval Checkpoint](examples/approval-checkpoint.md) | Human review gate before destructive action |
| [Parallel Tasks](examples/parallel-tasks.md)           | Spawn/await for concurrent work streams     |
| [Variable Pipeline](examples/variable-pipeline.md)     | Shell pipes for transforms and filtering    |
| [Memory and Context](examples/memory-and-context.md)   | Load persistent files into flow variables   |
| [Showcase](showcase.md)                                | 140+ worked examples across all primitives  |

## Evaluation

| Doc                               | Contents                                           |
| --------------------------------- | -------------------------------------------------- |
| [Eval Analysis](eval-analysis.md) | 45-hypothesis A/B comparison, methodology, results |

## Research

| Doc                                                                   | Contents                                                                   |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [Research Index](research/README.md)                                  | Index of all research reports with abstracts and source list               |
| [Architecture Position](research/00-architecture-position.md)         | How prompt-language differs from LangChain, DSPy, CrewAI                   |
| [Enhancement Opportunities](research/07-enhancement-opportunities.md) | Wishlist with evidence tiers, proposed syntax, priorities                  |
| [Feature Completeness](research/08-feature-completeness.md)           | Assessment: 10/15 enhancements already achievable with existing primitives |
