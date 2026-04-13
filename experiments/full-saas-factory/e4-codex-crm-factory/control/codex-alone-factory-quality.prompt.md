Work only inside the current workspace root. Do not assume any surrounding repo context.

Dependencies are already installed in the workspace. Reuse the existing package files and focus on implementation and verification.

Build a bounded CRM core slice with this exact outcome contract:

- write `docs/prd.md`
- write `docs/acceptance-criteria.md`
- write `docs/personas.md`
- write `docs/use-cases.md`
- write `docs/non-functional-requirements.md`
- write `docs/architecture/context.md`
- write `docs/architecture/container.md`
- write `docs/architecture/domain-model.md`
- write `docs/architecture/sequence-contact-to-opportunity.md`
- write `docs/api-contracts.md`
- write `docs/data-model.md`
- write `docs/adr-001-stack.md`
- write `specs/domain-glossary.md`
- write `specs/invariants.md`
- implement `packages/domain/src/index.ts`
- add focused tests under `packages/domain/test/`
- implement `packages/api/src/index.ts`
- add focused tests under `packages/api/test/`
- write `README.md`
- write `docs/traceability.md`
- write `docs/test-strategy.md`
- write `docs/product-summary.md`
- write `docs/demo-script.md`
- write `docs/release-notes.md`
- write `docs/known-issues.md`
- write `docs/handover.md`
- write `CHANGELOG.md`
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

Factory-quality requirements:

- keep the docs internally consistent with the implemented code and tests
- make `docs/traceability.md` connect the scope, artifacts, and verification
- make `docs/test-strategy.md` and `docs/known-issues.md` reflect the actual workspace state, not plans
- make release-facing docs (`docs/product-summary.md`, `docs/demo-script.md`, `docs/release-notes.md`, `CHANGELOG.md`, `docs/handover.md`) grounded in what was actually built
