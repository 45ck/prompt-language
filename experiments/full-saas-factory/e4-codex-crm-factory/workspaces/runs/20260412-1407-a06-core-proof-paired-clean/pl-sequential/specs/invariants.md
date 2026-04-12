# Bounded CRM Core — Invariants

This document enumerates the invariants that must hold for the bounded CRM core across domain logic and in-memory application services.

## Determinism invariants
- INV-01 No system clock: all operations that set or compare time take an explicit `now`/`asOf` ISO timestamp parameter.
- INV-02 No randomness in domain: the domain package does not generate IDs; IDs are inputs from the application layer.
- INV-03 Deterministic dashboard: dashboard summary is computed purely from supplied state + explicit `asOf`.

## Atomicity invariant
- INV-10 No partial writes: when an operation fails validation or referential checks, the in-memory state is unchanged.

## Company invariants
- INV-20 `Company.name` is required, trimmed, and non-empty.
- INV-21 `Company.createdAt` is an ISO timestamp string (`YYYY-MM-DDTHH:mm:ss.sssZ`).

## Contact invariants
- INV-30 `Contact.displayName` is required, trimmed, and non-empty.
- INV-31 `Contact.email` is optional; if present it is trimmed and must contain `@`.
- INV-32 `Contact.companyId` is optional; if present it must reference an existing company (application service enforced).
- INV-33 `Contact.createdAt` is an ISO timestamp string (`YYYY-MM-DDTHH:mm:ss.sssZ`).

## Opportunity invariants
- INV-40 `Opportunity.companyId` is required and must reference an existing company (application service enforced).
- INV-41 `Opportunity.primaryContactId` is optional; if present it must reference an existing contact (application service enforced).
- INV-42 `Opportunity.title` is required, trimmed, and non-empty.
- INV-43 `Opportunity.amountCents` is an integer and `>= 0`.
- INV-44 `Opportunity.currency` matches `^[A-Z]{3}$`.
- INV-45 `Opportunity.stage` is one of:
  - `prospecting`
  - `qualified`
  - `proposal`
  - `negotiation`
  - `closed-won`
  - `closed-lost`
- INV-46 New opportunities start at `stage = "prospecting"` and `stageUpdatedAt = createdAt`.
- INV-47 `Opportunity.createdAt` and `Opportunity.stageUpdatedAt` are ISO timestamp strings (`YYYY-MM-DDTHH:mm:ss.sssZ`).

## Stage transition invariants
- INV-50 Only these transitions are allowed (all others rejected):
  - `prospecting` → `qualified` | `closed-lost`
  - `qualified` → `proposal` | `closed-lost`
  - `proposal` → `negotiation` | `closed-lost`
  - `negotiation` → `closed-won` | `closed-lost`
- INV-51 Terminal stages: `closed-won` and `closed-lost` have no outgoing transitions.
- INV-52 On a successful stage move, `stageUpdatedAt` equals the provided `now`.

## Task invariants
- INV-60 `Task.subject` is one of:
  - `{ type: "contact"; id: string }`
  - `{ type: "company"; id: string }`
  - `{ type: "opportunity"; id: string }`
- INV-61 `Task.subject.id` must reference an existing entity of that type (application service enforced).
- INV-62 `Task.title` is required, trimmed, and non-empty.
- INV-63 `Task.dueAt` is optional; if present it must be a valid ISO timestamp string (`YYYY-MM-DDTHH:mm:ss.sssZ`).
- INV-64 `Task.status` is `"open"` or `"completed"`.
- INV-65 `Task.completedAt` is set only when `status = "completed"`.
- INV-66 Completing a task is one-way: only `"open"` → `"completed"` is allowed; completing a completed task fails and leaves it unchanged.

## Note invariants
- INV-70 `Note.subject` has the same shape and existence requirement as `Task.subject` (application service enforced).
- INV-71 `Note.body` is required, trimmed, and non-empty.
- INV-72 `Note.createdAt` is an ISO timestamp string (`YYYY-MM-DDTHH:mm:ss.sssZ`).

## Dashboard summary invariants
- INV-80 Totals include: companies, contacts, opportunities, tasks (open/completed), notes.
- INV-81 Opportunities by stage includes counts for every stage value:
  - `prospecting`
  - `qualified`
  - `proposal`
  - `negotiation`
  - `closed-won`
  - `closed-lost`
- INV-82 `overdueOpenTasks` counts tasks where `status = "open"` and `dueAt` is present and `dueAt < asOf`.

