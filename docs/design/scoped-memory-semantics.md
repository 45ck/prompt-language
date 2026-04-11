# Design: Scoped Memory Semantics

## Status

Accepted design note for `prompt-language-b8kq.1`.

Primary anchors:

- `prompt-language-b8kq.1` - scoped memory semantics: strict reads, invalidation, transactional writes
- [Memory Governance Alignment](memory-governance-alignment.md)
- [Recommended Implementation Roadmap](../wip/memory/memory-roadmap.md)
- [Prompt Language Plan Overview](../wip/memory/knowledge-plan/01-plan-overview.md)
- [Design Axes To Evaluate](../wip/memory/knowledge-plan/04-design-axes.md)
- [Recommended Adoption Order](../wip/memory/knowledge-plan/05-adoption-order.md)
- [Memory Knowledge Positioning](../wip/memory/memory-knowledge-positioning.md)
- [Proposed DSL Examples](../wip/memory/knowledge-plan/03-dsl-examples.md)
- [remember](../reference/remember.md)

This note defines the first disciplined-memory contract for the shipped `remember` and `memory:` surface. It does not introduce a second checkpoint model, and it does not collapse governance classes or Markdown retrieval into ordinary memory reads.

## Current problem

The shipped memory surface proves persistence, but not discipline:

- `remember` writes into a single flat store
- `memory:` currently treats unknown keys as silent empty strings
- write timing is immediate and not inspectable
- expiry and invalidation are not first-class
- the parser can accept memory syntax that the runtime cannot explain later

That shape is too weak for deterministic flows. The roadmap already calls for scoped memory, explicit strict versus optional reads, TTL/invalidation, and transactional writes. This note turns that direction into an accepted contract.

## Decision

Prompt Language will treat durable memory as an explicit, inspectable store with:

- initial scopes `run`, `project`, and `shared`
- required versus optional reads with fail-closed behavior for required entries
- visible TTL and invalidation state
- staged writes that commit only at explicit lifecycle boundaries
- parser, runtime, docs, and tests updated together so the semantics are real

The design keeps two boundaries intact:

- scope remains separate from governance class such as `facts`, `policy`, `wisdom`, or `scratch`
- durable memory remains separate from checkpoint/session state, even when `run` scope is supported

### Boundary with run-state and recovery artifacts

This separation is deliberate and remains in force even as the operator-shell program adds richer
run-state and recovery artifacts around `.prompt-language/session-state.json`.

- `run` scope means "durable for this run identity," not "part of the canonical runtime snapshot"
- checkpoint, restore, recovery summaries, and per-run manifests remain execution-state concerns
- memory may commit on checkpoint-aligned boundaries, but that timing does not make memory entries
  into recovery artifacts or ledger records

This keeps `prompt-language-b8kq.1` compatible with `prompt-language-f7jp.4`: scoped memory is a
separate data contract that may coordinate with recovery boundaries without collapsing into the
runtime state model.

## Scope model

### Supported scopes

- `run`
- `project`
- `shared`

### Semantics

`run`
: memory attached to the current run identity. It survives ordinary step advancement and resume within the same run, but it is not reusable by unrelated future runs. It is not a replacement for checkpoint state.

`project`
: memory reusable within the current repository or workspace. This is the compatibility home for today's unscoped memory file behavior.

`shared`
: memory reusable across project boundaries under a separately configured shared store. The DSL surface names it now even if some environments initially back it with the same adapter contract.

### Compatibility rule

Existing unscoped writes and reads remain valid, but they are interpreted as `project` scope:

- `remember key="k" value="v"` means `remember scope=project key="k" value="v"`
- `memory:` entries written as bare keys mean optional `project` reads
- `let x = memory "k"` remains a compatibility read for `project.k`

This keeps existing flows working while giving the runtime a single explicit internal model.

## Read semantics

The accepted first-class read surface is the top-level `memory:` section because it is visible before the first flow node runs.

Recommended accepted syntax:

```yaml
memory: require project.release_rule
  optional project.test_cmd default="npm test"
  optional shared.org_policy
```

### Required reads

`require <scope>.<key>` means:

- the key must exist
- the entry must not be expired
- the entry must not be invalidated
- startup fails before the first flow node if resolution fails

This failure is a runtime validation failure, not a silent empty string injection.

### Optional reads

`optional <scope>.<key>` means:

- absence is allowed
- an expired or invalidated entry is treated as absent
- if `default=...` is present, the default is injected and marked as a defaulted read
- if no default is present, no synthetic empty string is injected

This removes the current silent-empty behavior. Optional means absent is explicit, not disguised.

### Variable binding

For the `memory:` section, the injected variable name is the terminal key segment:

- `project.release_rule` binds `release_rule`
- `shared.org_policy` binds `org_policy`

If two declarations would bind the same variable name, parsing or preflight must fail with a deterministic duplicate-binding error.

### Direct read compatibility

The existing direct read form remains supported:

```yaml
let preferred_language = memory "preferred-language"
```

For this bead, it is treated as an optional `project` read with no default. Future shorthand such as explicit strict/optional direct reads may be added later, but they must resolve through the same runtime contract defined here rather than introducing a second read path.

## Write semantics

The `remember` node grows explicit scope, TTL, and write timing.

Accepted syntax direction:

