# GSLR-1: MC Projection Governed Hybrid Routing

Date: 2026-05-12
Status: scaffold ready; live model run not started
Tracking bead: `prompt-language-gslr1`
Parent bead: `prompt-language-sfd3`

## Purpose

GSLR-1 is the smallest useful experiment for the governed-Symphony local-routing
idea. It does not try to prove that local models can own engineering work end to
end. It tests whether a Prompt Language harness can represent one Portarium-style
engineering bead across local, frontier, advisor-only, and governed-hybrid arms
with enough evidence to compare correctness, cost, and route discipline.

The first task is intentionally a no-mutation MacquarieCollege projection task:
convert a vertical-specific architecture note into a refs-only Portarium evidence
envelope. That keeps the experiment realistic without giving any agent source
system access or raw school data.

## Claim Under Test

For one bounded documentation/projection bead, a governed hybrid route can:

- keep local work inside a narrow model-visible fixture;
- use deterministic gates to catch unsafe or incomplete output;
- use frontier calls only for classification, escalation, repair, or review;
- produce a manifest that separates model failure, routing-policy failure, and
  harness failure;
- use fewer frontier calls than frontier-only while matching or beating
  local-only correctness.

## Arms

| Arm             | Meaning for GSLR-1                                                      |
| --------------- | ----------------------------------------------------------------------- |
| `local-only`    | Local model writes the projection under public gates only.              |
| `frontier-only` | Frontier model owns the whole projection and review.                    |
| `advisor-only`  | Frontier writes advice or review; local model performs all edits.       |
| `hybrid-router` | Frontier classifies/reviews; local handles bulk work unless gates fail. |

Advisor-only is a control, not the desired architecture. The real thesis needs a
parent-owned route decision, not free-form advice that a local worker may ignore.

## Fixture

Fixture path:

```text
experiments/harness-arena/fixtures/gslr1-mc-doc-projection/
```

Model-visible files:

- `TASK.md` gives the projection objective and hard boundaries.
- `README.md` explains the fixture.
- `src/source-projection.md` contains a sanitized architecture excerpt.
- `src/expected-envelope-checklist.md` defines the required refs-only envelope.
- `test/public-gate.mjs` is the public deterministic gate.

The fixture contains no student records, no real connector payloads, no
credentials, no hidden oracle, and no source-system write capability.

## Run Shape

Dry structure check:

```sh
node experiments/harness-arena/runner.mjs \
  --dry-run \
  --fixture experiments/harness-arena/fixtures/gslr1-mc-doc-projection \
  --task-id GSLR-1-mc-doc-projection \
  --run-id gslr1-structure
```

Fake-live harness check:

```sh
node experiments/harness-arena/runner.mjs \
  --fake-live \
  --fixture experiments/harness-arena/fixtures/gslr1-mc-doc-projection \
  --task-id GSLR-1-mc-doc-projection \
  --run-id gslr1-fake-live \
  --frontier-call-limit 4 \
  --usd-limit 1 \
  --wall-seconds-limit 300
```

Live commands must be operator supplied. Do not put private oracle text, hidden
grading logic, or frontier-written answers into the model-visible fixture.

## Evidence Requirements

Each live arm must commit or archive:

- `hybrid-routing-manifest.json`;
- stdout and stderr artifacts for every lane;
- final projection artifact;
- public gate result;
- private oracle result, stored outside model-visible input;
- route decision and trigger per step;
- actual model/provider/endpoint metadata;
- frontier-call count and budget status;
- review defects and final verdict.

## Verdict Rules

The result supports the architecture only if `hybrid-router`:

- passes the deterministic and private gates;
- records complete manifest metadata;
- uses fewer frontier calls than `frontier-only`;
- matches or beats `local-only` on oracle result;
- has no unresolved final-review defects.

The result does not support the architecture if the hybrid arm succeeds only by
leaking frontier answers into local-only work, hiding oracle text in prompts,
omitting route metadata, or relying on a human to silently repair the artifact.

## Current Conclusion

This scaffold proves only that the experiment is now executable and evidence
shaped. It does not prove cost savings, local-model capability, or Portarium
integration. The next claim-grade step is a live run across all four arms using
the same fixture and locked gates.
