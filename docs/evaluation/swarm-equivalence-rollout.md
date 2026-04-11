# Swarm Equivalence and Rollout

## Status

Accepted evaluation planning note for `prompt-language-1wr7.6`.

Primary anchors:

- [docs/wip/swarm/06-implementation-plan.md](../wip/swarm/06-implementation-plan.md)
- [docs/wip/swarm/08-evaluation-rollout.md](../wip/swarm/08-evaluation-rollout.md)
- [docs/evaluation/eval-test-matrix.md](./eval-test-matrix.md)
- [docs/design/multi-agent-orchestration.md](../design/multi-agent-orchestration.md)

This note defines the QA bar for `swarm` v1 and the evidence required before
rollout expands beyond an experimental syntax surface.

## Equivalence contract

`swarm` is acceptable only if it behaves like a clearer authored form of existing parent-owned orchestration, not like a new runtime category.

For v1, each accepted `swarm` flow should have a hand-written equivalent expressible with existing primitives:

- role launch lowers to `spawn`
- role completion lowers to child `send parent`
- parent join lowers to `await` plus explicit result import
- role outputs remain parent-owned data, not shared mutable team state
- gate behavior, failure handling, and completion semantics remain the same after lowering

The QA question is not whether `swarm` looks attractive in examples. The QA question is whether authored `swarm` and lowered hand-written orchestration stay observably equivalent at parser, expansion, runtime, and eval layers.

## Automated expectations

### Parser and validation

Parser and lint coverage should prove that `swarm` accepts only the bounded v1 surface described in the implementation plan.

Required cases:

- valid single-role and multi-role `swarm` parse and render
- duplicate role names fail with targeted diagnostics
- `start` of an undeclared role fails with targeted diagnostics
- `await` of an undeclared role fails with targeted diagnostics
- illegal `return` placement fails with targeted diagnostics
- illegal `start` placement fails with targeted diagnostics
- nested `swarm` is rejected in v1
- mixed ordinary-flow constructs around `swarm` remain parseable when explicitly allowed

Expected evidence:

- AST shape is stable enough for expansion tests
- error messages identify the offending role or node, not a generic parse failure
- render or inspect output makes the authored structure clear before lowering

### Lowering and expansion

Lowering tests should treat `swarm` as a desugaring pass, not an interpreter fork.

Required cases:

- `start role` lowers to the same spawned child contract as a hand-written `spawn`
- `return` lowers to the same child-to-parent transport as a hand-written `send parent`
- `await role` lowers to the same synchronization and import behavior as `await` plus explicit result shaping
- `await all` preserves deterministic receive ordering
- lowered flow is inspectable through `validate --expand` or equivalent debug output
- lowering preserves namespacing under `<swarm>.<role>.*` or the final accepted namespace contract

Expected evidence:

- authored `swarm` and hand-written equivalents produce materially identical lowered flow graphs
- no hidden control edge appears only in the `swarm` path
- diffing lowered output is practical enough for debugging and review

### Runtime and completion

Runtime coverage should prove that `swarm` does not weaken the existing parent-child execution model.

Required cases:

- structured JSON return payload imports as structured data
- non-JSON return payload preserves raw text without silent loss
- one role failure surfaces in parent status, logs, and completion checks
- partial success plus recovery path behaves the same as the hand-written equivalent
- child metadata and status remain visible per role
- parent completion gates still execute against imported role outputs rather than hidden swarm state

Expected evidence:

- parent-visible results are predictable and namespaced
- failed roles cannot look like missing successful roles
- gate outcomes are identical between authored `swarm` and lowered manual orchestration

## Representative smoke and eval scenarios

The smoke and eval set should bias toward realistic orchestration seams rather than toy syntax demos.

### Smoke scenarios

These should run through the real harness path once `swarm` changes reach hook, parser, advancement, or state-transition layers.

- manager-worker happy path: two workers return distinct outputs and the parent summarizes both
- builder-reviewer chain: workers produce candidate artifacts, a reviewer role runs only after `await all`
- JSON and plain-text return mix: one role returns JSON, one returns plain text, parent consumes both correctly
- single-role failure: one child exits or returns invalid output, parent records failure and follows explicit recovery logic
- fan-out plus judge: parallel workers feed a parent-side judge or review step without hidden coordination
- race-adjacent composition: `swarm` output feeds existing `race`, `if`, or gate steps outside the swarm body

### Eval scenarios

The comparative eval set should measure equivalence and maintainability against hand-written flows with the same intent.

- frontend/backend split task authored once with `swarm` and once with explicit `spawn` / `await`
- per-package audit fan-out authored both ways
- search-plus-review workflow authored both ways
- fail-one-succeed-one recovery workflow authored both ways
- reviewer-after-workers workflow authored both ways

For each pair, capture:

- authoring time or edit count to first correct run
- parser or logic error count during authoring
- lowered-flow diff quality
- runtime outcome parity
- debugging time for an injected orchestration defect
- maintainer judgment on readability after seeing both authored and expanded forms

## Comparison rule against hand-written flows

Promotion decisions should compare `swarm` against the best equivalent hand-written orchestration, not against a straw-man verbose version.

The comparison bar is:

- hand-written flow uses the current intended primitives directly
- both variants preserve the same parent ownership and gate logic
- both variants run through the same harness and completion machinery
- any readability claim must survive inspection of the expanded form

If reviewers repeatedly need the hand-written lowered form to understand execution, that is evidence against promotion, not evidence that users should "learn the abstraction."

## Rollout phases

### Phase 0: experimental syntax behind explicit labeling

- land parser, lowering, and deterministic runtime coverage first
- keep `swarm` documented as experimental
- require inspectable expansion before claiming debuggability

### Phase 1: paired smoke and eval runs

- run representative smoke scenarios through the real host path
- maintain paired `swarm` and hand-written eval fixtures
- collect failure-mode evidence, not just happy-path demos

### Phase 2: limited example promotion

- add examples only after equivalence and debugging evidence is stable
- prefer examples that show the lowered mental model clearly
- avoid examples that imply peer-team autonomy, shared memory, or hidden delegation

### Phase 3: reference-surface decision

Promote into broader reference material only if the evidence shows a real gain over direct primitives without masking runtime behavior.

## Promotion criteria

Promotion from experimental should require all of the following:

- parser and lowering coverage for the v1 boundary is green
- real smoke runs pass for representative swarm scenarios on a supported host
- paired evals show runtime parity with equivalent hand-written flows
- maintainers can explain execution from the expanded form without hidden steps
- at least some real workflows are measurably easier to author or review
- no recurring bug class appears where `swarm` hides parent-child semantics that were clearer in direct `spawn` / `await`

## Hold or reject criteria

Do not promote, or narrow the feature, if any of these patterns appear:

- lowered output is required to debug most issues because authored `swarm` hides control flow
- role failure, message import, or gate behavior differs from the hand-written equivalent
- maintainers prefer direct primitives once workflows become non-trivial
- pressure for nested swarms, shared swarm state, or autonomous team behavior arrives before v1 is stable
- comparative evals show syntax preference but no improvement in correctness, debugging, or maintenance

## Evidence discipline

`swarm` should advance on evidence that it preserves the orchestration model while improving real authoring and review work.

It should not advance because the syntax looks modern, more "multi-agent", or more concise in screenshots. The rollout bar is runtime equivalence plus clearer maintenance outcomes.
