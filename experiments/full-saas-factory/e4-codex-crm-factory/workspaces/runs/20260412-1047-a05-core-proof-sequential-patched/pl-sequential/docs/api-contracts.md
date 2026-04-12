# Bounded CRM Core — API Contracts (In-Memory Application Services)

This document defines the **TypeScript-level** contracts for in-memory application services. This is **not** an HTTP API; it is the public interface of `packages/api`.

## Conventions

- **Deterministic IDs**: services receive an injected `IdGenerator` to create IDs.
- **Typed errors**: methods return either a value or a `CrmError` (no partial writes).
- **State**: services store data in memory and use domain functions for validation and computations.

## Types (conceptual)

### Id generation

- `IdGenerator`:
  - `nextId(): string`

### Result and errors

- `Result<T>`: `{ ok: true; value: T } | { ok: false; error: CrmError }`
- `CrmError` (shared union):
  - `ValidationError`
  - `NotFoundError`
  - `InvalidTransitionError`

## Service contract

### `InMemoryCrmService`

#### Companies

- `createCompany(input: { name: string }): Result<Company>`
- `getCompany(id: string): Result<Company>`

#### Contacts

- `createContact(input: { displayName: string; email?: string; companyId?: string }): Result<Contact>`
- `getContact(id: string): Result<Contact>`

#### Opportunities

- `createOpportunity(input: { companyId: string; primaryContactId?: string; title: string; amount?: number }): Result<Opportunity>`
- `getOpportunity(id: string): Result<Opportunity>`

#### Opportunity stage transitions

- `moveOpportunityStage(input: { opportunityId: string; toStage: OpportunityStage }): Result<Opportunity>`

Semantics:

- Fails with `NotFoundError` if `opportunityId` does not exist.
- Fails with `InvalidTransitionError` if the transition is not allowed.
- Returns the updated opportunity with the new stage.

#### Tasks

- `addTask(input: { opportunityId: string; title: string }): Result<Task>`
- `completeTask(input: { taskId: string }): Result<Task>`
- `listTasksForOpportunity(input: { opportunityId: string }): Result<Task[]>`

Semantics:

- `addTask` fails with `NotFoundError` if the opportunity does not exist.
- `listTasksForOpportunity` fails with `NotFoundError` if the opportunity does not exist.

#### Notes

- `addNote(input: { targetType: "contact" | "company" | "opportunity"; targetId: string; body: string }): Result<Note>`
- `listNotesForTarget(input: { targetType: "contact" | "company" | "opportunity"; targetId: string }): Result<Note[]>`

Semantics:

- Adding a note fails with `NotFoundError` if the target record does not exist.
- Listing notes returns notes in **insertion order**.

#### Dashboard summary

- `getDashboardSummary(): DashboardSummary`

Semantics:

- Summary values are computed from current in-memory state and match the domain definition.

## Expected implementation boundaries

- `packages/api` depends only on `packages/domain` (no upward imports into domain).
- `packages/domain` owns:
  - entity types (`Company`, `Contact`, `Opportunity`, `Task`, `Note`)
  - value objects (`OpportunityStage`)
  - pure functions for validation, transitions, and summary computation
