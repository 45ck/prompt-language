# Test Strategy — Bounded CRM Core (In-Memory)

## Goals
- Keep the core deterministic and fast to test.
- Validate domain rules (validation, transitions, invariants).
- Validate application-service behavior (referential integrity, atomicity, cloning).

## Test layers

### 1) Domain unit tests
File: `packages/domain/test/domain.test.ts`

Covers:
- entity constructors validate and normalize (trim/non-empty, ISO timestamps)
- opportunity stage defaults and stage transitions
- task completion is one-way
- dashboard summary aggregation is deterministic

Principles:
- Inputs always include explicit `createdAt`, `now`, `asOf` timestamps.
- Tests do not rely on global state or randomness.

### 2) API service tests (in-memory)
File: `packages/api/test/crm-service.test.ts`

Covers:
- end-to-end creation flows (company → contact → opportunity → task/note → dashboard summary)
- referential integrity rejections (`not-found`)
- stage transition rejection (`invalid-transition`) without state mutation
- task completion conflict (`conflict`) without state mutation
- `CrmError` instances and shape

Principles:
- IDs are deterministic via a test `generateId` stub.
- Rejection-path tests assert state unchanged via `getDashboardSummary`.

## Commands

```sh
npm run test
```

## Adding new tests
- Prefer domain tests for pure rules and invariants.
- Prefer API tests for multi-entity flows and “no partial writes” guarantees.
- For every new command/mutation, add:
  - one “happy path” test
  - one “reject path” test asserting state is unchanged
