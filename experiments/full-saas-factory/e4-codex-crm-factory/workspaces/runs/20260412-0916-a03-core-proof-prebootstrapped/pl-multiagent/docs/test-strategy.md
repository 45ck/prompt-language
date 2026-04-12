# Test Strategy - Bounded CRM Core

## Goals
- Prove the invariants and acceptance criteria for the bounded CRM core.
- Keep tests deterministic (no reliance on wall clock time, randomness, or external systems).
- Verify both pure domain behavior and application-layer orchestration/error mapping.

## Test levels and scope

### Domain unit tests (`packages/domain/test`)
Focus: pure validation and business rules in `packages/domain/src/index.ts`.

Coverage includes:
- Value validation (non-empty strings, amount cents, valid `YYYY-MM-DD` dates)
- Task/note parent targeting exclusivity (exactly one of `contactId`/`opportunityId`)
- Opportunity stage transition graph and terminal stage rules
- Dashboard summary projection and date-sensitive due-task counting

Helpers:
- `packages/domain/test/assert-domain-error.ts` (`expectDomainError(...)`)

### API service tests (`packages/api/test`)
Focus: in-memory orchestration in `packages/api/src/index.ts`.

Coverage includes:
- Cross-record reference validation (`companyId`, `primaryContactId`, task/note targets)
- Not-found behavior for `get*` and mutation operations
- Stage movement via `moveOpportunityStage(...)` and domain error mapping
- Dashboard summary computed from in-memory state
- Deterministic behavior via `createSequentialIdGenerator()`

Helpers:
- `packages/api/test/assert-crm-error.ts` (`expectCrmError(...)`)

## Test mapping (current suite)
- Domain:
  - `packages/domain/test/companies.test.ts`
  - `packages/domain/test/contacts.test.ts`
  - `packages/domain/test/opportunities.test.ts`
  - `packages/domain/test/stage-transitions.test.ts`
  - `packages/domain/test/tasks.test.ts`
  - `packages/domain/test/notes.test.ts`
  - `packages/domain/test/dashboard-summaries.test.ts`
- API:
  - `packages/api/test/contacts-and-opportunities.test.ts`
  - `packages/api/test/stage-transitions.test.ts`
  - `packages/api/test/tasks-notes-dashboard.test.ts`

## How to run
```sh
npm run test
```

Recommended local safety checks:
```sh
npm run lint
npm run typecheck
```

## Adding new tests
- Prefer domain tests when the behavior is a pure business rule (no lookup/orchestration required).
- Prefer API tests when the behavior involves cross-entity validation, storage, ID generation, or error mapping.
- Keep tests order-independent and avoid shared state between test cases.
- Use explicit inputs for any date-sensitive logic (`asOfDate`, `dueDate`).
