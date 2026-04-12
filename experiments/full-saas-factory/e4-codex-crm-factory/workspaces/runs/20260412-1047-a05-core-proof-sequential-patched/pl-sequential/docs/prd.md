# Bounded CRM Core — PRD

## Summary

Deliver a small, implementation-ready CRM core that supports:

- Contacts (people) linked to Companies (organizations)
- Opportunities (deals) linked to Companies (and optionally a primary Contact)
- Validated opportunity stage transitions
- Tasks and Notes attached to CRM records
- Dashboard summaries computed from current in-memory state

This is a **core proof slice**: deterministic domain logic, in-memory application services, and explicit domain errors.

## Goals (in scope)

### 1) Companies

- Create a company with a non-empty `name`.
- Read a company by `id`.

**Company fields (minimum):**

- `id: string`
- `name: string`

### 2) Contacts

- Create a contact with a non-empty `displayName`.
- Optionally link a contact to an existing company via `companyId`.
- Read a contact by `id`.

**Contact fields (minimum):**

- `id: string`
- `displayName: string`
- `email?: string` (if provided, must contain `@`)
- `companyId?: string`

### 3) Opportunities

- Create an opportunity for an existing company (`companyId` required).
- Optionally associate a primary contact (`primaryContactId` must reference an existing contact).
- Store a `title` and optional numeric `amount`.
- Read an opportunity by `id`.

**Opportunity fields (minimum):**

- `id: string`
- `companyId: string`
- `primaryContactId?: string`
- `title: string`
- `amount?: number` (if provided, must be `>= 0`)
- `stage: OpportunityStage`

### 4) Opportunity stages & transitions

Supported stages (ordered pipeline):

1. `prospecting`
2. `qualified`
3. `proposal`
4. `negotiation`
5. `won` (terminal)
6. `lost` (terminal)

Transition rules:

- Allowed: move **forward** in the pipeline.
- Allowed: move from any non-terminal stage to `won` or `lost`.
- Not allowed: move **backward**.
- Not allowed: change stage once `won` or `lost`.

### 5) Tasks

- Add a task to an opportunity.
- Mark a task as complete.
- List tasks for an opportunity.

**Task fields (minimum):**

- `id: string`
- `opportunityId: string`
- `title: string`
- `status: "open" | "done"`

### 6) Notes

- Add a note to a contact, company, or opportunity.
- List notes for a given target.

**Note fields (minimum):**

- `id: string`
- `targetType: "contact" | "company" | "opportunity"`
- `targetId: string`
- `body: string` (non-empty)

### 7) Dashboard summaries

Compute a summary snapshot from current state:

- `companiesTotal`
- `contactsTotal`
- `opportunitiesTotal`
- `opportunitiesByStage` (counts per stage)
- `openOpportunitiesTotal` (non-terminal)
- `wonOpportunitiesTotal`
- `lostOpportunitiesTotal`
- `tasksOpenTotal`
- `tasksDoneTotal`
- `notesTotal`

## Non-goals (explicitly out of scope)

- Authentication/authorization, users/teams, roles, audit trails
- Persistence (DB), migrations, external integrations
- Search, filtering, pagination, bulk import/export
- Deleting/merging records, duplicate detection, activity feeds
- Attachments, rich text, mentions, notifications, reminders
- Revenue forecasting, probabilities, multi-currency conversions

## Constraints & implementation notes

- Domain logic is **pure TypeScript**, deterministic, dependency-free.
- In-memory application services orchestrate domain operations and hold state.
- IDs are treated as strings; ID generation should be deterministic (e.g., injected generator) to keep tests stable.
- All operations return either a domain object/snapshot or a typed domain error (no implicit partial writes).

