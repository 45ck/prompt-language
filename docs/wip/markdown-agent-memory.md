# Markdown, Agent Memory, and Prompt Language

This document captures the part of the discussion focused on Markdown.

## Why Markdown matters

Markdown is now one of the dominant human-authored surfaces for agent systems because it is:

- readable
- diffable
- version-controlled
- portable
- easy to compose across repos and teams

Instruction files, runbooks, architecture notes, and agent guidance are frequently written in Markdown.

That means Prompt Language should not fight Markdown. It should interoperate with it extremely well.

---

## The wrong conclusion

It would be easy to jump from "Markdown is heavily used by agents" to:

> Prompt Language should just become Markdown plus vector search.

That is the wrong move.

If Prompt Language becomes:

- a Markdown-only runtime substrate
- a vector-search-first control plane
- a free-form doc interpreter for critical execution

then it loses too much of what makes it distinct:

- deterministic control flow
- hard completion gates
- explicit runtime state
- approvals
- reproducibility
- inspectability

---

## The stronger conclusion

The better architecture is:

- Markdown = human-authored knowledge and one valid long-term-memory representation
- Prompt Language = executable, verifiable, stateful orchestration layer
- retrieval = how Prompt Language consults Markdown and other stores when needed
- structured storage = where strict runtime state and durable machine-readable memory live

This lets each layer do what it is good at.

---

## What Markdown is good for

Markdown is strong for:

- shared guidance
- instructions to agents
- architecture overviews
- playbooks
- postmortems
- policies
- curated lessons
- skills and procedures
- human review and version control

It is especially strong when information benefits from headings and structure.

That makes section-based retrieval one of the strongest interop opportunities.

---

## What Markdown is weak for

Markdown is weak for:

- strict runtime state
- approval queues
- counters and machine lifecycle
- complex typed machine state
- ephemeral execution context
- authoritative control semantics by itself

A Markdown file can influence an agent without actually enforcing anything.

That means Markdown should not be treated as equivalent to runtime policy.

### Rule

> Markdown guidance is advisory until compiled into hard gates, approvals, policies, or stateful runtime behavior.

---

## Recommended Markdown interop surface

## 1. Knowledge sources

Prompt Language should be able to declare Markdown knowledge inputs explicitly.

Example:

```yaml
knowledge: source "./AGENTS.md"
  source "./CLAUDE.md"
  source "./docs/**/*.md"
```

This does not force one retrieval method. It declares where knowledge may come from.

## 2. Deterministic section lookup

This is one of the strongest Markdown-native capabilities.

Example:

```yaml
let auth_rules = section "AGENTS.md#Authentication rules"
let rollback_notes = section "docs/runbooks/deploy.md#Rollback"
```

This is inspectable, debuggable, and aligned with how humans structure docs.

## 3. Filtered or soft retrieval

Prompt Language should also have a softer retrieval path for grounding.

Example:

```yaml
let context = retrieve from "docs" query="tenant isolation failures" top 5
```

The runtime can then choose grep, structure-aware search, hybrid retrieval, or semantic retrieval depending on configuration.

The key is: retrieval remains abstract at the language layer.

## 4. Knowledge compilation and sync

Prompt Language should not only consume Markdown. It may also benefit from producing or updating it.

Examples:

- refresh `AGENTS.md`
- publish distilled procedures from structured memory
- compile `wisdom.flow` into readable Markdown
- maintain curated guidance files derived from repeated lessons

This would make Prompt Language stronger as a system that both **uses** and **maintains** human-readable agent knowledge.

---

## Retrieval split: deterministic vs grounding

The cleanest model is:

### deterministic retrieval

Used for critical execution paths.

Examples:

- exact section lookup
- exact key lookup
- file path lookup
- tag/prefix filtering

### grounding retrieval

Used for soft context gathering.

Examples:

- semantic search
- hybrid search
- reranked retrieval
- broader document recall

This keeps critical control flow stable while still allowing modern retrieval techniques where they are useful.

---

## Markdown and memory

Markdown should be treated as:

- a knowledge layer
- a writable memory representation in some cases
- a shared reviewable medium

But not as the only memory model.

A healthy split is:

- Markdown for readable shared knowledge and some durable memory artifacts
- structured memory for typed durable values
- session state for execution state
- retrieval adapters for lookup and grounding

---

## Security implications

Once writable Markdown becomes part of the memory model, it becomes a trust surface.

That means the design should explicitly distinguish:

- read-only policy docs
- shared knowledge docs
- user-writable or agent-writable memory docs
- runtime-generated summaries

These should not all have the same trust level.

---

## Final recommendation

Prompt Language should lean into Markdown hard, but in the right role.

It should become excellent at:

- consuming Markdown
- indexing or retrieving from Markdown through adapters
- addressing Markdown sections deterministically
- syncing structured lessons into Markdown when useful

It should **not** become:

- a Markdown-only runtime
- a fuzzy-document execution engine
- a vector-search-first control language

The win is in combining Markdown's readability with Prompt Language's runtime discipline.
