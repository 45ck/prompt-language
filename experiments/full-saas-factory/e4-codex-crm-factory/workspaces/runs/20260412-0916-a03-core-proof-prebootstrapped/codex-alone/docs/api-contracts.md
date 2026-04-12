# API Contracts — In-Memory CRM

This project exposes a small in-memory “API” via a TypeScript factory.

## Entry Point

- `createInMemoryCrmApi(options?: InMemoryCrmApiOptions): CrmApi` (`packages/api/src/index.ts`)
- Domain types and helpers are re-exported from `packages/api` (IDs, entity types, stages, etc.).

## Options

```ts
export type InMemoryCrmApiOptions = {
  now?: () => number; // TimestampMs
};
```

Use `now` injection for deterministic tests and simulations.

## Error Model

All API methods may throw:

- `ApiError` with `code: 'NOT_FOUND' | 'BAD_REQUEST'`
  - `NOT_FOUND`: referenced entity does not exist
  - `BAD_REQUEST`: invalid input or invalid state transition

Domain validation errors (`DomainError`) are wrapped into `ApiError('BAD_REQUEST', ...)`.

## Core Operations (CrmApi)

### Companies

- `createCompany({ name, domain? }) -> Company`
- `updateCompany(companyId, { name?, domain? }) -> Company`
- `getCompany(companyId) -> Company`
- `listCompanies() -> Company[]`

### Contacts

- `createContact({ name, email?, phone?, companyId? }) -> Contact`
- `updateContact(contactId, { name?, email?, phone?, companyId? }) -> Contact`
- `getContact(contactId) -> Contact`
- `listContacts({ companyId? }) -> Contact[]`

### Opportunities

- `createOpportunity({ companyId, title, valueCents, currency?, stage?, primaryContactId? }) -> Opportunity`
- `updateOpportunity(opportunityId, { title?, valueCents?, primaryContactId? }) -> Opportunity`
- `transitionOpportunityStage(opportunityId, toStage, reason?) -> Opportunity`
- `getOpportunity(opportunityId) -> Opportunity`
- `listOpportunities({ companyId? }) -> Opportunity[]`

### Tasks

- `createTask({ subject, dueAt?, relatedTo? }) -> Task`
- `completeTask(taskId) -> Task`
- `getTask(taskId) -> Task`
- `listTasks({ status?, relatedTo? }) -> Task[]`

### Notes

- `createNote({ body, relatedTo }) -> Note`
- `updateNote(noteId, { body }) -> Note`
- `getNote(noteId) -> Note`
- `listNotes({ relatedTo? }) -> Note[]`

### Dashboard

- `getDashboardSummary() -> DashboardSummary`

## ID Formats

IDs are deterministic, sequential, and prefixed by entity type:

- `com_1`, `con_1`, `opp_1`, `tsk_1`, `note_1`

