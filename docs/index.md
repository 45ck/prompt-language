# Documentation

prompt-language is a verification-first supervision runtime for existing coding agents. This docs set keeps product docs, evidence, status, and research separate so the shipped surface is easy to find.

## Choose your path

| Path     | Start here                                                      | Use it for                                                           |
| -------- | --------------------------------------------------------------- | -------------------------------------------------------------------- |
| Product  | [guides/](guides/index.md), [reference/](reference/index.md)    | Learn and use the shipped runtime today                              |
| Status   | [roadmap.md](roadmap.md), [wip/](wip/index.md)                  | Check what is tracked next, partial, or still proposed               |
| Evidence | [evaluation/](evaluation/index.md)                              | Review measured results, QA coverage, and current caveats            |
| Research | [strategy/](strategy/index.md), [research/](research/README.md) | Read the thesis, positioning material, and external-source syntheses |

If a feature is not described in the product docs, treat it as unavailable today.

## Folder map

| Folder                             | Purpose                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| [guides/](guides/index.md)         | Tutorials, conceptual walkthroughs, and usage guidance                         |
| [reference/](reference/index.md)   | Shipped language and runtime reference, including CLI and DSL quick refs       |
| [design/](design/index.md)         | Architecture boundaries, canonical design docs, and superseded design history  |
| [examples/](examples/index.md)     | Worked examples and the showcase catalog                                       |
| [evaluation/](evaluation/index.md) | Evidence, parity matrices, QA coverage, and current caveats for product claims |
| [operations/](operations/index.md) | Troubleshooting and smoke/validation runbooks                                  |
| [strategy/](strategy/index.md)     | Product positioning and long-range thesis material, not shipped guarantees     |
| [research/](research/README.md)    | External research syntheses and source archive that inform direction           |
| [wip/](wip/index.md)               | Proposed and imported future work that is not shipped today                    |
| [roadmap.md](roadmap.md)           | Public shipped-vs-WIP boundary backed by `.beads`                              |

## Start here for shipped usage

| Doc                                          | What you'll get                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| [Getting Started](guides/getting-started.md) | Install the runtime, run your first gate, and see the supervision loop work end to end |
| [Language Guide](guides/language-guide.md)   | A high-level walkthrough of the runtime model and the shipped language surface         |
| [How It Works](guides/guide.md)              | Hook lifecycle, variable state, gate trust model, and runtime mechanics                |

## Product entry points

| Area              | Entry point                                | Contents                                                              |
| ----------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| Shipped reference | [reference/index.md](reference/index.md)   | Keyword-by-keyword language reference plus CLI and DSL summaries      |
| Examples          | [examples/index.md](examples/index.md)     | Worked flows for gates, loops, parallelism, memory, and composition   |
| Operations        | [operations/index.md](operations/index.md) | Recovery paths, smoke testing, and support expectations               |
| Design            | [design/index.md](design/index.md)         | Architecture boundaries, design decisions, and canonical design notes |

## Status and proposal entry points

| Area            | Entry point                  | Contents                                                          |
| --------------- | ---------------------------- | ----------------------------------------------------------------- |
| Status tracking | [roadmap.md](roadmap.md)     | Public summary of shipped, tracked, partial, and exploratory work |
| Future work     | [wip/index.md](wip/index.md) | Proposed features and imported planning packs                     |

## Evidence and research entry points

| Area       | Entry point                                | Contents                                                             |
| ---------- | ------------------------------------------ | -------------------------------------------------------------------- |
| Evaluation | [evaluation/index.md](evaluation/index.md) | Comparative results, parity matrix, and QA analysis                  |
| Strategy   | [strategy/index.md](strategy/index.md)     | Positioning, thesis, and experiment roadmap                          |
| Research   | [research/README.md](research/README.md)   | External research reports and archived sources that inform direction |

## Research and design anchors

| Doc                                                                                | Contents                                                                  |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [Research Index](research/README.md)                                               | Research reports with abstracts and source list                           |
| [Architecture Position](research/00-architecture-position.md)                      | How prompt-language differs from LangChain, DSPy, and CrewAI              |
| [Feature Completeness](research/08-feature-completeness.md)                        | Assessment of what the current shipped primitives already cover           |
| [What Works Now](evaluation/what-works-now.md)                                     | Short public summary of the strongest proven surface and current caveats  |
| [Multi-Agent Orchestration Boundary](design/multi-agent-orchestration.md)          | Accepted subagent-first boundary                                          |
| [Operator Shell Boundary](design/operator-shell-boundary.md)                       | Accepted shell-over-runtime boundary for imported OMX adaptation work     |
| [Output Summarization Policy](design/output-summarization-policy.md)               | Accepted thresholds and fail-closed policy for compact summary surfaces   |
| [Evaluation Stack V1 Boundary](design/evaluation-stack-v1.md)                      | Accepted first implementation slice for rubrics, judges, and eval tooling |
| [ADR-00XX: Context-Adaptive Rendering](adr/ADR-00XX-context-adaptive-rendering.md) | Proposed render-mode decision under evaluation                            |
