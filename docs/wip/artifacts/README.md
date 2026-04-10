# Artifacts Proposal Pack

Imported from `prompt-language-artifacts-bundle.zip`.

This pack proposes a durable artifact model for prompt-language: typed, human-reviewable, machine-readable outputs that are distinct from state, memory, logs, and ordinary side effects.

Status: proposal only. The syntax and runtime described here are not shipped unless they also appear in the accepted design or shipped reference docs.

## Imported docs

| Doc                                                           | Focus                                                             |
| ------------------------------------------------------------- | ----------------------------------------------------------------- |
| [Artifact Definition](prompt-language-artifact-definition.md) | Boundary for what counts as an artifact                           |
| [Artifact Taxonomy](artifact-taxonomy.md)                     | Proposed families and initial built-ins                           |
| [Custom Artifact Model](custom-artifact-model.md)             | Runtime envelope vs user payload vs renderer boundary             |
| [Manifest And Renderers](manifest-and-renderers.md)           | Canonical package form and review/export views                    |
| [Runtime Semantics](runtime-semantics.md)                     | Lifecycle, validation, review, and artifact-aware gates           |
| [Open Questions](open-questions.md)                           | Remaining type, review, runtime, rendering, and storage questions |
| [Current DSL Workarounds](current-dsl-workarounds.md)         | How to approximate artifact behavior with today’s runtime         |
| [Proposed Artifact Syntax](proposed-artifact-syntax.md)       | Future-facing DSL examples, explicitly not shipped                |

## Import boundary

I kept the design and example markdown only.

I did not copy:

- raw HTML index assets
- schemas
- sample artifact packages
- example `.flow` files

Those can be reintroduced later if the artifacts program moves past the current design stage.
