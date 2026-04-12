Work only inside the current workspace root. Do not assume any surrounding repo context.

Dependencies are already installed in the workspace. Reuse the existing package files and focus on implementation and verification.

Build a bounded CRM core slice with this exact outcome contract:

- write `docs/prd.md`
- write `docs/acceptance-criteria.md`
- write `docs/architecture/domain-model.md`
- write `docs/api-contracts.md`
- write `specs/invariants.md`
- implement `packages/domain/src/index.ts`
- add focused tests under `packages/domain/test/`
- implement `packages/api/src/index.ts`
- add focused tests under `packages/api/test/`
- write `README.md`
- write `docs/handover.md`
- write `docs/test-strategy.md`
- run `npm run lint`
- run `npm run typecheck`
- run `npm run test`
- leave the workspace passing all three commands

Scope only the following CRM core behaviors:

- contacts
- companies
- opportunities
- stage transitions
- tasks
- notes
- dashboard summaries

Implementation constraints:

- use pure TypeScript domain logic
- keep application services in memory
- keep the design small and implementation-ready
- do not create UI code
- do not edit any `.factory/` files if they exist
- prefer deterministic logic and focused tests over extra scaffolding
