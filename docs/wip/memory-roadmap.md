# Recommended Implementation Roadmap

This roadmap collapses the discussion into an actionable sequence.

## Guiding rule

Add features when they are:

- necessary
- wanted
- clearly good
- non-reductive

In other words: the test is not whether a feature is possible, but whether it strengthens Prompt Language without blurring its identity.

---

## Phase 1 - disciplined memory

These are the highest-leverage additions.

### Ship first

1. **Memory scopes**
   - initial: `run`, `project`, `shared`
   - reserve conceptual space for `user`, `agent`, and `policy`

2. **Strict and optional reads**
   - required memory must fail clearly
   - optional memory should support explicit defaults

3. **Structured memory values**
   - reuse the existing JSON/schema capture model

4. **TTL and invalidation**
   - stale memory should expire or be invalidated explicitly

5. **Transactional writes**
   - support `on="success"`, `on="approval"`, `on="checkpoint"`

6. **Checkpointing and compaction**
   - treat this as core runtime behavior, not polish

### Why this phase matters

Without these features, memory remains too flat, too easy to pollute, and too easy to trust incorrectly.

---

## Phase 2 - Markdown knowledge interop

### Ship next

1. **`knowledge:` declaration**
   - explicit Markdown knowledge sources

2. **Deterministic `section` lookup**
   - exact heading-path retrieval

3. **Readable knowledge visibility**
   - make it clear which docs and sections were loaded

4. **Trust model**
   - distinguish policy docs from lower-trust writable docs

### Why this phase matters

Markdown is already a dominant medium for agent guidance. Prompt Language should interoperate with it natively.

---

## Phase 3 - filtered recall and abstract retrieval

### Ship after the Markdown foundation

1. **Filtered recall**
   - by key
   - by prefix
   - by tag
   - by kind
   - latest N

2. **Abstract retrieval**
   - language surface should stay backend-agnostic

3. **Two retrieval modes**
   - deterministic retrieval
   - grounding retrieval

### Why this phase matters

This gives the language a retrieval story without hard-coding vector-database semantics into the DSL.

---

## Phase 4 - knowledge compilation and sync

### Ship when the core is stable

1. compile structured lessons into Markdown
2. refresh `AGENTS.md` / related docs from curated sources
3. publish distilled procedures
4. make agent guidance artifacts easier to keep current

### Why this phase matters

This turns Prompt Language into a stronger maintenance layer for agent-readable knowledge, not only an execution layer.

---

## Phase 5 - eval alignment

### Align memory and knowledge features with the evaluation layer

1. reusable judges
2. eval suites
3. baselines
4. replay
5. thesis experiments
6. regression banks built from repeated failures

### Why this phase matters

Memory and knowledge features should ultimately help:

- reduce babysitting
- reduce repeated failures
- improve repeatability
- make evaluation more meaningful

---

## What to defer

These are plausible, but should not lead the roadmap.

### Defer

1. **semantic/vector retrieval as default language semantics**
2. **shared blackboard memory**
3. **heavy episodic/semantic/procedural taxonomy**
4. **casual standalone `judge` additions**
5. **backend-specific retrieval knobs inside ordinary flows**

---

## Minimal first surface

If the project wants a very small first cut, the strongest small surface is:

- `remember`
- `recall`
- `knowledge:`
- `section`
- `checkpoint`

Everything else can initially live behind:

- config
- policies
- adapters
- CLI/tooling

---

## Acceptance tests for the roadmap

This roadmap is succeeding if it produces a system where:

1. missing critical memory fails clearly
2. stale memory is actively managed
3. Markdown guidance is easy to consume precisely
4. retrieval is inspectable
5. runtime state remains distinct from docs
6. new users can still understand the system
7. the language becomes stronger without becoming bloated
