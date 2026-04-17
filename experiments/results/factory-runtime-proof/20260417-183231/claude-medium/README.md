# E6 Pure Prompt-Language CRM Factory

A sibling of `e4-codex-crm-factory/`. Where E4 mixes prompt-language orchestration with a Codex-specific baseline prompt and bash-driven bootstrap scaffolding, E6 is the inverse: **prompt-language is the entire contract**. No runner-specific prompts. No shell orchestration. No `bootstrap/` or `control/` directories. One invocation, one flow pack.

## Thesis

If prompt-language is a credible primary engineering medium, a factory for a real product (bounded CRM MVP) should be expressible as:

- one top-level `project.flow`
- a small set of phase flows (`discovery`, `build`, `release`)
- reusable micro-flow libraries (`scaffold`, `crud`, `acceptance`, `commit`, `deps`)
- nothing else

That is what this experiment ships. It deliberately excludes any runner-specific prompt template.

## How to invoke

From the repo root:

```sh
node bin/cli.mjs install
cd experiments/full-saas-factory/e6-pl-crm-factory
claude -p --dangerously-skip-permissions "$(cat project.flow)"
```

The `project.flow` content is the whole contract. There is no wrapper script, no hidden environment, no implicit bootstrap. Any agent that implements the prompt-language plugin can consume the same flow pack.

## Layout

```text
experiments/full-saas-factory/e6-pl-crm-factory/
  README.md
  project.flow
  phases/
    discovery.flow
    build.flow
    release.flow
  libraries/
    scaffold-project.flow
    generate-crud-entity.flow
    run-acceptance.flow
    git-commit.flow
    install-dependencies.flow
  workspace/
    crm-app/
      README.md
```

## Expected inputs

Memory keys set by `project.flow` before any phase runs:

- `crm_target_market` — business focus for the MVP
- `crm_stack` — technology stack
- `crm_package_manager` — lint/typecheck/test runner
- `crm_workspace` — bounded workspace path (`workspace/crm-app/`)
- `crm_entities` — space-separated list of core CRM entities (drives `foreach` CRUD generation)

Override any of these by editing `project.flow` or by pre-seeding memory with a `memory:` adapter before invocation.

## Expected outputs (inside `workspace/crm-app/`)

- `docs/prd.md`, `docs/personas.md`, `docs/use-cases.md`, `docs/non-functional-requirements.md`, `docs/acceptance-criteria.md`
- `docs/research/*.md`
- `docs/architecture/*.md`, `docs/data-model.md`, `docs/api-contracts.md`, `docs/adr/adr-001-stack.md`
- `apps/web/`, `packages/api/` (implementation)
- `README.md`, `AGENTS.md`, `docs/traceability.md`, `docs/test-strategy.md`
- `CHANGELOG.md`, `docs/release-notes.md`, `docs/known-issues.md`, `docs/handover.md`, `docs/product-summary.md`, `docs/demo-script.md`

Final `ship_gates` in `libraries/run-acceptance.flow` enforce this artifact set plus green `lint`, `typecheck`, and `test`.

## Differences from E4 (Codex-driven)

| Dimension                 | E4 (`e4-codex-crm-factory`)                                   | E6 (`e6-pl-crm-factory`)                                           |
| ------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| Primary medium            | Codex prompt + PL flow pack                                   | PL flow pack only                                                  |
| Runner assumption         | Codex `codex` CLI                                             | Any PL-capable agent (`claude -p`, etc.)                           |
| Bootstrap                 | `bootstrap/` directory with seeded overlays                   | `libraries/scaffold-project.flow`                                  |
| Orchestration scaffolding | `control/`, `manifest.template.json`, attempt-close rituals   | None — flow is the whole contract                                  |
| Baseline prompt           | `codex-alone-baseline.md`                                     | Absent by design                                                   |
| Gate enforcement          | `export gates crm_ship_gates()` in `libraries/quality.flow`   | `export gates ship_gates()` in `libraries/run-acceptance.flow`     |
| CRUD generation           | Single backend / frontend macro prompts                       | `foreach entity in ...` over `libraries/generate-crud-entity.flow` |
| Agent-neutrality          | Prompts mention `Use agent: X` names tied to a shared toolkit | Prompts state behavior, not agent identity                         |

## Non-goals

- This pack does not prescribe model choice or runner flags beyond what PL primitives express.
- It does not replace E4 as a comparative baseline; it is a separate lane asserting a different thesis.
- It does not include an evaluation harness. Evaluation belongs under `experiments/results/` at run time.

## Validation (parse-level only)

This PR ships the pack and parse-level verification. It has not been executed live. To confirm the pack parses, run (from repo root, after `npm run build`):

```sh
for f in project.flow phases/discovery.flow phases/build.flow phases/release.flow \
         libraries/scaffold-project.flow libraries/generate-crud-entity.flow \
         libraries/run-acceptance.flow libraries/git-commit.flow libraries/install-dependencies.flow; do
  node -e "const {parseFlow}=require('./dist/application/parse-flow.js'); parseFlow(require('fs').readFileSync('experiments/full-saas-factory/e6-pl-crm-factory/' + process.argv[1], 'utf8')); console.log('OK', process.argv[1]);" "$f"
done
```

`scripts/eval/smoke-test.mjs` includes test `AZ` which performs a design-scope toy-slice invocation of `project.flow` and asserts `workspace/crm-app/` contains at least three files after the run. That test is **design scope only** — present in the suite but intentionally not on the default hot path pending live-runtime support.

## Runtime caveat

This factory still requires a capable agent runtime (model + tool access sufficient to write files, run commands, commit code) to actually ship software. The PL pack defines the structure and gates; the runtime supplies the execution. Missing-runtime behavior surfaces as gate failures, not as silent drift.
