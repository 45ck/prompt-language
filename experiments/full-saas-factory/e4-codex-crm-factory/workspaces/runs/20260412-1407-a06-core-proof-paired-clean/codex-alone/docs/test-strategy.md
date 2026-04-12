# Test Strategy — CRM Core Slice

## Objectives

- Prove the core workflows work end-to-end through the in-memory API.
- Prove domain invariants and transitions are enforced deterministically.
- Keep tests small, fast, and stable.

## Test levels

### Domain unit tests (`packages/domain/test`)

- Validate normalization and invariants (e.g., trimming, email normalization).
- Validate opportunity stage transition rules.
- Validate deterministic dashboard summary computations.

### API/service tests (`packages/api/test`)

- Exercise in-memory workflows across entities (create, relate, transition).
- Verify referential integrity failures (`ApiError(code=NOT_FOUND)`).
- Verify relationship conflicts (`ApiError(code=CONFLICT)`).
- Verify domain errors bubble up from the API (e.g., invalid stage transitions).

## Determinism

- Domain layer never calls `Date.now()`, `new Date()` without an injected timestamp, or any randomness.
- API layer accepts injected `now()` and `generateId()` so tests can be fully deterministic.

## Running tests

- `npm run test`

