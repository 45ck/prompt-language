# CRM Core Proof Workspace

This workspace contains a bounded CRM core slice implemented as pure TypeScript domain logic plus in-memory application services.

## Scope
- Contacts and companies
- Opportunities with a fixed stage model and allowed transitions
- Tasks and append-only notes linked to CRM records
- Dashboard summaries (counts, overdue tasks, pipeline totals)

See `docs/prd.md` for the product scope and `specs/invariants.md` for the invariants.

## Layout
- `.factory/`: frozen prompt-language flow control input (do not edit)
- `packages/domain/src/index.ts`: pure domain model + validation + derived projections
- `packages/api/src/index.ts`: in-memory CRM services built on the domain
- `docs/`: PRD, acceptance criteria, architecture, and API contracts
- `specs/invariants.md`: invariants and verification matrix

## Commands
```sh
npm run lint
npm run typecheck
npm run test
npm run ci
```

## Using the In-Memory Services
`packages/api` is not an HTTP server; it exposes synchronous in-memory services you can call directly.

```ts
import {
  createInMemoryCrmServices,
  type Clock,
  type CompanyId,
  type ContactId
} from './packages/api/src/index.js';

const clock: Clock = {
  now: () => '2026-04-12T09:00:00Z',
  today: () => '2026-04-12'
};

const crm = createInMemoryCrmServices(clock);

// Create records
crm.companies.create({ id: 'company-1' as CompanyId, name: 'Acme' });
crm.contacts.create({
  id: 'contact-1' as ContactId,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ADA@example.com'
});

// Read derived summary
crm.dashboard.getSummary();
```
