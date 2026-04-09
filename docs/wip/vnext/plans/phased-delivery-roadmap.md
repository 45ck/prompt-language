# Phased delivery roadmap

## Principle

Ship vertical slices that each increase trust or reduce babysitting in measurable ways. Do not front-load abstract framework work unless it directly unlocks safety, replay, or boundedness.

## Phase 0 — Foundations for trusted execution (4–6 weeks)

### Deliverables

- strict mode
- `review strict`
- `approve ... on_timeout`
- unknown-var failure
- fail-closed state corruption behavior
- basic budgets
- checkpoint primitive

### Why first

This phase hardens the current runtime without requiring a new architecture.

### Success metrics

- fewer silent runtime degradations
- clearer failed-state reporting
- better recovery from stuck runs
- reduced manual rechecking of review/approval edge cases

## Phase 1 — Boundaries and side effects (6–8 weeks)

### Deliverables

- contracts v1
- effect nodes v1
- risk tiers
- policy block
- capabilities declarations
- contract-aware linting

### Why now

This directly targets scope babysitting and unsafe retries.

### Success metrics

- lower rate of out-of-scope changes
- lower manual diff-review time
- clearer classification of risky actions

## Phase 2 — Replay and auditability (5–7 weeks)

### Deliverables

- append-only event log
- derived snapshots
- replay CLI
- artifact capture
- run reports

### Why now

Without replay, autonomy improvements are difficult to trust or debug.

### Success metrics

- time-to-debug failed runs drops
- run auditability improves
- regression creation from failures becomes feasible

## Phase 3 — Compile-time rigor (6–8 weeks)

### Deliverables

- Flow IR
- compile/explain/lint path
- simulation
- flow unit tests
- schema/artifact validation v1

### Why now

This shifts the language from “interpreted runtime convenience” toward “reviewable engineering substrate.”

### Success metrics

- more issues caught before runtime
- easier code review of flows
- fewer runtime-only failures

## Phase 4 — Evaluation and learning loop (6–10 weeks)

### Deliverables

- rubrics
- judges
- eval suites
- baseline locking
- regression promotion tooling
- memory governance v1

### Why now

This is how the system starts improving systematically rather than anecdotally.

### Success metrics

- regression bank growth
- lower repeated-failure rate
- better measured pass-rate changes after flow/contract updates

## Phase 5 — Safe orchestration and portability (8–12 weeks)

### Deliverables

- worktree spawn
- locks
- ownership declarations
- merge policies
- provider adapter boundary
- Codex/Claude shared runtime pathway

### Why now

This builds safer multi-agent work and reduces provider lock-in.

### Success metrics

- lower integration-conflict rate
- lower supervision time for parallel tasks
- cleaner provider portability story

## Explicit deprioritizations until core trust work lands

- large playground work
- ornamental DSL sugar
- heavy NL-to-flow convenience work
- speculative self-rewriting runtime work
