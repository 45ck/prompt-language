# Prompt Language: Memory, Knowledge, Markdown, and Evaluation Positioning

## Status

Draft design memo for the Prompt Language project.

This document consolidates the current thinking on:

- what Prompt Language already is
- how memory should fit into the language
- how Markdown should fit into the system
- where evaluation and judges belong
- what to add now, later, or not at all

---

## Executive summary

Prompt Language should remain a **control-flow runtime for bounded engineering work**, not drift into becoming a generic vector database DSL, note-taking system, or opaque agent-memory platform.

The strongest direction is:

- keep **execution, verification, state, approvals, and orchestration** in Prompt Language
- treat **Markdown as the human-authored knowledge layer**
- treat **retrieval as an adapter/backend concern**
- keep **runtime state and durable machine-readable memory** separate from free-form docs
- expand memory only in ways that improve **determinism, inspectability, and repeatability**

The language already has a strong base: persistent state, `remember`, `memory:`, structured capture, `ask`, `review`, approvals, imports, `spawn`/`await`, and messaging. The next step is not "more memory everywhere." The next step is **disciplined memory and knowledge integration**.

---

## What Prompt Language is today

Prompt Language is best understood as a runtime that wraps coding agents with:

- deterministic control flow
- real completion gates
- persistent state
- structured capture
- bounded repair loops
- parallel orchestration
- human approval checkpoints

That framing matters. It protects the project from becoming a vague "agent platform" and keeps the differentiator clear: **the runtime handles supervision instead of the human doing it manually**.

---

## Current shipped surface relevant to this discussion

The current surface already includes the key primitives needed for memory and evaluation foundations:

### Memory and state

- `remember`
- `memory:` prefetch
- keyed reads from persistent memory
- persistent session state across runs

### Structured data

- structured prompt capture via JSON + schema validation
- captured values reused through variables and interpolation

### Subjective and evaluative control

- `ask` for subjective true/false conditions
- `review` for generator-evaluator repair loops
- `grounded-by` to connect judgments to evidence

### Orchestration

- `spawn` / `await`
- `send` / `receive`
- `foreach-spawn`
- `race`
- imports and reusable flow libraries

This means the project is **not missing memory entirely**. It is missing a more disciplined model for how memory, knowledge, retrieval, and evaluation should relate.

---

## Core design thesis

Prompt Language should use the following layered model.

### Layer 1: Execution state

This is the current working state of a run.

Examples:

- current node
- loop counters
- pending approvals
- child-flow status
- last command output
- resumability checkpoints

This belongs in **session state**, not Markdown docs and not free-form long-term memory.

### Layer 2: Durable memory

This is machine-readable knowledge the runtime may reuse across runs.

Examples:

- learned procedures
- durable project rules
- prior lessons
- stable environment facts

This belongs in a structured memory store.

### Layer 3: Human-authored knowledge

This is the readable guidance layer.

Examples:

- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- architecture docs
- troubleshooting docs
- playbooks
- postmortems

This should remain primarily **Markdown-authored**.

### Layer 4: Retrieval

This is the mechanism for finding relevant knowledge.

Examples:

- exact lookup
- section addressing
- tag filters
- hybrid search
- vector search
- reranking

This should be an **adapter concern**, not the center of the language.

### Layer 5: Evaluation

This is the quality measurement layer.

Examples:

- regression suites
- judges
- rubrics
- baseline comparison
- replay and artifacts

This belongs above normal execution, not hidden inside ordinary completion semantics.

---

## The key positioning decision

## Boundary decision: checkpointing is not durable memory

The repo needs one clear model:

- **session state** owns resumability, current execution position, pending approvals, retry progress, child status, and compaction summaries
- **durable memory** owns curated reusable facts, procedures, and lessons with provenance
- **handoff summaries** are restart/review aids derived from session state and recent execution history
- **Markdown knowledge** is readable guidance, not implicit resume state

That means checkpoints, restore, handoff, and compaction are runtime behaviors first. They may read from memory and may promote validated outputs into memory, but they are not just memory aliases.

## Responsibility matrix

| Concern                      | Default storage           | Why                                                                |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------ |
| Current node / flow position | session state             | Must restore the exact next execution point                        |
| Loop/retry counters          | session state             | In-flight control facts are not durable lessons                    |
| Pending approval             | session state             | Approval state is run-specific and must fail closed                |
| Child inbox/outbox status    | session state             | Needed for multi-agent recovery and `await` correctness            |
| Compaction summary           | session state             | It exists to restore active context after host compaction          |
| Handoff summary              | session state or artifact | It is a readable boundary object, not automatically trusted memory |
| Stable procedure             | durable memory            | Reusable across runs if validated and still current                |
| Stable project fact          | durable memory            | Reusable, inspectable, and able to be invalidated                  |
| Policy/guidance doc          | Markdown knowledge        | Human-authored source of guidance and review context               |

