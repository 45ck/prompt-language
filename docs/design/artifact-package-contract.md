# Design: Artifact Package, Manifest, and Renderer Contract

## Status

Accepted design target for artifact packaging.

Relevant bead:

- `prompt-language-50m6.3` - Decision: artifact package, manifest, and renderer contract

Primary upstream references:

- [`docs/wip/artifacts/README.md`](../wip/artifacts/README.md)
- [`docs/wip/artifacts/manifest-and-renderers.md`](../wip/artifacts/manifest-and-renderers.md)
- [`docs/wip/artifacts/artifact-taxonomy.md`](../wip/artifacts/artifact-taxonomy.md)
- [`docs/wip/artifacts/runtime-semantics.md`](../wip/artifacts/runtime-semantics.md)
- [`docs/wip/artifacts/custom-artifact-model.md`](../wip/artifacts/custom-artifact-model.md)
- [`docs/wip/artifacts/open-questions.md`](../wip/artifacts/open-questions.md)

This note resolves the package and renderer questions left open by the artifact boundary decision. It does not settle runtime lifecycle, cross-run lookup, plugin APIs, retention policy, or review-comment storage.

## Decision

The canonical prompt-language artifact is one package directory with:

- one required manifest at `manifest.json`
- one required canonical content source under `content/`
- zero or more attachments under `attachments/`
- zero or more rendered views under `views/`
- zero or more generated export files under `exports/`

Markdown, HTML, JSON, PDF, DOCX, CSV, and similar outputs are not separate artifacts. They are views over one package. The package is the durable unit of identity, provenance, inspection, and handoff.

The manifest is the stable entry point for tools and humans. A renderer reads the package's canonical content and may materialize one or more views, but renderer output does not become more canonical than the package itself.

## Why this needs an explicit contract

The WIP artifact material already converges on three constraints:

- artifacts are deliberate, typed, reviewable outputs rather than generic files
- attachments and rendered files belong to an artifact package rather than defining new artifact families
- renderers own presentation, while the runtime owns the envelope and producers own the content

Without an accepted package contract, later beads would be free to drift in incompatible directions:

- treating HTML or Markdown as the artifact itself
- overloading the manifest into application state
- mixing review attachments with renderer caches
- making per-renderer filenames more authoritative than the package ID

This note fixes those boundaries while leaving runtime lifecycle and plugin extensibility for later design work.

## Canonical package layout

This note defines the layout inside one artifact package. It intentionally does not define the global storage root. A package may later live under a run-scoped directory, a workspace-local artifact store, or another approved location.

Canonical layout:

```text
<artifact-package>/
  manifest.json
  content/
    source.json
  views/
    artifact.md
    artifact.html
    artifact.json
  exports/
    artifact.pdf
    artifact.docx
    artifact.csv
  attachments/
    <attachment files and subdirectories>
```

Required meaning:

- `manifest.json` is the package envelope and routing document
- `content/source.json` is the canonical machine-readable artifact body used for validation and rendering
- `views/` contains human-facing or consumer-facing projections derived from the package
- `exports/` contains format-targeted deliverables optimized for sharing, printing, or third-party tools
- `attachments/` contains supporting evidence referenced by the manifest

Minimum required files:

- `manifest.json`
- `content/source.json`

All other paths are optional. A package with no rendered views is still a valid artifact package if its manifest and canonical content exist.

## Package invariants

The package contract has these invariants:

1. The package, not any one file inside it, is the artifact.
2. `manifest.json` must be sufficient to identify the artifact, explain where its canonical content lives, and enumerate available views and attachments.
3. `content/source.json` is the canonical structured source for renderers and machine consumers.
4. Files under `views/` and `exports/` are replaceable derivatives. They may be regenerated without changing the artifact's identity.
5. Files under `attachments/` are evidence files or supporting assets. They are not views unless the manifest explicitly classifies them as such.
6. The manifest may point at files that are not present yet, but the referenced relative paths must be stable for a given package layout version.

## Manifest contract

`manifest.json` is required for every artifact package.

It is an artifact envelope, not runtime state and not a renderer cache.

Required top-level fields:

