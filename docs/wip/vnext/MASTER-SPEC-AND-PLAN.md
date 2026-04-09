# Master spec and plan

This document is the single-file version of the vNext package. It integrates the refined thesis, core critiques, the target architecture, major specs, and the phased plan.

---

## 1. The refined thesis

Prompt-language should be developed as a **trust, scope, and execution substrate for bounded agentic engineering**.

That is stronger and more accurate than:

- “just a control-flow DSL”
- “autonomy with no human oversight”
- “the end of code”

The repo’s current evidence supports a narrower but real claim:

- deterministic structural enforcement (especially gates) is valuable
- broader claims such as prompt-language becoming the primary engineering surface remain unproven

The next iteration should therefore optimize for:

1. trust
2. boundedness
3. explicit effects
4. replayability
5. evaluation
6. portability

---

## 2. The biggest gap

The current runtime can orchestrate agent work, but it does not yet fully model:

- when it should refuse to continue
- what the bounded scope really is
- which actions are safe to replay
- how to classify risky effects
- how to recover deterministically
- how to learn from failures without becoming a memory junk drawer
- how to remain architecture-first rather than provider-hook-first

That is the gap between “useful supervised runtime” and “credible execution substrate.”

---

## 3. Architectural target

### Layer A — specs and intent

Artifacts:

- spec
- contract
- schema
- policy

### Layer B — compile and validate

Artifacts:

- Flow IR
- static analysis
- simulation
- flow tests

### Layer C — runtime execution

Artifacts:

- event log
- derived state snapshots
- checkpointing
- replay
- effect/policy enforcement

### Layer D — evaluation and learning

Artifacts:

- rubric
- judge
- eval
- regression promotion
- memory governance

### Layer E — adapters

Artifacts:

- Claude Code adapter
- Codex CLI adapter
- typed tool adapters

---

## 4. What to build first

### P0: trust hardening

- strict mode
- review strict
- approval timeout reject
- unknown-var failure
- fail-closed state corruption
- budgets
- checkpoints

### P1: boundedness and effects

- contracts
- effect nodes
- risk tiers
- policy engine
- capabilities

### P2: replay and compile-time rigor

- event log
- replay/report CLI
- Flow IR
- static analysis
- simulator
- flow tests

### P3: learning loop

- rubrics
- judges
- evals
- regression promotion
- memory governance

### P4: safer concurrency

- worktree spawn
- locks
- ownership
- merge policies

### P5: portability

- provider adapters
- shared runtime over Flow IR

---

## 5. Major specs

### 5.1 Strict mode

Add a trust block that controls whether ambiguity fails closed.

Why:

- current permissive behavior is good for experimentation but too weak for trustworthy autonomy

Outcome:

- runtime stops when it no longer knows enough

### 5.2 Contracts

Add reusable packages of:

- gates
- path scope
- limits
- invariants
- required artifacts

Why:

- this replaces much of the manual scope/diff babysitting developers do today

Outcome:

- bounded changes become explicit and reviewable

### 5.3 Schemas and artifacts

Add:

- named schemas
- typed captures
- typed artifacts
- expectations over typed values

Why:

- string interpolation is too weak for larger projects

Outcome:

- captured and produced artifacts become safer and easier to reuse

### 5.4 Effect system

Add:

- explicit effect nodes
- idempotency keys
- rollback hooks
- capability requirements
- risk metadata

Why:

- raw shell is semantically too opaque

Outcome:

- retries/resume become safer and policies become enforceable

### 5.5 Policy and budgets

Add:

- tiered risk policies
- action classes (auto, review, approve)
- budget ceilings for turns/runtime/cost/commands/files/children

Why:

- long unattended runs need hard bounds

Outcome:

- reduced approval fatigue and lower runaway risk

### 5.6 Event log and replay

Add:

- append-only run events
- derived snapshots
- structured reports
- replay CLI
- checkpoints/restores

Why:

- current mutable state is too weak for audit and debugging

Outcome:

- every run becomes inspectable and regression-eligible

### 5.7 Safe concurrency

Add:

- worktree-backed spawn
- ownership declarations
- resource locks
- merge policies

Why:

- coordination is not the same as safe concurrency

Outcome:

- multi-agent work becomes safer and more operationally real

### 5.8 Evals and judges

Add:

- rubrics
- judges
- eval suites
- strict review integration
- baseline locking

Why:

- current evaluation direction is promising and should become central

Outcome:

- the system can improve scientifically rather than by anecdote

### 5.9 Memory governance

Add:

- namespaces
- provenance
- confidence
- TTL
- promotion workflow from failures to durable knowledge

Why:

- ungoverned memory becomes noise

Outcome:

- wisdom accumulation becomes measurable and safer

### 5.10 Flow IR and adapters

Add:

- compile/explain/lint/simulate path
- stable Flow IR
- provider adapters
- typed tool adapters

Why:

- architecture should outlive any one provider integration

Outcome:

- portability, better linting, cleaner replay, easier testing

---

## 6. Hidden failure modes to design around

1. **Silent degradation**
   The runtime thinks it is helping, but quietly converts missing data into empty values.

2. **Contract bloat**
   Teams may turn contracts into giant unreadable policies.

3. **Effect ambiguity**
   A flow mixes harmless commands and dangerous ones without clear distinction.

4. **Judge drift**
   Model judges get treated like truth without calibration.

5. **Memory pollution**
   Durable “wisdom” becomes an unsorted dump of past mistakes.

6. **Concurrency without isolation**
   Parallel child flows collide in the same workspace.

7. **Adapter leakage**
   Provider-specific assumptions leak into the language core.

The specs in this pack are designed to counter those failure modes.

---

## 7. What not to overinvest in yet

Do not prioritize:

- more generic loop sugar
- giant opaque judges
- NL-to-flow magic as the main trusted path
- big playground work before trust/replay are stronger
- speculative self-rewrite work

---

## 8. Success criteria for vNext

The language should be considered materially improved when it can show:

- lower repeated-failure rate
- lower out-of-scope diff rate
- lower human babysitting minutes
- lower cleanup minutes
- safer resume/retry behavior
- replayable failed runs
- regression creation from failures
- clearer provider portability story

---

## 9. Recommended next actions

### Action 1

Turn:

- strict mode
- review strict
- approval timeout reject
- checkpoint v1
  into a single milestone

### Action 2

Turn:

- contracts v1
- effect nodes v1
- policy v1
  into the next milestone

### Action 3

Add:

- event log
- replay/report CLI
  before large-scale workflow expansion

### Action 4

Promote:

- rubrics
- judges
- evals
- regression promotion
  after replay is available

---

## 10. Reading map

For detail, use:

- `specs/001-trust-model-and-strict-mode.md`
- `specs/002-contract-system.md`
- `specs/005-effect-system-and-capabilities.md`
- `specs/007-checkpoints-event-log-and-replay.md`
- `specs/009-evals-judges-and-regression-promotion.md`
- `specs/010-provider-adapters-and-flow-ir.md`

For sequencing, use:

- `plans/phased-delivery-roadmap.md`
- `plans/30-60-90-day-plan.md`
- `plans/gap-closure-map.md`
- `plans/acceptance-matrix.md`
