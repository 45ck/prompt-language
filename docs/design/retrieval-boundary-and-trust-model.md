# Design: Retrieval Boundary and Trust Model

## Status

Accepted design target for bead `prompt-language-b8kq.4`.

Primary anchors:

- [Memory Governance Alignment](memory-governance-alignment.md)
- [Markdown Knowledge Interop](markdown-knowledge-interop.md)
- [Recommended Implementation Roadmap](../wip/memory/memory-roadmap.md)
- [Markdown, Agent Memory, and Prompt Language](../wip/memory/markdown-agent-memory.md)
- [Prompt Language: Memory, Knowledge, Markdown, and Evaluation Positioning](../wip/memory/memory-knowledge-positioning.md)
- [Source Notes](../wip/memory/memory-source-notes.md)
- [Design Axes To Evaluate](../wip/memory/knowledge-plan/04-design-axes.md)
- [Recommended Adoption Order](../wip/memory/knowledge-plan/05-adoption-order.md)

## Scope

This note owns three decisions:

- the boundary between deterministic retrieval and grounding retrieval
- the default trust levels for Markdown-backed knowledge and related memory sources
- the bounded first implementation slice that is safe to ship now

This note does not redefine:

- checkpoint, restore, compaction, or session-state behavior
- wisdom-promotion workflow or evidence requirements
- Markdown `section` lookup syntax or heading-path rules

Those remain with the adjacent accepted notes and their owning beads.

## Decision

Prompt Language should adopt an explicit retrieval split:

- **deterministic retrieval** is for control paths, required reads, and other places where the runtime must either resolve exactly or fail clearly
- **grounding retrieval** is for advisory context gathering, where multiple results, ranking, or softer matching are acceptable

Prompt Language should also adopt a default source-trust ladder:

`policy` > `project` > `user` > `run`

That ladder applies to both Markdown-backed knowledge and durable-memory sources. Storage format does not define trust by itself. A Markdown file can be high-trust policy or low-trust writable guidance; a structured memory entry can be curated project knowledge or ephemeral run output.

The bounded first slice is narrow:

- keep first-class language behavior deterministic
- surface source trust in diagnostics, rendered state, and artifacts
- defer generic grounding retrieval to adapters or later backlog work

No broader retrieval DSL is approved by this decision.

## Retrieval Boundary

## Deterministic Retrieval

Deterministic retrieval is the retrieval path for anything that can change execution outcome, validation, or approval behavior.

Its rules are:

- the target is explicit and stable
- the result set is one exact value or a deterministically ordered finite set
- failure is explicit when the target cannot be resolved
- operator-facing surfaces can show what was read and from where
- lower-trust material cannot silently override higher-trust material

Examples:

- exact memory-key reads
- deterministic file resolution from `knowledge:` declarations
- exact Markdown section lookup
- future exact filtered reads such as prefix, tag, or kind when the result rules are documented and stable

The neighboring Markdown interop note already owns `knowledge:` and `section` semantics. This note classifies them as deterministic surfaces and sets the trust rules that apply when they are used.

## Grounding Retrieval

Grounding retrieval is the retrieval path for advisory context gathering.

Its rules are:

- multiple candidates are acceptable
- ranking, keyword search, hybrid retrieval, or semantic retrieval may be used
- results help a model ground its output, but they do not become authoritative state by themselves
- results must remain inspectable enough for audit and debugging
- grounding results cannot satisfy strict required reads or replace deterministic policy lookup

Examples:

- retrieving several docs relevant to a bug or subsystem
- broad recall over project guidance or prior lessons
- adapter-backed hybrid or semantic search over Markdown and memory stores

Grounding retrieval is intentionally not a first-class core language feature in the first slice. It belongs behind adapters, config, or a later bounded retrieval surface once deterministic knowledge loading is proven.

## Trust Model

The runtime should treat source trust as a source-class property, not as a file-extension property.

Default conflict precedence is:

`policy` > `project` > `user` > `run`

An explicit flow may still choose to read a lower-trust source, but the runtime must not silently treat that source as if it were higher-trust.

| Source class | Typical examples                                                                            | Default authority                 | Mutability during normal runs                                                | Allowed deterministic use                                           | Cross-run reuse                                 |
| ------------ | ------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------- |
| `policy`     | curated policy docs, reviewed operational rules, compiled policy memory                     | authoritative                     | read-only except through explicit governance workflow                        | yes                                                                 | yes                                             |
| `project`    | repo docs, project durable memory, team procedures                                          | curated but subordinate to policy | writable only through explicit project-scoped writes or reviewed doc changes | yes                                                                 | yes                                             |
| `user`       | personal preferences, user-scoped memory, local guidance                                    | advisory                          | writable in user scope                                                       | only when the flow explicitly asks for it; never as silent policy   | yes, but only as user-scoped preference or hint |
| `run`        | run-scoped memory, transient notes, runtime-generated guidance, handoff-like scratch output | ephemeral and least authoritative | writable during the run                                                      | only inside the same run and only through explicit run-scoped reads | no                                              |

