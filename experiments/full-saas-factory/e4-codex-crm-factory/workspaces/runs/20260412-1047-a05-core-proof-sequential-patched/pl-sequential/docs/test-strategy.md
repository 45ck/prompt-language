# Test Strategy — Bounded CRM Core

## Goals

- Prove correctness of domain invariants and transitions with deterministic unit tests.
- Prove application orchestration (referential integrity, persistence, summaries) with in-memory service tests.
- Keep tests stable: no time, no randomness, no IO.

## Tooling

- Test runner: Vitest (`npm test`)
- Type-check: TypeScript (`npm run typecheck`)
- Lint: ESLint (`npm run lint`)

## Test layers

### 1) Domain tests (`packages/domain/test`)

Focus: pure functions and invariants.

- Validation:
  - trimming/empty fields
  - email format (`@`)
  - numeric amount constraints (`>= 0`, finite)
- Stage transitions:
  - forward-only pipeline
  - non-terminal → terminal allowed
  - terminal is immutable
- Dashboard summary:
  - counts by stage
  - open/won/lost totals
  - task open/done totals
  - total notes

### 2) Service tests (`packages/api/test`)

Focus: orchestration + in-memory persistence.

- ID determinism via an injected `IdGenerator` (a fixed sequence).
- Referential integrity:
  - contact.companyId must exist
  - opportunity.companyId must exist
  - opportunity.primaryContactId must exist (if provided)
- Mutation behavior:
  - stage transitions persist to stored opportunities
  - completing a task persists the updated status
- Collection semantics:
  - tasks list is filtered by opportunity
  - notes list preserves insertion order per target
- Summary correctness:
  - `getDashboardSummary()` matches current stored state

## Adding new behavior

1. Capture the rule in `specs/invariants.md` and acceptance criteria (if user-visible).
2. Add/extend a domain function in `packages/domain/src/index.ts`.
3. Add a focused domain test.
4. Add/extend the service method in `packages/api/src/index.ts`.
5. Add a service-level test proving persistence/orchestration.

