# Design: Wisdom Promotion Workflow

## Status

Accepted governance note for `prompt-language-b8kq.5`.

Primary anchors:

- [Memory Governance Alignment](./memory-governance-alignment.md)
- [Spec 012 - Memory governance and wisdom promotion](../wip/vnext/specs/012-memory-governance-and-wisdom-promotion.md)

This note defines the governance workflow for promoting durable `wisdom` entries. It is intentionally narrower than the full memory program.

## Decision

Durable `wisdom` must move through an explicit `proposal -> review -> promote -> demote` lifecycle.

The runtime may detect and propose candidate wisdom, but promotion is a governed act with metadata and evidence requirements. A promoted wisdom entry is reusable durable memory. It is not checkpoint state, not a retrieval policy, and not a Markdown lookup result.

## Scope

This workflow governs:

- how candidate wisdom is proposed from runs, failures, corrections, or repeated operator edits
- what metadata a durable wisdom entry must carry before promotion
- what evidence must be linked before a high-impact lesson is treated as reusable
- how promoted wisdom is reviewed later, expired, or demoted when confidence drops

This workflow does not govern:

- checkpoint, restore, handoff, compaction, or other session-state mechanics
- retrieval mode selection, ranking, filtering, or query strategy
- Markdown `knowledge:` declarations or deterministic section lookup
- the event-log or eval substrate implementation details

## Lifecycle

### 1. Proposal

A proposal is created when the system observes a pattern worth preserving, such as:

- repeated failure across similar runs
- a correction that reliably resolves a recurring mistake
- a judge or eval finding that indicates a stable guardrail or heuristic
- an operator-authored lesson captured after an incident, replay, or regression investigation

Proposal creation does not make the lesson durable. It creates a reviewable candidate with evidence links and provisional metadata.

### 2. Review

Review is the trust boundary.

During review, the reviewer confirms:

- the lesson is actually reusable wisdom rather than run-local scratch or checkpoint residue
- the statement is scoped narrowly enough to avoid becoming vague policy-by-accident
- the provenance is sufficient to reconstruct where the lesson came from
- the confidence and TTL are justified by the available evidence
- the linked replay, eval, or regression artifacts actually support the claim

Review outcomes:

- `promote` when evidence and metadata are sufficient
- `revise` when wording, scope, or evidence is incomplete
- `reject` when the candidate is not durable wisdom

### 3. Promote

Promotion creates a durable `wisdom` entry that can be inspected, replayed against its evidence, and revisited later.

Promotion rules:

- promotion must be explicit and auditable
- promoted wisdom must retain its proposal provenance
- promotion does not silently create or modify `policy`
- high-impact wisdom must reference at least one replay, eval, or regression artifact
- promoted wisdom must be reviewable for staleness and confidence decay

### 4. Demote

Demotion removes or downgrades a promoted entry when it is no longer trustworthy enough for reuse.

Demotion triggers include:

- replay or regression evidence contradicts the lesson
- a newer fix or architectural change invalidates the original conditions
- the TTL expires without enough fresh supporting evidence
- reviewers conclude the item should be treated as `scratch`, a transient observation, or a narrower proposal instead of durable wisdom

Demotion must preserve the audit trail:

- why the entry was demoted
- what evidence triggered demotion
- whether the item was retired entirely or returned to proposal status for revision

## Required metadata

Every durable wisdom proposal and promoted entry must include the following metadata.

| Field             | Required               | Purpose                                                                       |
| ----------------- | ---------------------- | ----------------------------------------------------------------------------- |
| `id`              | yes                    | Stable identifier for the proposal or promoted wisdom item                    |
| `statement`       | yes                    | The lesson in reviewable, reusable language                                   |
| `scope`           | yes                    | Sharing boundary such as project or shared; not a substitute for memory class |
| `class`           | yes                    | Must be `wisdom` for this workflow                                            |
| `provenance`      | yes                    | Source run, incident, replay, author, or artifact lineage                     |
| `confidence`      | yes                    | Reviewable confidence score or band tied to evidence quality                  |
| `ttl`             | yes                    | Freshness window after which re-review is required                            |
| `created_at`      | yes                    | When the proposal or entry was created                                        |
| `reviewed_at`     | on review              | When a reviewer accepted, revised, or rejected it                             |
| `reviewer`        | on review              | Human or accountable reviewer identity                                        |
| `evidence_links`  | yes for durable wisdom | Links to replay, eval, regression, issue, or incident artifacts               |
| `supersedes`      | optional               | Prior wisdom entry replaced by this one                                       |
| `demotion_reason` | on demotion            | Why the item is no longer durable wisdom                                      |

### Metadata expectations

- `provenance` must be specific enough to reconstruct the originating context.
- `confidence` must not be decorative. It should reflect evidence quality, repeatability, and reviewer judgment.
- `ttl` must force revalidation. Durable wisdom is not perpetual by default.
- `evidence_links` must point to concrete artifacts, not just free-form summaries.

## Evidence attachment model

Evidence stays in its owning system. Wisdom stores links and reviewable summaries, not duplicate substrates.

### Replay evidence

Replay evidence supports claims like:

- the failure pattern was reproducible
- the proposed lesson changes the outcome on rerun
- the lesson still holds after adjacent system changes

Wisdom entries should link to replay artifacts by identifier so reviewers can inspect the before/after path rather than rely on summary prose alone.

### Eval evidence

Eval evidence supports claims like:

- the lesson improves pass rate on a named scenario family
- the heuristic generalizes beyond a single incident
- the lesson remains beneficial after prompt, parser, or orchestration changes

Eval links should identify the relevant suite, case family, or judge output used during review.

### Regression evidence

Regression evidence supports claims like:

- the promoted lesson resulted in a concrete regression test or banked case
- the system now protects against recurrence
- the lesson should be revisited if the regression begins failing again

Regression links should connect the wisdom item to the test, fixture, or evidence package that turns the lesson into an operational regression.

## Governance rules

- Durable wisdom must never be created implicitly from checkpoints, handoff summaries, or compaction output.
- Durable wisdom must never silently upgrade into `policy`.
- A proposal without provenance, confidence, and TTL is incomplete and cannot be promoted.
- High-impact lessons require evidence beyond a single anecdotal run.
- Demotion is a normal governance action, not a failure of the system.
- Promotion and demotion must leave an inspectable audit trail.

## Boundary clarifications

This note keeps several adjacent concerns separate on purpose.

### Separate from checkpoint and session state

Checkpoint and session artifacts capture how a run can resume or hand off work. Wisdom captures reusable lessons that survive beyond a single run. Session artifacts may inform a proposal, but they are not durable wisdom by themselves.

### Separate from retrieval strategy

This note defines what metadata retrieval can later filter on, such as class, confidence, TTL, or provenance. It does not define how retrieval ranks or selects entries.

### Separate from Markdown section lookup

Markdown interop may provide supporting sources or policy references, but section lookup does not promote content into durable wisdom. Promotion still requires explicit review, metadata, and evidence.

## Consequences

This workflow makes durable wisdom slower to create, but safer to trust.

What it enables:

- reusable lessons with clear provenance and freshness rules
- explicit linkage between durable memory and replay/eval/regression evidence
- reviewable demotion when architecture or behavior changes invalidate an old lesson

What it prevents:

- durable memory turning into an unmanaged junk drawer
- checkpoint residue being mistaken for cross-run knowledge
- retrieval or Markdown loading decisions being smuggled in as governance policy
