<!-- cspell:ignore filesets fileset -->

# Design: Context Filesets for Prompt Turns

## Status

Accepted design target for bead `prompt-language-9uqe.9`.

Primary anchors:

- [Fresh-Step Bootstrap Context](fresh-step-bootstrap-context.md)
- [Markdown Knowledge Interop](markdown-knowledge-interop.md)
- [Bounded Execution Contracts](bounded-execution-contracts.md)
- [Diagnostics Contract V1](diagnostics-contract-v1.md)
- [Import (history note)](../wip/history/import.md)

This note defines a first-class deterministic context-fileset model for `prompt` and `ask` turns. It is scoped to read-only turn context assembly. It does not redefine `import`, prompt libraries, memory, or hidden retrieval.

## Decision

Prompt-language should support **first-class context filesets** as a runtime-owned, inspectable way to attach explicit file content to `prompt` and `ask` turns.

The contract is:

- filesets are declared explicitly, not inferred from tool calls or transcript history
- filesets are resolved deterministically against the workspace at turn-build time
- filesets are read-only turn inputs, not parse-time DSL expansion
- path safety, ordering, truncation, and budget behavior are stable and testable
- missing, unsafe, unreadable, and over-budget inputs produce explicit diagnostics instead of silent omission

## Why this is a separate surface

`import` and context filesets may both reference local files, but they serve different layers.

`import` is:

- parse-time
- DSL-facing
- structural expansion
- about flows, prompts, gates, exports, and symbol reuse

Context filesets are:

- turn-time
- runtime-facing
- read-only context assembly
- about which file contents a `prompt` or `ask` turn may see

That boundary must remain hard. A context fileset does not create symbols, inline nodes, expose `use`, or alter control flow. An `import` does not declare a prompt-turn attachment budget.

## Core model

A **context fileset** is a named bundle of deterministic file selectors that a `prompt` or `ask` turn may attach.

The runtime turns a fileset attachment into a **turn context snapshot** containing:

- the ordered resolved file list
- a bounded text snapshot for each included file
- truncation and omission metadata
- diagnostics and budget outcomes

The snapshot is created once at turn start. The running turn does not re-resolve globs or re-read files mid-turn.

## Declaration shape

The exact final syntax may shift, but the semantic shape should be fixed now.

Directionally valid shape:

```text
context-filesets:
  fileset repo_rules:
    require file "./AGENTS.md"
    optional file "./CLAUDE.md"

  fileset auth_surface:
    glob "./src/auth/**/*.ts" max-files 12
    optional file "./package.json"

flow:
  prompt context repo_rules, auth_surface:
    Implement refresh-token rotation without widening the edit surface.

  ask "is the auth surface internally coherent?" context repo_rules, auth_surface
```

Semantic rules:

- filesets are declared at top level
- each fileset has a stable name
- selectors are one of `file` or `glob`
- selectors may be `require` or `optional`
- `prompt` and `ask` nodes may attach one or more filesets in explicit order
- node-local inline selectors may exist later, but they must lower into the same runtime fileset model rather than creating a second context mechanism

## Selector semantics

### `file`

`file` identifies one literal workspace-relative file.

Rules:

- it resolves to exactly one canonical file path
- missing required files block the turn
- missing optional files emit a warning diagnostic
- `file` does not treat `*`, `**`, `?`, or bracket patterns as glob syntax

### `glob`

`glob` identifies zero or more workspace-relative files through a constrained glob grammar.

Rules:

- glob expansion is deterministic
- required globs that resolve to zero files block the turn
- optional globs that resolve to zero files emit a warning diagnostic
- `max-files N` narrows how many matches one selector may contribute after sorting

The first implementation should keep the selector grammar deliberately small and testable rather than pretending to support shell-complete glob semantics.

## Safe path rules

Context filesets must reuse the repo's existing safe-relative-path posture rather than inventing a looser second rule set.

Required path rules:

- paths and glob roots are relative to the flow base path
- absolute paths are rejected, including Windows drive-letter paths
- any path containing `..` is rejected
- normalized canonical paths must remain inside the workspace after resolution
- backslash paths are rejected at the DSL surface; use forward slashes only
- literal `file` selectors may contain spaces, dots, underscores, and hyphens
- unsupported control characters or shell-style escape tricks are rejected

Practical boundary:

- safe relative paths are allowed
- cross-workspace traversal is not

If later implementations support symlinked content, the post-resolution canonical target must still remain inside the allowed workspace boundary.

## Ordering rules

Determinism depends on one stable ordering contract.

Files are ordered as follows:

1. attached filesets are processed in the order listed on the node
2. selectors within one fileset are processed in declaration order
3. `glob` matches are sorted lexicographically by normalized relative path
4. duplicate canonical paths collapse to one entry in first-seen order

Duplicate handling rules:

- the first occurrence fixes the file's position in the final ordered list
- if later occurrences disagree on required versus optional, `require` wins
- if later occurrences specify a tighter per-file limit, the tighter limit wins
- duplicate inclusion never duplicates file content in the final turn payload

This yields one deterministic final fileset even when multiple named filesets overlap.

