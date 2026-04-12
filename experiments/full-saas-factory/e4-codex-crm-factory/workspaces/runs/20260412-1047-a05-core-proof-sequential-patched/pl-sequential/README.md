# Bounded CRM Core (Proof Slice)

This workspace contains a small, deterministic CRM core implemented as:

- `packages/domain`: pure TypeScript domain types + functions (no external deps)
- `packages/api`: in-memory application service (`InMemoryCrmService`) that orchestrates the domain

The `.factory/` folder is frozen flow control input and must not be edited.

## What’s implemented

- Companies, contacts, opportunities
- Opportunity stage transitions (`prospecting → qualified → proposal → negotiation → won|lost`)
- Tasks (add, complete, list by opportunity)
- Notes (add, list by target, insertion order preserved)
- Dashboard summary computed from current in-memory state

## Repo map

- `docs/prd.md`: scope + constraints
- `docs/acceptance-criteria.md`: testable requirements
- `docs/architecture/domain-model.md`: domain model + boundaries
- `docs/api-contracts.md`: service API surface and errors
- `specs/invariants.md`: invariants and transition rules
- `docs/test-strategy.md`: testing approach
- `docs/handover.md`: maintenance + extension notes

## Commands

```sh
npm test
npm run lint
npm run typecheck
```
