# Bounded CRM Core — Acceptance Criteria

## General
- AC-01 Deterministic time: all time-based logic takes an explicit `now`/`asOf` ISO timestamp parameter; no domain logic reads the system clock.
- AC-02 Deterministic IDs: IDs are explicit inputs or produced by an injected deterministic ID generator in in-memory services (tests can control outputs).
- AC-03 No partial writes: when an operation fails validation, the in-memory state is unchanged.

## Companies
- AC-10 Create company: Given a non-empty `name`, when a company is created, then it is stored with a generated `id` and `createdAt`.
- AC-11 Company name required: Given an empty or whitespace-only `name`, when creation is attempted, then the operation fails with a validation error.

## Contacts
- AC-20 Create contact: Given a non-empty `displayName` and optional `email`, when a contact is created, then it is stored with a generated `id` and `createdAt`.
- AC-21 Contact display name required: Given an empty or whitespace-only `displayName`, when creation is attempted, then the operation fails with a validation error.
- AC-22 Email format: Given an `email` value without `@`, when creation is attempted, then the operation fails with a validation error.
- AC-23 Optional company association: Given a `companyId`, when a contact is created with that `companyId`, then it must reference an existing company; otherwise the operation fails.

## Opportunities
- AC-30 Create opportunity: Given an existing `companyId`, a non-empty `title`, `amountCents >= 0`, and `currency` as an uppercase 3-letter code, when an opportunity is created, then it is stored with `stage = "prospecting"` and `stageUpdatedAt = createdAt`.
- AC-31 Company required: Given a `companyId` that does not exist, when opportunity creation is attempted, then it fails.
- AC-32 Amount validation: Given `amountCents` that is negative or non-integer, when creation is attempted, then it fails.
- AC-33 Currency validation: Given `currency` not matching `^[A-Z]{3}$`, when creation is attempted, then it fails.
- AC-34 Optional primary contact: Given `primaryContactId`, when opportunity creation is attempted, then it must reference an existing contact; otherwise it fails.

## Stage transitions
- AC-40 Allowed transitions only: Given an existing opportunity at a valid stage, when a move is requested, then it succeeds only for these transitions:
  - `prospecting` → `qualified` | `closed-lost`
  - `qualified` → `proposal` | `closed-lost`
  - `proposal` → `negotiation` | `closed-lost`
  - `negotiation` → `closed-won` | `closed-lost`
- AC-41 Terminal stages: Given an opportunity in `closed-won` or `closed-lost`, when a move is requested, then it fails.
- AC-42 Stage updated time: Given a successful stage move with explicit `now`, when the move completes, then `stageUpdatedAt` equals `now`.

## Tasks
- AC-50 Add task: Given a valid subject (`contact`/`company`/`opportunity`) and non-empty `title`, when a task is added, then it is stored with `status = "open"` and `createdAt`.
- AC-51 Subject must exist: Given a subject ID that does not exist, when a task is added, then it fails.
- AC-52 Due date optional: Given `dueAt` is omitted, when a task is added, then it succeeds; given `dueAt` is present and not a valid ISO timestamp, then it fails.
- AC-53 Complete task: Given an open task and explicit `now`, when the task is completed, then `status = "completed"` and `completedAt = now`.
- AC-54 One-way completion: Given a completed task, when completion is attempted again, then it fails and the task remains unchanged.

## Notes
- AC-60 Add note: Given a valid subject and non-empty `body`, when a note is added, then it is stored with `createdAt`.
- AC-61 Subject must exist: Given a subject ID that does not exist, when a note is added, then it fails.

## Dashboard summary
- AC-70 Totals: Given the current in-memory state, when the dashboard summary is computed, then it returns totals for companies, contacts, opportunities, tasks (open and completed), and notes.
- AC-71 Opportunities by stage: Given opportunities across stages, when the summary is computed, then it returns counts for every stage value (`prospecting`, `qualified`, `proposal`, `negotiation`, `closed-won`, `closed-lost`).
- AC-72 Overdue open tasks: Given explicit `asOf`, when the summary is computed, then `overdueOpenTasks` counts tasks where `status = "open"` and `dueAt` is present and `dueAt < asOf`.
