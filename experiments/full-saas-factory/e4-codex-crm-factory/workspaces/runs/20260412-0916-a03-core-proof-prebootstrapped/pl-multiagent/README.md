# Bounded CRM Core (Proof)

This workspace implements a small, deterministic CRM core slice in TypeScript:

- `packages/domain`: dependency-free domain logic (entities, validation, stage rules, dashboard summary).
- `packages/api`: in-memory application services (ID generation, cross-entity lookups, orchestration).

The `.factory/` folder is frozen flow control input and must not be edited.

## Docs
- `docs/prd.md`
- `docs/acceptance-criteria.md`
- `docs/architecture/domain-model.md`
- `docs/api-contracts.md`
- `specs/invariants.md`
- `docs/handover.md`
- `docs/test-strategy.md`

## Quickstart
```sh
npm install
npm run lint
npm run typecheck
npm run test
```

## Example usage
```ts
import { createInMemoryCrmCoreApi } from './packages/api/src/index.js';

const crm = createInMemoryCrmCoreApi();

const company = crm.createCompany({ name: 'Acme' });
const contact = crm.createContact({
  fullName: 'Jane Doe',
  companyId: company.companyId
});
const opportunity = crm.createOpportunity({
  title: 'Starter Plan',
  amountCents: 50_000,
  companyId: company.companyId,
  primaryContactId: contact.contactId
});

crm.moveOpportunityStage({ opportunityId: opportunity.opportunityId, nextStage: 'Qualified' });
crm.addTask({ subject: 'Follow up', dueDate: '2026-04-12', contactId: contact.contactId });

const summary = crm.getDashboardSummary({ asOfDate: '2026-04-12' });
console.log(summary.openPipelineAmountCents);
```
