# Design: Memory Governance Alignment

## Status

Accepted alignment note for the vNext memory-governance follow-up.

Relevant bead:

- `prompt-language-zhog.6` - align memory governance and wisdom promotion with the existing memory roadmap

Primary anchors:

- [Spec 012 - Memory governance and wisdom promotion](../wip/vnext/specs/012-memory-governance-and-wisdom-promotion.md)
- [Recommended Implementation Roadmap](../wip/memory/memory-roadmap.md)
- [Prompt Language Plan Overview](../wip/memory/knowledge-plan/01-plan-overview.md)
- [Design Axes To Evaluate](../wip/memory/knowledge-plan/04-design-axes.md)
- [Recommended Adoption Order](../wip/memory/knowledge-plan/05-adoption-order.md)

Related existing backlog:

- `prompt-language-b8kq` - disciplined memory + Markdown interop roadmap
- `prompt-language-b8kq.1` - scoped memory semantics: strict reads, invalidation, transactional writes
- `prompt-language-b8kq.2` - Markdown knowledge interop: knowledge sources and deterministic section lookup
- `prompt-language-b8kq.3` - checkpoint, handoff, and compaction boundary for memory
- `prompt-language-b8kq.4` - retrieval boundary and trust model for Markdown-backed knowledge
- `prompt-language-zhog.3` - replayability/event-log substrate
- `prompt-language-zhog.5` - eval and judge backlog alignment

This note maps the imported governance direction onto the existing roadmap. It does not create a second memory program, and it does not redefine Markdown interop or retrieval as governance work.

## Decision

Spec 012 fits the current roadmap as a **governance refinement inside `prompt-language-b8kq`**, not as a new parallel epic.

The imported direction adds four useful governance requirements:

- durable memory needs explicit classes such as `facts`, `policy`, `wisdom`, and `scratch`
- durable items need metadata such as provenance, confidence, and TTL
- promotion from transient learning to durable wisdom must be explicit and reviewable
- high-impact wisdom should link to replay, eval, or regression evidence

Those requirements are directionally consistent with the checked-in memory roadmap. The roadmap already says durable memory must be structured, scoped, inspectable, able to be invalidated, and promoted explicitly rather than confused with checkpoints, compaction, or handoff state.

## Governance boundary

The imported spec is strongest when read as a governance layer over durable memory, not as a new storage model.

### Governance owns

- what kind of durable memory an entry is
- who may write or promote it
- how long it remains trustworthy
- what provenance and confidence metadata it carries
- what evidence is required before a lesson is treated as reusable wisdom

### Governance does not own

- Markdown source declaration and section lookup
- retrieval mode selection or ranking behavior
- checkpoint, restore, handoff, or compaction semantics
- replay and event-log implementation details

That split keeps the roadmap coherent:

- `prompt-language-b8kq` owns durable memory semantics
- `prompt-language-b8kq.2` owns Markdown interop
- `prompt-language-b8kq.4` owns retrieval/trust boundaries
- `prompt-language-b8kq.3`, `prompt-language-zhog.1`, and `prompt-language-0ovo.5` own runtime recovery behavior
- `prompt-language-zhog.3` and `prompt-language-zhog.5` provide the audit and evaluation substrate that governance can point at

## Scope versus class

The imported namespaces in Spec 012 should not replace the roadmap's scope model.

These are different questions:

| Question           | Meaning                                                            | Current roadmap owner                   |
| ------------------ | ------------------------------------------------------------------ | --------------------------------------- |
| scope              | Where is this memory shared and who can reuse it?                  | `prompt-language-b8kq.1`                |
| class or namespace | What kind of durable memory is this and how should it be governed? | `prompt-language-b8kq` governance layer |

That means the roadmap can keep scope terms such as `run`, `project`, and `shared` while also adopting governance classes such as `facts`, `policy`, `wisdom`, and `scratch`.

Examples:

- a `policy` entry may live in project or shared scope, but its governance rule is still "curated, higher trust, not silently writable"
- a `wisdom` entry may live in project scope, but still requires provenance, confidence, and reviewable promotion
- a `scratch` entry may be short-lived and writable, but it still must not be confused with checkpoint/session state

This keeps sharing boundaries and trust boundaries orthogonal instead of forcing one overloaded taxonomy.

## Mapping Spec 012 onto the existing roadmap

