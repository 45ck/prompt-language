# Prompt Language Plan Bundle

This bundle packages the current plan discussed for Prompt Language around:

- memory and wisdom
- Markdown knowledge
- retrieval and section addressing
- checkpoints and replay
- trust boundaries and write policy
- evaluation positioning
- DSL examples
- fit with Prompt Language's thesis

The intent is to keep Prompt Language aligned with its core identity:
an executable, stateful, verifiable engineering medium for bounded software systems.

WIP note: this is an imported companion planning pack, not shipped syntax or a separate roadmap fork.
Its backlog impact is folded into the existing memory and vNext alignment beads rather than a new standalone program.

Boundary note: checkpoints, restore, handoff summaries, and compaction are governed by the main memory boundary docs plus the runtime/vNext checkpoint and replay specs. This pack can inform those decisions, but it does not define a second checkpoint model.

Folder note: this pack lives under `docs/wip/memory/` because it is supporting material for the main memory and knowledge direction, not a separate top-level initiative.

Current interpretation:

- durable memory stores validated reusable lessons and facts
- checkpoints and restore operate on execution/session state
- handoff summaries are restart/review artifacts unless explicitly promoted
- compaction manages active context pressure, not long-term memory quality

Backlog mapping stays with existing issues:

- `prompt-language-b8kq` for memory/knowledge positioning
- `prompt-language-zhog.1` for trust and checkpoint semantics
- `prompt-language-zhog.3` for event log, replay, and snapshots
- `prompt-language-0ovo.5` for recovery-safe compaction fallback

Files:

- docs/01-plan-overview.md
- docs/02-design-fit.md
- docs/03-dsl-examples.md
- docs/04-design-axes.md
- docs/05-adoption-order.md
