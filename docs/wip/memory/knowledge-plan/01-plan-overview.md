# Prompt Language Plan Overview

## Core position

Prompt Language should remain a **control-flow runtime and engineering medium**,
not drift into becoming a generic vector database DSL or opaque memory platform.

The strongest direction is:

- keep **execution, verification, approvals, and orchestration** in Prompt Language
- treat **Markdown as the human-authored knowledge layer**
- allow Markdown to also serve as **one valid long-term memory representation**
- keep **runtime state** separate from free-form docs
- keep **retrieval backend details** below the DSL
- keep **evaluation** as a higher layer than ordinary flow execution

## Layers

### 1. Execution state

Examples:

- current node
- loop counters
- pending approvals
- child-flow status
- last command output
- resumability checkpoints

This belongs in checkpointed runtime/session state.

### 2. Durable memory

Examples:

- reusable procedures
- project rules
- learned lessons
- stable preferences or constraints

This should be structured, scoped, and inspectable.

### 3. Human-authored knowledge

Examples:

- CLAUDE.md
- AGENTS.md
- README.md
- runbooks
- postmortems
- architecture docs

This should stay readable and version-controlled.

### 4. Retrieval

Examples:

- exact section lookup
- key/prefix/tag recall
- hybrid retrieval
- semantic retrieval
- reranked search

This should be exposed as an abstract capability, not as raw vector-DB internals.

### 5. Evaluation

Examples:

- judges
- rubrics
- eval suites
- baselines
- replay

This should remain a meta-layer above normal flow execution.

## Recommended additions

### Add now

- `knowledge:` declarations
- `section` exact heading lookup
- scoped `remember`
- strict/optional memory reads
- `checkpoint`
- read-only policy vs writable memory separation

### Add next

- abstract `retrieve`
- filtered recall (`tags`, `kind`, `latest N`)
- summarization / compaction
- handoff summaries
- background consolidation as runtime maintenance

### Keep out of the hot path

- vector DB tuning knobs
- backend-specific index semantics
- hidden retrieval that silently controls flow
- overly heavy memory taxonomies

## Guiding principle

A feature fits Prompt Language if it helps engineers express:

- goals
- constraints
- workflows
- verification
- approvals
- reusable wisdom
- recovery logic
- bounded coordination

A feature does **not** fit well if it mainly exposes backend mechanics or adds hidden statefulness to ordinary flows.
