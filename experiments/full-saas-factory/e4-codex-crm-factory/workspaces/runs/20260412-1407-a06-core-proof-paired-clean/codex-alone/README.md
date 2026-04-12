# CRM Core Slice (In-memory, TypeScript)

Bounded CRM core behaviors implemented as:

- Pure domain logic (`packages/domain`)
- In-memory API/service facade (`packages/api`)
- Focused `vitest` coverage

## Scope

- Contacts, companies, opportunities (stage transitions), tasks, notes, dashboard summaries

## Quick start

- `npm run lint`
- `npm run typecheck`
- `npm run test`

## Usage (in code)

```ts
import { createCrmApi } from './packages/api/src/index.js';

const crm = createCrmApi();
const company = crm.createCompany({ name: 'Acme', domain: 'acme.test' });
const contact = crm.createContact({ firstName: 'Ada', lastName: 'Lovelace', companyId: company.id });
const opp = crm.createOpportunity({
  companyId: company.id,
  primaryContactId: contact.id,
  title: 'Big Deal',
  amountCents: 500_00,
  currency: 'USD',
});

crm.transitionOpportunityStage(opp.id, 'Qualified');
crm.addNote({ body: 'Customer requested proposal update.', related: { type: 'opportunity', id: opp.id } });

const dashboard = crm.getDashboardSummary();
console.log(dashboard.pipeline.openAmountCentsTotal);
```

## Docs

- `docs/prd.md`
- `docs/acceptance-criteria.md`
- `docs/architecture/domain-model.md`
- `docs/api-contracts.md`
- `specs/invariants.md`
- `docs/test-strategy.md`
- `docs/handover.md`
