# Full-Stack CRUD Comparison

Status: designed, not yet executed

This experiment is the next best test of the local-model prompt-language thesis.
It asks a direct question:

Can the same local model build a more complete full-stack CRUD app when controlled by
a prompt-language factory flow than when given a direct solo prompt?

## Why This Exists

Existing evidence is useful but incomplete:

- E4 shows direct Codex is faster for a bounded CRM slice, while prompt-language is
  better for governed factory quality and auditability.
- E7-MK shows retry-with-validation removes low-salience requirement misses.
- Aider Phase 1 suggests prompt-language helps local models on gate-heavy tasks, but
  the older H1-H10 evidence is not claim-eligible.
- Senior Pairing Protocol tests metacognitive supervision on a small bug task, not a
  full-stack app.

This experiment closes that gap by testing the user's concrete hypothesis:
"build a full-stack CRUD app for a domain" with and without prompt-language control.

## Primary Hypothesis

Prompt-language will improve local-model full-stack CRUD delivery when the target has
multiple entities, deterministic gates, and explicit cross-layer contracts.

Expected advantage:

- more complete CRUD coverage
- fewer missing low-salience requirements
- better traceability from requirement to route, UI, test, and verification artifact
- stronger recovery from failing gates

Not expected:

- lower wall-clock time
- lower local GPU time
- better first-pass output on trivial slices

Runtime is telemetry only. Local inference is allowed to be slow.

## Arms

| Arm                     | Runner                                                  | Model                                  | Purpose                                                                     |
| ----------------------- | ------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------- |
| `solo-local-crud`       | aider or prompt-language `--runner aider` direct prompt | local Ollama model                     | Baseline: direct "build the app" prompt                                     |
| `pl-local-crud-factory` | prompt-language flow                                    | same local Ollama model                | Treatment: phase, gate, retry, review, and verification control             |
| `pl-local-senior-crud`  | prompt-language flow                                    | same local Ollama model                | Optional later arm: senior pairing metacognition plus factory gates         |
| `hybrid-router-crud`    | prompt-language flow                                    | local default plus frontier escalation | Later arm: local bulk work, external model only for policy-triggered review |

Run the first claim attempt with only `solo-local-crud` and
`pl-local-crud-factory`. Add the senior and hybrid arms only after the baseline
comparison is clean.

## Task

The seed task is `FSCRUD-01`: a field-service work order tracker.

It is intentionally not CRM, because CRM has already appeared in several factory
experiments. The app still requires the same engineering muscles: domain modeling,
CRUD, ownership, validation, UI flows, tests, and verification.

See [tasks/fscrud-01-field-service-work-orders.md](tasks/fscrud-01-field-service-work-orders.md).

## Current Decision

The next work item is to implement the runner harness for this pack, then run one
paired smoke pair:

1. `solo-local-crud`, repeat `r01`
2. `pl-local-crud-factory`, repeat `r01`

Only after both arms produce artifacts under the same frozen commit should we scale to
`k=3` paired runs.