| Imported direction                                            | Where it lands now                                                                                    | Why it does not need a separate program                                                                                                         |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `facts` / `policy` / `wisdom` / `scratch` memory classes      | `prompt-language-b8kq` governance model, implemented through the memory semantics track               | These are durable-memory classification rules, not a new retrieval or Markdown surface                                                          |
| provenance, confidence, TTL, and inspectable durable metadata | `prompt-language-b8kq.1`                                                                              | The existing scoped-memory slice already owns invalidation, explicit reads, and write timing; metadata belongs in the same inspectable contract |
| explicit promotion from transient result to durable wisdom    | `prompt-language-b8kq` with evidence hooks into `prompt-language-zhog.5` and `prompt-language-zhog.3` | Promotion is a governance workflow, not a checkpoint or retrieval feature                                                                       |
| wisdom must never silently become policy                      | `prompt-language-b8kq.4` trust model plus the durable-memory governance rules                         | This is a trust and write-permission boundary, not Markdown interop                                                                             |
| durable items linked to replay, eval, or regressions          | `prompt-language-zhog.5`, `prompt-language-5vsm`, and `prompt-language-zhog.3`                        | The governance layer requires evidence, but the evidence substrate is already tracked elsewhere                                                 |
| visible staleness and expiry                                  | `prompt-language-b8kq.1`                                                                              | The roadmap already calls out TTL and invalidation as first-phase disciplined-memory work                                                       |

## Separation from retrieval

Spec 012 shows `memory:` examples such as `wisdom.auth.*`, but that does not mean governance should absorb retrieval design.

Retrieval questions remain separate:

- whether recall is exact, filtered, hybrid, or semantic
- whether lookup is deterministic or grounding-oriented
- how loaded results are shown in status and artifacts
- what first-class DSL surface exists now versus what stays in adapters/config

Those are already the open questions for `prompt-language-b8kq.4`. Governance only supplies the metadata that retrieval can filter on later, such as class, provenance, confidence, staleness, or trust level.

## Separation from Markdown interop

The memory-governance import should also stay separate from Markdown interop.

Markdown interop owns:

- `knowledge:` declarations
- deterministic `section` lookup
- visibility into which docs or sections were loaded
- the rule that Markdown guidance is readable and inspectable, but not automatically authoritative runtime policy

That is already the job of `prompt-language-b8kq.2`.

Governance can still interact with Markdown in one narrower way:

- a `policy` class may point at curated Markdown or compiled rules as one trusted source

But that does not collapse Markdown interop into memory governance, and it does not turn writable docs into durable wisdom automatically.

## Separation from runtime recovery

Spec 012 introduces `scratch`, promotion timing, and staleness rules, but none of that changes the boundary already established by the roadmap:

- checkpoints, restore, handoff summaries, and compaction remain runtime/session-state concerns
- durable memory remains cross-run reusable knowledge
- handoff or compaction outputs only become durable memory through explicit promotion rules

That keeps `prompt-language-b8kq.3`, `prompt-language-zhog.1`, `prompt-language-zhog.3`, and `prompt-language-0ovo.5` intact. The governance import reinforces that boundary rather than reopening it.

## Real follow-up gap

Most of Spec 012 already fits inside existing backlog slices. No new epic is needed, and no separate Markdown or retrieval program should be created from this import.

There is, however, one real gap the current backlog does not name cleanly enough:

- an explicit **proposal -> review -> promote or demote** lifecycle for durable wisdom, including required provenance/confidence metadata and a link to replay/eval/regression evidence

The current roadmap mentions explicit promotion and eval alignment, but the backlog is still stronger on memory structure, retrieval boundaries, and checkpoint boundaries than on the concrete governance workflow for wisdom promotion.

If a follow-up slice is created, it should be:

- a narrow child under `prompt-language-b8kq`
- cross-linked to `prompt-language-zhog.5` and the eval stack for evidence requirements
- explicitly scoped to governance workflow, not Markdown loading, retrieval strategy, or checkpoint semantics

No other new follow-up work is justified by this alignment pass.

## Consequences

What this clarifies:

- Spec 012 strengthens the existing memory roadmap instead of replacing it
- governance is an overlay on durable memory, not a synonym for retrieval or Markdown interop
- scope and class should remain separate concepts
- wisdom promotion should require evidence and review rather than silently mutating shared policy

What this avoids:

- a duplicate memory-governance epic beside `prompt-language-b8kq`
- treating `knowledge:` or `section` as governance work
- treating filtered recall or semantic retrieval as if they were the governance model
- reopening the checkpoint-versus-memory boundary that the roadmap already settled
