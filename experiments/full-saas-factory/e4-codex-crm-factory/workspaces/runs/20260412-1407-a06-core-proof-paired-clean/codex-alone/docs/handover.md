# Handover — CRM Core Slice

## What exists

- Pure domain model + invariants: `packages/domain/src/index.ts`
- In-memory API facade: `packages/api/src/index.ts`
- Focused tests:
  - `packages/domain/test/domain.test.ts`
  - `packages/api/test/api.test.ts`
- Docs:
  - `docs/prd.md`
  - `docs/acceptance-criteria.md`
  - `docs/architecture/domain-model.md`
  - `docs/api-contracts.md`
  - `specs/invariants.md`
  - `docs/test-strategy.md`

## How to run

- `npm run lint`
- `npm run typecheck`
- `npm run test`

## Key design decisions

- Domain layer is deterministic and has no I/O. Callers must supply timestamps.
- API layer is in-memory and enforces referential integrity at write time.
- Opportunity stages use a small, explicit transition graph (no reopening in this slice).
- IDs are generated in the API layer with a type prefix; tests inject deterministic generators.

## How to extend safely

Common next steps:

- Add update operations (e.g., edit contact email, update opportunity amount).
- Add querying helpers (e.g., list opportunities by company, list tasks by related entity).
- Add persistence by introducing repository interfaces (keeping domain pure) and implementing adapters.

Rules of thumb:

- Keep invariants in `packages/domain` and enforce cross-entity constraints in the API/service layer.
- Keep time and randomness injected at the boundary for testability.
- Add tests for every new rule or transition.

## Known limitations

- No persistence, no multi-user access, no concurrency control.
- Minimal validation (sufficient for core slice, not production-grade).
- No bulk operations or search.

