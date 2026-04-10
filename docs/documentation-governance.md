# Documentation Governance

This repo separates shipped behavior, tracked work, and exploratory material on purpose. Readers should be able to tell what exists today without having to infer it from design notes, research packs, or proposal docs.

## Interpretation guide

| Question                                  | Canonical location                       | How to interpret it                                                |
| ----------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| What can I use today?                     | [Language Reference](reference/index.md) | Shipped runtime behavior only                                      |
| How do I learn the shipped surface?       | [Guides](guides/index.md)                | Tutorials and conceptual walkthroughs for shipped behavior         |
| What examples are ready to copy or adapt? | [Examples](examples/index.md)            | Worked flows built around the current runtime surface              |
| What is tracked next?                     | [Roadmap](roadmap.md)                    | Product status backed by `.beads`                                  |
| What is still under design?               | [WIP Features](wip/index.md)             | Proposals, imported packs, and design history; not available today |
| Why is the product headed this way?       | [Strategy](strategy/index.md)            | Positioning, thesis, and long-range direction                      |
| What evidence informed that direction?    | [Research Reports](research/README.md)   | External-source syntheses and source archive                       |

## Boundary rules

- The [Language Reference](reference/index.md) is the contract for shipped syntax, semantics, defaults, and CLI behavior. If a feature is not documented there, treat it as not shipped.
- [Guides](guides/index.md) teach shipped workflows. They can link to the roadmap or WIP for context, but they should not present unshipped behavior as available now.
- [Roadmap](roadmap.md) is the status view. Use it for shipped-versus-tracked-versus-exploratory state, not as the exact language specification.
- [WIP Features](wip/index.md) is for proposals, imported plan packs, and design history. Content there is exploratory unless and until it is promoted into the shipped docs set.
- [Strategy](strategy/index.md) explains the product thesis, framing, and long-term bets. It is directional, not a delivery guarantee.
- [Research Reports](research/README.md) capture evidence and synthesis. They inform decisions but do not by themselves make a feature planned or shipped.

## Promotion rule

When a feature becomes real, document the user-facing behavior in the [Language Reference](reference/index.md) first, then update guides and examples. Keep superseded rationale in WIP or design-history pages instead of treating old proposal docs as the current contract.