## Merge behavior

Turn attachment merges named filesets into one final context snapshot.

Merge semantics:

- merging is additive by default
- duplicates collapse by canonical path
- requirement severity is merged by the stricter rule
- budget treatment happens only after merge, not per fileset in isolation

If a later surface introduces flow-level default filesets plus node-level attachments, the runtime should merge them in this order:

1. flow defaults
2. node-attached named filesets
3. node-local inline selectors

Later layers may narrow or add context. They must not silently reorder earlier material.

## Snapshot and read semantics

At turn start, the runtime builds a turn-local snapshot.

Required behavior:

- resolve selectors to canonical workspace-relative paths
- read file contents once for the turn
- record file size and truncation metadata
- expose the final ordered manifest through inspectable runtime surfaces

The first contract is text-first:

- files are read as UTF-8 text
- unreadable or binary-looking files produce diagnostics
- future binary attachment support, if added, must be a separate explicit extension

This keeps the first implementation deterministic and runner-neutral.

## Truncation and size limits

The first version should use hard deterministic text limits, not model-specific "best effort" token guessing.

Recommended initial limits:

- maximum `32` resolved files per turn after merge
- maximum `12,000` characters per file before truncation
- maximum `48,000` aggregate characters across the whole turn fileset snapshot

The runtime may allow tighter policy defaults later, but the contract needs one documented baseline.

### Per-file truncation

If one file exceeds its allowed per-file limit:

- keep the leading prefix only
- append a stable truncation marker
- record original size, kept size, and truncation reason in metadata

The first implementation should prefer simple prefix truncation over summaries, head-tail sampling, or semantic clipping.

### Aggregate truncation and omission

If the merged fileset exceeds the aggregate turn budget:

- earlier ordered files consume the budget first
- a file that partially fits may be prefix-truncated to the remaining allowance
- later files that do not fit are omitted entirely
- each omitted file records a stable omission reason

This is intentionally predictable. The runtime must not reorder files to "fit more useful ones" unless a later design explicitly adds a priority system.

## Budgeting rules

Context fileset budgeting is a **turn-context budget**, not a replacement for broader flow or cost budgets.

It should be tracked separately and surfaced explicitly.

Minimum counters:

- `resolvedFiles`
- `includedFiles`
- `truncatedFiles`
- `omittedFiles`
- `totalIncludedChars`
- `remainingContextChars`

Required behavior:

- budget checks happen before the turn is sent to the runner
- required files may not be silently dropped because of budget pressure
- if a required file cannot be included within the enforced budget, the turn blocks with a diagnostic
- optional files may be truncated or omitted with warning diagnostics

This keeps budgeting fail-closed for mandatory context and best-effort only for optional context.

## Diagnostics

Context filesets need explicit diagnostics in the shared repo style.

The exact code set can land later, but failures should classify into the existing envelope shape:

- parse or shape diagnostics for malformed declarations
- compatibility or preflight diagnostics for unsafe, missing, unreadable, or over-budget required files
- runtime warnings for optional omissions and truncations that still allow the turn to proceed

Minimum diagnosable cases:

- unknown fileset name on a node
- duplicate fileset name at declaration time
- invalid selector shape
- unsafe path
- missing required file
- empty required glob
- unreadable required file
- unreadable optional file
- required file omitted by budget
- optional file truncated
- optional file omitted by budget

Diagnostics must identify:

- the node or turn requesting the fileset
- the fileset and selector responsible
- the normalized target path or glob pattern
- whether the failure blocked execution

## Inspectability

Operators must be able to answer which files a turn actually saw.

Minimum visible fields:

- requested filesets
- resolved file list in final order
- file-level required versus optional mode
- original size and included size
- truncation or omission reason
- aggregate budget totals

Good first surfaces:

- validate output
- rendered workflow or dry-run preview
- machine-readable run artifacts
- runtime status or debug output

The runtime should expose the manifest, not just a vague "extra context attached" flag.

## Non-goals

This design does not include:

- parse-time symbol import or DSL expansion
- fuzzy retrieval, embeddings, or ranking
- hidden transcript carry-over as a substitute for filesets
- automatic repo-wide file discovery
- binary attachment semantics
- a priority-based packing algorithm

Those belong to separate design slices if they are accepted later.

## Consequences

What this enables:

- deterministic file-backed context for `prompt` and `ask`
- bounded and auditable turn setup
- shared path-safety and diagnostics behavior across file-aware surfaces
- future flow defaults or reusable filesets without collapsing into `import`

What this constrains:

- prompt-turn context must be explicit and inspectable
- required context cannot disappear silently under budget pressure
- runtime context assembly stays separate from DSL composition semantics

## Recommended boundary

Treat context filesets as a **runtime-owned, read-only prompt-turn attachment system**.

Do not let them become:

- another spelling of `import`
- a hidden retrieval subsystem
- a back door for arbitrary workspace crawling
- a symbolic DSL composition surface

The stable boundary is:

> `import` changes the program structure at parse time; context filesets change only what a specific `prompt` or `ask` turn can read at execution time.
