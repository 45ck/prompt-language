# GSLR Policy-Schema Fixture Family Plan

Status: route-policy follow-up after GSLR-4 scaffold
Tracking bead: `prompt-language-gslr8`
Latest live bead: `prompt-language-gslr12`
Latest scaffold bead: `prompt-language-gslr14`
Companion Portarium bead: `bead-1233`

## Decision

GSLR-2 does not promote hybrid routing for tiny schema work. It promotes a more
specific policy:

```text
Use local-only screening for one-file policy/schema tasks with strong public and
private gates. Escalate to advisor-only after the first local failure. Reserve
frontier-only or hybrid review for ambiguity, weak gates, multi-file contracts,
privacy/security sensitivity, or independent governance requirements.
```

The checked-in policy is:

```text
experiments/harness-arena/gslr-policy-schema-routing-policy.v1.json
```

## Why

The hardened GSLR-2 live result showed:

- `local-only` passed with zero frontier tokens;
- `advisor-only` passed with fewer frontier tokens than frontier-only;
- `hybrid-router` passed but used more frontier tokens than frontier-only.

That means the route policy should not blindly add frontier classify/review to
tiny validators. Review is valuable only when the risk justifies it.

## Fixture Family

The next evidence step is a small family, not product integration.

| ID                                | Hypothesis        | Shape                                                          | Why it matters                                      |
| --------------------------------- | ----------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| `gslr3-policy-manifest-transform` | frontier-baseline | One-file transform from route manifest to Portarium card input | Local/advisor failed; frontier passed the transform |
| `gslr4-two-file-validator`        | advisor-only      | Two implementation files plus public tests                     | Tests whether file-count growth needs advice        |
| `gslr5-raw-payload-adversarial`   | frontier-baseline | Subtle raw-payload leakage with misleading safe summaries      | Tests privacy-sensitive ambiguity and local bypass  |

## Current Progress

`gslr3-policy-manifest-transform` now has live evidence:

- `local-only` failed the public gate by accepting an array manifest;
- `advisor-only` failed the public gate by counting frontier wall time as local
  wall time;
- `frontier-only` passed the public gate and private oracle with 33,913 frontier
  tokens.

The route is therefore `frontier-baseline` for this exact transform shape.

`gslr4-two-file-validator` is now scaffolded with deterministic fake-live
evidence only. It has a two-file implementation contract, public gate, private
oracle, deterministic lane, and runbook:

- `experiments/harness-arena/GSLR-4-TWO-FILE-VALIDATOR-RUNBOOK.md`
- `experiments/harness-arena/results/gslr4-fake-live-2026-05-12/report.md`

The GSLR-4 live hypothesis remains `advisor-only`. No route promotion is
available until live model evidence exists.

## Promotion Rule

Do not promote a broad GSLR local route until at least three fixture-family runs
pass with:

- public gate pass;
- private oracle pass;
- `finalVerdict.status == "pass"`;
- no blocking review defects;
- recorded local resource samples when a local lane runs;
- frontier token telemetry when a frontier lane runs.

## Product Boundary

Portarium should not ingest live runner events or build a product evidence card
yet. It can consume this as R&D policy evidence only.

The first product evidence card should wait until the route policy covers more
than one fixture shape and can explain why a bead used local-only, advisor-only,
frontier-only, or hybrid review.
