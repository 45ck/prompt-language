# API Contracts — In-memory CRM Core

## Entry point

- `packages/api/src/index.ts` exports `createCrmApi(overrides?: Partial<CrmApiDeps>): CrmApi`
- The API is an in-memory facade over pure domain functions.

## Dependency injection

`CrmApiDeps`:

- `now: () => Date` — injected clock used for timestamps.
- `generateId: () => string` — injected id generator used to build entity ids (prefixed by type).

Defaults:

- `now()` uses `new Date()`
- `generateId()` uses `crypto.randomUUID()`

Tests inject deterministic implementations.

## Error model

- Validation / invariant violations throw `DomainError` (from `packages/domain`).
- Missing references and relationship conflicts throw `ApiError`:
  - `ApiError(code=NOT_FOUND)`
  - `ApiError(code=CONFLICT)`

## Core interface

All “get” methods throw `ApiError(code=NOT_FOUND)` if the entity does not exist.

### Companies

- `createCompany({ name, domain? }): Company`
- `renameCompany(companyId, name): Company`
- `listCompanies(): Company[]`
- `getCompany(companyId): Company`

### Contacts

- `createContact({ firstName, lastName, email?, companyId? }): Contact`
  - If `companyId` is provided, the company must exist.
- `setContactCompany(contactId, companyId?): Contact`
  - If `companyId` is provided, the company must exist.
- `listContacts(): Contact[]`
- `getContact(contactId): Contact`

### Opportunities

- `createOpportunity({ companyId, primaryContactId?, title, amountCents, currency, stage? }): Opportunity`
  - `companyId` must exist.
  - If `primaryContactId` is provided, the contact must exist.
  - If the contact has a `companyId`, it must match `companyId` or the call fails with `ApiError(code=CONFLICT)`.
- `transitionOpportunityStage(opportunityId, toStage): Opportunity`
  - Invalid transitions throw `DomainError(code=INVALID_STAGE_TRANSITION)`.
- `listOpportunities(): Opportunity[]`
- `getOpportunity(opportunityId): Opportunity`

### Tasks

- `createTask({ title, dueAt?, related? }): Task`
  - If `related` is provided, the referenced entity must exist.
- `completeTask(taskId): Task`
- `cancelTask(taskId): Task`
- `listTasks(): Task[]`
- `getTask(taskId): Task`

### Notes

- `addNote({ body, related }): Note`
  - `related` must exist.
- `listNotes(): Note[]`
- `getNote(noteId): Note`

### Dashboard

- `getDashboardSummary(at?: Date): DashboardSummary`
  - If `at` is omitted, the injected `now()` is used.

