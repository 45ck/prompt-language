# Handover — Bounded CRM Core (In-Memory)

## What this is
This workspace implements a bounded, deterministic CRM core slice:

- Companies
- Contacts (optional company association)
- Opportunities (fixed stages + allowed transitions)
- Tasks and notes (attached to company/contact/opportunity via a `SubjectRef`)
- Dashboard summaries (pure aggregation)

It is intentionally **in-memory only** and designed to be implementation-ready for a larger system.

## How to run quality checks

```sh
npm run lint
npm run typecheck
npm run test
```

## Code map

### Domain (`packages/domain/src/index.ts`)
Pure TypeScript with no external dependencies.

Exports:
- Entity types: `Company`, `Contact`, `Opportunity`, `Task`, `Note`
- Supporting types: `Id`, `IsoTimestamp`, `SubjectRef`, `OpportunityStage`
- Errors: `CrmError` (`type` is one of `validation | not-found | invalid-transition | conflict`)
- Constructors / commands: `createCompany`, `createContact`, `createOpportunity`, `moveOpportunityStage`, `createTask`, `completeTask`, `createNote`
- Query / projection: `computeDashboardSummary`

Key decisions:
- Determinism: callers provide timestamps (`IsoTimestamp` string), no reading the system clock.
- Validation: inputs are trimmed; timestamps must match `YYYY-MM-DDTHH:mm:ss.sssZ`.
- Stage transitions: hard-coded whitelist in `moveOpportunityStage`.
- One-way completion: `completeTask` rejects completing an already completed task.

### API service (`packages/api/src/index.ts`)
In-memory application service built on the domain.

Exports:
- `createCrmService({ generateId })`

Behavior:
- Stores entities in `Map<Id, Entity>` collections.
- Enforces referential integrity for:
  - `createContact.companyId` → existing company
  - `createOpportunity.companyId` → existing company
  - `createOpportunity.primaryContactId` → existing contact
  - task/note `subject` → existing company/contact/opportunity
- Uses domain functions for validation and transitions.
- Returns cloned entities to prevent external mutation of in-memory state.
- Includes `__debug.snapshot()` for test visibility.

## Extending the slice (safe path)

1. Add/extend domain types + pure functions in `packages/domain/src/index.ts`.
2. Add or update domain unit tests in `packages/domain/test/domain.test.ts`.
3. Wire new behaviors into `createCrmService` in `packages/api/src/index.ts` without introducing IO.
4. Add service-level tests in `packages/api/test/crm-service.test.ts` that cover:
   - happy path behavior
   - rejection paths
   - no partial writes (state unchanged on error)

## Intentional limitations
- No persistence layer, migrations, or async behavior.
- No auth, tenancy, RBAC, or audit trails.
- No indexing/search, pagination, or custom fields.
- Minimal validation (fit for a bounded core proof).
