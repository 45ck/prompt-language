# Design: Operator Scaffolding Boundary

## Status

Accepted design target for the current operator-shell scaffolding work.

Relevant beads:

- `prompt-language-f7jp.6` - Workflow aliases and `render-workflow` lowering to visible flows
- `prompt-language-f7jp.7` - Project scaffolding for AGENTS guidance, starter flows, and reusable libraries
- `prompt-language-f7jp.9` - Rollout, troubleshooting, and promotion evidence for operator-shell work

This note accepts the scaffolding boundary implied by the imported OMX adaptation pack, especially:

- [Spec 004 — Workflow Aliases That Lower to Flows](../wip/reviews/2026-04-11-omx-adaptation-pack/specs/004-workflow-alias-lowering.md)
- [Spec 005 — Project Scaffolding and Guidance](../wip/reviews/2026-04-11-omx-adaptation-pack/specs/005-project-scaffolding.md)
- [Implementation Workstreams](../wip/reviews/2026-04-11-omx-adaptation-pack/plans/implementation-workstreams.md), especially WS5

## Decision

prompt-language may scaffold operator-facing project structure, but the scaffold must materialize as **ordinary repo-visible artifacts** rather than hidden shell state.

Scaffold output may include:

- top-level `AGENTS.md` guidance
- starter `.flow` programs and reusable flow libraries
- starter gate packs and related docs
- repo-visible manifests or metadata that help discovery
- `docs/wip/reviews/<date>-pack/` or similar review skeletons

The runtime does not treat scaffolded guidance as invisible authority. Generated files are inputs that humans can inspect, edit, move, review, or delete like any other repository content.

This keeps scaffolding aligned with the [Operator Shell Boundary](operator-shell-boundary.md): the shell may accelerate setup, but it does not replace explicit flow, gate, state, or docs ownership with a second hidden control plane.

## Why this needs a first-class boundary

Scaffolding is useful only if it improves startup speed without creating opaque behavior.

Without an explicit boundary, project templates drift toward the same failure mode as hidden host automation:

- guidance exists, but readers cannot tell where it came from
- starter libraries become more authoritative than the files users can actually review
- workflow aliases appear to "just know" behavior that is not recoverable from generated artifacts
- imported bundle content can leak into the repo as shadow documentation rather than curated product docs

The accepted direction is therefore: generate visible files, keep runtime semantics explicit, and make provenance legible.

## Generated artifact types

The operator shell may generate or refresh the following artifact classes.

### 1. Guidance documents

Examples:

- `AGENTS.md`
- subsystem or folder-local guidance files
- review or operating checklists

Purpose:

- define collaboration rules
- capture local conventions
- document reusable operating patterns

These are documentation artifacts. They guide people and tooling, but they do not become a hidden execution model.

### 2. Starter flows and libraries

Examples:

- `flows/clarify.flow`
- `flows/plan.flow`
- `flows/execute.flow`
- reusable prompt, flow, or gate libraries referenced from visible files

Purpose:

- give projects a concrete starting point
- lower alias-style conveniences to inspectable prompt-language assets
- preserve reusable building blocks as normal repo content

This is the direct scaffolding counterpart to the workflow-alias rule in [Spec 004 — Workflow Aliases That Lower to Flows](../wip/reviews/2026-04-11-omx-adaptation-pack/specs/004-workflow-alias-lowering.md).

### 3. Discovery metadata

Examples:

- `.prompt-language/guidance/` manifests
- library indexes
- generated summaries that point to repo files

Purpose:

- help shell commands discover scaffolded assets
- preserve stable lookup points without inventing hidden prompt bundles

Discovery metadata is allowed only when it points back to ordinary repo files and remains safe to regenerate.

### 4. Review and planning skeletons

Examples:

- `docs/wip/reviews/<date>-pack/`
- template directories for clarify / plan / execute reviews

Purpose:

- make the repo's verification-first review style easier to start consistently
- give users a visible place to capture assumptions, decisions, and promotion evidence

These skeletons are scaffolding aids, not evidence that a review has already been performed.

## Editing and ownership model

