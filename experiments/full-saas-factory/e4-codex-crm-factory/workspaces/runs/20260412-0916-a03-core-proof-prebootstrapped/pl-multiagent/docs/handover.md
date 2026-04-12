# Handover - Bounded CRM Core Proof

## What is implemented
This workspace is a bounded CRM core implemented as deterministic TypeScript modules:

- `packages/domain/src/index.ts`
  - Domain types: `Company`, `Contact`, `Opportunity`, `Task`, `Note`, `DashboardSummary`
  - Domain policies and factories:
    - `createCompany`, `createContact`, `createOpportunity`, `createTask`, `createNote`
    - `moveOpportunityStage`, `canTransitionOpportunityStage`
    - `markTaskDone`
    - `buildDashboardSummary`
  - Domain errors:
    - `DomainError` with `code: 'validation_error' | 'invalid_stage_transition'`
  - Determinism constraints:
    - No system clock reads
    - Date logic uses explicit `asOfDate` and plain `YYYY-MM-DD` strings

- `packages/api/src/index.ts`
  - In-memory application facade:
    - `createInMemoryCrmCoreApi()` returns `CrmCoreApi`
  - ID generation:
    - `createSequentialIdGenerator()` with stable IDs like `company-1`, `contact-1`, etc.
  - API errors:
    - `CrmError` with `code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'INVALID_STAGE_TRANSITION'`
    - `CrmError('NOT_FOUND', ...)` for missing records and invalid references
    - Domain error mapping via `runDomainOperation(...)`

## Supported behaviors (high level)
- Create, list, and get:
  - companies, contacts, opportunities
- Opportunity stage transitions:
  - Allowed transitions enforced by domain policy (see `docs/prd.md`)
  - Terminal stages: `ClosedWon`, `ClosedLost`
- Tasks and notes:
  - Each task/note targets exactly one parent (contact OR opportunity)
  - Tasks support `markTaskDone`
- Dashboard summary:
  - Totals for each entity type
  - Opportunity counts per stage
  - Open pipeline amount (excludes terminal stages)
  - Due open-task count for `dueDate <= asOfDate`

## How to run checks locally
```sh
npm install
npm run lint
npm run typecheck
npm run test
```

## Files to read first
- `docs/prd.md` (scope and stage model)
- `docs/acceptance-criteria.md` (observable done criteria)
- `docs/api-contracts.md` (TypeScript service contract; not HTTP)
- `specs/invariants.md` (rules that must always hold)
- `packages/domain/src/index.ts` (domain truth)
- `packages/api/src/index.ts` (in-memory orchestration + error mapping)

## Extension guidelines
- Keep domain dependency-free (no I/O, no framework imports).
- Add cross-record checks (existence, linking) in `packages/api`.
- Add any new business rule to `specs/invariants.md` and back it with tests.
- Keep all date-sensitive behavior explicit (caller-provided `YYYY-MM-DD`).

## Known scope limits
- No persistence, auth, tenancy, or roles.
- No delete/merge/deduplication.
- No timestamps/audit trails.
- No search or reporting beyond the dashboard summary.
