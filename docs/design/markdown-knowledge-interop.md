# Design: Markdown Knowledge Interop

## Status

Accepted design target for bead `prompt-language-b8kq.2`.

Primary anchors:

- [Recommended Implementation Roadmap](../wip/memory/memory-roadmap.md)
- [Memory Governance Alignment](memory-governance-alignment.md)
- [Does this fit the design of Prompt Language?](../wip/memory/knowledge-plan/02-design-fit.md)
- [Proposed DSL Examples](../wip/memory/knowledge-plan/03-dsl-examples.md)
- [Prompt Language: Memory, Knowledge, Markdown, and Evaluation Positioning](../wip/memory/memory-knowledge-positioning.md)

This note defines the first backlog-ready contract for Markdown knowledge loading and exact section lookup. It is intentionally narrower than the broader memory and retrieval roadmap.

## Scope

This bead owns four things:

- the DSL surface for `knowledge:` declarations
- deterministic `section` lookup semantics for Markdown headings
- inspectability requirements in status, diagnostics, and artifacts
- the validation path and implementation touch points required before code work starts

This bead does not decide broader retrieval strategy, trust scoring, or memory governance classes.

## Decision

Prompt-language should support Markdown interop through an explicit, inspectable surface:

- flows may declare Markdown knowledge sources under `knowledge:`
- flows may read exact Markdown sections through deterministic heading-path lookup
- loaded knowledge must remain visible to operators through rendered state, diagnostics, or artifacts
- Markdown guidance is a readable input, not hidden runtime state and not automatic policy authority

The first implementation target is deterministic only. If the runtime cannot resolve a declared source or a requested section exactly, it must warn or fail explicitly rather than silently substitute fuzzy matches.

## Why this belongs in the language

The checked-in memory roadmap already calls out Markdown knowledge interop as the phase after disciplined memory. That sequencing is correct.

Markdown is already where teams keep:

- `AGENTS.md`
- `CLAUDE.md`
- runbooks
- architecture notes
- troubleshooting docs

Prompt-language should consume that guidance directly without pretending that Markdown files are the same thing as:

- run/session state
- durable structured memory
- checkpoint or compaction summaries
- implicit policy truth

This note therefore strengthens the current model rather than creating a second knowledge system.

## `knowledge:` declaration contract

### Purpose

`knowledge:` declares the Markdown sources a flow is allowed to consult as readable guidance.

The declaration is explicit so operators can answer:

- which files were made available to the run
- which declarations were resolved successfully
- which declarations were unused, missing, or ambiguous

### Initial shape

The accepted direction is a top-level section parallel to `memory:` rather than an inline ad hoc command inside `flow:`.

Directionally valid examples:

```yaml
knowledge: source "./AGENTS.md"
  source "./docs/runbooks/**/*.md"
  source "./services/api/CLAUDE.md"
```

The exact parser syntax can remain implementation-shaped, but the semantic contract is fixed:

- each declaration identifies one file path or glob rooted from the flow base path
- declarations are resolved before execution begins
- declared knowledge is readable only; declaration alone does not imply mutation, promotion, or indexing
- resolution results are inspectable

### Resolution rules

The runtime must treat `knowledge:` declarations as deterministic file discovery, not best-effort retrieval.

Required rules:

- relative paths resolve from the flow base path
- glob expansion must produce a stable, deterministic ordering
- duplicate resolved files should collapse to one canonical entry
- missing single-file declarations should fail clearly or emit a stable validation diagnostic
- globs that resolve to zero files should emit a stable diagnostic rather than silently pretending success
- non-Markdown files are out of scope for this bead unless later accepted separately

This keeps the feature compatible with prompt-language's current emphasis on explicit structure and inspectable state.

## Deterministic `section` lookup

### Purpose

`section` is the exact-addressing primitive for Markdown guidance.

It exists so a flow can point at a stable heading path such as:

- `AGENTS.md#Testing instructions`
- `docs/runbooks/deploy.md#Rollback`

without introducing fuzzy retrieval into critical control paths.

### Lookup contract

`section` lookup must be exact and reproducible.

Required semantics:

- the lookup target contains a resolved Markdown file plus a heading path
- heading matching is deterministic and based on parsed heading structure, not raw string grep
- when the same heading text appears under multiple parents, the full heading path must disambiguate
- if the target path resolves to zero sections, the runtime must fail clearly or emit a stable validation diagnostic
- if the target path is ambiguous under the accepted syntax, the runtime must reject it rather than choose arbitrarily

### Heading-path rule

The contract should support a heading path model, not only a leaf-heading string.

Minimum behavior:

- a single-heading lookup may work when the heading is unique within the file
- nested duplicate headings require a full path form
- the path comparison rules must be documented once and reused in parser tests, runtime diagnostics, and docs examples

Whether the final syntax uses one string or a structured reference is an implementation detail. The semantic requirement is exact parent-aware heading resolution.

### Returned value

The retrieved value should be the rendered section body associated with the matched heading, using one stable extraction rule.

That rule must answer:

- whether the heading line itself is included
- where the section ends
- how nested subsections are handled

The first implementation should prefer the simplest explicit rule and document it. The main requirement is that the same source always produces the same extracted text.

## Inspectability requirements

Markdown interop only fits prompt-language if it remains visible.

Any use of `knowledge:` or `section` that can affect model behavior must be inspectable through status, diagnostics, or artifacts. Operators should not have to guess which docs were loaded.

