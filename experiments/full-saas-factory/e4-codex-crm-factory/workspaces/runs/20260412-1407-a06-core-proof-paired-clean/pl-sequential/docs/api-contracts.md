# Bounded CRM Core — API Contracts (In-Memory Application Services)

## Purpose
Define a programmatic API for an **in-memory** CRM core service implemented in `packages/api`.

- Stores state in memory only
- Depends only on the local `packages/domain` package
- Enforces referential integrity (existence checks) and atomicity (no partial writes)
- Accepts explicit timestamps and an injected deterministic ID generator

## Shared primitives
- All IDs are strings.
- All timestamps are ISO strings: `YYYY-MM-DDTHH:mm:ss.sssZ` (provided by caller).
- `SubjectRef` is a discriminated union:
  - `{ type: "contact"; id: string }`
  - `{ type: "company"; id: string }`
  - `{ type: "opportunity"; id: string }`

## Error contract
Operations must fail with a structured error and **must not mutate state**.

Recommended error shape:
- `type: "validation"` (field-level validation failures)
- `type: "not-found"` (referenced entity does not exist)
- `type: "invalid-transition"` (opportunity stage move not allowed)
- `type: "conflict"` (attempted invalid state change, e.g. completing a completed task)

## Construction
Create the in-memory service with an injected ID generator:

- `createCrmService({ generateId })`
  - `generateId(): string` is deterministic in tests (e.g. returns a fixed sequence).

## Service interface (minimum)
### Companies
- `createCompany(input)`
  - input: `{ name: string; now: string }`
  - output: `Company`
  - behavior: validate `name`, generate `id`, set `createdAt = now`

### Contacts
- `createContact(input)`
  - input: `{ displayName: string; email?: string; companyId?: string; now: string }`
  - output: `Contact`
  - behavior: validate fields; if `companyId` is present it must exist

### Opportunities
- `createOpportunity(input)`
  - input: `{ companyId: string; primaryContactId?: string; title: string; amountCents: number; currency: string; now: string }`
  - output: `Opportunity`
  - behavior:
    - `companyId` must exist
    - `primaryContactId` (if present) must exist
    - stage defaults to `prospecting` and `stageUpdatedAt = now`

### Stage transitions
- `moveOpportunityStage(input)`
  - input: `{ opportunityId: string; toStage: "prospecting" | "qualified" | "proposal" | "negotiation" | "closed-won" | "closed-lost"; now: string }`
  - output: `Opportunity`
  - behavior:
    - opportunity must exist
    - transition must be allowed by the domain stage rules
    - `stageUpdatedAt = now` on success

### Tasks
- `addTask(input)`
  - input: `{ subject: SubjectRef; title: string; dueAt?: string; now: string }`
  - output: `Task`
  - behavior:
    - subject entity must exist
    - validate `title` and optional `dueAt`
    - sets `status = "open"` and `createdAt = now`

- `completeTask(input)`
  - input: `{ taskId: string; now: string }`
  - output: `Task`
  - behavior:
    - task must exist
    - task must be `"open"` (one-way completion)
    - sets `status = "completed"` and `completedAt = now`

### Notes
- `addNote(input)`
  - input: `{ subject: SubjectRef; body: string; now: string }`
  - output: `Note`
  - behavior:
    - subject entity must exist
    - validate `body`
    - sets `createdAt = now`

### Dashboard summary
- `getDashboardSummary(input)`
  - input: `{ asOf: string }`
  - output:
    - totals: companies, contacts, opportunities, tasks (open/completed), notes
    - opportunitiesByStage: counts for every stage value
    - overdueOpenTasks: count where `status = "open"` and `dueAt` is present and `dueAt < asOf`

## Atomicity
For every operation:
- Perform validation + existence checks before mutating state.
- On failure, state must be unchanged.

