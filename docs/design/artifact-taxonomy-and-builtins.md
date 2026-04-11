# Design: Artifact Taxonomy and Initial Built-ins

## Status

Accepted design target for `prompt-language-50m6.2`.

Primary upstream references:

- [`docs/wip/artifacts/artifact-taxonomy.md`](../wip/artifacts/artifact-taxonomy.md)
- [`docs/wip/artifacts/open-questions.md`](../wip/artifacts/open-questions.md)
- [`docs/wip/artifacts/custom-artifact-model.md`](../wip/artifacts/custom-artifact-model.md)
- [`docs/design/artifact-package-contract.md`](./artifact-package-contract.md)
- [`docs/design/artifact-runtime-lifecycle.md`](./artifact-runtime-lifecycle.md)
- [`docs/design/artifact-extension-boundary.md`](./artifact-extension-boundary.md)

This note decides which artifact families matter, which built-ins are worth shipping first, and which type ideas should stay out of the first release cut. It does not reopen package layout, lifecycle, renderer ownership, or custom declaration mechanics already addressed in parallel design notes.

## Decision

prompt-language should keep the five artifact families from the WIP taxonomy as the conceptual frame:

- intent
- change
- verification
- oversight
- learning

But the **smallest initial built-in set worth supporting first** is only:

- `implementation_plan`
- `decision_record`
- `test_report`

Everything else should be deferred to either:

- a later built-in expansion once the runtime proves the artifact envelope works in practice, or
- the custom-type path defined separately in `prompt-language-50m6.8`

The first release should therefore ship:

1. one generic planning artifact
2. one generic rationale artifact
3. one generic verification artifact

It should **not** try to ship first-class built-ins for change tracking, approval/governance packets, learning/postmortem records, or domain-specific artifact packets in the same cut.

## Why this needs an explicit release cut

The artifact taxonomy intentionally widened the in-bounds concept beyond one use case. That was correct for `prompt-language-50m6.1`, but it leaves too much freedom for implementation work:

- package work could try to optimize around the wrong payload shapes
- lifecycle work could drift into approval-specific or review-specific semantics too early
- renderer work could fit too narrowly to browser packets, PDF exports, or repo-local workflows
- custom-type work could get pulled into the minimum release when it should remain additive

The release cut therefore needs to be smaller than the taxonomy. "In bounds" is not the same as "must ship first."

## Evaluation of artifact families

### Intent family

Intent artifacts are the strongest candidate for initial built-ins.

Why:

- they are common across repos and hosts
- they are understandable with simple fallback rendering
- they are useful before any plugin ecosystem exists
- they do not depend on approval nodes, audit storage, or rich media

Best initial members:

- `implementation_plan`
- `decision_record`

Why these two:

- `implementation_plan` captures forward-looking execution structure, scope, steps, dependencies, and exit signals
- `decision_record` captures why a choice was made, what alternatives were considered, and what consequences follow

Those are materially different shapes. Shipping both proves that built-ins are not just "generic markdown blobs" while still staying small.

### Change family

Change artifacts should stay in taxonomy but out of the first built-in release.

Why they are in bounds:

- humans do review change summaries and migration reports as durable handoff objects
- they can be typed and validated

Why they should not ship first:

- they overlap heavily with existing repo-native sources such as diffs, changed files, and VCS metadata
- they risk being mistaken for the side effects themselves
- they are more repo- and workflow-specific than the initial generic contract needs

Initial consequence:

- change-oriented packets such as `code_diff_summary`, `changed_files_report`, or `migration_report` should arrive later or through custom declarations, not in v1 built-ins

### Verification family

Verification artifacts should be represented in the initial built-in set, but narrowly.

Why:

- verification is one of the clearest artifact use cases in the repo
- it exercises attachments, evidence references, and outcome summaries
- it is central to review, handoff, and completion gates without replacing those gates

Chosen initial member:

- `test_report`

Why `test_report` over narrower packets:

- it is generic across CLI, unit, integration, eval, and browser-oriented verification
- it can reference screenshots, recordings, logs, and exports as attachments without making each of those a built-in type
- it proves the package contract against a more evidence-heavy artifact than the intent family alone

Explicit deferral:

- `walkthrough`
- `screenshot_set`
- `browser_recording`
- `before_after_comparison`
- repo- or host-specific packets such as `browser_qa_packet`

Those remain valid artifact ideas, but they should be layered on later rather than defining the minimum release surface.

### Oversight family

Oversight artifacts are in bounds conceptually, but they should not be first-release built-ins.

Why they are in bounds:

- humans do need reviewable artifacts for exception handling, rollback planning, and governance context

Why they should not ship first:

- prompt-language already has explicit approval and gate primitives
- shipping built-ins like `approval_request` too early would blur the separation between artifact metadata and runtime control flow
- the lifecycle note explicitly keeps review state, approval state, and artifact existence distinct

Initial consequence:

