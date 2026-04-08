# Helpdesk SDLC Starter

A second bounded product experiment for `prompt-language`, this time targeting a helpdesk / ticketing system instead of a CRM.

The purpose is to test whether the same multi-file orchestration style generalizes to a different class of business software: queue-based support workflows rather than relationship and pipeline workflows.

## What this starter is trying to prove

- the same orchestration surface can drive a second bounded product without collapsing into product-specific one-offs
- `prompt-language` can coordinate discovery, requirements, architecture, implementation, QA, demo generation, and release prep for a helpdesk MVP
- MQM and demo-machine outputs can remain first-class artifacts in a different product shape
- the reusable library pattern is still coherent when the domain changes from CRM to support operations

## Stack assumptions

This starter assumes the target repo already has access to:

- `prompt-language`
- `skill-harness`
- `noslop`
- `manual-qa-machine` (`mqm`)
- `demo-machine`
- Claude Code or Codex CLI with full tool access

The prompts deliberately reference shared agents and skills from `skill-harness`. Those are harness conventions executed by Claude/Codex, not built-in prompt-language keywords.

## Folder layout

```text
examples/helpdesk-sdlc/
  README.md
  project.flow
  libraries/
    discovery.flow
    architecture.flow
    implementation.flow
    quality.flow
    release.flow
  qa-flows/
    helpdesk-smoke.json
  demo/
    helpdesk.demo.yaml
  docs/
    experiment-plan.md
    bead-helpdesk-sdlc-experiment.md
```

## Validate the coordinator flow

```bash
npx @45ck/prompt-language validate --file examples/helpdesk-sdlc/project.flow
```

## Product under test

A bounded helpdesk MVP for small service teams with:

- auth
- requesters / customers
- tickets
- queue / inbox views
- assignments
- status and priority updates
- internal notes
- canned replies
- dashboard reporting

## Why this is a useful comparison

CRM and helpdesk software share broad SaaS delivery traits, but the operational core differs:

- CRM centers relationship and pipeline progression
- helpdesk centers triage, queues, ticket state, assignment, and response handling

That makes this a better generalization test than simply cloning the CRM experiment with minor wording changes.
