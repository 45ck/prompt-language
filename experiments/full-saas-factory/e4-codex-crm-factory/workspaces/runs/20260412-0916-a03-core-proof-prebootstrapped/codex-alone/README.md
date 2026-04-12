# CRM Core Proof (Bounded Slice)

This workspace contains a small, implementation-ready CRM “core slice”:

- Pure TypeScript domain model + invariants (`packages/domain`)
- In-memory application API over the domain (`packages/api`)
- Focused tests for both layers (`packages/**/test`)

No UI code is included.

## Structure

- `packages/domain/src/index.ts`: entities, invariants, pure transitions, dashboard aggregation
- `packages/api/src/index.ts`: in-memory stores + orchestration + reference checks
- `docs/`: PRD, acceptance criteria, architecture notes, API contracts, handover, test strategy
- `specs/invariants.md`: invariant catalog (domain + API guarantees)

## Commands

```sh
npm run lint
npm run typecheck
npm run test
```

## Quick example

```ts
import { createInMemoryCrmApi } from './packages/api/src/index.js';

const api = createInMemoryCrmApi({ now: () => 1_000_000 });
const acme = api.createCompany({ name: 'Acme', domain: 'example.com' });
const alice = api.createContact({ name: 'Alice', email: 'alice@example.com', companyId: acme.id });
const opp = api.createOpportunity({ companyId: acme.id, primaryContactId: alice.id, title: 'Big deal', valueCents: 500_00 });
api.transitionOpportunityStage(opp.id, 'Qualified');

console.log(api.getDashboardSummary());
```

## Notes

If a `.factory/` folder exists in this workspace, it is considered a frozen flow control pack and should not be edited.