```yaml
remember scope=project key="release_rule" value="Always include rollback steps"
remember scope=project key="benchmark_baseline" value="${result}" ttl="7d" on="success"
remember scope=run key="root_cause" value="${analysis.summary}" on="checkpoint"
```

### Write timing

Accepted write triggers:

- `on="write"`
- `on="success"`
- `on="approval"`
- `on="checkpoint"`

#### `on="write"`

Immediate commit at node execution time. This is the compatibility default for current `remember` behavior.

#### `on="success"`

The write is staged when the node executes and committed only when the run reaches a successful terminal state. If the run fails, is rejected, or aborts first, the staged write is discarded.

#### `on="approval"`

The write is staged when the node executes and committed only after the relevant approval boundary succeeds. If approval is denied, times out, or the run aborts before approval, the write is discarded.

#### `on="checkpoint"`

The write is staged when the node executes and committed only when the runtime durably records the next checkpoint for the run. This allows the runtime to couple memory promotion to a recovery boundary without confusing memory itself with checkpoint state.

### Transaction rule

Staged writes must not become partially visible. A write is either:

- pending and inspectable as pending
- committed and readable
- skipped or discarded with an explicit reason

There is no silent partial success.

## TTL and invalidation

### TTL

`ttl="..."` is allowed on keyed writes. The runtime stores enough metadata to compute:

- `createdAt`
- `expiresAt`
- current status: active or expired

Expired entries are never returned as active reads:

- `require` fails on expired entries
- `optional` treats expired entries as absent

Expiry is a read-time rule even if cleanup is lazy.

### Invalidation

This slice accepts invalidation as a first-class store state, even if all invalidation entry points do not ship in the same parser change.

Minimum invalidation contract:

- an entry may be marked invalidated without deleting its history
- invalidated entries record `invalidatedAt` and `reason`
- invalidated entries behave like absent values for ordinary reads
- inspectability must show whether absence was true absence, expiry, or explicit invalidation

This keeps memory auditable. "Delete and forget why" is not an acceptable invalidation model for disciplined memory.

## Inspectability contract

The runtime must expose enough information to explain what memory did.

Minimum inspectable read metadata:

- requested scope and key
- required versus optional mode
- result state: loaded, defaulted, missing, expired, or invalidated
- variable name bound into the flow

Minimum inspectable write metadata:

- scope and key
- requested timing
- current status: pending, committed, skipped, or discarded
- timestamps for creation and commit or discard
- TTL metadata when present

Inspectability must appear in runtime-owned surfaces such as status, reports, debug output, or artifacts. The exact UI can evolve, but the data contract cannot stay hidden inside the adapter.

## Parser, runtime, docs, and tests path

This bead is only complete when the contract lands across all four layers.

### Parser

`src/application/parse-flow.ts` and parser tests must validate:

- `remember scope=...`
- `remember ttl="..."`
- `remember on="write|success|approval|checkpoint"`
- `memory:` entries using `require` and `optional`
- duplicate variable binding detection
- rejection of unknown scopes or write timings

Parser acceptance alone is not enough. The parser must only accept combinations the runtime can actually enforce.

### Runtime and store

The runtime and memory-store integration must implement:

- scoped lookup and scoped writes
- required-read startup failure before the first node executes
- optional-read defaulting without silent empty-string injection
- staged writes for non-immediate triggers
- expiry and invalidation state transitions
- inspectable read and write outcomes

The existing flat `.prompt-language/memory.json` adapter may remain the first backend, but its record shape must grow to carry the accepted metadata instead of pretending all entries are equivalent.

### Docs

Reference docs must be updated together:

- `docs/reference/remember.md`
- DSL reference and cheatsheet memory sections

The docs must describe compatibility behavior explicitly so users know that old unscoped memory maps to `project` scope and that missing optional reads no longer turn into silent empty strings.

### Tests

The implementation must add or update tests across:

- parser coverage for `memory:` required and optional entries
- parser coverage for scoped `remember`, TTL, and write timing
- runtime tests for required-read failure and optional defaulting
- adapter tests for scoped persistence, expiry, and invalidation metadata
- runtime tests for staged write commit and discard behavior
- inspectability tests proving the system reports loaded, defaulted, expired, invalidated, pending, and committed states

Validation evidence for the implementation is:

- `npm run test`
- `npm run ci`

## Consequences

What this decision improves:

- missing critical memory fails loudly instead of degrading silently
- stale memory becomes visible and governable
- write timing becomes deterministic and reviewable
- current memory behavior gets a compatibility path instead of a breaking rewrite
- the later governance layer can add provenance, confidence, and class rules on top of a stable scoped-memory substrate

What this decision does not do:

- it does not make `run` scope a synonym for checkpoint state
- it does not define retrieval ranking or semantic recall
- it does not define governance-class promotion rules such as `wisdom` versus `policy`
- it does not require a second memory DSL beside `remember` and `memory:`

Summary: `prompt-language-b8kq.1` adopts explicit `run`/`project`/`shared` scopes, fail-closed required reads, explicit optional/default behavior, visible TTL and invalidation state, and transactional `remember` writes with inspectable lifecycle states. The parser, runtime, docs, and tests must ship together so scoped memory is a real deterministic contract rather than parser-only sugar.

Changed file: `docs/design/scoped-memory-semantics.md`
