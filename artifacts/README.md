# Artifact Fixtures

This directory contains the smallest repo-owned Phase 1 artifact slice for `prompt-language-50m6.5`.

It is intentionally narrow:

- a repo-owned package convention that mirrors the accepted artifact package contract
- repo-owned JSON Schemas for the package envelope and one initial built-in type
- a sample artifact package with multiple renderer views

This directory does **not** claim that prompt-language already emits or validates artifact packages at runtime. It provides inspectable fixtures and schemas that later runtime and CLI work can adopt.

## Runtime-facing convention

The accepted package contract defines the layout inside one artifact package:

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
  attachments/
```

When runtime-owned emission lands, packages should materialize under a run-owned working directory such as:

```text
.prompt-language/artifacts/<run-id>/<artifact-id>/
```

This repo slice keeps the canonical fixtures under version control instead:

- `artifacts/schemas/`
- `artifacts/samples/`

## Directory map

| Path                                            | Purpose                                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| `schemas/artifact-package-manifest.schema.json` | Envelope schema for `manifest.json`                                                |
| `schemas/types/implementation-plan.schema.json` | Type-specific payload schema for the initial `implementation_plan` sample          |
| `samples/implementation-plan-v1/`               | Sample artifact package with canonical content plus Markdown, HTML, and JSON views |

## Source of truth

These fixtures are grounded in the accepted artifact notes:

- [`docs/design/artifact-package-contract.md`](../docs/design/artifact-package-contract.md)
- [`docs/design/artifact-runtime-lifecycle.md`](../docs/design/artifact-runtime-lifecycle.md)
- [`docs/design/artifact-taxonomy-and-builtins.md`](../docs/design/artifact-taxonomy-and-builtins.md)

They are not a substitute for those decisions. They are the first repo-owned implementation artifact that later validation and runtime slices can test against.
