# GSLR-7 Local Scaffolded Route-Record Result: 2026-05-13

Status: live local evidence, negative generalization result  
Tracking bead: `prompt-language-gslr22`  
Companion Portarium bead: `bead-1247`

## Question

Does the GSLR-6 scaffold pattern generalize from a sanitizer helper contract to
a different static task: building a route-decision record from manifest-like
evidence?

## Runs

Durable run roots:

- v1:
  `/tmp/prompt-language-gslr7-live/gslr7-scaffolded-route-record-live-2026-05-13-01-local-repeat`
- v2:
  `/tmp/prompt-language-gslr7-live/gslr7-scaffolded-route-record-live-2026-05-13-v2-01-local-repeat`

## Result

Both local attempts failed before an N=3 repeat set was justified.

| Attempt | Final verdict | Private oracle | Failure boundary                         | Frontier tokens | Step wall time |
| ------- | ------------- | -------------- | ---------------------------------------- | --------------- | -------------- |
| v1      | fail          | fail           | `selectedRoute.arm` was missing          | 0               | 77.160s        |
| v2      | fail          | fail           | `oracle command` unsafe key was accepted | 0               | 82.961s        |

Each attempt recorded before/after local resource snapshots for `local-bulk`.

## Interpretation

GSLR-7 is a useful negative result.

The GSLR-6 scaffold pattern did not automatically generalize to a route-record
builder. The local model again made errors that matter for a governed
engineering system:

- v1 missed a required output subfield inside `selectedRoute`;
- v2 kept forbidden key constants in unnormalized form, so
  separator-insensitive matching failed for `oracle command`.

The second failure is especially important because it repeats the GSLR-5R class:
the model can write a normalization helper but still compare normalized input
against unnormalized policy constants.

## Decision

Do not promote `gslr7-scaffolded-route-record` to `local-screen`.

Treat it as `frontier-baseline` or advisor-required until the reusable
local-screen scaffold template prevents unnormalized policy tables and required
output-field omissions mechanically.

## Next Move

The next engineering-system primitive should not be another hand-tuned prompt.
It should generate more of the scaffold deterministically:

- normalized policy sets should be provided by the fixture, not reauthored by
  the local model;
- required output envelope construction should be deterministic;
- the local model should fill only small decision predicates;
- Codex/frontier should diagnose the first failure and patch the scaffold or
  route to frontier, rather than retrying blind local generation.

## Product Boundary

Portarium runtime ingestion remains blocked.

Live Cockpit cards remain blocked.

MacquarieCollege connector/raw school-data movement remains blocked.
