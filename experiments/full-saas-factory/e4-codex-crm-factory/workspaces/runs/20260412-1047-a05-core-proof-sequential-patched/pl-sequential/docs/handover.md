# Handover — Bounded CRM Core Proof

## Purpose

This repo is a deliberately small CRM “core slice” to validate:

- deterministic, dependency-free domain logic
- in-memory application services that enforce referential integrity
- explicit errors (no throws for domain conditions)

Scope is intentionally constrained; see `docs/prd.md`.

## Quick start

```sh
npm run lint
npm run typecheck
npm test
```

## Where to look

- Domain entrypoint: `packages/domain/src/index.ts`
  - exports domain types plus pure functions:
    - `createCompany`, `createContact`, `createOpportunity`
    - `transitionOpportunityStage`
    - `createTask`, `completeTask`
    - `createNote`
    - `computeDashboardSummary`
- Application/service entrypoint: `packages/api/src/index.ts`
  - `InMemoryCrmService` stores records in `Map`s and uses injected `IdGenerator`
  - performs referential integrity checks (company/contact/opportunity existence)
  - persists the results of successful domain operations

## Domain error model

All operations return `Result<T>`:

- `{ ok: true, value: T }`
- `{ ok: false, error: CrmError }`

`CrmError` includes:

- `validation` (field-level input validation)
- `not_found` (missing referenced entity)
- `invalid_transition` (stage rules)

## Stage transitions

Stages are fixed and ordered; see `packages/domain/src/index.ts` and `specs/invariants.md`.

Rules (high level):

- cannot move backward in the pipeline
- cannot change stage once terminal (`won` or `lost`)
- can move from non-terminal to `won`/`lost`

## Notes on determinism

- No system clock, randomness, or external IO is used anywhere.
- `InMemoryCrmService` requires an `IdGenerator` so tests can supply deterministic IDs.

## Extension guidelines

- Keep the domain package dependency-free and deterministic.
- Add new invariants to `specs/invariants.md` before (or alongside) implementation.
- Prefer adding domain functions first, then orchestrate them in the service layer.
- Add tests:
  - domain behavior in `packages/domain/test/*`
  - orchestration/referential integrity in `packages/api/test/*`

