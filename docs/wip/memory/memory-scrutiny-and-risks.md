# Scrutiny and Risks: Revisions to the Memory + Markdown Direction

This document captures the critical review of the draft positioning memo and tightens the proposal where it was too broad, too optimistic, or missing failure modes.

## High-level verdict

The direction is mostly right.

The main split between:

- short-term execution state
- long-term memory
- knowledge sources
- evaluation

is sound.

But several parts need revision to better match how current agent systems actually behave.

---

## 1. Markdown was framed too narrowly

The original memo treated Markdown mostly as the **human-authored knowledge layer**.

That is incomplete.

In modern agent systems, Markdown is often also used as an **active memory substrate**:

- instruction files
- imported policy files
- project-specific agent memory
- on-demand loaded skill files
- writable memory files for agents or users

### Correction

The stronger claim is:

> Markdown is both a knowledge layer and one valid long-term-memory representation.

What still should **not** live primarily in Markdown:

- ephemeral runtime state
- execution checkpoints
- loop counters
- approval queues
- structured machine state that requires strict guarantees

---

## 2. The security model needs to be explicit

If agents can write shared memory or shared Markdown and later agents consume it, then memory becomes a prompt-injection and instruction-poisoning surface.

That is not an implementation footnote. It is a core design concern.

### Correction

The design should explicitly model:

- read-only shared policy/docs
- read-write run memory
- read-write user or agent memory
- approval or policy gates before shared-memory writes
- trust levels for memory sources

Suggested trust model:

- `policy` - curated, read-only, highest trust
- `project` - shared but versioned, medium trust
- `user` - personalized, writable, lower trust
- `run` - ephemeral, lowest trust

This can exist even if not all scopes are shipped immediately.

---

## 3. The scope model is too repo-centric

The original memo recommended starting with:

- `run`
- `project`
- `shared`

That is clean for an MVP, but it risks implying that project scope is the whole problem.

Real agent memory systems often revolve around:

- user-specific memory
- agent-specific memory
- org or policy memory

### Correction

For implementation, a smaller initial surface is fine.

For design, the doc should reserve conceptual space for:

- `run`
- `project`
- `user`
- `agent`
- `policy` or `org`

This keeps the model extensible without forcing all scopes into the first release.

---

## 4. Checkpointing and compaction were placed too late

The original roadmap treated checkpoints and handoffs as a later improvement.

That likely understates their importance.

Checkpointing and compaction are not nice-to-haves. They are part of what keeps a runtime stable, resumable, and cost-bounded.

Without them:

- context grows
- model focus degrades
- costs increase
- stale working state accumulates
- long runs become more fragile

### Correction

Move these earlier:

- explicit checkpoints
- resumable handoff summaries
- memory/session compaction
- on-demand loading of larger knowledge artifacts

These should be treated as core runtime behavior, not polish.

That does **not** mean they should become durable-memory semantics. It means the runtime must own them clearly enough that the memory proposal does not sprout a second restore model.

---

## 5. The retrieval stance should be more nuanced

The original memo correctly resisted turning vector search into core language semantics.

That part stands.

But the memo risked sounding as if exact lookup alone is the preferred retrieval story.

That is too restrictive.

Current systems increasingly use:

- keyword search
- structure-aware retrieval
- semantic retrieval
- hybrid retrieval
- reranking

### Correction

The language should likely expose two distinct retrieval modes:

### A. deterministic retrieval

Used for control paths and critical execution.

Examples:

- exact key lookup
- exact section lookup
- file path lookup
- prefix/tag filtering

### B. grounding retrieval

Used for soft context gathering.

Examples:

- hybrid search
- semantic search
- reranked retrieval
- broader document recall

That split is stronger than simply saying "retrieval is an adapter concern."

---

## 6. The memo should state that Markdown guidance is not authoritative by default

This is a major clarity issue.

A Markdown file can influence an agent without being enforceable.

That means readers may confuse:

- readable guidance
- soft instruction
- hard runtime policy
- enforced gating

### Correction

Add a blunt rule:

> Markdown guidance is advisory until compiled into hard gates, approvals, policies, or stateful runtime behavior.

This protects the runtime's identity and prevents overclaiming what docs alone can do.

## 6a. Handoff summaries are not automatically durable memory

A handoff summary is useful, but it is easy to over-trust.

If the runtime writes a summary such as "auth fix isolated to middleware ordering," that summary may be:

- incomplete
- stale
- scoped only to one run
- contradicted by later evidence

### Correction

