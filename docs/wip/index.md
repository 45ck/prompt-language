<!-- cspell:ignore vnext -->

# WIP Features

> **Most features listed here have shipped.** The [Language Reference](../reference/index.md) is the authoritative source for what is available today. The WIP area is now grouped by folder so design history, active proposals, and imported planning packs are easier to browse.

- If a feature is in the [Language Reference](../reference/index.md), it is shipped
- If a feature is only in this section, it is **WIP** and **not available today**
- For backlog status and prioritization, see the [Roadmap](../roadmap.md)

## Folder map

| Folder                       | Purpose                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| [history/](history/index.md) | Design-history pages for features that already shipped and now live in the Language Reference |
| [runtime/](runtime/index.md) | Active runtime and integration proposals that are not shipped yet                             |
| [tooling/](tooling/index.md) | Active tooling and ecosystem proposals such as evals, editor support, and playground work     |
| [memory/](memory/index.md)   | Memory, knowledge, retrieval, and checkpoint planning docs                                    |
| [swarm/](swarm/README.md)    | Imported swarm design pack with its own phased proposal set                                   |
| [vNext/](vnext/README.md)    | Imported vNext architecture/spec pack                                                         |

## Shipped design history

These pages are still useful for rationale and timing, but the shipped behavior lives in the reference:

- [History Index](history/index.md)
- [remember](../reference/remember.md) — persistent memory store and `memory:` prefetch
- [foreach-spawn](../reference/foreach-spawn.md) — parallel fan-out per list item
- [send / receive](../reference/send-receive.md) — inter-agent messaging between children and parent

## Active proposal sets

| Area                          | Entry point                          | Focus                                                        |
| ----------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| Runtime and integrations      | [runtime/index.md](runtime/index.md) | SDK, registry, MCP, workspace orchestration, routing         |
| Tooling and host integrations | [tooling/index.md](tooling/index.md) | Evals, editor tooling, GitHub Action, playground             |
| Memory and knowledge planning | [memory/index.md](memory/index.md)   | Memory semantics, Markdown knowledge, retrieval, checkpoints |

## Imported packs

| Pack              | Entry point                        | Focus                                                                    |
| ----------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| Swarm design pack | [swarm/README.md](swarm/README.md) | Manager-owned swarm macros that lower to existing spawn/await primitives |
| vNext pack        | [vnext/README.md](vnext/README.md) | Imported architecture/spec package with ADRs, specs, and rollout plans   |