### Prompt Language should not become "Markdown plus vector search"

Yes, modern agent systems heavily use Markdown instruction files and Markdown knowledge bases. Yes, many systems parse, chunk, and index Markdown for retrieval.

That does **not** imply that Prompt Language should reduce itself to:

- Markdown-only memory
- fuzzy retrieval as the primary control mechanism
- vector search baked into core language semantics

That would weaken the project's determinism and make critical control flow more opaque.

### Prompt Language should sit above Markdown

The better model is:

- Markdown is the **authoring and knowledge layer**
- Prompt Language is the **executable, stateful, verifiable orchestration layer**
- retrieval is how Prompt Language can consult Markdown and other stores when needed

This preserves the best property of Markdown, readability and editability, without forcing operational state and runtime guarantees into a loose document format.

---

## Scrutiny of earlier proposals

## What survives scrutiny

### 1. Memory scopes

This is one of the strongest additions.

The current memory model is effectively too flat for serious multi-flow or multi-agent use. Scope is needed to prevent pollution and accidental reuse.

Recommended initial scopes:

- `run`
- `project`
- `shared`

Do **not** start with a huge ontology such as `task`, `branch`, `workspace`, `user`, and `agent` unless real usage clearly justifies them.

### 2. Typed memory

This is good, but it should reuse the existing structured capture model.

Prompt Language already has a JSON/schema path for turning model output into validated structure. Memory should reuse that machinery instead of inventing a second type system.

### 3. TTL and invalidation

This is necessary.

A persistent memory store without expiration or invalidation will eventually become a stale-hints cache. That is worse than having less memory.

### 4. Strict memory reads

This is higher priority than many advanced features.

Missing memory should not silently degrade critical execution paths.

The language needs a way to distinguish:

- required memory
- optional memory
- optional memory with defaults

### 5. Transactional memory writes

Not every learned fact should be committed immediately.

Some memories should be written only when:

- a run succeeds
- gates pass
- approval is granted
- a checkpoint is reached
- a strict review passes

This reduces fossilized bad lessons from failed or half-complete runs.

This also gives checkpoints a clean role: a checkpoint may be the trigger that promotes a validated lesson, but the checkpoint itself still belongs to execution state.

### 6. Markdown knowledge interop

This is important and consistent with current agent practice.

Prompt Language should work well with:

- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `docs/**/*.md`

But it should treat them as knowledge sources, not as the sole runtime state store.

---

## What needs revision

### 1. Provenance is good; numeric confidence is weak

Memory entries should carry concrete metadata such as:

- `source`
- `created_at`
- `verified_by`
- `expires_at`
- `tags`

Numeric confidence scores should not be central. They create false precision and are usually less useful than explicit verification and provenance.

### 2. Retrieval is needed, but semantic recall should not be the default

The system needs better retrieval than exact one-key-at-a-time reads. However, the first retrieval modes should be predictable:

- by key
- by prefix
- by tag
- by kind
- latest N
- exact section path

Semantic/vector-style retrieval should exist only as an adapter-backed capability, not as the primary retrieval semantic for the language core.

### 3. Checkpoints belong closer to session state than memory

Checkpointing, resumability, and handoff summaries are useful, but they should be modeled as execution-state features rather than just more long-term memory writes.

Memory and checkpoints are related but not the same.

The same rule applies to compaction: compaction should summarize active execution context for restart, not silently rewrite the durable memory model.

---

## What should be deferred or avoided

### 1. Do not add a casual `judge` primitive without alignment

The project already has:

- `ask`
- `review`
- structured capture
- a WIP design direction for evals and judges

So the right move is not to bolt on an ad hoc new primitive. Evaluation and judges should align with the existing larger design:

- deterministic `done when:` remains separate
- evals become the meta-layer
- judges are reusable components, not hidden completion gates

### 2. Do not bake vector-database semantics into the DSL

Avoid language design that directly exposes specific backend mechanics.

Bad direction:

- vector index syntax in core flows
- backend-specific knobs in ordinary control flow
- embedding models becoming part of normal runtime logic

Good direction:

- abstract retrieval declarations
- adapter-backed implementation
- deterministic modes for critical paths

### 3. Do not store all runtime state in Markdown

