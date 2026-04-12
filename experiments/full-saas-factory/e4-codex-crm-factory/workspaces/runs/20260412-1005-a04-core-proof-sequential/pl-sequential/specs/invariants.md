# Invariants: Bounded CRM Core

This document lists invariants that must hold for the bounded CRM core domain and its in-memory application services.

These invariants are intended to be:
- Enforced by constructors/transitions in `packages/domain` where possible
- Enforced by in-memory application services in `packages/api` when they require access to state (references, duplicates)
- Covered by focused unit tests

## Common invariants (all record types)

- IDs are caller-provided strings and must be non-empty.
- Timestamps (`createdAt`, stage-change `at`) are valid ISO-8601 strings.
- In-memory uniqueness is enforced per record type:
  - No two companies share the same `id`.
  - No two contacts share the same `id`.
  - No two opportunities share the same `id`.
  - No two tasks share the same `id`.
  - No two notes share the same `id`.

## Company invariants

- `name` is a non-empty string.
- `createdAt` is ISO-8601.

## Contact invariants

- `firstName` and `lastName` are non-empty strings.
- If present, `email` matches a basic email format (bounded: must contain exactly one `@` and at least one `.` after the `@`).
- If present, `companyId` refers to an existing company (application invariant).
- `createdAt` is ISO-8601.

## Opportunity invariants

- `companyId` refers to an existing company (application invariant).
- `name` is a non-empty string.
- `amountCents` is an integer and `>= 0`.
- If present, `primaryContactId` refers to an existing contact (application invariant).
- `stage` is a valid `OpportunityStage`.
- `createdAt` is ISO-8601.

### Opportunity stage-history invariants

- `stageHistory` is append-only.
- Each entry `{ from, to, at }`:
  - Has valid `from`/`to` stages
  - Has `at` as ISO-8601
  - Represents a valid transition per the stage machine
- For a valid transition:
  - The opportunity’s `stage` becomes `to`
  - Exactly one history entry is appended
- Terminal stages:
  - If `stage` is `ClosedWon` or `ClosedLost`, no further transitions are permitted.

## Task invariants

- `subject` is a `SubjectRef` and refers to an existing record of the given type (application invariant).
- `title` is a non-empty string.
- `dueOn` is a `YYYY-MM-DD` string.
- `status` is either `'open'` or `'done'`.
- `createdAt` is ISO-8601.

### Task status invariants

- New tasks start with `status = 'open'`.
- Marking a task done sets `status = 'done'`.

## Note invariants

- `subject` is a `SubjectRef` and refers to an existing record of the given type (application invariant).
- `body` is a non-empty string.
- `createdAt` is ISO-8601.

## Dashboard summary invariants

Given in-memory state collections `{ companies, contacts, opportunities, tasks }` and `today`:

- `companiesTotal === companies.length`
- `contactsTotal === contacts.length`
- `opportunitiesTotal === opportunities.length`
- `openOpportunitiesTotal === opportunities.filter(o => o.stage !== 'ClosedWon' && o.stage !== 'ClosedLost').length`

### Opportunities by stage

- `opportunitiesByStage[stage]` equals the number of opportunities currently at that `stage` for every `OpportunityStage`.
- `openOpportunityAmountCentsTotal` equals the sum of `amountCents` across open opportunities only.

### Task counts

- `openTasksTotal` counts tasks where `status === 'open'`.
- `openTasksOverdue` counts open tasks where `dueOn < today` (lexicographic compare is valid for `YYYY-MM-DD`).
- `openTasksDueToday` counts open tasks where `dueOn === today`.
- `today` is a valid `YYYY-MM-DD` string (validated).

