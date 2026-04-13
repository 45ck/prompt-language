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
- write `qa-flows/crm-smoke.json`
- write `demo/crm.demo.yaml`
- write `README.md`
- write `docs/traceability.md`
- write `docs/test-strategy.md`
- write `docs/verification-summary.md`
- write `docs/product-summary.md`
- write `docs/demo-script.md`
- write `docs/release-notes.md`
- write `docs/known-issues.md`
- write `docs/handover.md`
- write `CHANGELOG.md`
- run build-if-present: if `package.json` has a `build` script, run `npm run build` and fix failures; otherwise note that build was skipped
- run `noslop doctor`
- run `noslop check --tier=fast`
- run `npm run lint`
- run `npm run typecheck`
- run `npm run test`
- leave the workspace passing build-if-present, `noslop doctor`, `noslop check --tier=fast`, `npm run lint`, `npm run typecheck`, and `npm run test`

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
- make `docs/verification-summary.md` report the actual outcomes of build-if-present, `noslop doctor`, `noslop check --tier=fast`, `npm run lint`, `npm run typecheck`, and `npm run test`
- make `docs/test-strategy.md` and `docs/known-issues.md` reflect the actual workspace state, not plans
- make release-facing docs (`docs/product-summary.md`, `docs/demo-script.md`, `docs/release-notes.md`, `CHANGELOG.md`, `docs/handover.md`) grounded in what was actually built
- keep `qa-flows/crm-smoke.json` and `demo/crm.demo.yaml` faithful to the implemented slice even if external executors are not available in the harness environment
