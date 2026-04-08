# Bead: run the CRM SDLC starter as a real thesis experiment

## Outcome

Run the multi-file CRM SDLC starter in a real target repo and determine whether `prompt-language` can act as the primary engineering surface for a bounded product lifecycle.

## Why this matters

The core thesis is larger than repair loops and gate enforcement. This bead tests whether a bounded product can be coordinated through `.flow` files, imported libraries, approvals, reviews, QA flows, and demo specs with code as the downstream artifact.

## Scope

In scope:

- discovery
- requirements
- architecture
- implementation
- local verification
- evidence-based QA via MQM
- demo generation via demo-machine
- release-prep / handover docs
- retrospective notes on what worked and what failed

Out of scope:

- production deployment
- polished branding beyond what the demo needs
- advanced CRM capabilities outside the bounded MVP
- generalizing the starter before the first real run is complete

## Inputs

- `examples/crm-sdlc/project.flow`
- imported flows under `examples/crm-sdlc/libraries/`
- `examples/crm-sdlc/qa-flows/crm-smoke.json`
- `examples/crm-sdlc/demo/crm.demo.yaml`
- a clean target repo with the 45ck stack available

## Steps

1. Create or select a clean target repo for the experiment.
2. Copy or adapt `examples/crm-sdlc/` into that repo.
3. Validate `project.flow`.
4. Run the structured experiment with full tool access.
5. Approve only at the two intended checkpoints.
6. Let the run complete through QA and demo generation.
7. Collect the evidence pack.
8. Write a short retrospective against the success and failure criteria.

## Acceptance

The bead is accepted when all of the following exist in the target repo or evidence pack:

- PRD and research docs
- architecture and domain model docs
- generated CRM implementation
- passing lint, typecheck, and tests
- MQM smoke flow plus at least one executed QA report
- validated demo spec and ideally a rendered demo output
- release / handover docs
- intervention log and retrospective

## Evidence to collect

- repo tree snapshot
- key generated docs
- gate outputs
- MQM report paths
- demo output paths
- list of manual interventions
- final assessment: thesis strengthened / mixed / weakened

## Done definition

Done means the experiment was actually run and assessed. Merely committing the starter files does not complete this bead.

## Possible follow-up beads

- compare against a baseline conversational run
- run the same starter on a second bounded product
- convert recurring failures into reusable library improvements
- identify which parts deserve first-class language/runtime features
