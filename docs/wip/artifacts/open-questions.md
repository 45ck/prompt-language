# Open Questions

<!-- cspell:ignore lrna -->

This file now separates what `prompt-language-50m6.1` settled from what still belongs to later beads.

## Settled by `prompt-language-50m6.1`

These are no longer open for the artifact program unless a later decision explicitly reopens them:

- artifacts are deliberate, typed, reviewable run outputs
- artifacts are not generic files
- artifacts are not execution state, snapshots, memory, logs, or hidden reasoning
- artifacts can be inspected by gates later, but they do not replace gate semantics
- nearby replay, audit, trace, and rendering programs stay separate unless they intentionally consume the artifact protocol

## Still open, by owning bead

### `prompt-language-50m6.2` Decision: artifact taxonomy and initial built-ins

Open questions:

- Which in-bounds artifact families are worth first-class built-ins in the first release?
- Which types should stay custom-only even if the family is in bounds?
- What is the smallest release cut that proves value without freezing too much surface area?

### `prompt-language-50m6.3` Decision: artifact package, manifest, and renderer contract

Open questions:

- What is the canonical package layout for one artifact?
- Which manifest fields are required for identity, provenance, reviewability, and attachments?
- Which views are canonical projections versus optional exports?

### `prompt-language-50m6.4` Decision: artifact runtime lifecycle and flow semantics

Open questions:

- How are emit, validate, reference, review, and supersede modeled?
- Are artifacts addressable only inside one run, or across runs as well?
- How do artifact states interact with approval nodes and `done when:` evaluation?

### `prompt-language-50m6.8` Decision: custom artifact types, review logs, storage, and plugin renderer boundary

Open questions:

- Where are custom types declared and versioned?
- Are review comments and approvals stored in the artifact package, beside it, or in event logs?
- Which renderers are core versus plugin-provided?
- How are large binary attachments stored and referenced?

### `prompt-language-50m6.9` Future gate: user-facing artifact syntax and review UI rollout

Open questions:

- Does prompt-language need first-class artifact DSL syntax at all?
- Which review surfaces belong in core, if any?
- What evidence is required before user-facing docs can claim artifact support?

## Adjacent issue map

These nearby beads should stay classified as follows.

| Bead                     | Classification        | Why                                                                                                                  |
| ------------------------ | --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `prompt-language-5vsm.6` | overlapping consumer  | Eval bundles may later use the artifact protocol, but replay-by-run-id and baseline lock remain eval concerns        |
| `prompt-language-67qn`   | out of scope          | Snapshot/restore solves resumability, not reviewable artifact packaging                                              |
| `prompt-language-42wb`   | out of scope          | Audit events are observability records, not artifact deliverables                                                    |
| `prompt-language-lrna`   | out of scope          | Execution trace is debugging history, not a human-facing artifact family by default                                  |
| `prompt-language-0ovo.4` | adjacent but separate | Large-output summarization may store or reference payloads, but render compaction policy is not the artifact program |

## Questions this slice intentionally refused to answer

These remain deferred because answering them here would silently broaden scope:

- the first implementation milestone
- exact schemas
- CLI commands
- renderer plugin APIs
- approval UX
- storage quotas and retention policy
