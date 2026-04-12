# Bounded CRM Core (In-Memory)

Small, deterministic CRM core slice implemented as:

- `packages/domain`: dependency-free TypeScript domain logic
- `packages/api`: in-memory application service (`createCrmService`) built on the domain

## Quickstart

```sh
npm install
npm run lint
npm run typecheck
npm run test
```

## Scope

- Companies, contacts, opportunities (stage transitions)
- Tasks and notes (attached to company/contact/opportunity)
- Dashboard summary aggregations

See:
- `docs/prd.md`
- `docs/acceptance-criteria.md`
- `docs/architecture/domain-model.md`
- `docs/api-contracts.md`
- `specs/invariants.md`
- `docs/handover.md`
- `docs/test-strategy.md`
