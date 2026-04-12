# Bounded CRM Core Domain Model

## Purpose
This document turns the bounded CRM core in `docs/prd.md` into an implementation-facing domain model for a pure TypeScript module. The target shape is:

- `packages/domain`: dependency-free entities, value rules, domain policies, and summary logic.
- `packages/api`: in-memory application services that manage collections, IDs, orchestration, and lookups.

The model is transport-free. No HTTP, database, queue, clock, or framework assumptions belong in this slice.

## Bounded context
The bounded context is a small CRM core for one internal operator. It tracks:

- companies
- contacts
- opportunities
- tasks
- notes
- dashboard summaries

Out of scope:

- auth, roles, or tenancy
- persistence and migrations
- deletion, merge, and deduplication flows
- notifications or reminders
- custom fields or forecasting

## Layered ownership
The package boundary should respect the repo rule:

```text
presentation -> infrastructure -> application -> domain
```

For this proof:

- `packages/domain` owns business truth.
- `packages/api` behaves as the application layer even though the package is named `api`.
- Presentation and infrastructure adapters can wrap the service contracts later.

## Core domain types

### Company
Represents an organization that can own contacts and opportunities.

Identity:

- `companyId: string`

Attributes:

- `name: string`
- `domain?: string`

Rules:

- `name` must be non-empty after trimming.
- `domain` is optional and stored as provided.
- No uniqueness rule exists for `name` or `domain` in this slice.

Suggested TypeScript shape:

```ts
export interface Company {
  companyId: string;
  name: string;
  domain?: string;
}
```

### Contact
Represents a person the operator interacts with.

Identity:

- `contactId: string`

Attributes:

- `fullName: string`
- `email?: string`
- `phone?: string`
- `companyId?: string`

Rules:

- `fullName` must be non-empty after trimming.
- `companyId` is optional.
- When `companyId` is present, it must reference an existing company.
- A contact may exist without a company.

Suggested TypeScript shape:

```ts
export interface Contact {
  contactId: string;
  fullName: string;
  email?: string;
  phone?: string;
  companyId?: string;
}
```

### Opportunity
Represents a sales opportunity moving through a fixed stage model.

Identity:

- `opportunityId: string`

Attributes:

- `title: string`
- `stage: OpportunityStage`
- `amountCents: number`
- `companyId?: string`
- `primaryContactId?: string`

Rules:

- `title` must be non-empty after trimming.
- `amountCents` must be an integer greater than or equal to zero.
- `stage` defaults to `Prospecting`.
- `companyId` is optional and must resolve when present.
- `primaryContactId` is optional and must resolve when present.
- No invariant requires `primaryContactId` to belong to the same company as `companyId`.

Suggested TypeScript shape:

```ts
export type OpportunityStage =
  | "Prospecting"
  | "Qualified"
  | "Proposal"
  | "Negotiation"
  | "ClosedWon"
  | "ClosedLost";

export interface Opportunity {
  opportunityId: string;
  title: string;
  stage: OpportunityStage;
  amountCents: number;
  companyId?: string;
  primaryContactId?: string;
}
```

### Task
Represents one follow-up action for exactly one parent record.

Identity:

- `taskId: string`

Attributes:

- `subject: string`
- `status: TaskStatus`
- `dueDate?: string`
- `contactId?: string`
- `opportunityId?: string`

Rules:

- `subject` must be non-empty after trimming.
- `status` is `Open` or `Done`.
- Exactly one of `contactId` or `opportunityId` must be present.
- The referenced parent must exist.
- `dueDate`, when present, is a plain `YYYY-MM-DD` string.

Suggested TypeScript shape:

```ts
export type TaskStatus = "Open" | "Done";

export interface Task {
  taskId: string;
  subject: string;
  status: TaskStatus;
  dueDate?: string;
  contactId?: string;
  opportunityId?: string;
}
```

### Note
Represents freeform text attached to exactly one parent record.

Identity:

- `noteId: string`

Attributes:

- `body: string`
- `contactId?: string`
- `opportunityId?: string`

Rules:

- `body` must be non-empty after trimming.
- Exactly one of `contactId` or `opportunityId` must be present.
- The referenced parent must exist.

Suggested TypeScript shape:

```ts
export interface Note {
  noteId: string;
  body: string;
  contactId?: string;
  opportunityId?: string;
}
```

### DashboardSummary
Represents a derived read model built from current in-memory state and an explicit date input.

Suggested TypeScript shape:

```ts
export interface DashboardSummary {
  totals: {
    contacts: number;
    companies: number;
    opportunities: number;
    tasks: number;
    notes: number;
  };
  opportunitiesByStage: Record<OpportunityStage, number>;
  openPipelineAmountCents: number;
  openTasksDueCount: number;
}
```

## Relationship model