- `approval_request`, `rollback_plan`, `exception_report`, and similar governance artifacts should be deferred until the runtime has proven that artifact review stays separate from `approve` semantics

### Learning family

Learning artifacts are valid but non-essential for the first release.

Why they are in bounds:

- postmortems and reusable lessons are durable, typed, human-facing outputs

Why they should not ship first:

- they are downstream of successful artifact emission, validation, and review patterns
- they do not test any minimum runtime boundary that the chosen built-ins do not already test
- their value increases after the core package and revision model already exists

Initial consequence:

- `postmortem`, `failure_pattern`, `rule_candidate`, and `workflow_candidate` should be deferred

## Chosen initial built-ins

The accepted first-release built-ins are:

### `implementation_plan`

Purpose:

- a reviewable execution plan that explains what will be done and in what order

Why it earns built-in status:

- broadly useful in agentic and non-agentic flows
- low dependency on plugins
- natural fit for fallback Markdown and structured JSON views

Minimum semantic expectations:

- objective or outcome
- scope or assumptions
- ordered steps or workstreams
- dependencies or risks
- completion evidence or exit criteria

### `decision_record`

Purpose:

- a durable rationale record for a meaningful technical or operational choice

Why it earns built-in status:

- common across architecture, delivery, and governance work
- clearly different from a plan
- useful even when no rich renderers are installed

Minimum semantic expectations:

- decision statement
- context
- considered options
- chosen option
- consequences or tradeoffs
- decision status

### `test_report`

Purpose:

- a verification packet that records what was checked, what happened, and what evidence supports the result

Why it earns built-in status:

- forces the contract to handle structured outcomes plus evidence attachments
- generic enough to support many verification modes
- directly valuable to review and handoff without redefining gates

Minimum semantic expectations:

- subject under test
- environment or execution context
- checks or scenarios executed
- pass/fail or graded outcomes
- key failures or warnings
- evidence references

## Why this set is the smallest one worth shipping

A smaller cut than these three would miss an important shape:

- only intent artifacts would prove lightweight document packaging, but not evidence-heavy verification
- only one intent artifact would not show that typed built-ins can distinguish plan from rationale
- only `test_report` would bias the first release too far toward verification use cases and under-serve planning and review handoff

These three are therefore the smallest set that covers:

- forward-looking planning
- explicit rationale
- evidence-backed verification

That is enough to exercise:

- the package and manifest contract
- fallback rendering
- validation of type-specific payloads
- lifecycle transitions such as emit, validate, review, and supersede

without forcing v1 to solve every artifact family at once.

## What the first release should not include

The first built-in cut should not include:

- `approval_request`
- `rollback_plan`
- `exception_report`
- `code_diff_summary`
- `migration_report`
- `walkthrough`
- `screenshot_set`
- `browser_recording`
- `before_after_comparison`
- `postmortem`
- `failure_pattern`
- `workflow_candidate`
- domain-specific packets such as `browser_qa_packet`, `client_handoff`, or `merge_review_packet`

Those are not rejected permanently. They are deferred because they either:

- overlap too much with existing runtime or repo semantics
- require richer renderer, review, or storage behavior
- are better expressed as custom declarations once that path lands

## Separation from the custom-type story

The custom-type path remains necessary, but it must stay separate from the first built-in release cut.

The accepted separation is:

- built-ins are the minimum generic types core ships and validates out of the box
- custom types are repo- or domain-specific declarations that use the same package, manifest, and lifecycle envelope
- plugins may later enrich rendering and validation for both built-ins and custom types, but the first release must not depend on plugin-defined type identity

Practical consequences:

- the first release does not need a large built-in catalog to prove artifact value
- the first release does not need to settle every custom declaration UX detail before shipping built-ins
- later custom types should compose from the same envelope instead of forcing new package semantics

Examples of types that should start as custom, not built-in:

- `browser_qa_packet`
- `release_readiness`
- `client_handoff`
- `merge_review_packet`
- team-specific decision or review bundles

This keeps the initial built-in set generic and portable while still leaving room for richer domain-specific artifact programs later.

## Consequences for follow-on beads

This decision constrains later work in concrete ways:

- `prompt-language-50m6.3` should ensure the package contract works cleanly for `implementation_plan`, `decision_record`, and `test_report` before optimizing for broader families
- `prompt-language-50m6.4` should validate lifecycle transitions against these three built-ins as the core examples
- `prompt-language-50m6.5` can use these built-ins when defining schemas and sample renderers for phase 1
- `prompt-language-50m6.8` should treat custom types as additive extensions over this narrow built-in base, not as a reason to delay the initial release cut

## Current repository implication

This note records the accepted design target. It does not claim the repository already ships artifact declarations, validators, renderers, or runtime syntax for these types.

What it does claim is narrower and more important:

- the taxonomy remains broad
- the first release cut remains small
- the smallest built-in set worth shipping first is `implementation_plan`, `decision_record`, and `test_report`
- the custom-type story is intentionally deferred to a separate extension decision rather than being pulled into the minimum release
