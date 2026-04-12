# E4 Codex CRM Factory

This experiment turns E4 into a repo-local, bounded CRM factory run inside this repository.

The goal is not to prove a generic "software factory." The goal is to compare two concrete execution lanes against the same CRM MVP scope:

- `codex-alone`: Codex receives only the frozen task prompt, workspace, and prior artifacts.
- `codex+prompt-language`: Codex is driven through the same task using the prompt-language flow pack in this folder.

## Hypothesis

`prompt-language` improves bounded product delivery when Codex is asked to build a CRM MVP with limited starting context, because the flow pack supplies explicit phase structure, parallel seams, verification gates, and artifact requirements that Codex-alone must reconstruct ad hoc.

## Product Scope

The target product is a bounded CRM MVP with:

- auth
- contacts
- companies
- opportunities and pipeline stages
- tasks
- notes and activities
- dashboard reporting

## Layout

```text
experiments/full-saas-factory/e4-codex-crm-factory/
  README.md
  project.flow
  phases/
    phase-1-discovery.flow
    phase-2-build.flow
    phase-3-release.flow
  codex-alone-baseline.md
  manifest.template.json
  workspace/
    crm-app/
      README.md
```

## Workspace Boundary

The generated product should live under:

`experiments/full-saas-factory/e4-codex-crm-factory/workspace/crm-app/`

Treat that directory as the target repo root for the experiment. Product outputs should land there under normal delivery paths like:

- `docs/`
- `specs/`
- `apps/web/`
- `packages/api/`
- `qa-flows/`
- `qa-reports/`
- `demo/`
- `artifacts/demo/`

Do not count starter files under `examples/crm-sdlc/` as experiment output.

## Candidates

### Candidate A: `codex-alone`

Use the phase prompts in [codex-alone-baseline.md](./codex-alone-baseline.md) and do not use prompt-language to orchestrate the run.

### Candidate B: `codex+prompt-language`

Use:

- [project.flow](./project.flow) for a single non-approval coordinator
- [phases/phase-1-discovery.flow](./phases/phase-1-discovery.flow), [phases/phase-2-build.flow](./phases/phase-2-build.flow), and [phases/phase-3-release.flow](./phases/phase-3-release.flow) for the canonical phased protocol

The flow pack reuses the existing CRM starter libraries under `examples/crm-sdlc/libraries/`.

## Run Contract

Freeze these before each run:

- runner: `codex`
- model
- package manager
- scope
- workspace root
- run id

Store the evidence pack under:

`experiments/results/e4-factory/<run-id>/`

## Attempt Closure

No E4 attempt is considered complete just because the model run ended.

Close every attempt with:

- `manifest.json` updated to a final `status` / `verdict`
- `outcome.md`
- `postmortem.md`
- `interventions.md`
- comparison update in `experiments/results/e4-factory/comparison.md`

This applies to success, partial success, failure, and aborts.

## Minimum Success Criteria

- a working repo-local CRM app exists in the workspace
- the required docs pack exists
- core CRM journeys pass at least a smoke level
- product verification passes in the workspace
- QA and demo artifacts exist
- the evidence pack is complete enough to distinguish planning from execution

## Required Verification

Inside the workspace, run:

```sh
npm run lint
npm run typecheck
npm run test
```

In this repo, before claiming the experiment pack itself is ready, run:

```sh
npm run format:check && npm run lint && npm run spell
npm run typecheck && npm run test
```

Run `npm run ci` before claiming the repo changes are complete.

Run `npm run eval:smoke` only if the experiment prep changes runtime, hook, parsing, advancement, or state-transition behavior.
