# Change-Request Suite — E5 Family 4

## Purpose

This is the thesis test. The factory lane (PL-first or codex-first) hands
off its output. A **separate, blind maintenance lane** applies each change
request and the suite measures what it cost and whether the output still
works.

If PL-first output is genuinely higher quality, the maintenance lane should
land these changes with lower `reworkCost`, higher `changeRequestPassRate`,
and lower `driftDelta` than it does against codex-first output. If it
doesn't, the thesis is wrong for this scope.

## Blinding rules

Before handoff, the harness operator MUST strip:

- Any top-level directory named `prompt-language`, `flows`, `flow-packs`,
  `phases`, or containing `.flow` files at depth ≤ 2
- Any file whose name matches `*.flow` or `project.flow`
- Any README section titled "Flow pack", "Phases", "Prompt-language", or
  mentioning the factory run by name
- Any trace directory (`trace/`, `.prompt-language/`, `factory-trace/`)

The stripped diff is logged to the scorecard as
`blinding.handoffDiffArtifact` for audit. If stripping alters a path
referenced by the lane's README, that is a family-3 deliverability issue
and recorded as such — but the maintenance lane still sees only the
stripped tree.

The maintenance lane is told:

> "You are receiving a codebase. Apply the attached change requests in
>  order. You may read any file you want. Your goal is to land each change
>  with passing journey tests and minimal rework."

It is not told which factory lane produced the tree, or that this is an
experiment about factory lanes at all.

## Declaration discipline

All change requests MUST be declared and committed to this file BEFORE any
E5 factory run touches them. Any change request added after a run is
invalid for that batch and must be deferred to the next batch.

Each request includes:

- **ID** — stable identifier
- **User-facing intent** — one sentence, the PM-style ask
- **Acceptance journeys** — which of J1-J7 (from `crm-journeys.md`) must
  still pass, plus any new journeys the change implies
- **Budget** — wall-clock cap for the maintenance lane on this request

## Suite v1

### CR-01 — Add email-verification field to contacts

**Intent**: "Add an `emailVerified` boolean to contacts, surfaced as a
checkbox on create/edit and a badge on the detail view."

**Acceptance**:
- J2 still passes unchanged
- New J2b: create a contact with `emailVerified=true`, verify badge renders
- New J2c: edit an existing contact to toggle the flag, verify persistence

**Budget**: 20 minutes

---

### CR-02 — Insert a new pipeline stage "Negotiation"

**Intent**: "Add a 'Negotiation' stage to the opportunity pipeline,
positioned between whatever stage currently represents 'proposed' and
'closed-won'. Existing opportunities keep their current stage."

**Acceptance**:
- J4 still passes, now stepping through the new stage in the correct
  position
- Existing opportunities from a pre-seeded fixture do not shift stage
  silently

**Budget**: 25 minutes

---

### CR-03 — Contact soft-delete

**Intent**: "Allow deleting a contact. Deleted contacts are hidden from
lists and dashboards but still reachable via their company's contacts
list with a 'deleted' indicator."

**Acceptance**:
- J2 still passes
- New J2d: delete a contact, confirm it disappears from the main list
- New J3b: company detail still shows the deleted contact with the
  indicator
- Dashboard contact count from J7 decreases by one

**Budget**: 30 minutes

---

### CR-04 — Activity log on opportunities

**Intent**: "Record an entry each time an opportunity changes stage,
showing from-stage, to-stage, timestamp, and user. Render the log on the
opportunity detail view."

**Acceptance**:
- J4 still passes
- New J4b: after advancing through all stages, the detail view shows one
  log entry per transition with all four fields correct

**Budget**: 35 minutes

---

### CR-05 — Export contacts to CSV

**Intent**: "Add a 'Download CSV' action on the contacts list. CSV
includes name, email, phone, company, and the `emailVerified` field added
in CR-01."

**Acceptance**:
- J2 still passes
- New J2e: trigger the download, CSV parses as valid RFC 4180, row count
  matches visible list count, all five fields present

**Budget**: 20 minutes

---

## Execution order and isolation

The maintenance lane applies CR-01 through CR-05 **sequentially, on the
same tree**. Each change builds on the last. This tests `driftResistance`:
by CR-05, is the output still coherent, or has it rotted under
accumulation?

Between requests, the harness re-runs J1-J7 plus any new journeys the
prior request introduced. A request is recorded as passed only if all
prior journeys still pass. A single regression fails that request.

## Rework accounting

For each request, the harness records:

- `linesOfCodeTouched` — `git diff --stat` summed additions + deletions
- `filesModified`, `filesCreated`, `filesDeleted` — from the same diff
- `artifactsRewritten` — count of non-code files the lane chose to update
  (docs, fixtures, configs). High values here are not penalized — they
  indicate the lane was forced into wide changes to land a narrow ask.
- `wallClockSec` — time inside the maintenance lane's session

## What a thesis win looks like at this level

Across 4+ counterbalanced pairs:

- PL-first mean `changeRequestPassRate` exceeds codex-first by ≥ 20%, OR
- PL-first mean `reworkCost` is ≤ 60% of codex-first on equal pass rates,
  OR
- `driftDelta` after CR-05 is positive (or near-zero) for PL-first and
  strongly negative for codex-first

Anything short of that is either inconclusive or, if codex-first wins,
disconfirming.
