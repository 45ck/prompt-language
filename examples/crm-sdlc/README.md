# CRM SDLC Starter

This starter treats `prompt-language` as the orchestration layer for a bounded end-to-end software delivery experiment.

The intent is to test whether a multi-file prompt-language project can coordinate discovery, requirements, architecture, implementation, QA, demo generation, and release preparation for a realistic but bounded product: a CRM MVP.

## What this starter is trying to prove

- multi-file prompt-language can express a real SDLC, not just a single repair loop
- skills and shared agents can be invoked from `prompt:` steps while prompt-language supplies state, reviews, approvals, gates, and parallel workers
- manual QA and demo artifacts can be first-class outputs of the same orchestration layer
- bounded product delivery can be expressed primarily in `.flow` files plus QA/demo specs

## Stack assumptions

This starter assumes the target repo already has access to the broader 45ck workflow stack:

- `prompt-language`
- `skill-harness`
- `noslop`
- `manual-qa-machine` (`mqm`)
- `demo-machine`
- Claude Code or Codex CLI with full tool access

The prompts in this starter deliberately reference shared agents and skills from `skill-harness`. Those are harness conventions executed by Claude/Codex, not built-in prompt-language keywords.

## Folder layout

```text
examples/crm-sdlc/
  README.md
  project.flow
  libraries/
    discovery.flow
    architecture.flow
    implementation.flow
    quality.flow
    release.flow
  qa-flows/
    crm-smoke.json
  demo/
    crm.demo.yaml
```

## Validate the coordinator flow

The repo ships a stable validate command. Use it to parse, lint, score, and preview the coordinator before running the experiment:

```bash
npx @45ck/prompt-language validate --file examples/crm-sdlc/project.flow
```

## How to use it

This repo currently has a clear shipped `validate` path. Treat this starter as a validateable, importable SDLC scaffold that you run through the normal runtime + harness loop inside a real project context.

A practical experiment run looks like this:

1. Copy `examples/crm-sdlc/` into a target repo.
2. Adjust the prompts for your actual product, stack, package manager, and domain.
3. Validate the coordinator flow.
4. Start the runtime in Claude Code or Codex CLI with the target repo context loaded.
5. Let `project.flow` orchestrate the experiment, approving checkpoints when requested.
6. Inspect the resulting docs, generated product code, QA reports, and demo artifacts.

## What the flow writes

The example folder contains the orchestration source files. The experiment itself is expected to write product outputs into the target repo, for example:

- `docs/prd.md`
- `docs/research/*`
- `docs/architecture/*`
- `docs/api-contracts.md`
- `docs/data-model.md`
- `specs/domain-glossary.md`
- `specs/invariants.md`
- generated application code under `apps/` and `packages/`
- `qa-reports/*`
- `artifacts/demo/output.mp4`

## Success criteria for the experiment

The run is considered successful if it produces:

- a coherent bounded CRM scope
- implementation artifacts aligned to that scope
- passing lint, typecheck, and test gates
- an executable MQM flow for the main CRM smoke path
- a runnable demo-machine spec and rendered product demo
- release-oriented handover docs

## Why the paths are split this way

The flow source, demo spec, and QA spec stay under `examples/crm-sdlc/` so the starter remains self-contained and versionable inside this repo.

The generated product outputs intentionally land in the target repo root (`docs/`, `apps/`, `packages/`, `artifacts/`, `qa-reports/`) because those are the real delivery artifacts being evaluated.
