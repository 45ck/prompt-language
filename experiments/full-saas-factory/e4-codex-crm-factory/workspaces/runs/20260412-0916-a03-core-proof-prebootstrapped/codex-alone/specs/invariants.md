# Invariants — CRM Core Slice

This document lists the invariants enforced by `packages/domain` plus the additional “existence checks” enforced by `packages/api`.

## Domain-Level Invariants (`packages/domain`)

### IDs

- `ContactId` must start with `con_` and include a non-empty suffix.
- `CompanyId` must start with `com_` and include a non-empty suffix.
- `OpportunityId` must start with `opp_` and include a non-empty suffix.
- `TaskId` must start with `tsk_` and include a non-empty suffix.
- `NoteId` must start with `note_` and include a non-empty suffix.

### Required strings (trimmed)

- `Company.name`, `Contact.name`, `Opportunity.title`, `Task.subject`, `Note.body` must be non-empty after trimming.

### Email normalization

- `Contact.email` is optional.
- When present it is trimmed, lowercased, must not contain spaces, and must follow `local@domain` where `domain` contains a dot.

### Opportunity value

- `Opportunity.valueCents` must be a finite, non-negative integer.
- `currency` defaults to `USD` when not provided.

### Opportunity stage transitions

Stages:

- `Prospecting -> Qualified -> Proposal -> Negotiation -> ClosedWon/ClosedLost`

Rules:

- Closed stages cannot transition to non-closed stages.
- Non-closed stages can transition to the next stage in sequence.
- Non-closed stages can transition directly to `ClosedWon` or `ClosedLost`.
- Invalid transitions throw `DomainError(code: 'INVALID_STAGE_TRANSITION')`.

### Tasks

- `Task.status` is `Open` or `Completed`.
- Completing a task sets `completedAt` and updates `updatedAt`.

### Dashboard summaries

- `buildDashboardSummary` returns deterministic counts given the same inputs and `now`.

## API-Level Guarantees (`packages/api`)

The in-memory API enforces reference existence:

- Creating/updating a contact with `companyId` requires the company to exist.
- Creating an opportunity requires the company to exist.
- If `primaryContactId` is provided, the contact must exist; if the contact has a `companyId`, it must match the opportunity’s `companyId`.
- Creating tasks/notes with `relatedTo` requires the referenced entity to exist.

API wraps domain validation errors into `ApiError(code: 'BAD_REQUEST')`.

