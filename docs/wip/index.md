<!-- cspell:ignore vnext -->

# WIP Features

> **This section is for future-facing work, imported planning packs, and design history.** It is not the source of truth for shipped behavior. The [Language Reference](../reference/index.md), [README](../../README.md), and [Roadmap](../roadmap.md) define what exists today and what is merely tracked next.

- If a feature is in the [Language Reference](../reference/index.md), it is shipped
- If a page in this section describes something that has since shipped, treat it as design history unless it is explicitly called out as an active proposal extension
- For backlog status and prioritization, see the [Roadmap](../roadmap.md)

## How WIP is organized

### Active proposals

These folders should be read as candidate future work, not as available product surface:

| Folder                            | Purpose                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| [runtime/](runtime/index.md)      | Unshipped runtime and integration proposals, plus a small amount of shipped context           |
| [tooling/](tooling/index.md)      | Tooling proposals, imported tooling packs, and shipped tooling context that is marked as such |
| [memory/](memory/index.md)        | Memory, knowledge, retrieval, and checkpoint planning docs                                    |
| [artifacts/](artifacts/README.md) | Artifact packages, review surfaces, and manifest/runtime proposal docs                        |

### Imported packs

These folders are imported design or planning packs. They may inform the roadmap, but they are not commitments:

| Folder                       | Purpose                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------- |
| [reviews/](reviews/index.md) | Imported review and plan packs used for backlog shaping and follow-up positioning |
| [swarm/](swarm/README.md)    | Imported swarm design pack with its own phased proposal set                       |
| [vnext/](vnext/README.md)    | Imported vNext architecture/spec pack with ADRs, specs, and delivery planning     |

### Design history

These pages are retained for rationale, migration notes, and historical context. The shipped behavior lives elsewhere:

- [History Index](history/index.md)
- [remember](../reference/remember.md) — persistent memory store and `memory:` prefetch
- [foreach-spawn](../reference/foreach-spawn.md) — parallel fan-out per list item
- [send / receive](../reference/send-receive.md) — inter-agent messaging between children and parent

## Active proposal sets

| Area                          | Entry point                                | Focus                                                           |
| ----------------------------- | ------------------------------------------ | --------------------------------------------------------------- |
| Runtime and integrations      | [runtime/index.md](runtime/index.md)       | Registry, MCP, workspace orchestration, and routing proposals   |
| Tooling and host integrations | [tooling/index.md](tooling/index.md)       | Evals, editor tooling, imported packs, and playground work      |
| Memory and knowledge planning | [memory/index.md](memory/index.md)         | Memory semantics, Markdown knowledge, retrieval, checkpoints    |
| Artifact protocol planning    | [artifacts/README.md](artifacts/README.md) | Artifact boundaries, taxonomy, and deferred lifecycle decisions |

## Imported packs

| Pack              | Entry point                        | Focus                                                                    |
| ----------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| Swarm design pack | [swarm/README.md](swarm/README.md) | Manager-owned swarm macros that lower to existing spawn/await primitives |
| vNext pack        | [vnext/README.md](vnext/README.md) | Imported architecture/spec package with ADRs, specs, and rollout plans   |
