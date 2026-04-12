# API Contracts: In-Memory CRM Core

This document specifies the TypeScript “API contracts” for the in-memory application services in `packages/api`.

These contracts are **not HTTP**. They are module-level interfaces (functions/classes) that operate on in-memory state and call into `packages/domain`.

## Error model (shared)

All operations that can fail do so by throwing a `CrmError`:

```ts
type CrmErrorCode =
  | 'validation_error'
  | 'duplicate_id'
  | 'reference_not_found'
  | 'invalid_stage_transition';

class CrmError extends Error {
  readonly code: CrmErrorCode;
  readonly details?: Record<string, unknown>;
}
```

Guidance:
- Use `validation_error` for invalid field formats/values (empty strings, bad email, bad dates, bad timestamps, negative amounts).
- Use `duplicate_id` when creating a record with an `id` that already exists in that collection.
- Use `reference_not_found` when a referenced record does not exist (e.g. `companyId`, `primaryContactId`, task/note `subject`).
- Use `invalid_stage_transition` for any stage change that violates the stage machine.

## Public types (from domain)

The API layer depends on and re-exports (or returns) domain types:

- `Company`, `Contact`, `Opportunity`, `OpportunityStage`, `Task`, `Note`, `SubjectRef`, `DashboardSummary`

## Service contract

`packages/api` provides an in-memory CRM service that manages state and enforces:
- Duplicate-ID prevention (per record type)
- Referential integrity checks (subject existence, company/contact references)
- Domain validation and transitions (via `packages/domain`)

### InMemoryCrmService

Recommended contract (implementation may vary as long as observable behavior matches):

```ts
class InMemoryCrmService {
  // --- Create ---
  createCompany(input: { id: string; name: string; now: string }): Company;

  createContact(input: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    companyId?: string;
    now: string;
  }): Contact;

  createOpportunity(input: {
    id: string;
    companyId: string;
    name: string;
    amountCents: number;
    primaryContactId?: string;
    now: string;
  }): Opportunity;

  // --- Transitions ---
  moveOpportunityStage(input: { id: string; to: OpportunityStage; at: string }): Opportunity;

  // --- Tasks ---
  addTask(input: { id: string; subject: SubjectRef; title: string; dueOn: string; now: string }): Task;
  markTaskDone(input: { id: string }): Task;

  // --- Notes ---
  addNote(input: { id: string; subject: SubjectRef; body: string; now: string }): Note;

  // --- Dashboard ---
  computeDashboardSummary(input: { today: string }): DashboardSummary;

  // --- Reads (minimal, for tests/consumers) ---
  getCompany(id: string): Company | undefined;
  getContact(id: string): Contact | undefined;
  getOpportunity(id: string): Opportunity | undefined;
  getTask(id: string): Task | undefined;
  getNote(id: string): Note | undefined;
}
```

### Behavioral requirements (by operation)

#### `createCompany`
- Validates fields via domain rules.
- Throws `duplicate_id` if `id` exists in companies.
- Stores and returns the created company.

#### `createContact`
- Validates fields via domain rules.
- Throws `duplicate_id` if `id` exists in contacts.
- If `companyId` is provided, it must exist; otherwise throw `reference_not_found`.
- Stores and returns the created contact.

#### `createOpportunity`
- Validates fields via domain rules.
- Throws `duplicate_id` if `id` exists in opportunities.
- `companyId` must exist; otherwise throw `reference_not_found`.
- If `primaryContactId` is provided, it must exist; otherwise throw `reference_not_found`.
- Sets initial stage to `Prospecting` with empty `stageHistory` (via domain constructor).
- Stores and returns the created opportunity.

#### `moveOpportunityStage`
- The opportunity `id` must exist; otherwise throw `reference_not_found`.
- Transition must be valid per stage machine; otherwise throw `invalid_stage_transition`.
- Appends `{ from, to, at }` to `stageHistory` and updates `stage` (via domain transition function).
- Stores and returns the updated opportunity.

#### `addTask`
- Validates fields via domain rules.
- Throws `duplicate_id` if `id` exists in tasks.
- `subject` must exist based on `subject.type`:
  - `company` -> company exists
  - `contact` -> contact exists
  - `opportunity` -> opportunity exists
- If missing, throw `reference_not_found`.
- Stores and returns the created task with `status = 'open'`.

#### `markTaskDone`
- The task `id` must exist; otherwise throw `reference_not_found`.
- Updates and returns the task with `status = 'done'` (via domain transition function).

#### `addNote`
- Validates fields via domain rules.
- Throws `duplicate_id` if `id` exists in notes.
- `subject` must exist (same rules as `addTask`); otherwise throw `reference_not_found`.
- Stores and returns the created note.

#### `computeDashboardSummary`
- Validates `today` is `YYYY-MM-DD`.
- Computes and returns summary from current in-memory state (via domain pure function).

