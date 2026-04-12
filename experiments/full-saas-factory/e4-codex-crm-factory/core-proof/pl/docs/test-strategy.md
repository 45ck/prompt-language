# CRM Core Test Strategy

## Goal
Keep the CRM core slice reliable while preserving architecture boundaries:
- Domain logic is pure and deterministic.
- Application services are thin orchestration over in-memory state.

## What’s Covered Today

### Domain Unit Tests
File: `packages/domain/test/index.test.ts`

Covers:
- Contact creation validation and normalized email uniqueness.
- Company creation/update validation and normalized name uniqueness.
- Opportunity creation rules (initial stage is `Lead`, references must exist, non-negative amount).
- Stage transition rules and terminal closure semantics.
- Task rules (linked-entity must exist, overdue logic, open/complete transitions).
- Notes append-only behavior and newest-first listing.
- Dashboard summary projection (counts, overdue tasks, stage counts, open pipeline amount).

### In-Memory Service Tests
File: `packages/api/test/index.test.ts`

Covers:
- Orchestration correctness when reading/writing from Maps and delegating to domain functions.
- Query behavior for list/search/stage filters.
- Stage movement persistence in the store.
- Linking tasks/notes to stored CRM records.
- Dashboard summary computed from current in-memory snapshots.

### Documentation Presence Tests
File: `packages/api/test/docs.test.ts`

Covers:
- Required documents exist and contain key headings:
  - `docs/prd.md`
  - `docs/acceptance-criteria.md`
  - `docs/architecture/domain-model.md`
  - `docs/api-contracts.md`
  - `specs/invariants.md`

## How To Run
```sh
npm run test
npm run ci
```

## Testing Principles For This Repo
- Prefer pure unit tests for domain functions (no time, randomness, or IO).
- Make time explicit:
  - Pass `now` and `currentDate` directly in domain tests.
  - Use the injected `Clock` in application service tests (see `createClock(...)` helper in `packages/api/test/index.test.ts`).
- Cover both:
  - Happy-path state transitions and projections
  - Negative paths that must throw `DomainValidationError` or `EntityNotFoundError`
- Keep tests stable by using fixed IDs and fixed timestamps/dates.

## When Extending Functionality
- Add new rules in `packages/domain/src/index.ts` and cover them with new domain unit tests first.
- If a rule is surfaced via the in-memory services, add/extend service tests to validate orchestration + persistence.
- If you change required docs/specs, update `packages/api/test/docs.test.ts` expectations accordingly.
