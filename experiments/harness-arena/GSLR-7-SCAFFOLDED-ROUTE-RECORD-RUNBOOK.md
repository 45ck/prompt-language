# GSLR-7 Scaffolded Route-Record Runbook

Status: live local attempt complete; no route promotion  
Tracking bead: `prompt-language-gslr22`  
Companion Portarium bead: `bead-1247`

## Purpose

GSLR-7 tests whether the GSLR-6 scaffolded local-screen win generalizes beyond
sanitizer predicates.

The fixture asks the local model to complete a static route-decision record
builder. The record converts manifest-like evidence into:

- selected route;
- stable escalation reason codes;
- sanitized evidence refs;
- bounded output fields.

## Hypothesis

GSLR-6 showed that fixed helper boundaries can make a local model reliable for
one privacy-sensitive static sanitizer.

GSLR-7 tests the broader hypothesis:

```text
If PL supplies fixed helper boundaries and hidden-oracle checks, local models can
also build adjacent engineering route records, not only sanitizer predicates.
```

## Helper Boundaries

The fixture exposes these required exports:

- `normalizeRouteKey(value)`
- `isUnsafeEvidenceKey(key)`
- `containsUnsafeEvidenceText(value)`
- `isSafeEvidenceRef(ref)`
- `deriveEscalationReasons(input)`
- `selectRouteDecision(input)`
- `buildRouteDecisionRecord(input)`

## Deterministic Proof

The deterministic fake-live scaffold passes:

```text
experiments/harness-arena/results/gslr7-fake-live-2026-05-13/report.md
```

That proves fixture, public gate, private oracle, and final-verdict wiring only.

## Live Local Result

The live local attempts failed:

```text
experiments/harness-arena/results/gslr7-local-repeat-2026-05-13/report.md
```

| Attempt | Final verdict | Private oracle | Failure boundary                         |
| ------- | ------------- | -------------- | ---------------------------------------- |
| v1      | fail          | fail           | `selectedRoute.arm` was missing          |
| v2      | fail          | fail           | `oracle command` unsafe key was accepted |

## Decision

Do not promote `gslr7-scaffolded-route-record` to local-screen.

The result says the GSLR-6 pattern is promising but not yet a reusable
engineering-system primitive. The next scaffold must make normalized policy
tables and output envelopes deterministic, leaving the local model to fill only
small predicates.

## Product Boundary

Portarium runtime ingestion remains blocked.

Live Cockpit cards remain blocked.

MacquarieCollege connector observation, raw school-data movement, and
source-system reads or writes remain blocked.