Markdown is excellent for readable guidance and docs. It is not a strong substrate for:

- loop counters
- approval queues
- process status
- structured machine state
- child-flow runtime coordination

### 4. Do not overformalize memory taxonomy too early

Concepts like episodic, semantic, and procedural memory are useful intellectually, but they should probably begin as metadata or light classification, not heavyweight core syntax.

---

## Proposed design principles

1. **Determinism first**  
   Critical execution should prefer exact lookup, explicit state, and hard gates over fuzzy recall.

2. **Readable knowledge, structured state**  
   Keep human guidance readable in Markdown; keep machine state and durable memory structured.

3. **Memory must be inspectable**  
   Any memory read or write that affects behavior should be visible in status, watch mode, or run artifacts.

4. **Retrieval is not truth**  
   Retrieval helps find context. It does not replace authoritative state or deterministic checks.

5. **Evaluation is a layer, not a side effect**  
   Evals and judges should live at the experiment and quality layer, not silently inside ordinary flow completion.

6. **Prefer small composable mechanisms**  
   Add a few disciplined primitives rather than one giant memory subsystem.

7. **Do not punish simple use cases**  
   The first-time user should still be able to understand and use Prompt Language without learning a complex ontology.

---

## What to add now

## 1. Memory scopes

Recommended syntax direction:

```yaml
remember scope=project key="release_rule" value="Always include rollback steps"
remember scope=run key="root_cause" value="${analysis.summary}"
```

Initial supported scopes:

- `run`
- `project`
- `shared`

## 2. Strict and optional memory reads

Recommended syntax direction:

```yaml
memory: require project.release_rule
  optional project.test_cmd default="npm test"
```

Or:

```yaml
let release_rule = memory! "project.release_rule"
let test_cmd = memory? "project.test_cmd" default "npm test"
```

## 3. Structured memory values

Recommended syntax direction:

```yaml
let contract = prompt "Summarize the API contract" as json {
  endpoint: string
  auth: string
  version: string
}

remember scope=project key="api_contract" value=${contract}
```

This should reuse the existing structured-capture machinery.

## 4. TTL and invalidation

Recommended syntax direction:

```yaml
remember scope=project key="benchmark_baseline" value="${result}" ttl="7d"
invalidate key="api_contract" when file_changed "openapi.yaml"
```

## 5. Transactional memory writes

Recommended syntax direction:

```yaml
remember scope=project key="migration_rule"
value="Always write forward and rollback SQL"
on="success"
```

Possible triggers:

- `on="write"`
- `on="success"`
- `on="approval"`
- `on="checkpoint"`

## 6. Markdown knowledge sources

Recommended syntax direction:

```yaml
knowledge: source "./AGENTS.md"
  source "./docs/**/*.md"
```

This should be a declaration of readable knowledge inputs, not an instruction to necessarily embed or vectorize everything.

## 7. Deterministic section addressing for Markdown

Recommended syntax direction:

```yaml
let testing_rules = section "AGENTS.md#Testing instructions"
let deploy_notes = section "docs/runbooks/deploy.md#Rollback"
```

This is one of the strongest Markdown features because it is inspectable and reliable.

---

## What to add next

## 1. Filtered recall

Recommended capabilities:

- recall by key
- recall by prefix
- recall by tag
- recall by kind
- latest N

Example:

```yaml
let lessons = recall scope=project tags="auth,tenant" latest 5
```

## 2. Checkpoints and handoffs

These should build on session state rather than only on long-term memory.

Possible syntax:

```yaml
checkpoint "after_red_phase"
handoff summary="Current failing tests isolated to auth middleware"
```

Recommended semantics:

- checkpoint captures execution/session state, with optional file snapshots where policy requires them
- restore restores execution/session state, files, or both
- handoff emits a readable restart/review summary
- none of those actions implicitly commit new durable memory unless an explicit promotion policy fires

## 3. Retrieval adapters

Allow optional hybrid or semantic retrieval from declared knowledge sources, but keep it behind a clear abstraction.

Example:

```yaml
let context = retrieve from "docs" query="tenant isolation failures" top 5
```

The runtime can then map this to local grep, section lookup, hybrid retrieval, or vector-backed retrieval depending on configuration.

## 4. Knowledge compilation / sync

Prompt Language projects should be able to emit or update curated Markdown guidance artifacts.

Examples:

- refresh `AGENTS.md`
- compile `wisdom.flow` into readable markdown
- publish stable procedures from structured memory into docs

This would make Prompt Language stronger as a system that both **uses** and **maintains** agent-facing knowledge.

