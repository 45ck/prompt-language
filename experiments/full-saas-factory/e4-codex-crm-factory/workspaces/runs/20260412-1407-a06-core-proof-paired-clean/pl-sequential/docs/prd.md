# Bounded CRM Core — PRD

## Summary
Build a small, deterministic CRM core slice that manages:

- Contacts
- Companies
- Opportunities (with stage transitions)
- Tasks
- Notes
- Dashboard summaries (aggregations)

This slice is intentionally **in-memory only** and designed to be implemented as pure TypeScript domain logic plus in-memory application services.

## Goals
- Provide a coherent core data model for a basic CRM workflow.
- Enforce a small set of **domain rules** (validation + stage transition rules).
- Keep the implementation deterministic and dependency-free (domain package).
- Enable fast unit tests for all behaviors.

## Non-goals (out of scope)
- Authentication/authorization, multi-tenancy, RBAC.
- Persistence (SQL/NoSQL/files), migrations, background jobs.
- UI, HTTP server, pagination, search, import/export.
- Integrations (email/calendar), notifications.
- Custom pipelines, custom fields, or configuration screens.

## Users & primary workflows
Primary user: a salesperson or sales ops user.

Primary workflows:
1. Create a company and one or more contacts.
2. Create an opportunity for a company (optionally associated to a primary contact).
3. Move the opportunity through stages until won/lost.
4. Add tasks and notes to track follow-ups.
5. View a dashboard summary of pipeline counts and work items.

## Data model (bounded)
All entities are identified by string IDs. Time is represented as an ISO-8601 string (`YYYY-MM-DDTHH:mm:ss.sssZ`) and is always **provided by the caller** to keep logic deterministic.

### Company
- `id` (string)
- `name` (string, required, trimmed, non-empty)
- `createdAt` (ISO string)

### Contact
- `id` (string)
- `displayName` (string, required, trimmed, non-empty)
- `email` (string, optional; if present must contain `@` and be trimmed)
- `companyId` (string, optional; if present must reference an existing company)
- `createdAt` (ISO string)

### Opportunity
- `id` (string)
- `companyId` (string, required; must reference an existing company)
- `primaryContactId` (string, optional; if present must reference an existing contact)
- `title` (string, required, trimmed, non-empty)
- `amountCents` (number, integer, `>= 0`)
- `currency` (string, required; uppercase 3-letter ISO code, e.g. `USD`)
- `stage` (see stage model below)
- `createdAt` (ISO string)
- `stageUpdatedAt` (ISO string)

### Task
- `id` (string)
- `subject` (one of: `{ type: "contact"; id: ContactId }`, `{ type: "company"; id: CompanyId }`, `{ type: "opportunity"; id: OpportunityId }`)
- `title` (string, required, trimmed, non-empty)
- `dueAt` (ISO string, optional)
- `status` (`"open"` | `"completed"`)
- `createdAt` (ISO string)
- `completedAt` (ISO string, optional; set only when completed)

### Note
- `id` (string)
- `subject` (same shape as Task subject)
- `body` (string, required, trimmed, non-empty)
- `createdAt` (ISO string)

## Opportunity stage model
Stages are fixed and represented as the following string values:

- `prospecting`
- `qualified`
- `proposal`
- `negotiation`
- `closed-won`
- `closed-lost`

Allowed transitions (all others are rejected):
- `prospecting` → `qualified` | `closed-lost`
- `qualified` → `proposal` | `closed-lost`
- `proposal` → `negotiation` | `closed-lost`
- `negotiation` → `closed-won` | `closed-lost`
- `closed-won` → *(no transitions)*
- `closed-lost` → *(no transitions)*

## Functional requirements
### Create & manage contacts/companies
- Create a company with a name.
- Create a contact with a display name and optional email.
- Optionally associate a contact to a company.

### Create & manage opportunities
- Create an opportunity for an existing company.
- Opportunity stage defaults to `prospecting`.
- Amount and currency are required and validated.
- Move an opportunity stage using the stage transition rules.

### Tasks & notes
- Add a task to a contact, company, or opportunity.
- Mark a task as completed (one-way).
- Add a note to a contact, company, or opportunity.

### Dashboard summary
Compute an in-memory summary from current state:
- Totals: companies, contacts, opportunities, tasks (open/completed), notes.
- Opportunities by stage: count per stage.
- Overdue open tasks: count where `dueAt` is present and `dueAt < asOf`.

Dashboard summary must be computed deterministically from the supplied state and an explicit `asOf` timestamp.

## Error handling & determinism requirements
- Domain logic must not read the system clock or generate randomness.
- Invalid inputs and invalid transitions must be rejected with explicit errors.
- No partial writes: failed operations must not mutate state.

## Delivery constraints
- Domain package: pure TypeScript, deterministic, dependency-free.
- API package: in-memory application services; depends only on the local domain package.
