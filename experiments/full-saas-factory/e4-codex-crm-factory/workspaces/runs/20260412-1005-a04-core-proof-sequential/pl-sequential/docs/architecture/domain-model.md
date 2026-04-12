# Domain Model: Bounded CRM Core

This document defines the domain model for the “core proof” bounded CRM slice.

## Layering

- `packages/domain` contains **pure, deterministic, dependency-free** TypeScript domain logic:
  - Data types (entities/value objects)
  - Validation
  - Opportunity stage machine
  - Dashboard summary computation (pure function)
- `packages/api` contains **in-memory application services**:
  - Uniqueness checks (duplicate IDs)
  - Reference checks across aggregates (company/contact/opportunity existence)
  - In-memory state (Maps or equivalent)
  - Orchestration by calling `packages/domain`

No persistence, HTTP, UI, auth, or integrations are modeled in this core slice.

## Cross-cutting conventions

### Identifiers

- All records use `id: string`, provided by the caller.
- Uniqueness is enforced by the application service per record type.
- IDs are treated as opaque strings; no parsing rules.

### Time and dates (deterministic)

- `createdAt` and opportunity stage-change `at` are **caller-provided** ISO-8601 strings (validated).
- Task due dates use `dueOn: string` in `YYYY-MM-DD` (validated).
- Dashboard summary uses `today: string` in `YYYY-MM-DD` (validated).

### Subjects (for tasks and notes)

Tasks and notes attach to a `SubjectRef`:

```ts
type SubjectType = 'company' | 'contact' | 'opportunity';
type SubjectRef = { type: SubjectType; id: string };
```

Subject existence is validated by the application service (since it requires access to in-memory state).

## Entities and value objects

### Company

Represents an account / organization.

Fields:
- `id: string`
- `name: string` (required, non-empty)
- `createdAt: string` (ISO-8601)

Domain validation:
- `name` must be non-empty
- `createdAt` must be ISO-8601

### Contact

Represents a person, optionally associated to a company.

Fields:
- `id: string`
- `firstName: string` (required, non-empty)
- `lastName: string` (required, non-empty)
- `email?: string` (optional; if present, must be valid format)
- `companyId?: string` (optional; if present, must refer to an existing company)
- `createdAt: string` (ISO-8601)

Domain validation:
- `firstName`, `lastName` non-empty
- `email` format if present
- `createdAt` ISO-8601

Application validation:
- If `companyId` present, it must exist.

### Opportunity

Represents a deal / pipeline item owned by a company.

Fields:
- `id: string`
- `companyId: string` (required; must exist)
- `name: string` (required, non-empty)
- `stage: OpportunityStage`
- `amountCents: number` (required; integer, `>= 0`)
- `primaryContactId?: string` (optional; if present, must exist)
- `createdAt: string` (ISO-8601)
- `stageHistory: OpportunityStageChange[]` (append-only)

Value objects:

```ts
type OpportunityStage =
  | 'Prospecting'
  | 'Qualified'
  | 'Proposal'
  | 'Negotiation'
  | 'ClosedWon'
  | 'ClosedLost';

type OpportunityStageChange = {
  from: OpportunityStage;
  to: OpportunityStage;
  at: string; // ISO-8601
};
```

Domain validation:
- `name` non-empty
- `amountCents` integer and `>= 0`
- `createdAt` ISO-8601
- `stageHistory[].at` ISO-8601

Application validation:
- `companyId` must exist
- `primaryContactId` (if present) must exist

#### Stage machine (bounded)

Stage ordering:

```
Prospecting -> Qualified -> Proposal -> Negotiation -> ClosedWon
```

Rules:
- No skipping forward stages (e.g. `Prospecting -> Proposal` invalid).
- From any **open** stage (`Prospecting`, `Qualified`, `Proposal`, `Negotiation`) you may move to `ClosedLost`.
- `ClosedWon` and `ClosedLost` are terminal (no outgoing transitions).
- Each valid transition appends a `stageHistory` item `{ from, to, at }`.

The stage machine is enforced in the domain function that transitions an opportunity.

### Task

Represents a follow-up item attached to a CRM record.

Fields:
- `id: string`
- `subject: SubjectRef` (required; must exist)
- `title: string` (required, non-empty)
- `dueOn: string` (`YYYY-MM-DD`)
- `status: 'open' | 'done'` (defaults to `'open'`)
- `createdAt: string` (ISO-8601)

Domain validation:
- `title` non-empty
- `dueOn` `YYYY-MM-DD`
- `createdAt` ISO-8601

Application validation:
- `subject` must exist.

### Note

Represents freeform text attached to a CRM record.

Fields:
- `id: string`
- `subject: SubjectRef` (required; must exist)
- `body: string` (required, non-empty)
- `createdAt: string` (ISO-8601)

Domain validation:
- `body` non-empty
- `createdAt` ISO-8601

Application validation:
- `subject` must exist.

## Dashboard summary (pure computation)

The dashboard summary is computed from in-memory state and `today`.

Inputs:
- `companies: Company[]`
- `contacts: Contact[]`
- `opportunities: Opportunity[]`
- `tasks: Task[]`
- `today: string` (`YYYY-MM-DD`)

Outputs (bounded):

```ts
type DashboardSummary = {
  companiesTotal: number;
  contactsTotal: number;
  opportunitiesTotal: number;
  openOpportunitiesTotal: number;
  opportunitiesByStage: Record<OpportunityStage, number>;
  openOpportunityAmountCentsTotal: number;
  openTasksTotal: number;
  openTasksOverdue: number;
  openTasksDueToday: number;
};
```

Rules:
- “Open opportunity” means `stage` is not `ClosedWon` and not `ClosedLost`.
- `openOpportunityAmountCentsTotal` sums `amountCents` for open opportunities only.
- Task counts only include tasks with `status === 'open'`.
- Overdue/due-today classification compares `dueOn` to `today` lexicographically (safe for `YYYY-MM-DD`).

Notes are stored and retrievable by subject, but do not contribute numeric summary fields for this slice.

## Domain API surface (planned exports)

`packages/domain` is expected to export:
- Types: `Company`, `Contact`, `Opportunity`, `OpportunityStage`, `OpportunityStageChange`, `Task`, `Note`, `SubjectRef`, `DashboardSummary`
- Errors: `CrmError` (see `docs/api-contracts.md` error model)
- Constructors/validators: `createCompany`, `createContact`, `createOpportunity`, `createTask`, `createNote`
- Transitions: `moveOpportunityStage`, `markTaskDone`
- Computation: `computeDashboardSummary`