## What each level means

### `policy`

`policy` is the highest-trust layer. It exists for reviewed rules the runtime may rely on when gating behavior.

Implications:

- it may participate in deterministic control paths
- it must not be silently writable from normal execution
- lower-trust sources cannot override it without an explicit, reviewed governance step

### `project`

`project` is durable repo or team knowledge. It is important and reusable, but it is not automatically policy.

Implications:

- it may participate in deterministic retrieval when referenced explicitly
- it can supply defaults, procedures, and stable facts
- it cannot silently outrank `policy`
- writable project knowledge must remain inspectable and bounded

### `user`

`user` is personal preference and operator-specific guidance.

Implications:

- it is useful for personalization and local working style
- it should usually ground behavior rather than govern shared repository rules
- it must not silently override `project` or `policy`
- deterministic use is allowed only when the flow asks for a user-scoped value explicitly

### `run`

`run` is the freshest layer, but also the least trustworthy for reusable knowledge.

Implications:

- it may be read deterministically inside the same run when the flow writes and reads it explicitly
- it must not be treated as durable truth across runs
- it must not be promoted into project or policy authority without a separate promotion workflow
- runtime scratch, handoff-like output, and similar artifacts remain outside this note's governance scope unless explicitly promoted elsewhere

## Boundary Rules

The trust model is only useful if the runtime enforces a few hard boundaries.

### Rule 1: deterministic control paths require deterministic sources

Required reads, validation-critical context, and policy-sensitive behavior must use deterministic retrieval.

Grounding retrieval may inform a prompt, but it cannot be the hidden source of truth for:

- `require`-style reads
- policy enforcement
- completion-gate semantics
- approval routing decisions

### Rule 2: lower-trust material may inform, not silently govern

`project`, `user`, and `run` sources may add context. They do not become policy just because they were retrieved.

### Rule 3: run scope is not a loophole for durable memory

Run-scoped output, checkpoint-adjacent summaries, or scratch notes remain ephemeral unless another workflow explicitly promotes them. This note does not approve that promotion workflow.

### Rule 4: trust and storage stay orthogonal

Markdown-backed knowledge and structured memory both participate in the same trust ladder. The runtime should not assume that Markdown is advisory or that structured memory is authoritative without source metadata.

## First Bounded Implementation Slice

The first slice should stay narrow enough to implement without reopening the broader memory program.

## Approve now

1. Keep deterministic retrieval first-class through the already accepted exact surfaces:
   - explicit memory reads
   - explicit `knowledge:` source declaration
   - exact `section` lookup
2. Attach a trust class to each resolved knowledge or memory source in runtime metadata.
3. Show that trust class and source origin in validation diagnostics, rendered state, or artifacts.
4. Enforce default precedence so lower-trust sources cannot silently satisfy policy or required deterministic reads.

## Defer

- a general `retrieve` DSL for grounding retrieval
- backend-specific retrieval knobs in ordinary flows
- semantic or hybrid ranking semantics in the language core
- checkpoint/session-state trust semantics
- wisdom-promotion workflow
- Markdown section lookup details beyond the classification already settled elsewhere

## Why this is the right first slice

This slice is strong because it improves behavior without leaking backend internals into ordinary flow authoring.

It gives the runtime three immediate guarantees:

- operators can see the trust class of knowledge that influenced a run
- control paths stay exact and fail-closed
- softer retrieval remains possible later without becoming hidden policy now

## Consequences

What this clarifies:

- Prompt Language supports two retrieval modes, but only one is allowed to govern critical execution
- trust is about source class and governance, not whether the data came from Markdown or structured memory
- run-scoped or user-scoped material can still be useful without silently becoming shared policy
- deterministic Markdown interop can ship before a larger retrieval feature set

What this avoids:

- treating fuzzy retrieval as if it were a safe control-plane primitive
- collapsing checkpoint or session-state concerns into retrieval design
- silently promoting writable docs or run output into durable truth
- expanding the DSL before the exact-path and trust metadata story is stable

## Acceptance Fit

This note satisfies `prompt-language-b8kq.4` when downstream work has one stable answer to these questions:

- what counts as deterministic retrieval versus grounding retrieval
- how `policy`, `project`, `user`, and `run` sources differ in trust
- which trust levels may participate in deterministic control paths
- what the first implementation slice includes now
- what remains deferred until a later bounded retrieval or governance slice
