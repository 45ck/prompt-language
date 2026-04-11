# Codex-Alone Baseline

This is the comparison lane for the same CRM workspace without prompt-language orchestration.

## Rule

Give Codex only:

- the frozen task prompt for the current phase
- the workspace root
- artifacts produced so far

Do not give Codex the prompt-language flow files for this lane.

## Shared Workspace

Use:

`experiments/full-saas-factory/e4-codex-crm-factory/workspace/crm-app/`

## Shared Product Scope

Build a bounded CRM MVP with:

- auth
- contacts
- companies
- opportunities and pipeline stages
- tasks
- notes and activities
- dashboard reporting

## Phase Prompts

### Phase 1

Work only inside `experiments/full-saas-factory/e4-codex-crm-factory/workspace/crm-app/`. Treat it as the target repo root. Create the bounded CRM discovery pack only. Write `docs/prd.md`, `docs/personas.md`, `docs/use-cases.md`, `docs/non-functional-requirements.md`, `docs/acceptance-criteria.md`, `docs/research/problem-space.md`, `docs/research/competitors.md`, `docs/research/risk-register.md`, `docs/research/success-metrics.md`, `docs/research/workflow-patterns.md`, and `docs/research/adoption-notes.md`. Do not implement product code yet.

### Phase 2

Work only inside `experiments/full-saas-factory/e4-codex-crm-factory/workspace/crm-app/`. Using the existing product docs, produce the bounded CRM architecture pack and then implement the product. Write `docs/architecture/context.md`, `docs/architecture/container.md`, `docs/architecture/domain-model.md`, `docs/architecture/sequence-contact-to-opportunity.md`, `docs/api-contracts.md`, `docs/data-model.md`, `docs/adr-001-stack.md`, `specs/domain-glossary.md`, and `specs/invariants.md`. Then build the frontend in `apps/web`, the backend in `packages/api`, write `README.md`, `AGENTS.md`, `docs/traceability.md`, and `docs/test-strategy.md`, run lint, typecheck, and test, generate or update `qa-flows/crm-smoke.json`, make it executable, generate `demo/crm.demo.yaml`, and produce demo output under `artifacts/demo`.

### Phase 3

Work only inside `experiments/full-saas-factory/e4-codex-crm-factory/workspace/crm-app/`. Produce the release pack only. Write `CHANGELOG.md`, `docs/release-notes.md`, `docs/known-issues.md`, `docs/handover.md`, `docs/product-summary.md`, and `docs/demo-script.md`. Then ensure the workspace passes its final ship checks.
