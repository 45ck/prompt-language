# Evaluation and Rollout

## What success should mean

`swarm` is worthwhile only if it improves at least one of:

- readability
- authoring speed
- reliability
- debuggability

without materially hurting:

- execution predictability
- testability
- gate trust
- runtime simplicity

## Evaluation questions

### Q1. Are swarm flows easier to author than raw spawn/await flows?

Measure:

- time to write a correct flow
- number of syntax or logic mistakes
- subjective clarity from maintainers

### Q2. Are swarm flows easier to debug?

Measure:

- time to locate orchestration bug
- time to compare authored vs expanded execution
- quality of error messages

### Q3. Do swarm flows preserve runtime reliability?

Measure:

- parity with hand-written desugared versions
- no silent result loss
- correct gating after multi-role runs

### Q4. Does v1 avoid triggering premature pressure for heavy features?

Measure:

- how often users immediately need handoffs, nested swarms, or shared memory
- whether manager-owned swarms cover the dominant use cases

## Suggested benchmark scenarios

- frontend/backend split fix
- builder/reviewer fix loop
- parallel search plus reviewer
- per-package audit in monorepo
- one role fails, one succeeds, parent recovers

## Promotion criteria

Promote from experimental to documented reference feature only if:

- parser and lowering are stable
- swarm smoke tests are green
- `validate` expansion is usable
- at least a few real flows are clearer than their hand-written equivalents
- no evidence that the abstraction hides critical runtime behavior

## Rejection criteria

Reconsider or narrow the feature if:

- users keep needing the expanded form to understand execution
- too many swarm bugs are actually lowered-flow surprises
- most real use cases still read better as plain `spawn`/`await`
- pressure for nested/decentralized behavior arrives before v1 stabilizes
