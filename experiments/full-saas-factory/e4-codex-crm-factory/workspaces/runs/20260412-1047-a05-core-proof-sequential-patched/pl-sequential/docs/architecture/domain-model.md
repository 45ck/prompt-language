# Bounded CRM Core — Domain Model

## Overview

This CRM core is intentionally small and deterministic:

- **Domain**: pure TypeScript types + pure functions (no IO, no time, no randomness).
- **Application (in-memory)**: owns state and enforces referential integrity across aggregates.
- **Errors**: explicit and typed (no partial writes).

## Entities (domain)

### Company

Represents an organization.

- `id: string`
- `name: string` (required, non-empty after trimming)

### Contact

Represents a person.

- `id: string`
- `displayName: string` (required, non-empty after trimming)
- `email?: string` (if present, must contain `@`)
- `companyId?: string` (optional link to a company; existence checked by application)

### Opportunity

Represents a deal.

- `id: string`
- `companyId: string` (required; existence checked by application)
- `primaryContactId?: string` (optional; existence checked by application)
- `title: string` (required, non-empty after trimming)
- `amount?: number` (if present, must be `>= 0`)
- `stage: OpportunityStage`

### Task

Represents a to-do attached to an opportunity.

- `id: string`
- `opportunityId: string` (required; existence checked by application)
- `title: string` (required, non-empty after trimming)
- `status: "open" | "done"`

### Note

Represents free-form text attached to a CRM record.

- `id: string`
- `targetType: "contact" | "company" | "opportunity"`
- `targetId: string` (required; existence checked by application)
- `body: string` (required, non-empty after trimming)

## Value objects (domain)

### OpportunityStage

Pipeline stages (ordered):

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

## Domain errors (shared)

All operations use a shared error union so both domain and application can return the same shapes.

- `ValidationError`: invalid input (e.g., empty `name`, invalid `email`, negative `amount`)
- `NotFoundError`: missing entity reference (e.g., `companyId` not found)
- `InvalidTransitionError`: invalid opportunity stage transition

## Domain operations (pure)

Pure functions validate and transform data. They do not read or write collections.

- Create/validate entities:
  - `createCompany(...)`
  - `createContact(...)`
  - `createOpportunity(...)` (starts at stage `prospecting`)
  - `createTask(...)` (starts with `status: "open"`)
  - `createNote(...)`
- Stage transitions:
  - `transitionOpportunityStage(opportunity, toStage)`
- Task transitions:
  - `completeTask(task)`
- Reporting:
  - `computeDashboardSummary({ companies, contacts, opportunities, tasks, notes })`

## Application responsibilities (in-memory)

The in-memory application layer enforces cross-entity rules that require state:

- `contact.companyId` (if provided) must reference an existing company.
- `opportunity.companyId` must reference an existing company.
- `opportunity.primaryContactId` (if provided) must reference an existing contact.
- `task.opportunityId` must reference an existing opportunity.
- `note.targetType + targetId` must reference an existing record of that type.

The application layer also defines list semantics:

- Listing notes for a target returns only that target’s notes in **insertion order**.
