# Helpdesk SDLC experiment plan

## Experiment name

Multi-file prompt-language helpdesk SDLC experiment

## Purpose

Test whether a bounded software product can be driven primarily from a multi-file `prompt-language` project plus reusable agents, skills, QA specs, and demo specs when the product shape changes from CRM to helpdesk / ticketing.

## Primary hypothesis

A well-structured multi-file prompt-language project can coordinate discovery, requirements, architecture, implementation, QA, demo generation, and release preparation for a bounded helpdesk MVP with less babysitting and better artifact completeness than an unstructured single-thread prompt workflow.

## Secondary hypotheses

1. The same orchestration style generalizes beyond CRM into queue-based support software.
2. `spawn` / `await` still improves throughput when the seams are real: market research, requirements, backend, frontend, docs.
3. `approve` checkpoints still reduce wasted effort at the same two leverage points: after scope synthesis and after QA/demo generation.
4. MQM and demo-machine outputs remain first-class delivery artifacts even when the product is centered on inboxes, queues, and ticket state.
5. The main engineering surface remains `.flow` files, QA flows, and demo specs, with code as a downstream artifact.

## Product under test

A bounded helpdesk MVP for small service teams with:

- auth
- requesters / customers
- tickets
- inbox / queue views
- assignments
- status and priority updates
- internal notes
- canned replies
- dashboard reporting

## Inputs

- `examples/helpdesk-sdlc/project.flow`
- imported library flows under `examples/helpdesk-sdlc/libraries/`
- `examples/helpdesk-sdlc/qa-flows/helpdesk-smoke.json`
- `examples/helpdesk-sdlc/demo/helpdesk.demo.yaml`
- Claude Code or Codex CLI with full repo tool access
- 45ck stack available in the target repo: `skill-harness`, `noslop`, `manual-qa-machine`, `demo-machine`

## Execution shape

### Run A - structured experiment

Run the helpdesk project through the multi-file prompt-language starter in a clean target repo.

### Optional Run B - baseline

Attempt the same helpdesk MVP using a normal long-form prompt or loose conversational orchestration without the multi-file flow structure.

The baseline is optional but strongly preferred if you want comparative evidence rather than a single success story.

## Success criteria

The experiment is a success if the structured run produces all of the following:

1. `docs/prd.md`
2. `docs/research/competitors.md`
3. `docs/architecture/domain-model.md`
4. `docs/api-contracts.md`
5. coherent generated helpdesk implementation under the target repo
6. passing lint, typecheck, and tests
7. a runnable MQM smoke flow for the main helpdesk path
8. a rendered demo-machine output or at minimum a validated demo spec
9. release / handover documents
10. evidence that the human checkpoints happened at the correct points

## Failure criteria

The experiment fails if one or more of the following occur:

- the flow stalls repeatedly and requires heavy manual rescue
- workers produce artifacts that drift from the bounded helpdesk scope
- backend and frontend branches cannot be integrated cleanly
- QA or demo generation is not grounded enough to run or validate
- the project completes only by bypassing real gates
- the resulting artifacts are not materially better than a simple one-shot prompt workflow

## What to measure

### Quantitative

- number of human interventions required
- number of approval checkpoints used
- total major artifacts produced
- gate pass / fail counts
- whether MQM validated and executed
- whether demo-machine validated and rendered

### Qualitative

- scope discipline
- clarity of the architecture and traceability docs
- stability of automation hooks / selectors
- coherence between PRD, architecture, implementation, QA flow, and demo flow
- how much the engineer edited `.flow` files vs. patching downstream code by hand

## Review questions

After the run, answer these:

1. Did prompt-language actually reduce babysitting?
2. Did multi-file composition help, or was it mostly ceremony?
3. Were the worker seams real enough to justify `spawn`?
4. Did MQM and demo-machine feel naturally integrated, or bolted on?
5. If recurring failures happened, were they better fixed in `.flow` files or in the generated code?
6. Does the same orchestration surface still feel right when the domain changes from CRM to helpdesk?

## Recommended evidence pack

Capture and keep:

- the final target repo tree
- the generated docs set
- lint / test / typecheck outputs
- MQM report directory
- demo-machine output directory
- notes on interventions and failure points
- a short retrospective comparing expectation vs. result

## Comparison note

This experiment becomes more valuable when compared directly against the CRM starter. The useful question is not only whether helpdesk works, but whether the reusable SDLC shape survives contact with a second bounded product category.
