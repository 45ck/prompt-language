# WIP Memory And Knowledge

This folder holds the memory, knowledge, retrieval, and checkpoint planning cluster. These docs are related and should be browsed together rather than as separate top-level WIP pages.

## Boundary decision

The current planning boundary is explicit:

- **Execution/session state** owns checkpoints, restore, handoff summaries, resume state, and compaction summaries.
- **Durable memory** owns curated reusable facts, procedures, and lessons that survive beyond one run.
- **Markdown knowledge** remains the human-authored guidance layer.
- **Retrieval** decides how the runtime finds relevant memory or Markdown sources.

The practical rule is simple: checkpointing and compaction may read from or promote into memory, but they are not just "more memory writes."

## Core memos

| Page                                                                                       | Focus                                                                                |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| [Memory, Knowledge, Markdown, and Evaluation Positioning](memory-knowledge-positioning.md) | Layering execution state, durable memory, Markdown knowledge, retrieval, and evals   |
| [Scrutiny and Risks](memory-scrutiny-and-risks.md)                                         | Tightens the proposal around trust, checkpoints, handoffs, compaction, and DSL creep |
| [Markdown, Agent Memory, and Prompt Language](markdown-agent-memory.md)                    | Markdown interop model and the split between deterministic and grounding retrieval   |
| [Memory Roadmap](memory-roadmap.md)                                                        | Phased order plus backlog mapping for memory vs runtime recovery work                |
| [Memory Source Notes](memory-source-notes.md)                                              | Repo-grounded and external source notes behind the memory/Markdown direction         |

## Companion pack

| Page                                            | Focus                                                                        |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| [Knowledge Plan Pack](knowledge-plan/README.md) | Condensed companion pack for knowledge, retrieval, and phased adoption order |