Scaffolded artifacts are **repo-owned content with user-editable defaults**.

The ownership rules are:

- generated files become ordinary repository files after creation
- users may edit, rename, move, or delete scaffolded files without violating runtime correctness
- scaffold refresh must preserve user-edited content unless the user explicitly chooses overwrite or the file is still clearly prompt-language-managed
- manifests or indexes may be regenerated, but they must not silently rewrite unrelated user-authored guidance
- scaffold tooling must prefer additive generation and visible conflict reporting over destructive replacement

If prompt-language needs refresh-safe behavior for a subset of files, that managed status must be explicit in the generated artifact or metadata. Silent "tool owns this because it created it once" behavior is out of bounds.

## Scaffolded structure versus runtime behavior

Scaffolding and runtime execution are related, but they are not the same thing.

Scaffolding may provide:

- default guidance
- example flows
- reusable libraries
- manifests that improve discovery

Runtime behavior remains grounded in explicit runtime artifacts such as:

- `.flow` programs
- gate definitions
- run-state and recovery files
- rendered workflow previews
- diagnostics produced from actual runtime state

Important consequences:

- `AGENTS.md` can shape how operators work, but it does not override gate semantics
- starter flows can provide a default path, but they do not create new execution rules beyond the files the runtime can already inspect
- reusable libraries are only authoritative when referenced through visible repo artifacts
- alias commands remain convenience surfaces that lower to visible flows, previews, or state transitions rather than hidden shell-only behavior

Scaffolding may accelerate authoring. It must not become a shadow runtime.

## Compatibility with docs-truth and import conventions

This repo already distinguishes between canonical design docs, WIP review material, and provenance summaries under `docs/source-imports/`.

Operator scaffolding must preserve that separation.

Required compatibility rules:

- scaffolding may create WIP review skeletons under `docs/wip/`, but it must not auto-promote them to canonical design truth
- durable design rationale belongs in `docs/design/`, not in generated import packs
- imported bundle content should remain summarized through curated provenance notes such as `docs/source-imports/README.md`, not copied wholesale into scaffold output
- scaffolded docs should be repo-native and editable, even when the starting structure was inspired by imported OMX material
- discovery metadata may reference imported-pack-derived templates, but the shipped source of truth must remain the generated repo files themselves

This keeps the docs story legible: imported material informs the product, but ordinary repo artifacts remain the authoritative surface.

## Non-goals

This design does not permit any of the following:

- hidden prompt bundles or skill packs that outrank repo-visible guidance
- shell-only workflow semantics that cannot be traced back to generated files or runtime state
- automatic promotion of scaffolded WIP docs into accepted design or reference docs
- mandatory `AGENTS.md` presence as a prerequisite for runtime execution
- vendoring raw external pack trees into the repo under the guise of scaffolding
- destructive regeneration that overwrites user-authored project structure by default

## Consequences

What this unblocks:

- `init`-style operator scaffolding that stays inspectable and reviewable
- workflow aliases that point users back to visible starter flows and planning artifacts
- reusable project libraries that can live under version control instead of inside hidden host state
- a clean promotion path from imported pack ideas to repo-native docs and examples

What this constrains:

- CLI scaffolding work must explain which artifacts are generated and who owns them after generation
- docs must describe scaffolding as a convenience layer, not as a second runtime
- regeneration logic must be conservative and conflict-aware
- future library discovery features must remain subordinate to repo-visible artifacts

## Current repository status

This note is the accepted target boundary for operator scaffolding. It should not be read as a claim that every scaffold command, generated template, or library manifest already exists in the current branch.

As of April 11, 2026:

- the imported OMX pack defines the intended scaffolding direction in WIP form
- workflow alias work is being promoted separately through inspectable rendering and visible outputs
- the remaining project-scaffolding work stays tracked under `prompt-language-f7jp.7`

## Practical rule

When evaluating a new scaffold feature, ask:

> Does it create ordinary repo artifacts that users can review and own, or does it move important guidance and behavior into hidden shell state?

If it does the first, it fits this boundary.

If it does the second, it is out of scope.