| Source | Relation | Target | Cardinality | Notes |
| --- | --- | --- | --- | --- |
| Contact | belongs to | Company | `0..1 -> 1` | Optional company linkage |
| Opportunity | belongs to | Company | `0..1 -> 1` | Optional deal ownership by company |
| Opportunity | primary contact | Contact | `0..1 -> 1` | Optional lead contact |
| Task | targets | Contact | `0..1 -> 1` | Mutually exclusive with opportunity target |
| Task | targets | Opportunity | `0..1 -> 1` | Mutually exclusive with contact target |
| Note | targets | Contact | `0..1 -> 1` | Mutually exclusive with opportunity target |
| Note | targets | Opportunity | `0..1 -> 1` | Mutually exclusive with contact target |

Important absences:

- Companies do not directly own tasks or notes.
- Contacts do not directly own opportunities.
- Notes and tasks do not nest or reference each other.
- No delete behavior means referential cleanup is out of scope.

## Aggregate and consistency boundaries
This slice is small enough that a single in-memory application service can coordinate cross-record checks, but domain truth should still stay explicit.

Recommended aggregate interpretation:

- `Company`, `Contact`, `Opportunity`, `Task`, and `Note` are entities.
- `OpportunityStage` and `TaskStatus` are domain enums.
- `DashboardSummary` is a derived projection, not a persisted entity.

Consistency expectations:

- Entity-level validation belongs in domain factories or constructors.
- Cross-record reference checks belong in the in-memory application layer because they need collection access.
- Transition rules for opportunity stages belong in domain policy code because they are pure business rules.

## Opportunity lifecycle

### Stage order
1. `Prospecting`
2. `Qualified`
3. `Proposal`
4. `Negotiation`
5. `ClosedWon`
6. `ClosedLost`

### Allowed transitions

| From | To |
| --- | --- |
| Prospecting | Qualified |
| Prospecting | ClosedLost |
| Qualified | Proposal |
| Qualified | ClosedLost |
| Proposal | Negotiation |
| Proposal | ClosedLost |
| Negotiation | ClosedWon |
| Negotiation | ClosedLost |

### Lifecycle rules

- Any transition not listed above is invalid.
- `ClosedWon` and `ClosedLost` are terminal.
- Reopening is not allowed.
- Stage movement should mutate only the `stage` field.

This policy should be implemented as a pure domain function:

```ts
export function canTransitionOpportunityStage(
  from: OpportunityStage,
  to: OpportunityStage,
): boolean;
```

## Domain responsibilities
`packages/domain` should contain pure logic only:

- entity factories or validation helpers
- string and numeric validation
- opportunity stage transition policy
- dashboard summary calculation
- error codes or domain error constructors that do not depend on transport

Recommended pure functions:

```ts
export function createCompany(props: Company): Company;
export function createContact(props: Contact): Contact;
export function createOpportunity(props: Opportunity): Opportunity;
export function createTask(props: Task): Task;
export function createNote(props: Note): Note;
export function markTaskDone(task: Task): Task;
export function moveOpportunityStage(
  opportunity: Opportunity,
  nextStage: OpportunityStage,
): Opportunity;
export function buildDashboardSummary(input: {
  companies: Company[];
  contacts: Contact[];
  opportunities: Opportunity[];
  tasks: Task[];
  notes: Note[];
  asOfDate: string;
}): DashboardSummary;
```

## Application responsibilities
`packages/api` should own in-memory orchestration:

- ID generation
- collection storage
- lookup by id
- reference validation against stored entities
- command execution ordering
- list/query helpers
- returning deterministic snapshots

Suggested service composition:

- `InMemoryCompanyService`
- `InMemoryContactService`
- `InMemoryOpportunityService`
- `InMemoryTaskService`
- `InMemoryNoteService`
- `InMemoryDashboardService`

Or a single facade:

```ts
export interface CrmCoreService {
  createCompany(input: CreateCompanyInput): Company;
  getCompany(companyId: string): Company;
  listCompanies(): Company[];
  createContact(input: CreateContactInput): Contact;
  getContact(contactId: string): Contact;
  listContacts(): Contact[];
  createOpportunity(input: CreateOpportunityInput): Opportunity;
  getOpportunity(opportunityId: string): Opportunity;
  listOpportunities(): Opportunity[];
  moveOpportunityStage(input: MoveOpportunityStageInput): Opportunity;
  addTask(input: AddTaskInput): Task;
  markTaskDone(taskId: string): Task;
  listTasks(filter?: TaskListFilter): Task[];
  addNote(input: AddNoteInput): Note;
  listNotes(filter?: NoteListFilter): Note[];
  getDashboardSummary(asOfDate: string): DashboardSummary;
}
```

## Determinism and testing posture
The model is intentionally shaped for fast, reliable tests:

- IDs come from injected application logic, not hidden state in the domain.
- Date-sensitive summary rules take `asOfDate` explicitly.
- List behavior should be deterministic; insertion order is the simplest acceptable contract.
- The domain package should be testable with plain object inputs and pure function assertions.

## Open design decisions intentionally left out
These are not hidden gaps; they are deferred by scope:

- delete semantics and orphan handling
- merge or deduplication rules
- optimistic concurrency or versioning
- timestamps and audit trails
- ownership alignment between `companyId` and `primaryContactId`