---

## What to defer

## 1. Full semantic/vector retrieval as a first-class core semantic

Defer until there is a clean abstraction and real demand.

## 2. Shared blackboard memory

Useful for advanced multi-agent systems, but lower priority than disciplined scope, strict reads, invalidation, and Markdown interop.

## 3. Heavy formal memory taxonomy

Defer hard-coded episodic/semantic/procedural syntax. Begin with tags or light metadata.

## 4. Inline ordinary-flow judge explosion

Keep ordinary execution simple. Put eval sophistication into the evaluation layer.

---

## Relationship to evals and judges

The project already has a strong direction available for evals and judges: reusable rubrics, reusable judges, suite execution, comparisons, replay, and stricter review modes.

This is the correct direction.

The memory and Markdown work proposed here should **support** that direction, not compete with it.

### The correct separation

- `done when:` = deterministic completion
- `ask` / `review` = bounded local judgment and repair
- `eval` = dataset and experiment runner
- `judge` = reusable evaluator definition
- memory = reusable durable facts/procedures/lessons
- Markdown knowledge = human-readable guidance and source material

This keeps the system comprehensible.

---

## Non-goals

This design does **not** aim to make Prompt Language:

- a generic vector database DSL
- a notebook or PKM system
- a universal agent memory platform
- a Markdown-only operating substrate
- an opaque self-modifying reasoning engine

The goal is narrower and stronger:

> Prompt Language should be the executable, verifiable, stateful layer that sits above agent prompts and below ad hoc human babysitting.

---

## Why Markdown still matters a lot

Markdown has become the common human-authored surface for agent guidance because it is:

- readable
- diffable
- version-controlled
- portable
- composable across repos

Prompt Language should lean into that reality.

The right response is not to replace Markdown. It is to make Prompt Language interoperate with Markdown extremely well while preserving stronger runtime semantics for:

- control flow
- verification
- durable state
- approvals
- replay
- experiments

---

## Acceptance criteria for this direction

This design is succeeding if:

1. users can store durable lessons without memory pollution
2. missing memory fails clearly when it matters
3. Markdown docs can be referenced precisely and usefully
4. retrieval remains inspectable and does not silently replace deterministic control
5. normal flows stay understandable for new users
6. evals and judges remain a higher-level quality layer
7. the language's identity as a runtime becomes clearer, not blurrier

---

## Recommended roadmap

## Phase 1 - disciplined memory

Ship:

- memory scopes
- strict/optional reads
- structured memory values
- TTL/invalidation
- transactional writes

## Phase 2 - Markdown knowledge interop

Ship:

- `knowledge:` sources
- section addressing
- exact and filtered recall from Markdown knowledge

## Phase 3 - checkpoint and handoff runtime alignment

Ship:

- explicit checkpoints
- resumable handoff summaries
- visibility in watch/status tooling

Important boundary:

- these remain runtime/session-state features
- durable memory receives only explicit promoted outputs
- replay/event-log ownership stays with the runtime/replay backlog, not the memory DSL

## Phase 4 - retrieval adapters

Ship:

- abstract retrieval surface
- adapter-backed implementations
- optional hybrid/semantic retrieval modes where useful

## Phase 5 - eval alignment

Align memory and knowledge features with:

- reusable judges
- eval suites
- baselines
- replay
- thesis experiments

---

## Example combined direction

```yaml
Goal: fix the auth regression safely

knowledge:
  source "./AGENTS.md"
  source "./docs/**/*.md"

memory:
  require project.release_rule
  optional project.test_cmd default="npm test"

flow:
  let auth_guidelines = section "AGENTS.md#Authentication rules"

  let contract = prompt "Summarize the auth contract and expected behavior" as json {
    endpoint: string
    auth: string
    failure_mode: string
  }

  prompt: |
    Use these authentication rules:
    ${auth_guidelines}

    Fix the regression without changing intended behavior.

  run: ${test_cmd}

  remember scope=project key="last_auth_contract"
    value=${contract}
    on="success"
    ttl="30d"

done when:
  tests_pass
  lint_pass
```

This is the kind of direction that strengthens the language without turning it into something else.

---

## Final recommendation

Prompt Language should evolve toward **disciplined memory + strong Markdown interop + adapter-backed retrieval + first-class evaluation**, while preserving its identity as a deterministic runtime for bounded engineering workflows.

The project should not try to win by becoming a generic memory system.

It should win by making agent work:

- more controlled
- more repeatable
- more inspectable
- less dependent on manual supervision

That is the strongest path forward.
