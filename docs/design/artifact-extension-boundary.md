# Artifact Extension Boundary

- Status: accepted design target for `prompt-language-50m6.8`
- Scope: custom artifact types, review/comment storage, version scoping, large attachments, and renderer ownership
- Primary upstream references:
  - [docs/wip/artifacts/open-questions.md](../wip/artifacts/open-questions.md)
  - [docs/wip/artifacts/custom-artifact-model.md](../wip/artifacts/custom-artifact-model.md)
  - [docs/wip/artifacts/manifest-and-renderers.md](../wip/artifacts/manifest-and-renderers.md)
  - [docs/wip/artifacts/runtime-semantics.md](../wip/artifacts/runtime-semantics.md)
  - [docs/wip/artifacts/proposed-artifact-syntax.md](../wip/artifacts/proposed-artifact-syntax.md)
  - [docs/wip/artifacts/current-dsl-workarounds.md](../wip/artifacts/current-dsl-workarounds.md)

This note closes the design gap left open on purpose by the artifact boundary pack. It does not claim that prompt-language already ships artifact DSL syntax, renderer plugins, or a review UI. It defines the contract later implementation slices must honor.

## Decision

prompt-language should treat artifact extension as a three-part boundary:

1. core owns the artifact envelope, declaration loading contract, canonical reviewable fallback surfaces, and attachment reference semantics
2. users and repos own custom artifact type declarations and their payload schemas
3. plugins may add validators, previews, exports, and rich renderers for declared types, but they do not become the canonical source of type identity or review history

Concretely:

- built-in artifact types and custom artifact types use the same declaration model
- custom types are declared in checked-in workspace or library material, not hidden inside plugin code or event logs
- review comments and approvals are stored with the artifact revision they inspect, using append-only review records plus a derived latest snapshot
- artifact revisions are immutable once emitted; changes create a superseding revision rather than editing review history in place
- core must always be able to show a machine-readable manifest and a human-legible fallback summary without requiring a plugin
- rich browser, DOCX, PDF, and domain-specific renderers may be plugin-provided
- large binary attachments are referenced by manifest metadata and storage handles; they are not inlined into payload fields or treated as first-class artifact types

## Why this boundary is necessary

The WIP bundle already established the key constraints:

- artifacts are typed, deliberate review objects rather than arbitrary files
- artifacts are not logs, state, replay history, or hidden reasoning
- the package and manifest are canonical; rendered files are projections
- the current repo has file-based workarounds, but no stable type registry, review state model, or renderer boundary yet

Without an explicit boundary here, the implementation would drift toward one of three bad outcomes:

- plugins secretly define artifact types, which makes repo review and compatibility hard
- review history lives only in runtime logs, which makes artifact-level governance brittle
- core tries to own every renderer and binary storage path, which bloats the runtime and couples it to export formats

## Custom type declaration model

### Core contract

Core should define one declaration contract that both built-ins and custom types follow. The exact syntax may be DSL, JSON, or another checked-in form later, but the semantic fields must be stable:

- `type`
- `schema_version`
- `title` or human label
- payload schema or field contract
- allowed attachment kinds
- canonical fallback summary fields
- optional review policy hints
- declared renderer targets and validation hooks

Each artifact instance must record:

- `type`
- `schema_version`
- `declaration_ref`

`declaration_ref` is the pointer to the declaration source used when the artifact was emitted. It may be a repo path, imported library reference, or registry key, but it must be explicit enough that a reviewer can tell which declaration governed the payload.

### Where declarations live

Custom artifact types belong in repo-owned or imported source material, not in plugin registration state.

Allowed declaration sources:

- checked-in project files
- checked-in prompt-language libraries imported by the project
- later workspace registries that are themselves file-backed and reviewable

Not allowed as the canonical declaration source:

- ad hoc plugin startup code
- event-log-only declarations
- host-specific hidden config that another reviewer cannot inspect in the repo

This keeps the model aligned with the repo's broader file-first design. A plugin may understand how to render or validate a type, but the repo must still be able to review the type declaration without running that plugin.

### Evolution and compatibility

Custom type evolution should follow the same rule as other explicit contracts:

- non-breaking field additions may advance `schema_version` within the compatible line
- breaking payload or attachment changes require a new major schema version
- existing artifact revisions keep the declaration they were emitted against
- later renderers or validators may support version ranges, but they must declare that support explicitly

This means prompt-language should behave more like "user-defined typed artifacts" than "arbitrary typed notes." A declaration is durable contract material, not just helpful metadata.

## Review and comment storage

### Canonical storage location

Review comments, approvals, and review-state transitions should live with the artifact package, not only in global event logs.

The canonical model is:

```text
artifact-package/
  manifest.json
  summary.md
  payload.json
  review/
    latest.json
    history.jsonl
```

Required semantics:

- `review/history.jsonl` is the append-only review ledger for that artifact revision
- `review/latest.json` is a derived summary for fast lookup
- `manifest.json` may mirror the current review status and pointers, but it is not the full review ledger

Global audit or event logs may record that a review action happened, but they are secondary evidence. They do not replace the artifact-local review record.

### What review records must reference

Every review record must be scoped to one artifact revision and include enough identity to survive later supersession:

- artifact id
- revision id
- review event id
- actor or actor class
- timestamp
- event kind such as comment, request_changes, approve, reject, resolve
- target section or attachment reference when applicable
- optional linkage to a superseding resolution

This allows later tooling to reconstruct what was reviewed, by whom, and against which exact revision, without scraping unrelated runtime logs.

### Why review state should not live only in logs

The WIP docs already draw a boundary between artifacts and observability. If review history lived only in audit trails:

