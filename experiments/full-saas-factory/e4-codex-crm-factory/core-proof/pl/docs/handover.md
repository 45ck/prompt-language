# CRM Core Proof Handover

## What’s Implemented

### Domain (`packages/domain`)
Single entry point: `packages/domain/src/index.ts`.

Includes:
- Branded ID types (`ContactId`, `CompanyId`, `OpportunityId`, `TaskId`, `NoteId`) and shared primitives (`Timestamp`, `CalendarDate`).
- Entities: `Contact`, `Company`, `Opportunity`, `Task`, `Note`.
- Opportunity stage model + transition policy:
  - Stages: `Lead | Qualified | Proposal | Won | Lost`
  - Allowed transitions:
    - `Lead -> Qualified | Lost`
    - `Qualified -> Proposal | Lost`
    - `Proposal -> Won | Lost`
    - `Won`/`Lost` are terminal
- Core pure functions:
  - Contacts: `createContact`, `updateContact`, `searchContacts`
  - Companies: `createCompany`, `updateCompany`, `searchCompanies`
  - Opportunities: `createOpportunity`, `updateOpportunity`, `searchOpportunities`, `filterOpportunitiesByStage`, `transitionOpportunityStage`
  - Tasks: `createTask`, `updateTask`, `completeTask`, `isTaskOverdue`
  - Notes: `createNote`, `listNotesForEntity` (newest-first), `updateNoteBody` (always throws to enforce immutability)
  - Dashboard: `buildDashboardSummary` (counts + overdue + pipeline amount)
- Error type: `DomainValidationError` for invariant/validation failures.

### In-Memory Application Services (`packages/api`)
Single entry point: `packages/api/src/index.ts`.

Provides `createInMemoryCrmServices(clock)` over in-memory Maps, exporting:
- `companies`: `create`, `get`, `list`
- `contacts`: `create`, `get`, `list`
- `opportunities`: `create`, `get`, `list`, `moveStage`
- `tasks`: `create`, `list`
- `notes`: `create`, `listForEntity`
- `dashboard`: `getSummary`

The services enforce domain rules by calling the domain functions with current in-memory snapshots.

Error type:
- `EntityNotFoundError` (currently used when moving the stage for a missing opportunity)

### Documentation + Specs
- Product + scope: `docs/prd.md`, `docs/acceptance-criteria.md`
- Architecture + domain model: `docs/architecture/domain-model.md`
- Planned HTTP-style contracts (not yet implemented as an HTTP server here): `docs/api-contracts.md`
- Invariants + verification matrix: `specs/invariants.md`

## How To Run Checks
```sh
npm run ci
```

## Key Decisions (Concrete)
- IDs are branded strings; tests construct them via casts like `'company-1' as CompanyId`.
- `Timestamp` is an ISO-8601 string and `CalendarDate` is `YYYY-MM-DD`.
- The API layer injects time via a `Clock` interface (`now()` + `today()`) to keep tests deterministic.
- Notes are append-only (no update path exists; attempts are rejected).

## Known Gaps / Next Steps
- No HTTP adapter/server exists in this workspace. `docs/api-contracts.md` is the target contract to wrap the services with a real transport later.
- In-memory services intentionally expose a minimal subset:
  - Domain supports update paths (`updateContact`, `updateCompany`, `updateOpportunity`) and task completion (`completeTask`), but the in-memory service interfaces do not yet expose them.
  - If you add these service methods, extend `packages/api/test/index.test.ts` alongside any domain tests required for new rules.
- No ID generation: callers supply IDs.
- No persistence: repositories are process-local Maps.

## Files To Start With
- `packages/domain/src/index.ts`
- `packages/api/src/index.ts`
- `packages/domain/test/index.test.ts`
- `packages/api/test/index.test.ts`
- `packages/api/test/docs.test.ts`

## Guardrails
- Treat `.factory/` as frozen prompt-language control input and do not edit it.