Treat handoff as a restart/review artifact first:

- derive it from session state and recent execution history
- show it in status, watch, or artifacts
- only promote parts of it into durable memory through explicit validated writes

## 6b. Compaction and memory compaction must stay separate

There are two different operations that can otherwise blur together:

- **runtime/context compaction**: reduce active context pressure while preserving enough state to continue the current run
- **memory curation**: expire, invalidate, merge, or prune durable memory entries over time

### Correction

Use different language and different mechanisms:

- compaction summarizes current run context
- TTL, invalidation, and curation manage durable memory quality
- do not treat compaction as permission to rewrite or silently compress trusted memory

---

## 7. There is real DSL creep risk

The draft started pulling in:

- memory scopes
- structured memory
- knowledge sources
- retrieval
- checkpoints
- evals
- judges
- knowledge compilation

Each one is defensible. Together they can become a bloated surface.

### Correction

Keep the first surface area tight.

A strong minimal set is:

- `knowledge:`
- `section`
- `remember`
- `recall`
- `checkpoint`

Then let:

- backends
- policies
- config
- tooling

carry the heavier storage and retrieval complexity.

---

## 8. `judge` should not be added casually

The original critique already caught this, but it is important enough to repeat.

The runtime already has:

- `ask`
- `review`
- `grounded-by`
- structured capture
- a larger proposed eval/judge design

So adding a lightweight new judge primitive ad hoc would create naming duplication and conceptual overlap.

### Correction

If `judge` lands, it should land as part of the broader evaluation layer, not as an isolated convenience feature.

---

## 9. Strict memory reads are even more important than they first appeared

One of the most concrete flaws in the current model is silent failure or silent fallback behavior around memory.

A system emphasizing determinism should not let missing critical memory degrade quietly.

### Correction

Promote this higher in the roadmap.

Examples:

```yaml
memory: require project.release_rule
  optional project.test_cmd default="npm test"
```

or

```yaml
let release_rule = memory! "project.release_rule"
```

This is higher leverage than many advanced memory features.

---

## 10. Transactional memory writes are essential

This should be treated as a core correctness feature.

Without transactional or gated writes, a failed run can leave behind bad lessons that later runs trust.

### Correction

Support memory-write policies such as:

- write immediately
- write on success
- write on approval
- write on checkpoint

This keeps durable memory closer to validated memory.

## 11. The repo must not grow two checkpoint models

The biggest planning risk is duplication:

- memory docs talk about checkpoints, handoffs, and compaction
- runtime/vNext docs talk about checkpoints, restore, event logs, and replay

Without an explicit boundary, those strands diverge.

### Correction

Adopt one model:

- checkpoint/restore semantics live with runtime/session-state and replay work
- durable memory integrates through explicit read/write/promotion policies
- handoff summaries are runtime outputs that may become artifacts
- existing backlog should absorb the implementation, rather than opening a second checkpoint epic under memory

---

## Revised recommendation

### Add now

1. memory scopes
2. strict reads
3. structured memory values
4. TTL and invalidation
5. transactional writes
6. Markdown knowledge interop
7. explicit boundary docs for checkpoints, handoff, and compaction

### Add next

1. checkpoint/restore implementation under runtime ownership
2. handoff and compaction summaries in watch/status tooling
3. filtered recall
4. deterministic section addressing
5. abstract retrieval surface
6. knowledge sync/compilation

### Defer

1. semantic/vector retrieval as a default language semantic
2. blackboard memory
3. heavy memory taxonomy
4. casual inline judge additions

## Backlog mapping

The chosen model maps to backlog like this:

| Concern                                   | Backlog                                        |
| ----------------------------------------- | ---------------------------------------------- |
| Durable memory semantics and positioning  | `prompt-language-b8kq`, `prompt-language-7g58` |
| Strict checkpoint/restore behavior        | `prompt-language-zhog.1`                       |
| Event log, snapshots, replay, reports     | `prompt-language-zhog.3`                       |
| Recovery-safe compaction fallback         | `prompt-language-0ovo.5` and children          |
| Older resume-state implementation details | `prompt-language-5syc`, `prompt-language-ea5a` |

---

## Final judgment

The direction remains strong if Prompt Language becomes:

- more stateful
- more inspectable
- more precise about memory
- better at using Markdown
- clearer about what is advisory vs enforced

The direction weakens if it becomes:

- a generic memory system
- a vector-database DSL
- an overgrown language with too many storage concepts
- a system that treats readable docs as if they were automatically authoritative
