# GSLR-1: MC Projection Governed Hybrid Routing

Date: 2026-05-12
Status: live result recorded; hybrid thesis not proven
Tracking bead: `prompt-language-gslr1`
Parent bead: `prompt-language-sfd3`
Live result: `experiments/harness-arena/results/gslr1-live-2026-05-12/report.md`

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
- review defects and manifest-level `finalVerdict`.

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

This experiment is now live-model evidence for the harness, but not positive
evidence for the hybrid cost-routing thesis.

The 2026-05-12 live run showed:

- `local-only` passed the private oracle with zero frontier calls;
- `frontier-only` passed with one frontier call;
- `advisor-only` passed after an oracle-calibration rerun;
- `hybrid-router` passed the private oracle but produced an unresolved blocking
  frontier-review finding;
- `hybrid-router` used more frontier calls and observed frontier tokens than the
  `frontier-only` control.

Follow-up: the post-GSLR-1 harness now records a manifest-level
`finalVerdict` and promotes Codex-style `tokens used` telemetry into step cost
fields for new runs. Next step is a harder GSLR-2 task before any Portarium
product card.
