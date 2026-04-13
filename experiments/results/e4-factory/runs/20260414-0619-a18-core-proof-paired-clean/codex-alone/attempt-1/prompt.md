Work only inside the current workspace root.

Treat `.factory/` as frozen control input except for `.factory/checkpoints/pre-verification-ready`, which is reserved for the recovery harness.

Goal:

Produce a bounded CRM core slice that includes:

- `docs/prd.md`
- `docs/acceptance-criteria.md`
- `docs/architecture/domain-model.md`
- `docs/api-contracts.md`
- `specs/invariants.md`
- `packages/domain/src/index.ts`
- focused tests under `packages/domain/test`
- `packages/api/src/index.ts`
- focused tests under `packages/api/test`
- `README.md`
- `docs/handover.md`
- `docs/test-strategy.md`

Scope:

- contacts
- companies
- opportunities
- stage transitions
- tasks
- notes
- dashboard summaries

Technical constraints:

- pure TypeScript domain logic
- deterministic behavior
- in-memory application services only
- `packages/api` may depend on the local domain package only

Recovery rule:

- If `.factory/checkpoints/pre-verification-ready` already exists, treat this as a resumed run after a forced stop.
- In that case, do not restart from scratch.
- Inspect the current workspace state, keep the existing docs and code, finish validation and repair work, and get `npm run lint`, `npm run typecheck`, and `npm run test` all passing.

First-pass rule:

- If `.factory/checkpoints/pre-verification-ready` does not exist, build the required docs and code artifacts first.
- Immediately before you start verification and repair work, create `.factory/checkpoints/pre-verification-ready`.
- After the checkpoint exists, continue by running the local tooling and fixing the workspace until lint, typecheck, and test all pass.