| Field                   | Required semantics                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifestVersion`       | Version of this package contract. It governs layout and field meaning, not the payload schema for one artifact type.                                                        |
| `artifactId`            | Stable identifier for this artifact package within its owning scope. View filenames must not redefine identity.                                                             |
| `artifactType`          | Logical artifact kind such as `browser_qa_packet`, `decision_record`, or `test_report`.                                                                                     |
| `artifactSchemaVersion` | Version of the type-specific content schema used by `content/source.json`.                                                                                                  |
| `title`                 | Human-readable name shown in review surfaces.                                                                                                                               |
| `summary`               | Short review-oriented synopsis of what the artifact contains or proves.                                                                                                     |
| `status`                | Current package lifecycle label such as `draft`, `active`, `superseded`, or `archived`. This labels the package; it does not replace flow gates or approval state machines. |
| `createdAt`             | First creation timestamp for this package identity.                                                                                                                         |
| `updatedAt`             | Most recent time manifest, content, attachments, or registered views changed materially.                                                                                    |
| `producer`              | Structured provenance for the subsystem, command, flow, or agent that emitted the artifact.                                                                                 |
| `origin`                | Structured provenance for the runtime context that produced the artifact.                                                                                                   |
| `content`               | Pointer and metadata for the canonical package content.                                                                                                                     |
| `views`                 | Registry of rendered projections currently available for this package.                                                                                                      |
| `attachments`           | Registry of supporting evidence files bundled with this package.                                                                                                            |

Required nested semantics:

### `producer`

`producer` identifies who or what emitted the package. It must include:

- `kind` such as `flow`, `runtime`, `host_integration`, or `tool`
- `name` as the stable producer label
- `version` when the producer has a versioned implementation surface

### `origin`

`origin` records where the artifact came from in runtime terms. It must include:

- `runId`
- `flowNode` when a specific node emitted the artifact
- `phase` when a producer distinguishes plan, change, verify, oversight, or similar phases

This keeps provenance visible without turning the manifest into a replay ledger.

### `content`

`content` must include:

- `path`, which is normally `content/source.json`
- `mediaType`, which is normally `application/json`
- `sha256`, the digest of the canonical content file for integrity and cache safety

The content object points to the source representation used for validation and rendering. It is not a registry of every derived file.

### `views`

`views` is a list of registered projections. Each entry must include:

- `name` such as `markdown`, `html`, `json`, `pdf`, `docx`, or `csv`
- `path` relative to the package root
- `mediaType`
- `renderer`
- `sha256`

If a view is absent from `views`, consumers must not assume its file exists even if a matching filename would be conventional.

### `attachments`

`attachments` is a list of evidence or supporting files. Each entry must include:

- `name`
- `path`
- `mediaType`
- `sha256`
- `role`

`role` explains why the attachment exists, such as `evidence`, `reference`, `input-sample`, or `supporting-image`.

## Stable semantics and non-semantics

This note fixes the meaning of the fields above.

Stable semantics:

- `artifactId` identifies the package, not one rendering
- `artifactType` and `artifactSchemaVersion` identify how to interpret `content/source.json`
- `status` describes package standing, not branch conditions or approval results
- `producer` and `origin` explain provenance, not replay history
- `views` and `attachments` are inventories of files bundled with the package
- `content` points to the canonical source representation from which views may be rendered

Not fixed here:

- exact allowed `status` values beyond the examples above
- whether `artifactId` is globally unique or only unique inside a run-owned scope
- how review comments or approvals are stored
- whether all packages must ship the same built-in renderer set

Those remain later lifecycle or plugin-boundary decisions.

## Renderer contract

Renderers treat Markdown, HTML, JSON, and export outputs as views over one package.

The renderer contract is:

1. Input is the package manifest, canonical content, and any referenced attachments.
2. Output is one or more registered files under `views/` or `exports/`.
3. Renderers may add or refresh registered view files, but they must not redefine package identity, provenance, or canonical content semantics.
4. Renderers must write files whose paths are then declared in `manifest.json`.
5. A renderer failure does not invalidate the package if `manifest.json` and `content/source.json` remain intact. It only means a requested view is missing or stale.

### View classes

The package contract distinguishes these renderer outputs:

| Class             | Purpose                                  | Typical location                                                        |
| ----------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| Canonical content | Source used for validation and rendering | `content/source.json`                                                   |
| Review view       | Human-readable inspection surface        | `views/artifact.md`, `views/artifact.html`                              |
| API view          | Consumer-oriented normalized projection  | `views/artifact.json`                                                   |
| Export view       | Format-targeted share or print output    | `exports/artifact.pdf`, `exports/artifact.docx`, `exports/artifact.csv` |

Important consequences:

- Markdown and HTML are peer views, not source-of-truth replacements for `content/source.json`
- JSON may appear both as canonical content and as a rendered API view, but the manifest must distinguish the canonical `content` object from registered `views`
- PDF, DOCX, and CSV are exports, not first-class artifact identities

### Renderer restrictions

Renderers must not:

- write package files outside the paths declared by the package layout
- smuggle runtime state, hidden reasoning, or raw execution traces into the manifest just because a view wants them
- treat temporary caches or intermediate templates as attachments automatically
- require consumers to guess filenames instead of reading `views`

This keeps rendering a presentation concern rather than a second storage protocol.

## Relationship to runtime and run-state artifacts

This package contract stays below the runtime lifecycle boundary described in the WIP artifact notes and parallel run-state design work.

It allows later systems to say:

- a run manifest points at one or more artifact packages
- an eval bundle is composed of one or more artifact packages
- an operator surface opens the preferred view for a package

It does not decide:

- when a flow emits an artifact
- whether artifact approval blocks execution
- how packages are indexed across runs
- whether package history is append-only

Those remain runtime and lifecycle questions.

## Consequences

What this unblocks:

- later built-in artifact type work can target one package envelope
- runtime lifecycle work can reference a concrete package shape without deciding review or supersession storage
- renderers and review surfaces can agree that Markdown, HTML, JSON, and export files are replaceable views over one durable package

What this constrains:

- implementations must not treat a lone Markdown or HTML file as the artifact identity
- manifest design must stay focused on identity, provenance, content routing, and bundled file inventory
- later plugin work must extend this contract rather than redefining attachments or views as separate artifact families

## Current repository status

This note records the accepted design target for packaging and rendering. It should not be read as a claim that the repository already emits artifact packages with this exact layout.

As of April 11, 2026, the accepted gap is architectural rather than implementation detail:

- the WIP artifact bundle already argues for a package-plus-manifest model
- the artifact boundary decision already excludes logs, state, and generic files from the artifact concept
- the remaining repo-level design need is a stable contract that later runtime and renderer work can implement without drifting apart

This document closes that contract gap for `prompt-language-50m6.3`.
