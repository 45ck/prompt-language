# Artifacts Boundary Decision Pack

<!-- cspell:ignore lrna -->

This folder now serves two purposes:

1. preserve the imported artifact proposal material from `prompt-language-artifacts-bundle.zip`
2. record the repo's current boundary decision for `prompt-language-50m6.1`

Status: `prompt-language-50m6.1` scope only. These docs define what the artifact program is and what it must not absorb. They do not claim shipped runtime behavior, DSL syntax, or UI support.

## Decision summary

An artifact in prompt-language is a deliberate run output that is:

- durable enough to inspect after the producing step completes
- human-reviewable without reading raw internal state or hidden reasoning
- machine-readable enough to validate, index, or consume later
- typed and named by the producing workflow or subsystem

An artifact is not:

- generic file output
- execution state or snapshot state
- memory or durable learned policy
- audit log or trace event stream
- a substitute for `if`, `done when:`, approval gates, or other control flow
- a promise that every host or feature will persist outputs in one universal artifact store

## Scope of this slice

`prompt-language-50m6.1` closes only the boundary and non-goals. It is complete when the docs make these points unambiguous:

- artifacts are reviewable outputs, not hidden internals
- artifacts stay separate from state, memory, logs, side effects, and gates
- adjacent backlog items are classified instead of blurred together

The following decisions are intentionally deferred:

- which built-in artifact families ship first
- the canonical package layout and manifest contract
- lifecycle details such as validation, review state, supersession, and cross-run lookup
- custom type declarations, renderer/plugin boundaries, and large attachment handling
- any user-facing DSL syntax or review UI

## Document map

| Doc                                       | Role in the boundary decision                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| [Artifact Taxonomy](artifact-taxonomy.md) | Defines which families are in-bounds as human-facing artifacts and what should stay out |
| [Runtime Semantics](runtime-semantics.md) | States the runtime constraints later lifecycle work must honor                          |
| [Open Questions](open-questions.md)       | Separates questions resolved here from questions deferred to later beads                |

The remaining imported docs stay as design input. They are useful source material, but they are not automatically accepted design.

## Adjacent backlog classification

This artifact program overlaps with nearby work, but it must not silently absorb it.

| Bead                     | Relationship                   | Boundary                                                                                                 |
| ------------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `prompt-language-50m6.2` | blocked by this slice          | Can decide initial built-ins only after artifact families and exclusions are clear                       |
| `prompt-language-50m6.3` | blocked by this slice          | Package and renderer contracts depend on a stable definition of "artifact"                               |
| `prompt-language-50m6.4` | blocked by this slice          | Runtime lifecycle semantics must preserve the boundary set here                                          |
| `prompt-language-50m6.8` | blocked by later design slices | Custom types, review storage, and renderer/plugin boundaries are later design work                       |
| `prompt-language-5vsm.6` | overlapping consumer           | Eval runs may emit artifact bundles, but eval replay is not the whole artifact protocol                  |
| `prompt-language-67qn`   | out of scope                   | Snapshot and restore are state management, not human-facing artifact packaging                           |
| `prompt-language-42wb`   | out of scope                   | Audit logging is observability, not artifact review/handoff                                              |
| `prompt-language-lrna`   | out of scope                   | Execution traces explain runtime history; they are not first-class review artifacts by default           |
| `prompt-language-0ovo.4` | adjacent but separate          | Large-output summarization may reference stored outputs, but render compaction policy is its own program |

## Import boundary

I kept the imported design markdown only.

I did not copy:

- raw HTML index assets
- schemas
- sample artifact packages
- example `.flow` files

Those remain implementation or fixture candidates for later beads rather than part of the boundary decision itself.