- artifact packages would stop being self-describing review objects
- approval and handoff tooling would need cross-system joins for ordinary inspection
- superseded artifacts would lose a compact, local explanation of why they changed

Review records can still be mirrored into broader audit systems, but the artifact must remain reviewable as a package on its own.

## Versioning and supersession semantics

### Revision rule

Artifact revisions are immutable once emitted for review.

If the producer updates payload, attachments, or a rendered claim in a materially review-relevant way, the system should create a new revision or new package and point back with `supersedes`.

The system should not:

- rewrite comment history in place
- mutate an approved revision until it silently means something else
- treat attachment replacement as "just metadata" when it changes the evidence being reviewed

### Review scoping rule

Comments and approvals are revision-scoped, not artifact-family-scoped.

That means:

- approval of revision `r1` does not auto-approve revision `r2`
- comments on `r1` remain attached to `r1` even after `r2` supersedes it
- `r2` may explicitly carry forward unresolved issues from `r1`, but that carry-forward must be represented as new review state, not implied

This is the minimum rule set that keeps review trustworthy when artifacts are revised.

### Derived summary rule

Later operator surfaces may show "artifact status" at the logical artifact level, but that status must be derived from revision history, not by erasing old review records.

For example:

- logical artifact `deploy_plan` may currently point to revision `r3`
- `r1` and `r2` remain historical packages with their own review ledgers
- any "latest approved" banner must identify which revision was approved

## Renderer boundary

### What core must own

Core must own the minimum renderer-independent contract:

- manifest schema and attachment reference fields
- declaration loading and type identity rules
- canonical fallback summary generation rules
- capability discovery for optional renderers
- safe rendering fallback when no plugin is installed

At minimum, core must always be able to expose:

- normalized manifest JSON
- one human-legible fallback surface such as Markdown or plain text summary

That rule preserves the runtime-semantics requirement that artifacts stay inspectable even when no rich renderer is available.

### What plugins may own

Plugins may provide:

- browser-oriented HTML review views
- DOCX and PDF exports
- domain-specific renderers such as spreadsheet, diagram, or slide projections
- attachment-specific previews such as image galleries, video wrappers, or office document summaries
- validator helpers for declared custom types

Plugins may not:

- redefine artifact identity semantics
- become the only place a custom type is declared
- make a plugin-specific view the only reviewable surface
- force large attachment bytes into the core payload contract

This keeps the plugin boundary additive. Missing plugins should degrade review richness, not artifact legibility or type integrity.

### Why DOCX and PDF should stay outside core

The earlier WIP package notes intentionally treated DOCX and PDF as candidate views, not mandatory core output. That is the right boundary to keep:

- export stacks are format-heavy and operationally noisy
- they often require different dependencies or host capabilities
- they are useful, but not necessary for the protocol itself

Core should standardize renderer targets and fallback behavior. Plugins should own the expensive export implementations.

## Large attachments and storage boundary

### Attachment rule

Large binaries are attachments, not payload fields and not artifact types by themselves.

The manifest should store attachment metadata such as:

- logical name
- media type
- byte size
- digest
- storage ref
- optional preview ref
- review role such as evidence, source, export, or auxiliary

This preserves a machine-readable contract without pretending the manifest itself should contain the bytes.

### Storage boundary

The artifact package may contain small local attachments directly, but the design must support large attachments through stable references.

The boundary is:

- core owns attachment reference semantics and integrity metadata
- storage backends may be local package files, workspace blob stores, or later external object stores
- plugins may stream or preview attachments through those references

Core should not require all attachments to be copied into prompt context, rendered inline, or transformed into base64 payload blobs just to remain valid artifacts.

### Reviewability rule for large attachments

Even when an attachment is large or binary-only, the artifact still needs a reviewable top-level surface.

Acceptable examples:

- a screenshot set with captions and a manifest summary
- a video recording with a textual summary and key timestamps
- a DOCX source attachment plus a fallback Markdown synopsis

Not acceptable:

- a package that is effectively just a binary blob with no inspectable summary
- treating "the PDF export exists" as the whole artifact

This keeps the artifact boundary aligned with the earlier runtime-semantics rule that attachments may be binary, but the artifact itself must stay legible.

## Rejected alternatives

### Hidden plugin-defined types

Rejected because it would make type identity depend on runtime environment rather than checked-in repo material.

### Review history only in audit or event logs

Rejected because it would make ordinary artifact review depend on observability infrastructure and blur the artifact-versus-log boundary.

### Core owns every renderer

Rejected because it would over-couple the runtime to export stacks and make the protocol heavier than necessary.

### Mutable in-place approved artifacts

Rejected because review and approval lose meaning when the reviewed object can silently change underneath them.

## Consequences for later slices

This decision constrains later artifact work as follows:

- `prompt-language-50m6.3` should treat review pointers and attachment references as part of the package contract
- `prompt-language-50m6.4` should model review and supersede transitions against immutable revisions rather than mutable packages
- `prompt-language-50m6.9` should not claim a review UI until it can surface revision-scoped review history and fallback rendering
- later plugin work must treat rich renderers as optional capability layers over a core-readable artifact package

## Current repository status

This note records the accepted boundary, not shipped runtime behavior.

As of April 11, 2026, the repo has:

- WIP material proposing custom artifact types and renderer targets
- package and runtime notes that intentionally deferred review storage and plugin ownership
- current file-based workarounds that prove need, but not the final contract

The design gap closed here is the missing explicit answer to where type declarations live, where review history lives, how revisions behave, and what rendering and attachment responsibilities belong to core versus plugins.
