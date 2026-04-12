# Acceptance Criteria — CRM Core Slice

## Companies

- **AC-COMP-1**: Creating a company requires a non-empty `name` (trimmed); otherwise an error is thrown.
- **AC-COMP-2**: `domain` is optional; when present it is trimmed and lowercased.
- **AC-COMP-3**: Company can be updated (name/domain) and `updatedAt` advances.

## Contacts

- **AC-CON-1**: Creating a contact requires a non-empty `name` (trimmed).
- **AC-CON-2**: `email` is optional; when present it is normalized (trim + lowercase) and validated.
- **AC-CON-3**: If `companyId` is provided, it must refer to an existing company; otherwise an error with code `NOT_FOUND` is thrown.
- **AC-CON-4**: Contact can be updated (name/email/phone/companyId) with `updatedAt` advancing.

## Opportunities

- **AC-OPP-1**: Creating an opportunity requires an existing `companyId`.
- **AC-OPP-2**: `stage` defaults to `Prospecting` when not provided.
- **AC-OPP-3**: `valueCents` must be a non-negative integer.
- **AC-OPP-4**: If `primaryContactId` is provided, it must exist; if the contact has a `companyId`, it must match the opportunity’s `companyId`.
- **AC-OPP-5**: Stage transition rules:
  - Closed stages (`ClosedWon`, `ClosedLost`) cannot transition to non-closed stages.
  - Non-closed stages may transition to the next stage in sequence.
  - Non-closed stages may transition directly to a closed stage.
  - Invalid transitions throw an error.

## Tasks

- **AC-TASK-1**: Creating a task requires a non-empty `subject` (trimmed).
- **AC-TASK-2**: `relatedTo` is optional; when provided it must refer to an existing entity (company/contact/opportunity) or an error with code `NOT_FOUND` is thrown.
- **AC-TASK-3**: Completing a task sets `status` to `Completed` and records `completedAt`.

## Notes

- **AC-NOTE-1**: Creating a note requires non-empty `body` (trimmed).
- **AC-NOTE-2**: A note requires `relatedTo` and it must refer to an existing entity (company/contact/opportunity/task) or an error with code `NOT_FOUND` is thrown.
- **AC-NOTE-3**: Updating a note body advances `updatedAt`.

## Dashboard Summary

- **AC-DASH-1**: Summary totals include counts of contacts, companies, opportunities, tasks, notes.
- **AC-DASH-2**: Summary includes opportunity counts by stage.
- **AC-DASH-3**: Summary includes task counts: open, completed, overdue open, due-in-next-7-days open.
- **AC-DASH-4**: Summary is deterministic given the same inputs/clock.

