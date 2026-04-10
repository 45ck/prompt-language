# Documentation

prompt-language is a control-flow runtime for Claude Code. The docs are organized by purpose so you can tell, from the directory structure alone, whether a page is a tutorial, shipped reference, design rationale, operational runbook, evaluation artifact, or future-facing proposal.

## Folder map

| Folder                             | Purpose                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| [guides/](guides/index.md)         | Tutorials, conceptual walkthroughs, and usage guidance                        |
| [reference/](reference/index.md)   | Shipped language and runtime reference, including CLI and DSL quick refs      |
| [design/](design/index.md)         | Architecture boundaries, canonical design docs, and superseded design history |
| [examples/](examples/index.md)     | Worked examples and the showcase catalog                                      |
| [evaluation/](evaluation/index.md) | Evidence, parity matrices, hypothesis sets, and QA gap analysis               |
| [operations/](operations/index.md) | Troubleshooting and smoke/validation runbooks                                 |
| [strategy/](strategy/index.md)     | Positioning, thesis, and long-term research direction                         |
| [research/](research/README.md)    | External research syntheses and source archive                                |
| [wip/](wip/index.md)               | Proposed and imported future work that is not shipped today                   |
| [roadmap.md](roadmap.md)           | Shipped-vs-tracked product roadmap backed by `.beads`                         |

## Start here

| Doc                                          | What you'll get                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| [Getting Started](guides/getting-started.md) | Install the runtime, run your first gate, and see the supervision loop work end to end |
| [Language Guide](guides/language-guide.md)   | A high-level walkthrough of the runtime model and the shipped language surface         |
| [How It Works](guides/guide.md)              | Hook lifecycle, variable state, gate trust model, and runtime mechanics                |

## Core entry points

| Area              | Entry point                                | Contents                                                              |
| ----------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| Shipped reference | [reference/index.md](reference/index.md)   | Keyword-by-keyword language reference plus CLI and DSL summaries      |
| Examples          | [examples/index.md](examples/index.md)     | Worked flows for gates, loops, parallelism, memory, and composition   |
| Operations        | [operations/index.md](operations/index.md) | Recovery paths, smoke testing, and support expectations               |
| Evaluation        | [evaluation/index.md](evaluation/index.md) | Comparative results, parity matrix, and QA analysis                   |
| Design            | [design/index.md](design/index.md)         | Architecture boundaries, design decisions, and canonical design notes |
| Strategy          | [strategy/index.md](strategy/index.md)     | Positioning, thesis, and experiment roadmap                           |
| Future work       | [wip/index.md](wip/index.md)               | Proposed features and imported planning packs                         |

## Research and design anchors

| Doc                                                                                | Contents                                                                  |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [Research Index](research/README.md)                                               | Research reports with abstracts and source list                           |
| [Architecture Position](research/00-architecture-position.md)                      | How prompt-language differs from LangChain, DSPy, and CrewAI              |
| [Feature Completeness](research/08-feature-completeness.md)                        | Assessment of what the current shipped primitives already cover           |
| [What Works Now](evaluation/what-works-now.md)                                     | Short public summary of the strongest proven surface and current caveats  |
| [Multi-Agent Orchestration Boundary](design/multi-agent-orchestration.md)          | Accepted subagent-first boundary                                          |
| [Evaluation Stack V1 Boundary](design/evaluation-stack-v1.md)                      | Accepted first implementation slice for rubrics, judges, and eval tooling |
| [ADR-00XX: Context-Adaptive Rendering](adr/ADR-00XX-context-adaptive-rendering.md) | Proposed render-mode decision under evaluation                            |