### Minimum visible fields

At minimum, the runtime should be able to expose:

- declared knowledge sources
- resolved file list in deterministic order
- missing or invalid declarations
- `section` lookups attempted
- `section` lookups that resolved successfully
- failures caused by missing or ambiguous section targets

### Acceptable surfaces

The exact first surface can vary, but at least one operator-facing and one machine-readable surface are required.

Good initial surfaces:

- rendered state or summary output
- validation diagnostics
- session-state metadata
- run artifact manifests or audit logs

The design intent is simple:

- status should show what knowledge was in play
- artifacts should preserve enough evidence to audit later

### What inspectability is not

Inspectability does not require dumping entire Markdown files into every prompt or report.

Prefer:

- file paths
- section references
- resolution outcomes
- bounded previews when needed

over opaque "knowledge used" flags or massive copied blobs.

## Trust boundary

This bead keeps one explicit trust boundary from the roadmap and adjacent design notes:

- Markdown guidance may inform a run
- Markdown guidance does not become automatically authoritative policy just because it was declared under `knowledge:`

That means:

- writable docs are not silently elevated into policy
- `knowledge:` is not a governance class
- exact section lookup does not imply approval to mutate runtime behavior outside existing flow controls

Any later policy-authority model belongs under the broader trust and retrieval slices, not here.

## Parser, runtime, docs, and tests touch points

The implementation should stay inside existing architecture boundaries and reuse the repo's current flow parsing and validation surfaces.

### Parser and domain touch points

Expected files to extend:

- `src/domain/flow-node.ts`
- `src/application/parse-flow.ts`
- `src/application/parse-flow.test.ts`
- `src/application/parse-flow.property.test.ts`
- `src/application/parse-flow.fuzz.test.ts`
- `src/application/parse-flow-memory-messaging.test.ts`

Expected responsibilities:

- represent `knowledge:` declarations in the parsed spec
- represent `section` as an exact lookup source rather than a fuzzy retrieval primitive
- produce stable diagnostics for malformed declarations, missing targets, and ambiguous heading paths

### Runtime and application touch points

Expected files to evaluate:

- `src/application/inject-context.ts`
- `src/application/execution-preflight.ts`
- `src/domain/render-flow.ts`
- `src/presentation/validate-flow.ts`
- `src/presentation/render-workflow.ts`

Expected responsibilities:

- preload or resolve declared Markdown sources deterministically
- surface validation failures before execution where possible
- include inspectable knowledge metadata in rendered or validated outputs
- avoid conflating knowledge loading with memory prefetch, checkpoint restore, or hidden runner behavior

### Infrastructure touch points

Expected files to evaluate:

- file-backed adapters that already resolve paths, state, memory, and audit output
- any artifact or audit logger adapter used to persist machine-readable inspection data

Expected responsibilities:

- canonical file resolution
- deterministic ordering
- artifact-safe recording of what was declared or resolved

This bead does not justify a retrieval backend, vector index, or semantic ranking adapter.

### Docs touch points

When implementation starts, the minimum docs set should include:

- reference docs for `knowledge:` and `section`
- at least one guide or example showing exact Markdown usage
- wording that preserves the shipped-versus-tracked boundary until runtime support actually lands

This design note itself is not the shipped reference.

### Test touch points

Tests should be added or extended in four layers:

- parser tests for syntax and diagnostics
- domain or rendering tests for inspectable output
- validation tests for preflight and preview behavior
- integration tests proving deterministic resolution across real Markdown fixtures

Minimum scenario families:

- single-file declaration resolves successfully
- glob declaration resolves in stable order
- duplicate files collapse deterministically
- missing file declaration fails or warns predictably
- exact unique heading lookup succeeds
- duplicate heading text requires explicit disambiguation
- missing section fails clearly
- loaded knowledge appears in status, preview, or artifact evidence

## Explicit validation path before implementation

No parser or runtime implementation should start until the validation path is written down and agreed.

The minimum pre-implementation checklist is:

1. Finalize one syntax sketch for `knowledge:` declarations and one for `section` references.
2. Define exact heading-path comparison rules, including duplicate-heading behavior.
3. Decide the first inspectability surfaces:
   status or rendered view, validation diagnostics, and artifact metadata.
4. Prepare Markdown fixture files that exercise:
   unique headings, duplicate headings, nested headings, missing files, and empty globs.
5. Write the parser and validation test cases before or alongside runtime code so deterministic behavior is locked first.

The key sequencing rule is:

- parser and validation semantics first
- runtime loading second
- shipped reference docs only after the feature exists and passes the agreed tests

This prevents the feature from drifting into fuzzy behavior under implementation pressure.

## Non-goals

This bead does not include:

- semantic or vector retrieval as default language behavior
- backend-specific ranking, embeddings, or hybrid search knobs
- automatic policy authority for declared Markdown
- turning Markdown into checkpoint, compaction, or session-state storage
- redesigning durable memory scopes, governance classes, or wisdom promotion

Those belong to later or separate slices already named in the roadmap and adjacent design notes.

## Acceptance fit

This note satisfies `prompt-language-b8kq.2` when downstream work has one stable answer to these questions:

- what `knowledge:` declares
- how Markdown sources resolve deterministically
- how `section` finds one exact heading path
- what operators can inspect when knowledge affects a run
- which parser, runtime, docs, and test surfaces must move together
- what validation work must happen before code changes begin

That is the boundary for this bead.
