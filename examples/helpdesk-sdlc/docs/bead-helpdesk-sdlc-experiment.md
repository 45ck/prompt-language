# Bead: run the Helpdesk SDLC starter as a real thesis experiment

## Outcome

Run the multi-file Helpdesk SDLC starter in a real target repo and determine whether `prompt-language` can act as the primary engineering surface for a second bounded product lifecycle, not just the CRM case.

## Why this matters

A single successful product starter could still be a one-off. This bead tests whether a similar orchestration surface can coordinate a different class of product centered on queues, ticket state, and assignment workflows.

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
- advanced helpdesk capabilities outside the bounded MVP
- generalizing the starter before the first real run is complete

## Inputs

- `examples/helpdesk-sdlc/project.flow`
- imported flows under `examples/helpdesk-sdlc/libraries/`
- `examples/helpdesk-sdlc/qa-flows/helpdesk-smoke.json`
- `examples/helpdesk-sdlc/demo/helpdesk.demo.yaml`
- a clean target repo with the 45ck stack available

## Steps

1. Create or select a clean target repo for the experiment.
2. Copy or adapt `examples/helpdesk-sdlc/` into that repo.
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
- generated helpdesk implementation
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
- compare the helpdesk run directly against the CRM run
- run the same starter shape on a third bounded product such as booking software
- convert recurring failures into reusable library improvements
