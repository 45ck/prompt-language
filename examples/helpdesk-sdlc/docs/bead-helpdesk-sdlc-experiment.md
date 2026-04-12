# Bead: run the Helpdesk SDLC starter as a real thesis experiment

## Outcome

Run the multi-file Helpdesk SDLC starter in a real target repo and determine whether `prompt-language` can act as the primary engineering surface for a second bounded product lifecycle, not just the CRM case.

## Why this matters

A single successful product starter could still be a one-off. This bead tests whether a similar orchestration surface can coordinate a different class of product centered on queues, ticket state, and assignment workflows.

This bead now has a narrower execution lane as well: prove the starter on the hosted OpenCode baseline first, and only compare against a free-model lane if that host already exists.

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
- phased lower-cost runner execution using temporary phase fixtures
- retrospective notes on what worked and what failed

Out of scope:

- production deployment
- polished branding beyond what the demo needs
- advanced helpdesk capabilities outside the bounded MVP
- generalizing the starter before the first real run is complete
- claiming that the unchanged `project.flow` already supports end-to-end headless execution

## Inputs

- `examples/helpdesk-sdlc/project.flow`
- imported flows under `examples/helpdesk-sdlc/libraries/`
- `examples/helpdesk-sdlc/qa-flows/helpdesk-smoke.json`
- a clean target repo with the 45ck stack available
- the phased run plan in `examples/helpdesk-sdlc/docs/experiment-plan.md`

## Required lane and optional lane

Required lane:

- `--runner opencode --model opencode/gpt-5-nano`

Optional lane:

- `--runner opencode --model ollama/gemma4:e2b` only on a host that already has the free-model environment provisioned

Do not treat the optional lane as a substitute for the required hosted baseline.

## Steps

1. Confirm the OpenCode smoke/eval baseline has already cleared the hosted baseline for cheap starter experiments.
2. Create or select a clean target repo for the experiment.
3. Copy or adapt `examples/helpdesk-sdlc/` into that repo.
4. Validate `project.flow` and capture the expected headless blocker caused by `approve`.
5. Prepare the three temporary phase fixtures described in `experiment-plan.md`.
6. Run phase 1 on the required hosted baseline.
7. Review the scope pack at the first approval boundary.
8. Run phase 2 on the required hosted baseline.
9. Review QA and demo outputs at the second approval boundary.
10. Run phase 3 on the required hosted baseline.
11. Run the optional free-model lane only if a pre-provisioned host already exists.
12. Collect the evidence pack and write the retrospective.

Use the maintainer run packet while executing:

- `examples/helpdesk-sdlc/docs/execution-template-checklist.md`

## Acceptance

The bead is accepted when all of the following exist in the target repo or evidence pack:

- PRD and research docs
- architecture and domain model docs
- generated helpdesk implementation
- passing lint, typecheck, and tests
- MQM smoke flow plus at least one executed QA report
- validated demo spec and ideally a rendered demo output
- release / handover docs
- runner JSON output for each executed phase
- captured evidence that the unchanged coordinator was blocked by `approve` in headless mode
- intervention log and retrospective

## Evidence to collect

- validate output for the unchanged `project.flow`
- runner JSON output per phase and lane
- repo tree snapshot
- key generated docs
- gate outputs
- MQM report paths
- demo output paths
- list of manual interventions
- final assessment: thesis strengthened / mixed / weakened

## Done definition

Done means the experiment was actually run and assessed through the phased lower-cost protocol. Merely committing the starter files or the experiment plan does not complete this bead.

## Possible follow-up beads

- compare against a baseline conversational run
- compare the helpdesk run directly against the CRM run
- run the same starter shape on a third bounded product such as booking software
- convert recurring failures into reusable library improvements
- refactor the starter so approval boundaries can be segmented cleanly without temporary phase fixtures
