# Recommended Implementation Roadmap

This roadmap collapses the discussion into an actionable sequence.

## Guiding rule

Add features when they are:

- necessary
- wanted
- clearly good
- non-reductive

In other words: the test is not whether a feature is possible, but whether it strengthens Prompt Language without blurring its identity.

## Boundary rule

Checkpointing, resumability, handoff summaries, and compaction are **runtime/session-state responsibilities**.

Durable memory is separate:

- memory stores reusable facts, procedures, and lessons
- checkpoints store resumable execution position and related runtime state
- handoff summaries explain a run boundary to a later human or agent
- compaction reduces active context pressure for the current run

Those features interact, but they should not be modeled as one generic memory bucket.

## Responsibility split

| Concern             | Primary owner             | Why                                                                    |
| ------------------- | ------------------------- | ---------------------------------------------------------------------- |
| Execution position  | session state             | Must resume deterministically                                          |
| Pending approvals   | session state             | A checkpoint must know whether the run is blocked                      |
| Retry/loop counters | session state             | These are in-flight control-flow facts, not reusable knowledge         |
| Child status/inbox  | session state             | Needed for `spawn`/`await` recovery and handoff                        |
| Handoff summary     | session state or artifact | It is a restart/review aid, not automatically trusted long-term memory |
| Compaction summary  | session state             | It exists to rehydrate active context after compaction                 |
| Durable lessons     | memory store              | These are cross-run reusable facts with provenance and invalidation    |
| Project rules       | memory store or Markdown  | They may be reused across runs, but should be explicit and inspectable |

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

### Why this phase matters

Without these features, memory remains too flat, too easy to pollute, and too easy to trust incorrectly.

---

## Phase 2 - checkpoint and handoff boundary alignment

### Align next, but under runtime ownership

1. **Checkpoint semantics**
   - capture execution/session state, not the entire durable memory store by default

2. **Restore semantics**
   - restore runtime state, workspace files, or both according to runtime policy

3. **Handoff summaries**
   - derive restart/review context from session state and execution events

4. **Compaction summaries**
   - preserve the minimum active run context needed after host compaction

5. **Explicit promotion into durable memory**
   - only write to durable memory when a checkpoint/success/approval policy says to promote a validated lesson

### Why this phase matters

Without this boundary, the repo grows two overlapping checkpoint models: one in memory docs and one in runtime/replay work.

---

## Phase 3 - Markdown knowledge interop

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

## Phase 4 - filtered recall and abstract retrieval

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

## Phase 5 - knowledge compilation and sync

### Ship when the core is stable

1. compile structured lessons into Markdown
2. refresh `AGENTS.md` / related docs from curated sources
3. publish distilled procedures
4. make agent guidance artifacts easier to keep current

### Why this phase matters

This turns Prompt Language into a stronger maintenance layer for agent-readable knowledge, not only an execution layer.

---

## Phase 6 - eval alignment

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

Everything else can initially live behind:

- config
- policies
- adapters
- CLI/tooling

`checkpoint` still matters, but it belongs in the runtime/replay track rather than the durable-memory MVP.

---

## Existing backlog mapping

This roadmap should map onto existing backlog rather than create a second recovery track.

| Area                                        | Existing backlog                               | Role in the chosen model                                                             |
| ------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| Durable memory semantics                    | `prompt-language-7g58`, `prompt-language-b8kq` | Memory scopes, reads, writes, TTL, promotion rules                                   |
| Strict recovery and checkpoint semantics    | `prompt-language-zhog.1`                       | Fail-closed restore behavior, approval/review timeout behavior, checkpoint semantics |
| Replay, event log, snapshots, and reports   | `prompt-language-zhog.3`                       | Append-only execution history, restore/replay tooling, checkpoint capture/restore    |
| Compact-render recovery safety              | `prompt-language-0ovo.5` and children          | Fallback behavior around resume, compaction, and risky recovery paths                |
| Older resume-state implementation fragments | `prompt-language-5syc`, `prompt-language-ea5a` | Session-state recovery details, not a competing memory model                         |

No new follow-up beads are required for this decision as long as future work lands under those existing tracks.

---

## Acceptance tests for the roadmap

This roadmap is succeeding if it produces a system where:

1. missing critical memory fails clearly
2. stale memory is actively managed
3. checkpoints and restore operate on session state rather than a vague memory blob
4. handoff summaries are useful without being mistaken for trusted memory
5. compaction pressure does not silently rewrite durable memory semantics
6. Markdown guidance is easy to consume precisely
7. retrieval is inspectable
8. runtime state remains distinct from docs
9. new users can still understand the system
10. the language becomes stronger without becoming bloated
