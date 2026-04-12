# Acceptance Criteria — CRM Core Slice

## Companies

- Creating a company with a non-empty name returns a `Company` with `createdAt`/`updatedAt` set to the call time.
- Creating a company with an invalid domain fails validation.
- Renaming a company updates `updatedAt` and preserves `createdAt`.
- Getting or renaming a missing company fails with `ApiError(code=NOT_FOUND)`.

## Contacts

- Creating a contact trims `firstName`/`lastName`.
- Creating a contact normalizes email to lowercase.
- Creating a contact with `companyId` requires the company to exist.
- Setting a contact’s company requires the company to exist.
- Getting a missing contact fails with `ApiError(code=NOT_FOUND)`.

## Opportunities

- Creating an opportunity requires the company to exist.
- Creating an opportunity with `primaryContactId` requires the contact to exist.
- If the primary contact has a `companyId`, it must match the opportunity’s `companyId` or the call fails with `ApiError(code=CONFLICT)`.
- Opportunity stages follow the allowed transition graph:
  - `Prospecting -> Qualified -> Proposal -> Negotiation -> ClosedWon`
  - Any open stage may transition to `ClosedLost` per the rules in `specs/invariants.md`.
- Invalid stage transitions fail with `DomainError(code=INVALID_STAGE_TRANSITION)`.
- Closed opportunities cannot transition back to open stages.

## Tasks

- Creating a task validates required fields and stores optional `dueAt`.
- Creating a task with `related` requires the referenced entity to exist.
- Completing/canceling a task is only allowed from `Open` status.
- Completing/canceling a missing task fails with `ApiError(code=NOT_FOUND)`.

## Notes

- Adding a note requires the referenced entity to exist.
- Notes are trimmed and validated for max length.
- Getting a missing note fails with `ApiError(code=NOT_FOUND)`.

## Dashboard summary

- Summary counts match the current in-memory state.
- `tasksOverdue` counts open tasks with `dueAt < now`.
- Pipeline totals include only open opportunities (closed opportunities do not contribute).
- Recent notes are ordered deterministically (newest first, then id).

## Quality gates

- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm run test` passes.

